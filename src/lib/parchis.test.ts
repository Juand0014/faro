import { describe, expect, it } from 'vitest';
import {
  PARCHIS_GOAL,
  globalCell,
  initialParchisState,
  isParchisState,
  legalMoves,
  moveParchis,
  rollParchis,
  type ParchisState,
} from './parchis';

function playing(pieceCount: 2 | 3 | 4 = 4): ParchisState {
  return initialParchisState('player-a', pieceCount);
}

describe('Parchís state', () => {
  it('starts a compact game with the selected number of pieces', () => {
    for (const count of [2, 3, 4] as const) {
      const state = initialParchisState('player-a', count);
      expect(state.version).toBe(2);
      expect(state.pieceCount).toBe(count);
      expect(state.pieces.a).toEqual(Array(count).fill(-1));
      expect(state.pieces.b).toEqual(Array(count).fill(-1));
      expect(state.dice).toBeNull();
      expect(state.remaining).toEqual([]);
      expect(isParchisState(state)).toBe(true);
      expect(JSON.stringify(state).length).toBeLessThan(500);
    }
  });

  it('rejects malformed deserialized states', () => {
    const state = playing();
    expect(isParchisState({ ...state, pieceCount: 8 })).toBe(false);
    expect(isParchisState({ ...state, pieces: { a: [-2, -1], b: [-1, -1] } })).toBe(false);
    expect(isParchisState({ ...state, phase: 'teleport' })).toBe(false);
    expect(isParchisState({ ...state, last: { seat: 'c', piece: 99 } })).toBe(false);
    expect(isParchisState({ ...state, dice: [2, 4], remaining: [6], phase: 'move' })).toBe(false);
    expect(isParchisState({ ...state, dice: [2, 4], remaining: [], phase: 'move' })).toBe(false);
  });
});

describe('Parchís movement rules', () => {
  it('forces a piece out when either die is five', () => {
    const state = playing(2);
    const rolled = rollParchis(state, 'a', [5, 4]);

    expect(rolled.state.phase).toBe('move');
    expect(rolled.state.dice).toEqual([5, 4]);
    expect(rolled.state.remaining).toEqual([5, 4]);
    expect(rolled.moves.map((move) => move.to)).toEqual([0, 0]);
    expect(new Set(rolled.moves.map((move) => move.steps))).toEqual(new Set([5]));

    const moved = moveParchis(rolled.state, 'a', 0, 5);
    expect(moved.state.pieces.a[0]).toBe(0);
    expect(globalCell('a', moved.state.pieces.a[0])).toBe(5);
    expect(moved.state.remaining).toEqual([4]);
    expect(moved.nextSeat).toBe('a');
  });

  it('uses both dice together only to force an exit when they total five', () => {
    const rolled = rollParchis(playing(2), 'a', [2, 3]);
    expect(rolled.moves).toHaveLength(2);
    expect(rolled.moves.every((move) => move.steps === 5)).toBe(true);
    expect(rolled.moves.every((move) => move.consume.length === 2)).toBe(true);

    const moved = moveParchis(rolled.state, 'a', 0, 5);
    expect(moved.state.pieces.a[0]).toBe(0);
    expect(moved.state.remaining).toEqual([]);
    expect(moved.nextSeat).toBe('b');
  });

  it('does not let an active piece avoid a mandatory exit', () => {
    const state = { ...playing(2), pieces: { a: [8, -1], b: [-1, -1] } };
    const rolled = rollParchis(state, 'a', [5, 4]);
    expect(rolled.moves.every((move) => move.from === -1 && move.steps === 5)).toBe(true);
  });

  it('may spend five normally when an own bridge blocks the exit', () => {
    const state = { ...playing(4), pieces: { a: [0, 0, 8, -1], b: [-1, -1, -1, -1] } };
    const rolled = rollParchis(state, 'a', [5, 4]);
    expect(rolled.moves.some((move) => move.piece === 2 && move.steps === 5)).toBe(true);
    expect(rolled.moves.every((move) => move.from !== -1)).toBe(true);
  });

  it('spends each die separately and may move the same piece twice', () => {
    const state = { ...playing(2), pieces: { a: [0, -1], b: [-1, -1] } };
    const rolled = rollParchis(state, 'a', [4, 3]);
    expect(new Set(rolled.moves.map((move) => move.steps))).toEqual(new Set([3, 4]));

    const first = moveParchis(rolled.state, 'a', 0, 4);
    expect(first.state.pieces.a[0]).toBe(4);
    expect(first.state.remaining).toEqual([3]);
    expect(first.state.phase).toBe('move');

    const second = moveParchis(first.state, 'a', 0, 3);
    expect(second.state.pieces.a[0]).toBe(7);
    expect(second.state.remaining).toEqual([]);
    expect(second.nextSeat).toBe('b');
  });

  it('uses opposite starts for both players', () => {
    expect(globalCell('a', 0)).toBe(5);
    expect(globalCell('b', 0)).toBe(39);
    expect(globalCell('a', 34)).toBe(39);
    expect(globalCell('b', 34)).toBe(5);
  });

  it('enters the arrival lane immediately after shared square 68', () => {
    expect(globalCell('a', 63)).toBe(68);
    expect(globalCell('a', 64)).toBeNull();
    expect(globalCell('b', 63)).toBe(34);
    expect(globalCell('b', 64)).toBeNull();

    const state = { ...playing(2), pieces: { a: [63, 0], b: [-1, -1] } };
    const rolled = rollParchis(state, 'a', [1, 4]);
    const entered = moveParchis(rolled.state, 'a', 0, 1);
    expect(entered.state.pieces.a[0]).toBe(64);
    expect(globalCell('a', entered.state.pieces.a[0])).toBeNull();
    expect(entered.state.remaining).toEqual([4]);
  });

  it('captures on an unsafe square and grants a mandatory +20', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: [3, 4],
      remaining: [3],
      pieces: { a: [7, -1], b: [44, -1] },
    };
    // a progress 10 and b progress 44 both map to global square 15.
    const result = moveParchis(state, 'a', 0, 3);
    expect(result.state.pieces.a[0]).toBe(10);
    expect(result.state.pieces.b[0]).toBe(-1);
    expect(result.state.phase).toBe('bonus');
    expect(result.state.bonus).toBe(20);
    expect(result.nextSeat).toBe('a');
  });

  it('does not allow capturing or sharing a safe square with an opponent', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: [1, 4],
      remaining: [1],
      pieces: { a: [6, -1], b: [41, -1] },
    };
    // Both destinations map to safe square 12.
    expect(legalMoves(state, 'a', 1)).toEqual([]);
  });

  it('lets a five capture an opponent on the exiting player’s start', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: [5, 4],
      remaining: [5],
      pieces: { a: [-1, -1], b: [34, -1] },
    };
    const result = moveParchis(state, 'a', 0, 5);
    expect(result.state.pieces.a[0]).toBe(0);
    expect(result.state.pieces.b[0]).toBe(-1);
    expect(result.state.bonus).toBe(20);
  });

  it('blocks passing through any bridge', () => {
    const state: ParchisState = {
      ...playing(4),
      phase: 'move',
      dice: [6, 4],
      remaining: [6],
      pieces: { a: [2, -1, -1, -1], b: [38, 38, -1, -1] },
    };
    // b's bridge is on global 9, four spaces ahead of a.
    expect(legalMoves(state, 'a', 6)).toEqual([]);
  });

  it('forbids making a bridge on the rival start', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: [1, 4],
      remaining: [1],
      pieces: { a: [33, 34], b: [-1, -1] },
    };
    expect(globalCell('a', 34)).toBe(39);
    expect(legalMoves(state, 'a', 1).some((move) => move.piece === 0)).toBe(false);
  });

  it('requires an exact roll to reach goal', () => {
    const exact: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: [1, 4],
      remaining: [1],
      pieces: { a: [PARCHIS_GOAL - 1, -1], b: [-1, -1] },
    };
    expect(moveParchis(exact, 'a', 0, 1).state.pieces.a[0]).toBe(PARCHIS_GOAL);

    const tooFar = { ...exact, dice: [2, 4] as [number, number], remaining: [2] };
    expect(legalMoves(tooFar, 'a', 2)).toEqual([]);
  });

  it('grants +10 after reaching goal and wins with every piece home', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: [1, 4],
      remaining: [1],
      pieces: { a: [PARCHIS_GOAL - 1, PARCHIS_GOAL], b: [-1, -1] },
    };
    const result = moveParchis(state, 'a', 0, 1);
    expect(result.winnerSeat).toBe('a');
    expect(result.state.phase).toBe('over');
    expect(result.state.bonus).toBe(0);
  });

  it('resumes the unused die after resolving a home bonus', () => {
    const state: ParchisState = {
      ...playing(3),
      phase: 'move',
      dice: [1, 4],
      remaining: [1, 4],
      pieces: { a: [PARCHIS_GOAL - 1, 10, 20], b: [-1, -1, -1] },
    };
    const home = moveParchis(state, 'a', 0, 1);
    expect(home.state.phase).toBe('bonus');
    expect(home.state.remaining).toEqual([4]);

    const bonus = moveParchis(home.state, 'a', 1, 10);
    expect(bonus.state.phase).toBe('move');
    expect(bonus.state.remaining).toEqual([4]);
    expect(bonus.moves.every((move) => move.steps === 4)).toBe(true);
  });

  it('gives another roll after doubles but not after the third consecutive double', () => {
    let state: ParchisState = {
      ...playing(2),
      pieces: { a: [0, -1], b: [0, -1] },
    };
    for (let streak = 1; streak <= 3; streak += 1) {
      const rolled = rollParchis(state, 'a', [2, 2]);
      const first = moveParchis(rolled.state, 'a', 0, 2);
      const moved = moveParchis(first.state, 'a', 0, 2);
      if (streak < 3) {
        expect(moved.nextSeat).toBe('a');
        expect(moved.state.phase).toBe('roll');
      } else {
        expect(moved.nextSeat).toBe('b');
      }
      state = moved.state;
      if (streak < 3) state = { ...state, phase: 'roll' };
    }
  });

  it('automatically resolves a roll when no piece can move', () => {
    const state: ParchisState = {
      ...playing(2),
      pieces: { a: [PARCHIS_GOAL, PARCHIS_GOAL], b: [-1, -1] },
    };
    const rolled = rollParchis(state, 'a', [4, 3]);
    expect(rolled.moves).toEqual([]);
    expect(rolled.nextSeat).toBe('b');
    expect(rolled.state.phase).toBe('roll');
    expect(rolled.state.dice).toBeNull();
  });

  it('ends a bonus chain after four consecutive rewards', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'bonus',
      dice: [2, 4],
      remaining: [],
      bonus: 20,
      bonusChain: 4,
      pieces: { a: [0, -1], b: [54, -1] },
    };
    const result = moveParchis(state, 'a', 0, 20);
    expect(result.state.pieces.b[0]).toBe(-1);
    expect(result.state.bonus).toBe(0);
    expect(result.state.phase).toBe('roll');
    expect(result.nextSeat).toBe('b');
  });
});
