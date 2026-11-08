import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckersState, applyCheckersMove } from '../src/checkers.js';

test('crea una posición inicial de damas con 24 fichas', () => {
  const state = createCheckersState();
  assert.equal(state.board.filter(Boolean).length, 24);
  assert.equal(state.turn, 'r');
});

test('rechaza una jugada fuera de turno', () => {
  const state = createCheckersState();
  const result = applyCheckersMove(state, 'b', 17, 24);
  assert.equal(result.ok, false);
});

test('acepta un movimiento inicial válido de las rojas', () => {
  const state = createCheckersState();
  const result = applyCheckersMove(state, 'r', 40, 33);
  assert.equal(result.ok, true);
  assert.equal(state.turn, 'b');
  assert.equal(state.board[33], 'r');
  assert.equal(state.board[40], null);
});


test('obliga a capturar cuando existe una captura disponible', () => {
  const state = createCheckersState();
  state.board.fill(null);
  state.board[42] = 'r';
  state.board[33] = 'b';
  state.board[47] = 'r';
  const result = applyCheckersMove(state, 'r', 47, 38);
  assert.equal(result.ok, false);
  assert.equal(state.board[47], 'r');
});

test('mantiene el turno durante una captura encadenada', () => {
  const state = createCheckersState();
  state.board.fill(null);
  state.board[42] = 'r';
  state.board[33] = 'b';
  state.board[17] = 'b';
  const first = applyCheckersMove(state, 'r', 42, 24);
  assert.equal(first.ok, true);
  assert.equal(state.turn, 'r');
  assert.equal(state.chainFrom, 24);
  const second = applyCheckersMove(state, 'r', 24, 10);
  assert.equal(second.ok, true);
  assert.equal(state.over, true);
  assert.equal(state.winner, 'r');
});
