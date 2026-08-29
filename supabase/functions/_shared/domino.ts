export type DominoTile = [number, number];
export type DominoMode = 'duel' | 'partners';
export type DominoBlockedRule = 'general' | 'patio';
export type DominoPhase = 'play' | 'over';
export type DominoEnd = 'left' | 'right';
export type DominoSeat = 0 | 1 | 2 | 3;
export type DominoTeam = 0 | 1;

export type DominoConfig = {
  mode: DominoMode;
  handSize: number;
  drawFromBoneyard: boolean;
  target: number;
  blockedRule: DominoBlockedRule;
  capicuaBonus: number;
};

export type DominoPlay = {
  seat: DominoSeat;
  tile: number;
  end: DominoEnd;
};

export type DominoRoundResult = {
  reason: 'domino' | 'blocked';
  winnerSeat: DominoSeat | null;
  winnerTeam: DominoTeam | null;
  tie: boolean;
  pips: number;
  capicua: boolean;
  bonus: number;
  awarded: [number, number];
};

export type DominoRound = {
  hands: number[][];
  boneyard: number[];
  board: number[];
  ends: [number, number] | null;
  opener: number | null;
  turn: DominoSeat;
  lastSeat: DominoSeat | null;
  passes: number;
  phase: DominoPhase;
  result: DominoRoundResult | null;
};

export type DominoMatchState = {
  version: 1;
  config: DominoConfig;
  scores: [number, number];
  roundNo: number;
  starterSeat: DominoSeat;
  round: DominoRound;
  winnerTeam: DominoTeam | null;
  seq: number;
};

export type DominoTransition = {
  state: DominoMatchState;
  nextSeat: DominoSeat;
  result: DominoRoundResult | null;
  winnerTeam: DominoTeam | null;
};

export type DominoView = {
  seat: DominoSeat;
  turn: DominoSeat;
  hand: number[];
  ends: [number, number] | null;
  played: number[];
  handCounts: number[];
  boneyardCount: number;
  scores: [number, number];
  opener: number | null;
  config: DominoConfig;
};

export type DominoDecision =
  | { kind: 'play'; tile: number; end: DominoEnd }
  | { kind: 'draw' }
  | { kind: 'pass' };

const MAX_PIP = 6;

function buildTiles(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let low = 0; low <= MAX_PIP; low += 1) {
    for (let high = low; high <= MAX_PIP; high += 1) tiles.push([low, high]);
  }
  return tiles;
}

export const DOMINO_TILES: DominoTile[] = buildTiles();
export const DOMINO_TILE_COUNT: number = DOMINO_TILES.length;

export const DOMINO_DEFAULT_CONFIG: DominoConfig = {
  mode: 'duel',
  handSize: 7,
  drawFromBoneyard: true,
  target: 200,
  blockedRule: 'general',
  capicuaBonus: 25,
};

function normalizePips(tile: DominoTile): DominoTile {
  const low = Math.min(tile[0], tile[1]);
  const high = Math.max(tile[0], tile[1]);
  if (!Number.isInteger(low) || low < 0 || high > MAX_PIP) throw new Error('Ficha inválida.');
  return [low, high];
}

/** Index of the tile inside the canonical double-six order, ignoring orientation. */
export function tileId(tile: DominoTile): number {
  const [low, high] = normalizePips(tile);
  return (low * (15 - low)) / 2 + (high - low);
}

export function tileFromId(id: number): DominoTile {
  const tile = DOMINO_TILES[id];
  if (!tile) throw new Error('Ficha inválida.');
  return [tile[0], tile[1]];
}

export function tileKey(tile: DominoTile): string {
  const [low, high] = normalizePips(tile);
  return `${low}-${high}`;
}

export function tilePips(tile: DominoTile): number {
  return tile[0] + tile[1];
}

export function isDoubleTile(tile: DominoTile): boolean {
  return tile[0] === tile[1];
}

export function dominoHandPips(hand: number[]): number {
  return hand.reduce((total, id) => total + tilePips(tileFromId(id)), 0);
}

export function dominoConfig(patch: Partial<DominoConfig> = {}): DominoConfig {
  const mode: DominoMode = patch.mode === 'partners' ? 'partners' : 'duel';
  const seats = mode === 'partners' ? 4 : 2;
  const maxHandSize = Math.floor(DOMINO_TILE_COUNT / seats);
  const requestedHand = Number.isInteger(patch.handSize)
    ? Number(patch.handSize)
    : DOMINO_DEFAULT_CONFIG.handSize;
  const handSize = Math.min(Math.max(requestedHand, 1), maxHandSize);
  // A deal that exhausts the set leaves nothing to draw, whatever the caller asked for.
  const drawFromBoneyard = DOMINO_TILE_COUNT - seats * handSize > 0
    && (patch.drawFromBoneyard ?? DOMINO_DEFAULT_CONFIG.drawFromBoneyard) === true;
  const target = Number.isInteger(patch.target) && Number(patch.target) > 0
    ? Number(patch.target)
    : DOMINO_DEFAULT_CONFIG.target;
  const blockedRule: DominoBlockedRule = patch.blockedRule === 'patio' ? 'patio' : 'general';
  const capicuaBonus = Number.isInteger(patch.capicuaBonus) && Number(patch.capicuaBonus) >= 0
    ? Number(patch.capicuaBonus)
    : DOMINO_DEFAULT_CONFIG.capicuaBonus;
  return { mode, handSize, drawFromBoneyard, target, blockedRule, capicuaBonus };
}

export function dominoSeatCount(config: DominoConfig): number {
  return config.mode === 'partners' ? 4 : 2;
}

export function dominoTeam(seat: DominoSeat): DominoTeam {
  return (seat % 2) as DominoTeam;
}

export function rightNeighborSeat(seat: DominoSeat, seatCount: number): DominoSeat {
  return ((seat + 1) % seatCount) as DominoSeat;
}

function randomFrom(seed: number) {
  let value = Math.abs(Math.trunc(Number.isFinite(seed) ? seed : 0)) || 1;
  return () => {
    value |= 0;
    value = value + 0x6D2B79F5 | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result;
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

export function shuffleDominoTiles(seed: number): number[] {
  const random = randomFrom(seed);
  const order = [...DOMINO_TILES.keys()];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = order[index];
    order[index] = order[swap];
    order[swap] = held;
  }
  return order;
}

/** Highest double, else heaviest tile, else the lowest seat holding the tie. */
function openerFor(hands: number[][]): { seat: DominoSeat; tile: number } {
  let seat: DominoSeat = 0;
  let tile = -1;
  let rank = -1;
  hands.forEach((hand, index) => {
    hand.forEach((id) => {
      const pips = tileFromId(id);
      const candidate = (isDoubleTile(pips) ? 100 : 0) + tilePips(pips);
      if (candidate > rank) {
        rank = candidate;
        tile = id;
        seat = index as DominoSeat;
      }
    });
  });
  return { seat, tile };
}

export function dominoOpenerSeat(hands: number[][]): DominoSeat {
  return openerFor(hands).seat;
}

function dealHands(config: DominoConfig, seed: number): { hands: number[][]; boneyard: number[] } {
  const seats = dominoSeatCount(config);
  const order = shuffleDominoTiles(seed);
  const hands = Array.from({ length: seats }, (_, seat) =>
    order.slice(seat * config.handSize, (seat + 1) * config.handSize));
  return { hands, boneyard: order.slice(seats * config.handSize) };
}

export function initialDominoState(seed: number, configPatch: Partial<DominoConfig> = {}): DominoMatchState {
  const config = dominoConfig(configPatch);
  const { hands, boneyard } = dealHands(config, seed);
  const opener = openerFor(hands);
  return {
    version: 1,
    config,
    scores: [0, 0],
    roundNo: 1,
    starterSeat: opener.seat,
    round: {
      hands,
      boneyard,
      board: [],
      ends: null,
      opener: opener.tile >= 0 ? opener.tile : null,
      turn: opener.seat,
      lastSeat: null,
      passes: 0,
      phase: 'play',
      result: null,
    },
    winnerTeam: null,
    seq: 0,
  };
}

function playsFrom(
  seat: DominoSeat,
  hand: number[],
  ends: [number, number] | null,
  opener: number | null,
): DominoPlay[] {
  const tiles = opener !== null && hand.includes(opener) ? [opener] : hand;
  const plays: DominoPlay[] = [];
  for (const tile of tiles) {
    const [low, high] = tileFromId(tile);
    if (!ends) {
      plays.push({ seat, tile, end: 'right' });
      continue;
    }
    if (low === ends[0] || high === ends[0]) plays.push({ seat, tile, end: 'left' });
    if (low === ends[1] || high === ends[1]) plays.push({ seat, tile, end: 'right' });
  }
  return plays;
}

export function legalDominoPlays(state: DominoMatchState, seat: DominoSeat): DominoPlay[] {
  const round = state.round;
  if (round.phase !== 'play' || round.turn !== seat) return [];
  return playsFrom(seat, round.hands[seat] ?? [], round.ends, round.opener);
}

export function canPlayDomino(state: DominoMatchState, seat: DominoSeat): boolean {
  return legalDominoPlays(state, seat).length > 0;
}

export function mustDrawDomino(state: DominoMatchState, seat: DominoSeat): boolean {
  const round = state.round;
  return round.phase === 'play'
    && round.turn === seat
    && state.config.drawFromBoneyard
    && round.boneyard.length > 0
    && !canPlayDomino(state, seat);
}

function place(
  board: number[],
  ends: [number, number] | null,
  tile: number,
  end: DominoEnd,
): { board: number[]; ends: [number, number] } {
  const [low, high] = tileFromId(tile);
  if (!ends) return { board: [tile], ends: [low, high] };
  if (end === 'left') {
    const outer = low === ends[0] ? high : low;
    return { board: [tile, ...board], ends: [outer, ends[1]] };
  }
  const outer = low === ends[1] ? high : low;
  return { board: [...board, tile], ends: [ends[0], outer] };
}

function teamPips(hands: number[][]): [number, number] {
  const totals: [number, number] = [0, 0];
  hands.forEach((hand, seat) => {
    totals[dominoTeam(seat as DominoSeat)] += dominoHandPips(hand);
  });
  return totals;
}

function awardTo(team: DominoTeam, amount: number): [number, number] {
  return team === 0 ? [amount, 0] : [0, amount];
}

/** A capicúa closes the round with a non double that matches both open ends. */
function isCapicua(tile: number, ends: [number, number] | null): boolean {
  if (!ends) return false;
  const pips = tileFromId(tile);
  if (isDoubleTile(pips)) return false;
  const closed: [number, number] = [Math.min(ends[0], ends[1]), Math.max(ends[0], ends[1])];
  return pips[0] === closed[0] && pips[1] === closed[1];
}

function outResult(
  config: DominoConfig,
  hands: number[][],
  seat: DominoSeat,
  tile: number,
  endsBefore: [number, number] | null,
): DominoRoundResult {
  const winnerTeam = dominoTeam(seat);
  const pips = teamPips(hands)[winnerTeam === 0 ? 1 : 0];
  const capicua = isCapicua(tile, endsBefore);
  const bonus = capicua ? config.capicuaBonus : 0;
  return {
    reason: 'domino',
    winnerSeat: seat,
    winnerTeam,
    tie: false,
    pips,
    capicua,
    bonus,
    awarded: awardTo(winnerTeam, pips + bonus),
  };
}

function blockedResult(
  config: DominoConfig,
  hands: number[][],
  lastSeat: DominoSeat | null,
  seatCount: number,
): DominoRoundResult {
  const totals = teamPips(hands);
  const settle = (winnerSeat: DominoSeat | null, winnerTeam: DominoTeam): DominoRoundResult => {
    const pips = totals[winnerTeam === 0 ? 1 : 0];
    return {
      reason: 'blocked',
      winnerSeat,
      winnerTeam,
      tie: false,
      pips,
      capicua: false,
      bonus: 0,
      awarded: awardTo(winnerTeam, pips),
    };
  };

  if (config.blockedRule === 'patio' && lastSeat !== null) {
    // The seat that blocked keeps the round unless the seat to its right is lighter.
    const neighbor = rightNeighborSeat(lastSeat, seatCount);
    const blockerPips = dominoHandPips(hands[lastSeat] ?? []);
    const neighborPips = dominoHandPips(hands[neighbor] ?? []);
    const winnerSeat = blockerPips <= neighborPips ? lastSeat : neighbor;
    return settle(winnerSeat, dominoTeam(winnerSeat));
  }

  if (totals[0] === totals[1]) {
    return {
      reason: 'blocked',
      winnerSeat: null,
      winnerTeam: null,
      tie: true,
      pips: 0,
      capicua: false,
      bonus: 0,
      awarded: [0, 0],
    };
  }
  return settle(null, totals[0] < totals[1] ? 0 : 1);
}

function matchWinner(scores: [number, number], target: number): DominoTeam | null {
  const zero = scores[0] >= target;
  const one = scores[1] >= target;
  if (zero && one) return scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  if (zero) return 0;
  return one ? 1 : null;
}

function finishRound(
  state: DominoMatchState,
  result: DominoRoundResult,
  fallbackSeat: DominoSeat,
): DominoTransition {
  const scores: [number, number] = [
    state.scores[0] + result.awarded[0],
    state.scores[1] + result.awarded[1],
  ];
  const winnerTeam = matchWinner(scores, state.config.target);
  const turn = result.winnerSeat ?? fallbackSeat;
  return {
    state: {
      ...state,
      scores,
      winnerTeam,
      round: { ...state.round, turn, phase: 'over', result },
    },
    nextSeat: turn,
    result,
    winnerTeam,
  };
}

function requireTurn(state: DominoMatchState, seat: DominoSeat) {
  if (state.round.phase !== 'play') throw new Error('La ronda ya terminó.');
  if (state.round.turn !== seat) throw new Error('No es el turno de ese puesto.');
}

export function playDomino(
  state: DominoMatchState,
  seat: DominoSeat,
  tile: number,
  end: DominoEnd,
): DominoTransition {
  requireTurn(state, seat);
  const legal = legalDominoPlays(state, seat)
    .some((play) => play.tile === tile && play.end === end);
  if (!legal) throw new Error('Esa ficha no puede colocarse ahí.');

  const round = state.round;
  const seats = dominoSeatCount(state.config);
  const endsBefore = round.ends;
  const placed = place(round.board, endsBefore, tile, end);
  const hands = round.hands.map((hand, index) =>
    index === seat ? hand.filter((id) => id !== tile) : [...hand]);
  const next: DominoMatchState = {
    ...state,
    round: {
      ...round,
      hands,
      board: placed.board,
      ends: placed.ends,
      opener: null,
      turn: rightNeighborSeat(seat, seats),
      lastSeat: seat,
      passes: 0,
    },
    seq: state.seq + 1,
  };

  if (hands[seat].length === 0) {
    return finishRound(next, outResult(state.config, hands, seat, tile, endsBefore), seat);
  }
  return { state: next, nextSeat: next.round.turn, result: null, winnerTeam: null };
}

export function drawDomino(state: DominoMatchState, seat: DominoSeat): DominoTransition {
  requireTurn(state, seat);
  if (!mustDrawDomino(state, seat)) throw new Error('No hay nada que robar en este turno.');
  const round = state.round;
  const drawn = round.boneyard[0];
  const hands = round.hands.map((hand, index) => index === seat ? [...hand, drawn] : [...hand]);
  return {
    state: {
      ...state,
      round: { ...round, hands, boneyard: round.boneyard.slice(1) },
      seq: state.seq + 1,
    },
    nextSeat: seat,
    result: null,
    winnerTeam: null,
  };
}

export function passDomino(state: DominoMatchState, seat: DominoSeat): DominoTransition {
  requireTurn(state, seat);
  if (canPlayDomino(state, seat)) throw new Error('Todavía tienes una ficha jugable.');
  if (mustDrawDomino(state, seat)) throw new Error('Debes robar del pozo antes de pasar.');

  const round = state.round;
  const seats = dominoSeatCount(state.config);
  const nextSeat = rightNeighborSeat(seat, seats);
  const passes = round.passes + 1;
  const hands = round.hands.map((hand) => [...hand]);
  const next: DominoMatchState = {
    ...state,
    round: { ...round, hands, turn: nextSeat, passes },
    seq: state.seq + 1,
  };

  if (passes >= seats) {
    return finishRound(next, blockedResult(state.config, hands, round.lastSeat, seats), nextSeat);
  }
  return { state: next, nextSeat, result: null, winnerTeam: null };
}

/**
 * Salida of the next round: the seat that closed, else the lightest seat of the
 * winning team, and the previous starter when nobody won the round.
 */
function starterAfterRound(state: DominoMatchState, result: DominoRoundResult): DominoSeat {
  if (result.winnerSeat !== null) return result.winnerSeat;
  if (result.winnerTeam === null) return state.starterSeat;
  const seats = dominoSeatCount(state.config);
  const hands = state.round.hands;
  let lightest: DominoSeat | null = null;
  let lightestPips = Number.POSITIVE_INFINITY;
  for (let index = 0; index < seats; index += 1) {
    const seat = index as DominoSeat;
    if (dominoTeam(seat) !== result.winnerTeam) continue;
    const pips = dominoHandPips(hands[seat] ?? []);
    if (pips < lightestPips) {
      lightestPips = pips;
      lightest = seat;
    }
  }
  if (lightest === null) return state.starterSeat;
  // A tie inside the winning team goes to the last seat that laid a tile.
  const lastSeat = state.round.lastSeat;
  if (
    lastSeat !== null
    && dominoTeam(lastSeat) === result.winnerTeam
    && dominoHandPips(hands[lastSeat] ?? []) === lightestPips
  ) return lastSeat;
  return lightest;
}

export function nextDominoRound(state: DominoMatchState, seed: number): DominoMatchState {
  if (state.round.phase !== 'over' || !state.round.result) throw new Error('La ronda sigue en juego.');
  if (state.winnerTeam !== null) throw new Error('La partida ya tiene ganador.');
  const starterSeat = starterAfterRound(state, state.round.result);
  const { hands, boneyard } = dealHands(state.config, seed);
  return {
    ...state,
    roundNo: state.roundNo + 1,
    starterSeat,
    round: {
      hands,
      boneyard,
      board: [],
      ends: null,
      opener: null,
      turn: starterSeat,
      lastSeat: null,
      passes: 0,
      phase: 'play',
      result: null,
    },
    seq: state.seq + 1,
  };
}

export function dominoView(state: DominoMatchState, seat: DominoSeat): DominoView {
  const round = state.round;
  return {
    seat,
    turn: round.turn,
    hand: [...(round.hands[seat] ?? [])],
    ends: round.ends ? [round.ends[0], round.ends[1]] : null,
    played: [...round.board],
    handCounts: round.hands.map((hand) => hand.length),
    boneyardCount: round.boneyard.length,
    scores: [state.scores[0], state.scores[1]],
    opener: round.opener,
    config: state.config,
  };
}

/**
 * Reads the stored board as one connected line, flipping halves so each tile
 * meets its neighbor. The outer halves are the open ends, doubles stay upright.
 */
export function orientedDominoBoard(
  board: number[],
  ends: [number, number] | null,
): DominoTile[] {
  if (!Array.isArray(board) || board.length === 0) return [];
  const chain: DominoTile[] = [];
  let joint: number | null = ends ? ends[0] : null;
  for (const id of board) {
    const [low, high] = tileFromId(id);
    const flip = joint !== null && high === joint && low !== joint;
    const oriented: DominoTile = flip ? [high, low] : [low, high];
    chain.push(oriented);
    joint = oriented[1];
  }
  return chain;
}

/** Leftover pips per seat, published only once the round is settled. */
export function dominoRoundPips(state: DominoMatchState): number[] | null {
  const round = state.round;
  if (round.phase !== 'over' || !round.result) return null;
  return round.hands.map((hand) => dominoHandPips(hand));
}

/** Heaviest tile first, doubles ahead of equal weights, leftmost end to break ties. */
function playWeight(tile: number): number {
  const pips = tileFromId(tile);
  return tilePips(pips) * 2 + (isDoubleTile(pips) ? 1 : 0);
}

/** Tiles this seat cannot account for: rival hands plus the boneyard. */
function unseenTiles(view: DominoView): number[] {
  const seen = new Set<number>([...view.hand, ...view.played]);
  const unseen: number[] = [];
  for (let id = 0; id < DOMINO_TILE_COUNT; id += 1) if (!seen.has(id)) unseen.push(id);
  return unseen;
}

function matchesEnds(tile: number, ends: [number, number]): boolean {
  const [low, high] = tileFromId(tile);
  return low === ends[0] || high === ends[0] || low === ends[1] || high === ends[1];
}

/** True while a rival sits one tile away from closing the round. */
function rivalIsClosing(view: DominoView): boolean {
  const team = dominoTeam(view.seat);
  return view.handCounts.some((count, index) =>
    index !== view.seat && dominoTeam(index as DominoSeat) !== team && count === 1);
}

/**
 * Ranks a play from the view alone: keep the capicúa tile for the closing play,
 * starve a rival that is about to go out, and unload weight otherwise.
 */
function rankDominoPlay(
  view: DominoView,
  play: DominoPlay,
  unseen: number[] | null,
): number[] {
  const spendsCapicua = view.hand.length > 1 && isCapicua(play.tile, view.ends) ? 1 : 0;
  const endsAfter = place(view.played, view.ends, play.tile, play.end).ends;
  const replies = unseen ? unseen.filter((id) => matchesEnds(id, endsAfter)).length : 0;
  return [spendsCapicua, replies, -playWeight(play.tile)];
}

/** Lexicographic on the rank tuple; the earliest play keeps a full tie. */
function isBetterRank(rank: number[], best: number[]): boolean {
  for (let index = 0; index < rank.length; index += 1) {
    if (rank[index] !== best[index]) return rank[index] < best[index];
  }
  return false;
}

export function botDominoDecision(view: DominoView): DominoDecision {
  const plays = playsFrom(view.seat, view.hand, view.ends, view.opener);
  if (plays.length > 0) {
    // A legal play is never skipped, so the last tile always goes out.
    const unseen = rivalIsClosing(view) ? unseenTiles(view) : null;
    let best = plays[0];
    let bestRank = rankDominoPlay(view, best, unseen);
    for (const play of plays) {
      const rank = rankDominoPlay(view, play, unseen);
      if (isBetterRank(rank, bestRank)) {
        best = play;
        bestRank = rank;
      }
    }
    return { kind: 'play', tile: best.tile, end: best.end };
  }
  if (view.config.drawFromBoneyard && view.boneyardCount > 0) return { kind: 'draw' };
  return { kind: 'pass' };
}

function isTileId(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < DOMINO_TILE_COUNT;
}

function isTileList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isTileId);
}

function isSeatIndex(value: unknown, seatCount: number): boolean {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < seatCount;
}

function isScore(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isNormalizedConfig(value: unknown): value is DominoConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<DominoConfig>;
  const normalized = dominoConfig(config);
  const keys: (keyof DominoConfig)[] = [
    'mode', 'handSize', 'drawFromBoneyard', 'target', 'blockedRule', 'capicuaBonus',
  ];
  return keys.every((key) => config[key] === normalized[key]);
}

function isRoundResult(value: unknown, seatCount: number): boolean {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<DominoRoundResult>;
  const validTeam = result.winnerTeam === null || result.winnerTeam === 0 || result.winnerTeam === 1;
  const validSeat = result.winnerSeat === null || isSeatIndex(result.winnerSeat, seatCount);
  return (result.reason === 'domino' || result.reason === 'blocked')
    && validSeat
    && validTeam
    && typeof result.tie === 'boolean'
    && typeof result.capicua === 'boolean'
    && isScore(result.pips)
    && isScore(result.bonus)
    && Array.isArray(result.awarded)
    && result.awarded.length === 2
    && result.awarded.every(isScore);
}

export function isDominoState(value: unknown): value is DominoMatchState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<DominoMatchState>;
  if (state.version !== 1) return false;
  if (!isNormalizedConfig(state.config)) return false;
  const seatCount = dominoSeatCount(state.config);
  if (!Array.isArray(state.scores) || state.scores.length !== 2 || !state.scores.every(isScore)) return false;
  if (!Number.isInteger(state.roundNo) || Number(state.roundNo) < 1) return false;
  if (!isSeatIndex(state.starterSeat, seatCount)) return false;
  if (!(state.winnerTeam === null || state.winnerTeam === 0 || state.winnerTeam === 1)) return false;
  if (!Number.isInteger(state.seq) || Number(state.seq) < 0) return false;

  const round = state.round as Partial<DominoRound> | undefined;
  if (!round || typeof round !== 'object') return false;
  if (round.phase !== 'play' && round.phase !== 'over') return false;
  if (!isSeatIndex(round.turn, seatCount)) return false;
  if (!(round.lastSeat === null || isSeatIndex(round.lastSeat, seatCount))) return false;
  if (!Number.isInteger(round.passes) || Number(round.passes) < 0 || Number(round.passes) > seatCount) return false;
  if (!Array.isArray(round.hands) || round.hands.length !== seatCount) return false;
  if (!round.hands.every(isTileList)) return false;
  if (!isTileList(round.boneyard) || !isTileList(round.board)) return false;
  if (!(round.opener === null || isTileId(round.opener))) return false;
  if (!isRoundResult(round.result, seatCount)) return false;
  if (round.phase === 'over' ? round.result === null : round.result !== null) return false;

  // Open ends exist exactly while the board holds tiles.
  const validEnds = round.board.length === 0
    ? round.ends === null
    : Array.isArray(round.ends) && round.ends.length === 2
      && round.ends.every((pip) => Number.isInteger(pip) && pip >= 0 && pip <= MAX_PIP);
  if (!validEnds) return false;

  const tiles = [...round.board, ...round.boneyard, ...round.hands.flat()];
  return tiles.length === DOMINO_TILE_COUNT && new Set(tiles).size === DOMINO_TILE_COUNT;
}
