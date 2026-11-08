export function initialCheckersBoard() {
  const board = Array(64).fill(null);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r * 8 + c] = 'b';
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r * 8 + c] = 'r';
  }
  return board;
}

const colorOf = (piece) => piece ? piece.toLowerCase() : null;
const isKing = (piece) => !!piece && piece !== piece.toLowerCase();
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const directions = (piece) => isKing(piece)
  ? [[-1,-1],[-1,1],[1,-1],[1,1]]
  : (colorOf(piece) === 'r' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);

function rawMoves(board, from, capturesOnly = false) {
  const piece = board[from];
  if (!piece) return [];
  const color = colorOf(piece), r = Math.floor(from / 8), c = from % 8, out = [];
  for (const [dr, dc] of directions(piece)) {
    const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (!inside(r1, c1)) continue;
    const mid = r1 * 8 + c1;
    if (!board[mid] && !capturesOnly) out.push({ from, to: mid, capture: null });
    else if (board[mid] && colorOf(board[mid]) !== color && inside(r2, c2)) {
      const to = r2 * 8 + c2;
      if (!board[to]) out.push({ from, to, capture: mid });
    }
  }
  return out;
}

function allMoves(board, color) {
  const captures = [], regular = [];
  for (let i = 0; i < 64; i++) {
    if (colorOf(board[i]) !== color) continue;
    const moves = rawMoves(board, i, false);
    captures.push(...moves.filter(m => m.capture !== null));
    regular.push(...moves.filter(m => m.capture === null));
  }
  return captures.length ? captures : regular;
}

export function createCheckersState() {
  return { board: initialCheckersBoard(), turn: 'r', chainFrom: null, over: false, winner: null };
}

// Mutates state only when the requested move is legal under the same rules as the client.
export function applyCheckersMove(state, color, from, to) {
  if (state.over) return { ok: false, error: 'La partida ya terminó.' };
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 63 || to < 0 || to > 63) {
    return { ok: false, error: 'Movimiento inválido.' };
  }
  if (color !== state.turn) return { ok: false, error: 'No es tu turno.' };
  if (state.chainFrom !== null && state.chainFrom !== from) return { ok: false, error: 'Debes continuar la captura con la misma ficha.' };
  const piece = state.board[from];
  if (colorOf(piece) !== color) return { ok: false, error: 'La ficha no pertenece a tu reino.' };

  let candidates = rawMoves(state.board, from, false);
  if (state.chainFrom !== null) candidates = candidates.filter(m => m.capture !== null);
  else if (allMoves(state.board, color).some(m => m.capture !== null)) candidates = candidates.filter(m => m.capture !== null);
  const move = candidates.find(m => m.to === to);
  if (!move) return { ok: false, error: 'Movimiento no permitido.' };

  state.board[to] = piece;
  state.board[from] = null;
  if (move.capture !== null) state.board[move.capture] = null;
  const row = Math.floor(to / 8);
  let crowned = false;
  if (!isKing(piece) && ((color === 'r' && row === 0) || (color === 'b' && row === 7))) {
    state.board[to] = color === 'r' ? 'R' : 'B';
    crowned = true;
  }

  let chainFrom = null;
  if (move.capture !== null && !crowned && rawMoves(state.board, to, true).length) {
    chainFrom = to;
  } else {
    const enemy = color === 'r' ? 'b' : 'r';
    const enemyPieces = state.board.some(p => colorOf(p) === enemy);
    if (!enemyPieces || allMoves(state.board, enemy).length === 0) {
      state.over = true;
      state.winner = color;
    } else {
      state.turn = enemy;
    }
  }
  state.chainFrom = chainFrom;
  return { ok: true, move: { from, to, capture: move.capture }, state: publicCheckersState(state) };
}

export function publicCheckersState(state) {
  return {
    board: [...state.board], turn: state.turn, chainFrom: state.chainFrom,
    over: state.over, winner: state.winner
  };
}
