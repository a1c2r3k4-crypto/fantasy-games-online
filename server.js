import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { Server as SocketServer } from 'socket.io';
import { Chess } from 'chess.js';
import { createCheckersState, applyCheckersMove, publicCheckersState } from './checkers.js';

const PORT = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.CLIENT_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOrigin = allowedOrigins.length ? allowedOrigins : '*';
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: false },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e5
});

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST'], credentials: false }));
app.use(express.json({ limit: '10kb' }));

const rooms = new Map();
const dedicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Vuelve a intentarlo más tarde.' }
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  service: 'Fantasy Games Server',
  activeRooms: rooms.size,
  dedicationConfigured: Boolean(process.env.DEDICATION_PASSWORD_HASH)
}));

app.post('/api/dedication/unlock', dedicationLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const hash = process.env.DEDICATION_PASSWORD_HASH || '';
  if (!hash) return res.status(503).json({ success: false, error: 'La dedicatoria aún no está configurada en el servidor.' });
  if (!password || password.length > 256) return res.status(400).json({ success: false, error: 'Solicitud inválida.' });
  let valid = false;
  try { valid = await bcrypt.compare(password, hash); } catch { valid = false; }
  if (!valid) return res.status(401).json({ success: false, error: 'Clave incorrecta.' });

  const dedication = {
    title: process.env.DEDICATION_TITLE || 'Una dedicatoria especial',
    signature: process.env.DEDICATION_SIGNATURE || '',
    message: process.env.DEDICATION_MESSAGE || ''
  };
  return res.json({ success: true, dedication });
});

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(crypto.randomBytes(6), byte => alphabet[byte % alphabet.length]).join('');
  } while (rooms.has(code));
  return code;
}

function toSquare(index) {
  const files = 'abcdefgh';
  return files[index % 8] + String(8 - Math.floor(index / 8));
}

function leaveRoom(socket, notify = true) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.data.roomCode = null;
  if (!room) return;
  room.players = room.players.filter(id => id !== socket.id);
  socket.leave(code);
  if (notify) socket.to(code).emit('room:opponent-left', { message: 'El otro jugador salió de la sala.' });
  if (room.players.length === 0) rooms.delete(code);
  else room.finished = true;
}

function roomReadyPayload(room, playerId) {
  const color = playerId === room.players[0] ? (room.gameType === 'chess' ? 'w' : 'r') : 'b';
  return {
    roomCode: room.code,
    gameType: room.gameType,
    color,
    chessFen: room.gameType === 'chess' ? room.chess.fen() : null,
    checkers: room.gameType === 'checkers' ? publicCheckersState(room.checkers) : null
  };
}

io.on('connection', socket => {
  socket.data.roomCode = null;
  socket.data.joinAttempts = [];

  socket.on('room:create', (payload = {}, ack = () => {}) => {
    if (socket.data.roomCode) leaveRoom(socket, false);
    const gameType = payload.gameType === 'checkers' ? 'checkers' : 'chess';
    const code = makeRoomCode();
    const room = {
      code, gameType, players: [socket.id], createdAt: Date.now(), finished: false,
      chess: gameType === 'chess' ? new Chess() : null,
      checkers: gameType === 'checkers' ? createCheckersState() : null
    };
    rooms.set(code, room);
    socket.data.roomCode = code;
    socket.join(code);
    ack({ ok: true, code, waiting: true, gameType });
    socket.emit('room:waiting', { code, gameType, message: 'Sala creada. Comparte el código con tu rival.' });
  });

  socket.on('room:join', (payload = {}, ack = () => {}) => {
    const now = Date.now();
    socket.data.joinAttempts = socket.data.joinAttempts.filter(t => now - t < 60_000);
    if (socket.data.joinAttempts.length >= 12) return ack({ ok: false, error: 'Demasiados intentos. Espera un minuto.' });
    socket.data.joinAttempts.push(now);
    const code = String(payload.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || !room) return ack({ ok: false, error: 'No encontramos esa sala. Revisa el código.' });
    if (room.players.length !== 1 || room.finished) return ack({ ok: false, error: 'La sala ya está llena o terminó.' });
    if (socket.data.roomCode) leaveRoom(socket, false);
    room.players.push(socket.id);
    socket.data.roomCode = code;
    socket.join(code);
    ack({ ok: true, code, gameType: room.gameType });
    for (const playerId of room.players) io.to(playerId).emit('room:ready', roomReadyPayload(room, playerId));
  });

  socket.on('game:move', (payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode;
    const room = code && rooms.get(code);
    if (!room || room.players.length !== 2 || room.finished) return ack({ ok: false, error: 'No hay una partida activa.' });
    const color = room.players[0] === socket.id ? (room.gameType === 'chess' ? 'w' : 'r') : room.players[1] === socket.id ? 'b' : null;
    if (!color) return ack({ ok: false, error: 'No perteneces a esta sala.' });

    if (room.gameType === 'chess') {
      const { from, to } = payload;
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 63 || to < 0 || to > 63) return ack({ ok: false, error: 'Movimiento inválido.' });
      if (room.chess.turn() !== color) return ack({ ok: false, error: 'No es tu turno.' });
      try {
        const move = room.chess.move({ from: toSquare(from), to: toSquare(to), promotion: ['q','r','b','n'].includes(payload.promotion) ? payload.promotion : 'q' });
        if (!move) return ack({ ok: false, error: 'Movimiento no permitido.' });
        const response = {
          gameType: 'chess',
          move: { from, to, promotion: move.promotion || null, san: move.san },
          fen: room.chess.fen(), turn: room.chess.turn(),
          over: room.chess.isGameOver(),
          winner: room.chess.isCheckmate() ? (room.chess.turn() === 'w' ? 'b' : 'w') : null,
          draw: room.chess.isDraw()
        };
        ack({ ok: true });
        io.to(code).emit('game:move', response);
        if (response.over) room.finished = true;
      } catch {
        ack({ ok: false, error: 'Movimiento de ajedrez inválido.' });
      }
      return;
    }

    const result = applyCheckersMove(room.checkers, color, payload.from, payload.to);
    if (!result.ok) return ack(result);
    ack({ ok: true });
    io.to(code).emit('game:move', {
      gameType: 'checkers', move: result.move,
      state: result.state
    });
    if (result.state.over) room.finished = true;
  });

  socket.on('game:resign', (ack = () => {}) => {
    const code = socket.data.roomCode;
    const room = code && rooms.get(code);
    if (!room || room.players.length !== 2 || room.finished) return ack({ ok: false, error: 'No hay una partida activa.' });
    const color = room.players[0] === socket.id ? (room.gameType === 'chess' ? 'w' : 'r') : 'b';
    const winner = room.gameType === 'chess' ? (color === 'w' ? 'b' : 'w') : (color === 'r' ? 'b' : 'r');
    room.finished = true;
    ack({ ok: true });
    io.to(code).emit('game:forfeit', { gameType: room.gameType, winner });
  });

  socket.on('room:leave', (ack = () => {}) => {
    leaveRoom(socket, true);
    ack({ ok: true });
  });

  socket.on('disconnect', () => leaveRoom(socket, true));
});

setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) if (room.createdAt < cutoff) rooms.delete(code);
}, 60_000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fantasy Games Server escuchando en el puerto ${PORT}`);
});
