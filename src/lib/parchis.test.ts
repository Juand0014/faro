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
      expect(state.pieceCount).toBe(count);
      expect(state.pieces.a).toEqual(Array(count).fill(-1));
      expect(state.pieces.b).toEqual(Array(count).fill(-1));
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
  });
});

describe('Parchís movement rules', () => {
  it('only takes a piece out of home with a five', () => {
    const state = playing(2);
    expect(legalMoves({ ...state, phase: 'move', dice: 4 }, 'a', 4)).toEqual([]);

    const rolled = rollParchis(state, 'a', 5);
    expect(rolled.state.phase).toBe('move');
    expect(rolled.moves.map((move) => move.to)).toEqual([0, 0]);

    const moved = moveParchis(rolled.state, 'a', 0);
    expect(moved.state.pieces.a[0]).toBe(0);
    expect(globalCell('a', moved.state.pieces.a[0])).toBe(5);
    expect(moved.nextSeat).toBe('b');
  });

  it('uses opposite starts for both players', () => {
    expect(globalCell('a', 0)).toBe(5);
    expect(globalCell('b', 0)).toBe(39);
    expect(globalCell('a', 34)).toBe(39);
    expect(globalCell('b', 34)).toBe(5);
  });

  it('captures on an unsafe square and grants a mandatory +20', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: 3,
      pieces: { a: [7, -1], b: [44, -1] },
    };
    // a progress 10 and b progress 44 both map to global square 15.
    const result = moveParchis(state, 'a', 0);
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
      dice: 1,
      pieces: { a: [6, -1], b: [41, -1] },
    };
    // Both destinations map to safe square 12.
    expect(legalMoves(state, 'a', 1)).toEqual([]);
  });

  it('lets a five capture an opponent on the exiting player’s start', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: 5,
      pieces: { a: [-1, -1], b: [34, -1] },
    };
    const result = moveParchis(state, 'a', 0);
    expect(result.state.pieces.a[0]).toBe(0);
    expect(result.state.pieces.b[0]).toBe(-1);
    expect(result.state.bonus).toBe(20);
  });

  it('blocks passing through any bridge', () => {
    const state: ParchisState = {
      ...playing(4),
      phase: 'move',
      dice: 6,
      pieces: { a: [2, -1, -1, -1], b: [38, 38, -1, -1] },
    };
    // b's bridge is on global 9, four spaces ahead of a.
    expect(legalMoves(state, 'a', 6)).toEqual([]);
  });

  it('forbids making a bridge on the rival start', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: 1,
      pieces: { a: [33, 34], b: [-1, -1] },
    };
    expect(globalCell('a', 34)).toBe(39);
    expect(legalMoves(state, 'a', 1).some((move) => move.piece === 0)).toBe(false);
  });

  it('requires an exact roll to reach goal', () => {
    const exact: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: 1,
      pieces: { a: [PARCHIS_GOAL - 1, -1], b: [-1, -1] },
    };
    expect(moveParchis(exact, 'a', 0).state.pieces.a[0]).toBe(PARCHIS_GOAL);

    const tooFar = { ...exact, dice: 2 };
    expect(legalMoves(tooFar, 'a', 2)).toEqual([]);
  });

  it('grants +10 after reaching goal and wins with every piece home', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'move',
      dice: 1,
      pieces: { a: [PARCHIS_GOAL - 1, PARCHIS_GOAL], b: [-1, -1] },
    };
    const result = moveParchis(state, 'a', 0);
    expect(result.winnerSeat).toBe('a');
    expect(result.state.phase).toBe('over');
    expect(result.state.bonus).toBe(0);
  });

  it('gives another roll after a six but not after the third consecutive six', () => {
    let state: ParchisState = {
      ...playing(2),
      pieces: { a: [0, -1], b: [0, -1] },
    };
    for (let streak = 1; streak <= 3; streak += 1) {
      const rolled = rollParchis(state, 'a', 6);
      const moved = moveParchis(rolled.state, 'a', 0);
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
    const rolled = rollParchis(state, 'a', 4);
    expect(rolled.moves).toEqual([]);
    expect(rolled.nextSeat).toBe('b');
    expect(rolled.state.phase).toBe('roll');
    expect(rolled.state.dice).toBeNull();
  });

  it('ends a bonus chain after four consecutive rewards', () => {
    const state: ParchisState = {
      ...playing(2),
      phase: 'bonus',
      dice: 2,
      bonus: 20,
      bonusChain: 4,
      pieces: { a: [0, -1], b: [54, -1] },
    };
    const result = moveParchis(state, 'a', 0);
    expect(result.state.pieces.b[0]).toBe(-1);
    expect(result.state.bonus).toBe(0);
    expect(result.state.phase).toBe('roll');
    expect(result.nextSeat).toBe('b');
  });
});
