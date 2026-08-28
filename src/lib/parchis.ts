export type ParchisSeat = 'a' | 'b';
export type ParchisPhase = 'roll' | 'move' | 'bonus' | 'over';
export type ParchisPieceCount = 2 | 3 | 4;

export const PARCHIS_GOAL = 75;
export const PARCHIS_SAFE_CELLS = [5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63, 68] as const;

export type ParchisMove = {
  piece: number;
  from: number;
  to: number;
  capture: number | null;
};

export type ParchisLastMove = ParchisMove & {
  seat: ParchisSeat;
  steps: number;
  bonus: 0 | 10 | 20;
};

export type ParchisState = {
  version: 1;
  first: string;
  pieceCount: ParchisPieceCount;
  phase: ParchisPhase;
  dice: number | null;
  sixStreak: number;
  bonus: 0 | 10 | 20;
  bonusChain: number;
  pieces: Record<ParchisSeat, number[]>;
  last: ParchisLastMove | null;
  seq: number;
};

export type ParchisTransition = {
  state: ParchisState;
  nextSeat: ParchisSeat;
  moves: ParchisMove[];
  winnerSeat: ParchisSeat | null;
};

const START: Record<ParchisSeat, number> = { a: 5, b: 39 };
const SAFE = new Set<number>(PARCHIS_SAFE_CELLS);
const MAX_BONUS_CHAIN = 4;

export function otherParchisSeat(seat: ParchisSeat): ParchisSeat {
  return seat === 'a' ? 'b' : 'a';
}

export function parchisSeatFor(first: string, memberId: string): ParchisSeat {
  return first === memberId ? 'a' : 'b';
}

export function initialParchisState(first: string, pieceCount: ParchisPieceCount = 4): ParchisState {
  const count = pieceCount === 2 || pieceCount === 3 || pieceCount === 4 ? pieceCount : 4;
  return {
    version: 1,
    first,
    pieceCount: count,
    phase: 'roll',
    dice: null,
    sixStreak: 0,
    bonus: 0,
    bonusChain: 0,
    pieces: { a: Array(count).fill(-1), b: Array(count).fill(-1) },
    last: null,
    seq: 0,
  };
}

export function isParchisState(value: unknown): value is ParchisState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<ParchisState>;
  const validPieceCount = state.pieceCount === 2 || state.pieceCount === 3 || state.pieceCount === 4;
  const validPosition = (position: unknown) =>
    Number.isInteger(position) && Number(position) >= -1 && Number(position) <= PARCHIS_GOAL;
  const validPieces = (pieces: unknown) =>
    Array.isArray(pieces) && pieces.length === state.pieceCount && pieces.every(validPosition);
  const last = state.last as Partial<ParchisLastMove> | null | undefined;
  const validLast = last === null || Boolean(last && typeof last === 'object'
    && (last.seat === 'a' || last.seat === 'b')
    && Number.isInteger(last.piece) && Number(last.piece) >= 0 && Number(last.piece) < Number(state.pieceCount)
    && validPosition(last.from) && validPosition(last.to)
    && (last.capture === null || (Number.isInteger(last.capture)
      && Number(last.capture) >= 0 && Number(last.capture) < Number(state.pieceCount)))
    && Number.isInteger(last.steps) && Number(last.steps) >= 1 && Number(last.steps) <= 20
    && (last.bonus === 0 || last.bonus === 10 || last.bonus === 20));
  return state.version === 1
    && typeof state.first === 'string'
    && state.first.length > 0
    && validPieceCount
    && (state.phase === 'roll' || state.phase === 'move' || state.phase === 'bonus' || state.phase === 'over')
    && (state.dice === null || (Number.isInteger(state.dice) && Number(state.dice) >= 1 && Number(state.dice) <= 6))
    && Number.isInteger(state.sixStreak) && Number(state.sixStreak) >= 0 && Number(state.sixStreak) <= 3
    && (state.bonus === 0 || state.bonus === 10 || state.bonus === 20)
    && Number.isInteger(state.bonusChain) && Number(state.bonusChain) >= 0 && Number(state.bonusChain) <= MAX_BONUS_CHAIN
    && Boolean(state.pieces)
    && validPieces(state.pieces?.a)
    && validPieces(state.pieces?.b)
    && validLast
    && Number.isInteger(state.seq) && Number(state.seq) >= 0;
}

/** A progress position (0–67) mapped to the shared 68-square track. */
export function globalCell(seat: ParchisSeat, position: number): number | null {
  if (position < 0 || position > 67) return null;
  return ((START[seat] - 1 + position) % 68) + 1;
}

export function isSafeCell(cell: number): boolean {
  return SAFE.has(cell);
}

function occupancy(state: ParchisState, seat: ParchisSeat, cell: number) {
  const mine: number[] = [];
  const enemy: number[] = [];
  const rival = otherParchisSeat(seat);
  state.pieces[seat].forEach((position, index) => {
    if (globalCell(seat, position) === cell) mine.push(index);
  });
  state.pieces[rival].forEach((position, index) => {
    if (globalCell(rival, position) === cell) enemy.push(index);
  });
  return { mine, enemy };
}

function hasBridge(state: ParchisState, cell: number): boolean {
  return (['a', 'b'] as const).some((seat) =>
    state.pieces[seat].filter((position) => globalCell(seat, position) === cell).length >= 2);
}

function destination(position: number, steps: number): number | null {
  if (position === -1) return steps === 5 ? 0 : null;
  if (position === PARCHIS_GOAL) return null;
  const to = position + steps;
  return to <= PARCHIS_GOAL ? to : null;
}

function crossesBridge(state: ParchisState, seat: ParchisSeat, from: number, to: number): boolean {
  if (from < 0) return false;
  const publicEnd = Math.min(to, 67);
  for (let position = from + 1; position <= publicEnd; position += 1) {
    const cell = globalCell(seat, position);
    if (cell !== null && hasBridge(state, cell)) return true;
  }
  return false;
}

function moveForPiece(
  state: ParchisState,
  seat: ParchisSeat,
  piece: number,
  steps: number,
): ParchisMove | null {
  const from = state.pieces[seat][piece];
  const to = destination(from, steps);
  if (to === null) return null;

  if (to >= 68 && to < PARCHIS_GOAL) {
    if (state.pieces[seat].includes(to)) return null;
    if (crossesBridge(state, seat, from, to)) return null;
    return { piece, from, to, capture: null };
  }
  if (to === PARCHIS_GOAL) {
    if (crossesBridge(state, seat, from, to)) return null;
    return { piece, from, to, capture: null };
  }

  const cell = globalCell(seat, to)!;
  const { mine, enemy } = occupancy(state, seat, cell);
  if (mine.length >= 2 || enemy.length >= 2) return null;
  if (crossesBridge(state, seat, from, to)) return null;
  // A bridge on the rival's starting square can freeze a two-player board.
  if (mine.length === 1 && cell === START[otherParchisSeat(seat)]) return null;

  const exitsHome = from === -1 && steps === 5;
  if (enemy.length === 1) {
    if (SAFE.has(cell) && !(exitsHome && cell === START[seat])) return null;
    return { piece, from, to, capture: enemy[0] };
  }
  return { piece, from, to, capture: null };
}

export function legalMoves(state: ParchisState, seat: ParchisSeat, steps?: number): ParchisMove[] {
  const distance = steps ?? (state.phase === 'bonus' ? state.bonus : state.dice);
  if (!distance || state.phase === 'over') return [];
  return state.pieces[seat]
    .map((_, piece) => moveForPiece(state, seat, piece, distance))
    .filter((move): move is ParchisMove => move !== null);
}

function finishTurn(state: ParchisState, seat: ParchisSeat): ParchisTransition {
  const extraRoll = state.dice === 6 && state.sixStreak < 3;
  const nextSeat = extraRoll ? seat : otherParchisSeat(seat);
  return {
    state: {
      ...state,
      phase: 'roll',
      dice: null,
      sixStreak: extraRoll ? state.sixStreak : 0,
      bonus: 0,
      bonusChain: 0,
    },
    nextSeat,
    moves: [],
    winnerSeat: null,
  };
}

export function rollParchis(state: ParchisState, seat: ParchisSeat, dice: number): ParchisTransition {
  if (state.phase !== 'roll') throw new Error('El dado ya fue lanzado.');
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new Error('Dado inválido.');
  const rolled: ParchisState = {
    ...state,
    phase: 'move',
    dice,
    sixStreak: dice === 6 ? Math.min(3, state.sixStreak + 1) : 0,
    bonus: 0,
    bonusChain: 0,
    seq: state.seq + 1,
  };
  const moves = legalMoves(rolled, seat, dice);
  if (!moves.length) return finishTurn(rolled, seat);
  return { state: rolled, nextSeat: seat, moves, winnerSeat: null };
}

export function moveParchis(state: ParchisState, seat: ParchisSeat, piece: number): ParchisTransition {
  if (state.phase !== 'move' && state.phase !== 'bonus') throw new Error('No hay una ficha por mover.');
  const steps = state.phase === 'bonus' ? state.bonus : state.dice;
  if (!steps) throw new Error('Movimiento sin distancia.');
  const move = legalMoves(state, seat, steps).find((candidate) => candidate.piece === piece);
  if (!move) throw new Error('Esa ficha no puede moverse.');

  const rival = otherParchisSeat(seat);
  const pieces = {
    a: [...state.pieces.a],
    b: [...state.pieces.b],
  };
  pieces[seat][piece] = move.to;
  if (move.capture !== null) pieces[rival][move.capture] = -1;

  const won = pieces[seat].every((position) => position === PARCHIS_GOAL);
  const earnedBonus: 0 | 10 | 20 = move.capture !== null ? 20 : move.to === PARCHIS_GOAL ? 10 : 0;
  let next: ParchisState = {
    ...state,
    pieces,
    phase: won ? 'over' : state.phase,
    bonus: 0,
    last: { ...move, seat, steps, bonus: earnedBonus },
    seq: state.seq + 1,
  };
  if (won) {
    return { state: next, nextSeat: seat, moves: [], winnerSeat: seat };
  }

  if (earnedBonus && state.bonusChain < MAX_BONUS_CHAIN) {
    next = {
      ...next,
      phase: 'bonus',
      bonus: earnedBonus,
      bonusChain: state.bonusChain + 1,
    };
    const bonusMoves = legalMoves(next, seat, earnedBonus);
    if (bonusMoves.length) {
      return { state: next, nextSeat: seat, moves: bonusMoves, winnerSeat: null };
    }
  }
  return finishTurn(next, seat);
}
