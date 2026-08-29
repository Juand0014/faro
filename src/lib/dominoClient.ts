import { dominoConfig, type DominoConfig, type DominoEnd, type DominoRoundResult } from './domino';

export type DominoPublicSeat = {
  seat: number;
  memberId: string | null;
  label: string;
  bot: boolean;
};

export type DominoPublicEvent = {
  seq: number;
  kind: 'deal' | 'play' | 'draw' | 'pass' | 'round';
  seat?: number;
  tile?: number;
  end?: DominoEnd;
};

export type DominoPublicState = {
  version: 1;
  first: string;
  phase: 'lobby' | 'play' | 'between' | 'over';
  config: DominoConfig;
  confirmations: string[];
  seats: DominoPublicSeat[];
  scores: [number, number];
  roundNo: number;
  turnSeat: number | null;
  opener: number | null;
  board: number[];
  ends: [number, number] | null;
  handCounts: number[];
  boneyardCount: number;
  passes: number;
  result: DominoRoundResult | null;
  roundPips: number[] | null;
  winnerTeam: 0 | 1 | null;
  seq: number;
  lastEvents: DominoPublicEvent[];
};

export type DominoAction =
  | { action: 'confirm' | 'snapshot' | 'draw' | 'pass' | 'next_round' }
  | { action: 'play'; tile: number; end: DominoEnd };

export type DominoActionResponse = {
  gameId: string;
  state: DominoPublicState;
  seat: number;
  hand: number[];
};

export function initialDominoLobby(
  first: string,
  configPatch: Partial<DominoConfig> = {},
): DominoPublicState {
  const config = dominoConfig(configPatch);
  return {
    version: 1,
    first,
    phase: 'lobby',
    config,
    confirmations: [],
    seats: [],
    scores: [0, 0],
    roundNo: 0,
    turnSeat: null,
    opener: null,
    board: [],
    ends: null,
    handCounts: Array(config.mode === 'partners' ? 4 : 2).fill(0),
    boneyardCount: 0,
    passes: 0,
    result: null,
    roundPips: null,
    winnerTeam: null,
    seq: 0,
    lastEvents: [],
  };
}

function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

export function isDominoPublicState(value: unknown): value is DominoPublicState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if ('hands' in state || 'boneyard' in state || 'round' in state) return false;
  if (state.version !== 1 || typeof state.first !== 'string') return false;
  if (!['lobby', 'play', 'between', 'over'].includes(String(state.phase))) return false;
  const rawConfig = (state.config as Partial<DominoConfig>) ?? {};
  const config = dominoConfig(rawConfig);
  const configKeys: (keyof DominoConfig)[] = [
    'mode', 'handSize', 'drawFromBoneyard', 'target', 'blockedRule', 'capicuaBonus',
  ];
  if (!configKeys.every((key) => rawConfig[key] === config[key])) return false;
  const seatCount = config.mode === 'partners' ? 4 : 2;
  if (!Array.isArray(state.confirmations) || !state.confirmations.every((id) => typeof id === 'string')) return false;
  if (!Array.isArray(state.seats) || !state.seats.every((seat) => {
    if (!seat || typeof seat !== 'object') return false;
    const item = seat as Record<string, unknown>;
    return integer(item.seat, 0, seatCount - 1)
      && (item.memberId === null || typeof item.memberId === 'string')
      && typeof item.label === 'string'
      && typeof item.bot === 'boolean';
  })) return false;
  if (!Array.isArray(state.scores) || state.scores.length !== 2 || !state.scores.every((score) => integer(score))) return false;
  if (!Array.isArray(state.board) || !state.board.every((tile) => integer(tile, 0, 27))) return false;
  if (!Array.isArray(state.handCounts) || state.handCounts.length !== seatCount
    || !state.handCounts.every((count) => integer(count, 0, 28))) return false;
  if (!(state.ends === null || (Array.isArray(state.ends) && state.ends.length === 2
    && state.ends.every((pip) => integer(pip, 0, 6))))) return false;
  if (!(state.turnSeat === null || integer(state.turnSeat, 0, seatCount - 1))) return false;
  if (!(state.opener === null || integer(state.opener, 0, 27))) return false;
  if (!integer(state.roundNo) || !integer(state.boneyardCount) || !integer(state.passes) || !integer(state.seq)) return false;
  if (!(state.winnerTeam === null || state.winnerTeam === 0 || state.winnerTeam === 1)) return false;
  if (!(state.roundPips === null || (Array.isArray(state.roundPips)
    && state.roundPips.length === seatCount && state.roundPips.every((pips) => integer(pips))))) return false;
  if (!Array.isArray(state.lastEvents) || !state.lastEvents.every((event) => {
    if (!event || typeof event !== 'object') return false;
    const item = event as Record<string, unknown>;
    return integer(item.seq)
      && ['deal', 'play', 'draw', 'pass', 'round'].includes(String(item.kind))
      && (item.seat === undefined || integer(item.seat, 0, seatCount - 1))
      && (item.tile === undefined || integer(item.tile, 0, 27))
      && (item.end === undefined || item.end === 'left' || item.end === 'right');
  })) return false;
  return state.phase === 'lobby'
    ? state.turnSeat === null && state.roundNo === 0 && state.board.length === 0
    : state.seats.length === seatCount && state.confirmations.length === 2;
}
