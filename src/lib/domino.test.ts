import { describe, expect, it } from 'vitest';
import {
  DOMINO_DEFAULT_CONFIG,
  DOMINO_TILES,
  DOMINO_TILE_COUNT,
  botDominoDecision,
  canPlayDomino,
  dominoConfig,
  dominoHandPips,
  dominoOpenerSeat,
  dominoRoundPips,
  dominoSeatCount,
  dominoTeam,
  dominoView,
  drawDomino,
  initialDominoState,
  isDominoState,
  isDoubleTile,
  legalDominoPlays,
  mustDrawDomino,
  nextDominoRound,
  orientedDominoBoard,
  passDomino,
  playDomino,
  rightNeighborSeat,
  shuffleDominoTiles,
  tileFromId,
  tileId,
  tileKey,
  tilePips,
  type DominoConfig,
  type DominoMatchState,
  type DominoRoundResult,
  type DominoSeat,
  type DominoTile,
  type DominoView,
} from './domino';
import * as canonicalDomino from '../../supabase/functions/_shared/domino';
import * as clientDomino from './domino';

/** Tile id from its canonical pip pair. */
function t(low: number, high: number): number {
  return tileId([low, high]);
}

type RoundFixture = {
  hands: number[][];
  board?: number[];
  ends?: [number, number] | null;
  opener?: number | null;
  turn?: DominoSeat;
  lastSeat?: DominoSeat | null;
  passes?: number;
  boneyard?: number[];
};

/**
 * Builds a mid-round state directly. Mutators trust the state they receive, so
 * fixtures only carry the tiles a scenario needs; full-deck conservation is
 * asserted separately on dealt states.
 */
function fixture(
  configPatch: Partial<DominoConfig>,
  round: RoundFixture,
  scores: [number, number] = [0, 0],
): DominoMatchState {
  const config = dominoConfig(configPatch);
  return {
    version: 1,
    config,
    scores,
    roundNo: 2,
    starterSeat: 0,
    round: {
      hands: round.hands,
      boneyard: round.boneyard ?? [],
      board: round.board ?? [],
      ends: round.ends ?? null,
      opener: round.opener ?? null,
      turn: round.turn ?? 0,
      lastSeat: round.lastSeat ?? null,
      passes: round.passes ?? 0,
      phase: 'play',
      result: null,
    },
    winnerTeam: null,
    seq: 0,
  };
}

function allTiles(state: DominoMatchState): number[] {
  return [...state.round.board, ...state.round.boneyard, ...state.round.hands.flat()];
}

describe('domino tiles', () => {
  it('re-exports the canonical edge-compatible engine', () => {
    expect(clientDomino.initialDominoState).toBe(canonicalDomino.initialDominoState);
    expect(clientDomino.playDomino).toBe(canonicalDomino.playDomino);
    expect(clientDomino.DOMINO_TILES).toBe(canonicalDomino.DOMINO_TILES);
  });

  it('describes the double-six set with 28 unique tiles in canonical order', () => {
    expect(DOMINO_TILE_COUNT).toBe(28);
    expect(DOMINO_TILES).toHaveLength(28);
    expect(new Set(DOMINO_TILES.map(tileKey)).size).toBe(28);
    expect(DOMINO_TILES.every(([low, high]) => low <= high && low >= 0 && high <= 6)).toBe(true);
    expect(DOMINO_TILES[0]).toEqual([0, 0]);
    expect(DOMINO_TILES[6]).toEqual([0, 6]);
    expect(DOMINO_TILES[7]).toEqual([1, 1]);
    expect(DOMINO_TILES[27]).toEqual([6, 6]);
  });

  it('encodes a tile as its index and normalizes flipped pairs', () => {
    expect(t(0, 0)).toBe(0);
    expect(t(1, 1)).toBe(7);
    expect(t(3, 3)).toBe(18);
    expect(t(5, 6)).toBe(26);
    expect(t(6, 6)).toBe(27);
    expect(tileId([6, 1])).toBe(tileId([1, 6]));
    expect(tileKey([6, 1])).toBe('1-6');
    for (let id = 0; id < DOMINO_TILE_COUNT; id += 1) {
      expect(tileId(tileFromId(id))).toBe(id);
    }
  });

  it('counts pips and recognizes doubles', () => {
    expect(tilePips([6, 6])).toBe(12);
    expect(tilePips([0, 0])).toBe(0);
    expect(isDoubleTile([4, 4])).toBe(true);
    expect(isDoubleTile([4, 5])).toBe(false);
    expect(dominoHandPips([t(6, 6), t(3, 4), t(0, 0)])).toBe(19);
    expect(dominoHandPips([])).toBe(0);
  });
});

describe('domino configuration', () => {
  it('defaults to a 1v1 duel to 200 with boneyard draws and a 25 point capicúa', () => {
    expect(DOMINO_DEFAULT_CONFIG).toEqual({
      mode: 'duel',
      handSize: 7,
      drawFromBoneyard: true,
      target: 200,
      blockedRule: 'general',
      capicuaBonus: 25,
    });
    expect(dominoConfig()).toEqual(DOMINO_DEFAULT_CONFIG);
    expect(dominoSeatCount(dominoConfig())).toBe(2);
    expect(dominoSeatCount(dominoConfig({ mode: 'partners' }))).toBe(4);
  });

  it('normalizes impossible options', () => {
    const partners = dominoConfig({ mode: 'partners', handSize: 8 });
    expect(partners.handSize).toBe(7);
    // Four hands of seven exhaust the set, so partners never draws.
    expect(partners.drawFromBoneyard).toBe(false);
    expect(dominoConfig({ mode: 'partners', drawFromBoneyard: true }).drawFromBoneyard).toBe(false);
    expect(dominoConfig({ target: 0 }).target).toBe(200);
    expect(dominoConfig({ target: -5 }).target).toBe(200);
    expect(dominoConfig({ blockedRule: 'patio' }).blockedRule).toBe('patio');
    expect(dominoConfig({ capicuaBonus: -1 }).capicuaBonus).toBe(25);
    expect(dominoConfig({ mode: 'duel', drawFromBoneyard: false }).drawFromBoneyard).toBe(false);
  });

  it('pairs seats across the table and turns to the right', () => {
    expect([0, 1, 2, 3].map((seat) => dominoTeam(seat as DominoSeat))).toEqual([0, 1, 0, 1]);
    expect(rightNeighborSeat(0, 4)).toBe(1);
    expect(rightNeighborSeat(3, 4)).toBe(0);
    expect(rightNeighborSeat(1, 2)).toBe(0);
  });
});

describe('domino shuffle and deal', () => {
  it('rebuilds the same shuffle from the same seed', () => {
    const order = shuffleDominoTiles(4182);
    expect(order).toHaveLength(28);
    expect(new Set(order).size).toBe(28);
    expect(order.every((id) => id >= 0 && id < DOMINO_TILE_COUNT)).toBe(true);
    expect(shuffleDominoTiles(4182)).toEqual(order);
    expect(shuffleDominoTiles(4183)).not.toEqual(order);
    expect(order).not.toEqual([...DOMINO_TILES.keys()]);

    const duel = initialDominoState(4182, { mode: 'duel' });
    expect(duel).toEqual(initialDominoState(4182, { mode: 'duel' }));
    expect(initialDominoState(4183, { mode: 'duel' }).round.hands).not.toEqual(duel.round.hands);
    expect(isDominoState(duel)).toBe(true);
    expect(JSON.stringify(duel).length).toBeLessThan(1200);
  });

  it('deals seven tiles per seat and leaves the rest in the boneyard for a duel', () => {
    const order = shuffleDominoTiles(4182);
    const duel = initialDominoState(4182, { mode: 'duel' });
    // Seats take consecutive slices; the boneyard keeps the tail and is drawn from its front.
    expect(duel.round.hands).toEqual([order.slice(0, 7), order.slice(7, 14)]);
    expect(duel.round.boneyard).toEqual(order.slice(14));
    expect(duel.round.board).toEqual([]);
    expect(duel.round.ends).toBeNull();
    expect(duel.round.passes).toBe(0);
    expect(duel.round.phase).toBe('play');
    expect(duel.round.result).toBeNull();
    expect(duel.roundNo).toBe(1);
    expect(duel.scores).toEqual([0, 0]);
    expect(duel.winnerTeam).toBeNull();

    const tiles = allTiles(duel);
    expect(tiles).toHaveLength(28);
    expect(new Set(tiles).size).toBe(28);
  });

  it('deals four hands of seven with no boneyard in partners mode', () => {
    const order = shuffleDominoTiles(77);
    const partners = initialDominoState(77, { mode: 'partners' });
    expect(partners.round.hands.map((hand) => hand.length)).toEqual([7, 7, 7, 7]);
    expect(partners.round.hands).toEqual([0, 1, 2, 3].map((seat) => order.slice(seat * 7, seat * 7 + 7)));
    expect(partners.round.boneyard).toEqual([]);
    expect(new Set(allTiles(partners)).size).toBe(28);
    expect(isDominoState(partners)).toBe(true);
  });
});

describe('domino placement', () => {
  const placing = () => fixture({ mode: 'partners' }, {
    // Board reads left to right: 4-3, 3-6, so the open ends are 4 and 6.
    board: [t(3, 4), t(3, 6)],
    ends: [4, 6],
    hands: [[t(4, 5), t(6, 6), t(4, 6), t(0, 1)], [t(2, 2), t(5, 6)], [t(0, 3)], [t(1, 5)]],
    turn: 0,
  });

  it('lists every matching end, both ends for a tile that fits twice', () => {
    expect(legalDominoPlays(placing(), 0)).toEqual([
      { seat: 0, tile: t(4, 5), end: 'left' },
      { seat: 0, tile: t(6, 6), end: 'right' },
      { seat: 0, tile: t(4, 6), end: 'left' },
      { seat: 0, tile: t(4, 6), end: 'right' },
    ]);
    expect(canPlayDomino(placing(), 0)).toBe(true);
    // Seat 1 could place its 5-6 on the six, but the turn is not its own.
    expect(legalDominoPlays(placing(), 1)).toEqual([]);
  });

  it('extends the left end and keeps the other end untouched', () => {
    const played = playDomino(placing(), 0, t(4, 5), 'left');
    expect(played.state.round.board).toEqual([t(4, 5), t(3, 4), t(3, 6)]);
    expect(played.state.round.ends).toEqual([5, 6]);
    expect(played.state.round.hands[0]).toEqual([t(6, 6), t(4, 6), t(0, 1)]);
    expect(played.state.round.lastSeat).toBe(0);
    expect(played.state.round.passes).toBe(0);
    expect(played.state.seq).toBe(1);
    expect(played.nextSeat).toBe(1);
    expect(played.result).toBeNull();
  });

  it('places a double on the only end it matches without moving that end', () => {
    const played = playDomino(placing(), 0, t(6, 6), 'right');
    expect(played.state.round.board).toEqual([t(3, 4), t(3, 6), t(6, 6)]);
    expect(played.state.round.ends).toEqual([4, 6]);
    expect(() => playDomino(placing(), 0, t(6, 6), 'left')).toThrow();
  });

  it('rejects tiles that match no end, tiles outside the hand and plays out of turn', () => {
    expect(() => playDomino(placing(), 0, t(0, 1), 'left')).toThrow();
    expect(() => playDomino(placing(), 0, t(0, 1), 'right')).toThrow();
    expect(() => playDomino(placing(), 0, t(2, 2), 'right')).toThrow();
    expect(() => playDomino(placing(), 1, t(5, 6), 'right')).toThrow();
  });

  it('opens an empty board with a single canonical play per tile', () => {
    const open = fixture({ mode: 'partners' }, { hands: [[t(0, 1), t(6, 6)], [], [], []], turn: 0 });
    expect(legalDominoPlays(open, 0)).toEqual([
      { seat: 0, tile: t(0, 1), end: 'right' },
      { seat: 0, tile: t(6, 6), end: 'right' },
    ]);
    const played = playDomino(open, 0, t(0, 1), 'right');
    expect(played.state.round.board).toEqual([t(0, 1)]);
    expect(played.state.round.ends).toEqual([0, 1]);
  });
});

describe('domino openers', () => {
  it('forces the double six on the first hand and frees the board afterwards', () => {
    const state = initialDominoState(77, { mode: 'partners' });
    const opener = state.round.hands.findIndex((hand) => hand.includes(t(6, 6))) as DominoSeat;
    expect(opener).toBeGreaterThanOrEqual(0);
    expect(state.starterSeat).toBe(opener);
    expect(state.round.turn).toBe(opener);
    expect(state.round.opener).toBe(t(6, 6));
    expect(legalDominoPlays(state, opener)).toEqual([{ seat: opener, tile: t(6, 6), end: 'right' }]);

    const otherTile = state.round.hands[opener].find((tile) => tile !== t(6, 6))!;
    expect(() => playDomino(state, opener, otherTile, 'right')).toThrow();

    const played = playDomino(state, opener, t(6, 6), 'right');
    expect(played.state.round.board).toEqual([t(6, 6)]);
    expect(played.state.round.ends).toEqual([6, 6]);
    expect(played.state.round.opener).toBeNull();
    expect(played.nextSeat).toBe(rightNeighborSeat(opener, 4));
  });

  it('falls back to the highest double, then the heaviest tile, then the lowest seat', () => {
    expect(dominoOpenerSeat([[t(0, 1), t(2, 3)], [t(6, 6), t(1, 4)]])).toBe(1);
    expect(dominoOpenerSeat([[t(0, 1), t(2, 3)], [t(5, 5), t(0, 6)]])).toBe(1);
    expect(dominoOpenerSeat([[t(3, 3), t(0, 1)], [t(5, 5), t(0, 6)]])).toBe(1);
    expect(dominoOpenerSeat([[t(0, 1), t(5, 6)], [t(2, 4), t(0, 3)]])).toBe(0);
    expect(dominoOpenerSeat([[t(2, 3)], [t(1, 4)]])).toBe(0);
  });

  it('lets the previous winner open the next round with any tile', () => {
    const result: DominoRoundResult = {
      reason: 'domino',
      winnerSeat: 2,
      winnerTeam: 0,
      tie: false,
      pips: 12,
      capicua: false,
      bonus: 0,
      awarded: [12, 0],
    };
    const finished = fixture({ mode: 'partners' }, { hands: [[], [t(2, 2)], [], [t(1, 5)]] }, [12, 0]);
    const over: DominoMatchState = {
      ...finished,
      round: { ...finished.round, phase: 'over', result },
    };

    const next = nextDominoRound(over, 99);
    expect(next.roundNo).toBe(finished.roundNo + 1);
    expect(next.starterSeat).toBe(2);
    expect(next.round.turn).toBe(2);
    expect(next.round.opener).toBeNull();
    expect(next.round.phase).toBe('play');
    expect(next.round.result).toBeNull();
    expect(next.round.passes).toBe(0);
    expect(next.round.board).toEqual([]);
    expect(next.scores).toEqual([12, 0]);
    expect(next.round.hands.map((hand) => hand.length)).toEqual([7, 7, 7, 7]);
    expect(new Set(allTiles(next)).size).toBe(28);
    expect(legalDominoPlays(next, 2)).toHaveLength(7);
    expect(nextDominoRound(over, 99)).toEqual(next);
  });

  it('keeps the same starter after a tie and refuses to deal a finished match', () => {
    const tie: DominoRoundResult = {
      reason: 'blocked',
      winnerSeat: null,
      winnerTeam: null,
      tie: true,
      pips: 0,
      capicua: false,
      bonus: 0,
      awarded: [0, 0],
    };
    const base = fixture({ mode: 'partners' }, { hands: [[t(0, 0)], [t(2, 2)], [t(3, 3)], [t(4, 4)]] });
    const over: DominoMatchState = {
      ...base,
      starterSeat: 3,
      round: { ...base.round, phase: 'over', result: tie },
    };
    expect(nextDominoRound(over, 7).starterSeat).toBe(3);
    expect(() => nextDominoRound(base, 7)).toThrow();
    expect(() => nextDominoRound({ ...over, winnerTeam: 0 }, 7)).toThrow();
  });
});

describe('domino draws and passes', () => {
  const stuck = (configPatch: Partial<DominoConfig>, boneyard: number[]) => fixture(configPatch, {
    board: [t(3, 4), t(3, 6)],
    ends: [4, 6],
    hands: [[t(0, 1)], [t(2, 2)]],
    turn: 0,
    boneyard,
  });

  it('forces a 1v1 seat to draw while the boneyard holds tiles', () => {
    const state = stuck({ mode: 'duel' }, [t(4, 4), t(2, 3)]);
    expect(canPlayDomino(state, 0)).toBe(false);
    expect(mustDrawDomino(state, 0)).toBe(true);
    expect(() => passDomino(state, 0)).toThrow();

    const drawn = drawDomino(state, 0);
    expect(drawn.state.round.hands[0]).toEqual([t(0, 1), t(4, 4)]);
    expect(drawn.state.round.boneyard).toEqual([t(2, 3)]);
    expect(drawn.state.round.passes).toBe(0);
    expect(drawn.state.round.turn).toBe(0);
    expect(drawn.nextSeat).toBe(0);
    expect(canPlayDomino(drawn.state, 0)).toBe(true);
    expect(mustDrawDomino(drawn.state, 0)).toBe(false);
  });

  it('passes only once the boneyard runs dry', () => {
    const state = stuck({ mode: 'duel' }, [t(2, 3)]);
    const drawn = drawDomino(state, 0);
    expect(drawn.state.round.boneyard).toEqual([]);
    expect(mustDrawDomino(drawn.state, 0)).toBe(false);
    expect(canPlayDomino(drawn.state, 0)).toBe(false);
    expect(() => drawDomino(drawn.state, 0)).toThrow();

    const passed = passDomino(drawn.state, 0);
    expect(passed.state.round.passes).toBe(1);
    expect(passed.state.round.turn).toBe(1);
    expect(passed.nextSeat).toBe(1);
    expect(passed.state.round.phase).toBe('play');
    expect(passed.result).toBeNull();
  });

  it('passes instead of drawing when the 1v1 config disables the boneyard', () => {
    const state = stuck({ mode: 'duel', drawFromBoneyard: false }, [t(4, 4), t(2, 3)]);
    expect(mustDrawDomino(state, 0)).toBe(false);
    expect(() => drawDomino(state, 0)).toThrow();
    expect(passDomino(state, 0).state.round.passes).toBe(1);
  });

  it('never lets a seat pass or draw while it has a legal play, nor act out of turn', () => {
    const state = fixture({ mode: 'duel' }, {
      board: [t(3, 4), t(3, 6)],
      ends: [4, 6],
      hands: [[t(4, 5)], [t(2, 2)]],
      turn: 0,
      boneyard: [t(0, 0)],
    });
    expect(() => passDomino(state, 0)).toThrow();
    expect(() => drawDomino(state, 0)).toThrow();
    expect(() => passDomino(state, 1)).toThrow();
  });

  it('lets four seats pass in a row with no boneyard', () => {
    const state = fixture({ mode: 'partners' }, {
      board: [t(1, 1)],
      ends: [1, 1],
      hands: [[t(0, 2)], [t(3, 4)], [t(6, 6)], [t(2, 2)]],
      turn: 0,
      lastSeat: 0,
    });
    expect(mustDrawDomino(state, 0)).toBe(false);

    const first = passDomino(state, 0);
    expect(first.state.round.passes).toBe(1);
    const second = passDomino(first.state, 1);
    expect(second.state.round.passes).toBe(2);
    const third = passDomino(second.state, 2);
    expect(third.state.round.passes).toBe(3);
    expect(third.state.round.phase).toBe('play');

    const fourth = passDomino(third.state, 3);
    expect(fourth.state.round.passes).toBe(4);
    expect(fourth.state.round.phase).toBe('over');
    expect(fourth.result?.reason).toBe('blocked');
  });
});

describe('domino round scoring', () => {
  it('ends the round when a seat plays its last tile and counts only the rivals', () => {
    const state = fixture({ mode: 'partners' }, {
      board: [t(2, 3), t(3, 5)],
      ends: [2, 5],
      hands: [[t(2, 6)], [t(6, 6)], [t(5, 6)], [t(3, 4)]],
      turn: 0,
    });
    const played = playDomino(state, 0, t(2, 6), 'left');
    expect(played.state.round.hands[0]).toEqual([]);
    expect(played.state.round.phase).toBe('over');
    expect(played.nextSeat).toBe(0);
    expect(played.result).toEqual({
      reason: 'domino',
      winnerSeat: 0,
      winnerTeam: 0,
      tie: false,
      // Rivals hold 6-6 and 3-4; the partner's 5-6 is not counted.
      pips: 19,
      capicua: false,
      bonus: 0,
      awarded: [19, 0],
    });
    expect(played.state.scores).toEqual([19, 0]);
    expect(played.state.round.result).toEqual(played.result);
    expect(played.winnerTeam).toBeNull();
  });

  it('adds 25 for a capicúa closed on both ends and can reach the target', () => {
    const state = fixture({ mode: 'partners' }, {
      board: [t(2, 3), t(3, 5)],
      ends: [2, 5],
      hands: [[t(2, 5)], [t(6, 6)], [t(5, 6)], [t(3, 4)]],
      turn: 0,
    }, [180, 0]);
    expect(legalDominoPlays(state, 0)).toEqual([
      { seat: 0, tile: t(2, 5), end: 'left' },
      { seat: 0, tile: t(2, 5), end: 'right' },
    ]);

    const played = playDomino(state, 0, t(2, 5), 'right');
    expect(played.result?.capicua).toBe(true);
    expect(played.result?.bonus).toBe(25);
    expect(played.result?.pips).toBe(19);
    expect(played.result?.awarded).toEqual([44, 0]);
    expect(played.state.scores).toEqual([224, 0]);
    expect(played.state.winnerTeam).toBe(0);
    expect(played.winnerTeam).toBe(0);
    expect(() => nextDominoRound(played.state, 3)).toThrow();
  });

  it('does not pay a capicúa for a double or a single matching end', () => {
    const double = fixture({ mode: 'partners' }, {
      // 3-6, 6-5, 5-3 leaves a 3 open on both ends.
      board: [t(3, 6), t(5, 6), t(3, 5)],
      ends: [3, 3],
      hands: [[t(3, 3)], [t(6, 6)], [t(0, 0)], [t(3, 4)]],
      turn: 0,
    });
    const closedByDouble = playDomino(double, 0, t(3, 3), 'left');
    expect(closedByDouble.result?.capicua).toBe(false);
    expect(closedByDouble.result?.bonus).toBe(0);
    expect(closedByDouble.result?.awarded).toEqual([19, 0]);

    const single = fixture({ mode: 'partners' }, {
      board: [t(2, 3), t(3, 5)],
      ends: [2, 5],
      hands: [[t(2, 6)], [t(6, 6)], [t(0, 0)], [t(3, 4)]],
      turn: 0,
    });
    expect(playDomino(single, 0, t(2, 6), 'left').result?.capicua).toBe(false);
  });

  it('gives a blocked round to the lighter team under the general rule', () => {
    const state = fixture({ mode: 'partners', blockedRule: 'general' }, {
      board: [t(1, 1)],
      ends: [1, 1],
      // Team 0 (seats 0 and 2) holds 2 + 12 = 14; team 1 holds 7 + 4 = 11.
      hands: [[t(0, 2)], [t(3, 4)], [t(6, 6)], [t(2, 2)]],
      turn: 3,
      lastSeat: 0,
      passes: 3,
    });
    const blocked = passDomino(state, 3);
    expect(blocked.state.round.phase).toBe('over');
    expect(blocked.result).toEqual({
      reason: 'blocked',
      winnerSeat: null,
      winnerTeam: 1,
      tie: false,
      pips: 14,
      capicua: false,
      bonus: 0,
      awarded: [0, 14],
    });
    expect(blocked.state.scores).toEqual([0, 14]);
  });

  it('gives a blocked round to the blocker when the patio rule beats the right neighbor', () => {
    const state = fixture({ mode: 'partners', blockedRule: 'patio' }, {
      board: [t(1, 1)],
      ends: [1, 1],
      // Blocker seat 0 holds 2 against right neighbor seat 1 with 7, even though
      // team 0 is the heavier pair.
      hands: [[t(0, 2)], [t(3, 4)], [t(6, 6)], [t(2, 2)]],
      turn: 3,
      lastSeat: 0,
      passes: 3,
    });
    const blocked = passDomino(state, 3);
    expect(blocked.result).toEqual({
      reason: 'blocked',
      winnerSeat: 0,
      winnerTeam: 0,
      tie: false,
      pips: 11,
      capicua: false,
      bonus: 0,
      awarded: [11, 0],
    });
    expect(blocked.state.scores).toEqual([11, 0]);
  });

  it('splits an even block as a tie under the general rule and to the blocker under patio', () => {
    const hands = [[t(2, 2)], [t(0, 4)]];
    const general = fixture({ mode: 'duel', blockedRule: 'general' }, {
      board: [t(1, 1)],
      ends: [1, 1],
      hands,
      turn: 1,
      lastSeat: 0,
      passes: 1,
      boneyard: [],
    });
    const tied = passDomino(general, 1);
    expect(tied.result).toEqual({
      reason: 'blocked',
      winnerSeat: null,
      winnerTeam: null,
      tie: true,
      pips: 0,
      capicua: false,
      bonus: 0,
      awarded: [0, 0],
    });
    expect(tied.state.scores).toEqual([0, 0]);

    const patio = fixture({ mode: 'duel', blockedRule: 'patio' }, {
      board: [t(1, 1)],
      ends: [1, 1],
      hands,
      turn: 1,
      lastSeat: 0,
      passes: 1,
      boneyard: [],
    });
    const toBlocker = passDomino(patio, 1);
    expect(toBlocker.result?.tie).toBe(false);
    expect(toBlocker.result?.winnerSeat).toBe(0);
    expect(toBlocker.result?.awarded).toEqual([4, 0]);
  });

  it('stops the match at the configured target only', () => {
    // 19 rival pips plus the 25 capicúa bonus put team 0 on 224.
    const near = (target: number) => fixture({ mode: 'partners', target }, {
      board: [t(2, 3), t(3, 5)],
      ends: [2, 5],
      hands: [[t(2, 5)], [t(6, 6)], [t(0, 0)], [t(3, 4)]],
      turn: 0,
    }, [180, 0]);
    expect(playDomino(near(200), 0, t(2, 5), 'right').state.winnerTeam).toBe(0);
    expect(playDomino(near(300), 0, t(2, 5), 'right').state.winnerTeam).toBeNull();
  });
});

describe('domino state validation', () => {
  const dealt = () => initialDominoState(5, { mode: 'duel' });

  it('accepts dealt states and rejects malformed ones', () => {
    const state = dealt();
    expect(isDominoState(state)).toBe(true);
    expect(isDominoState(null)).toBe(false);
    expect(isDominoState({ ...state, version: 2 })).toBe(false);
    expect(isDominoState({ ...state, scores: [0] })).toBe(false);
    expect(isDominoState({ ...state, scores: [0, -3] })).toBe(false);
    expect(isDominoState({ ...state, config: { ...state.config, target: 0 } })).toBe(false);
    expect(isDominoState({ ...state, round: { ...state.round, turn: 4 } })).toBe(false);
    expect(isDominoState({ ...state, round: { ...state.round, phase: 'shuffling' } })).toBe(false);
    // Ends exist exactly while the board holds tiles.
    expect(isDominoState({ ...state, round: { ...state.round, ends: [3, 3] } })).toBe(false);
    expect(isDominoState({
      ...state,
      round: { ...state.round, board: [t(3, 3)], ends: null, boneyard: state.round.boneyard.slice(1) },
    })).toBe(false);
  });

  it('rejects states that lose, duplicate or invent tiles', () => {
    const state = dealt();
    const duplicated = {
      ...state,
      round: {
        ...state.round,
        hands: [[state.round.hands[1][0], ...state.round.hands[0].slice(1)], state.round.hands[1]],
      },
    };
    expect(isDominoState(duplicated)).toBe(false);
    expect(isDominoState({
      ...state,
      round: { ...state.round, boneyard: state.round.boneyard.slice(1) },
    })).toBe(false);
    expect(isDominoState({
      ...state,
      round: { ...state.round, hands: [[28, ...state.round.hands[0].slice(1)], state.round.hands[1]] },
    })).toBe(false);
    expect(isDominoState({
      ...state,
      round: { ...state.round, hands: [[-1, ...state.round.hands[0].slice(1)], state.round.hands[1]] },
    })).toBe(false);
    expect(isDominoState({
      ...state,
      round: { ...state.round, hands: [state.round.hands[0], state.round.hands[1], []] },
    })).toBe(false);
  });

  it('conserves the 28 tiles while bots play a whole partners round', () => {
    let state = initialDominoState(2024, { mode: 'partners' });
    let guard = 0;
    while (state.round.phase === 'play' && guard < 60) {
      guard += 1;
      expect(isDominoState(state)).toBe(true);
      const seat = state.round.turn;
      const decision = botDominoDecision(dominoView(state, seat));
      const transition = decision.kind === 'play'
        ? playDomino(state, seat, decision.tile, decision.end)
        : decision.kind === 'draw'
          ? drawDomino(state, seat)
          : passDomino(state, seat);
      state = transition.state;
      const tiles = allTiles(state);
      expect(tiles).toHaveLength(DOMINO_TILE_COUNT);
      expect(new Set(tiles).size).toBe(DOMINO_TILE_COUNT);
    }
    expect(state.round.phase).toBe('over');
    expect(state.round.result?.reason === 'domino' || state.round.result?.reason === 'blocked').toBe(true);
    expect(state.scores[0] + state.scores[1]).toBe(state.round.result?.awarded.reduce((a, b) => a + b, 0));
  });
});

describe('domino information view', () => {
  it('exposes only what the seat may know', () => {
    const state = fixture({ mode: 'duel' }, {
      board: [t(3, 4), t(3, 6)],
      ends: [4, 6],
      hands: [[t(4, 5), t(0, 1)], [t(2, 2), t(6, 6), t(0, 0)]],
      turn: 1,
      lastSeat: 0,
      boneyard: [t(1, 1), t(5, 5)],
    }, [30, 15]);

    const view = dominoView(state, 1);
    expect(view).toEqual({
      seat: 1,
      turn: 1,
      hand: [t(2, 2), t(6, 6), t(0, 0)],
      ends: [4, 6],
      played: [t(3, 4), t(3, 6)],
      handCounts: [2, 3],
      boneyardCount: 2,
      scores: [30, 15],
      opener: null,
      config: state.config,
    });
    // No rival tile and no boneyard tile leaks through the view.
    const hidden = [...state.round.hands[0], ...state.round.boneyard];
    const revealed = [...view.hand, ...view.played];
    expect(revealed.filter((tile) => hidden.includes(tile))).toEqual([]);
  });

  it('carries the forced opener of the first hand', () => {
    const state = initialDominoState(77, { mode: 'partners' });
    const opener = state.round.hands.findIndex((hand) => hand.includes(t(6, 6))) as DominoSeat;
    const view = dominoView(state, opener);
    expect(view.opener).toBe(t(6, 6));
    expect(view.handCounts).toEqual([7, 7, 7, 7]);
    expect(view.boneyardCount).toBe(0);
    expect(view.ends).toBeNull();
    expect(view.played).toEqual([]);
  });
});

describe('domino bot', () => {
  const baseView = (patch: Partial<DominoView>): DominoView => ({
    seat: 0,
    turn: 0,
    hand: [],
    ends: null,
    played: [],
    handCounts: [7, 7, 7, 7],
    boneyardCount: 0,
    scores: [0, 0],
    opener: null,
    config: dominoConfig({ mode: 'partners' }),
    ...patch,
  });

  it('opens with the forced double six', () => {
    const view = baseView({ hand: [t(0, 1), t(6, 6), t(3, 5)], opener: t(6, 6) });
    expect(botDominoDecision(view)).toEqual({ kind: 'play', tile: t(6, 6), end: 'right' });
  });

  it('decides from the view alone, without mutating it', () => {
    const view = baseView({ hand: [t(4, 6), t(0, 4)], ends: [4, 4], played: [t(4, 4)], handCounts: [2, 6, 6, 6] });
    const snapshot = structuredClone(view);
    const first = botDominoDecision(view);
    expect(botDominoDecision(view)).toEqual(first);
    expect(botDominoDecision(structuredClone(view))).toEqual(first);
    expect(view).toEqual(snapshot);
    // Only the view is needed: a frozen copy is enough to decide.
    expect(botDominoDecision(Object.freeze(structuredClone(view)) as DominoView)).toEqual(first);
  });

  it('plays the heaviest tile it can and never skips a legal play', () => {
    const heavy = baseView({ hand: [t(0, 4), t(4, 6)], ends: [4, 4], played: [t(4, 4)] });
    const decision = botDominoDecision(heavy);
    expect(decision).toMatchObject({ kind: 'play', tile: t(4, 6) });
    expect(decision.kind === 'play' && (decision.end === 'left' || decision.end === 'right')).toBe(true);

    const onlyOne = baseView({ hand: [t(0, 1), t(4, 4)], ends: [4, 6], played: [t(3, 4), t(3, 6)] });
    expect(botDominoDecision(onlyOne)).toEqual({ kind: 'play', tile: t(4, 4), end: 'left' });
  });

  it('closes the round when its last tile fits', () => {
    const view = baseView({ hand: [t(0, 4)], ends: [4, 2], played: [t(2, 4)], handCounts: [1, 3, 3, 3] });
    expect(botDominoDecision(view)).toEqual({ kind: 'play', tile: t(0, 4), end: 'left' });
  });

  it('draws when it must and passes when it cannot draw', () => {
    const duel = dominoConfig({ mode: 'duel' });
    const blocked = { hand: [t(0, 1)], ends: [4, 6] as [number, number], played: [t(3, 4), t(3, 6)], handCounts: [1, 4] };
    expect(botDominoDecision(baseView({ ...blocked, config: duel, boneyardCount: 5 })))
      .toEqual({ kind: 'draw' });
    expect(botDominoDecision(baseView({ ...blocked, config: duel, boneyardCount: 0 })))
      .toEqual({ kind: 'pass' });
    expect(botDominoDecision(baseView({
      ...blocked,
      config: dominoConfig({ mode: 'duel', drawFromBoneyard: false }),
      boneyardCount: 5,
    }))).toEqual({ kind: 'pass' });
    expect(botDominoDecision(baseView({ ...blocked, handCounts: [1, 4, 4, 4] }))).toEqual({ kind: 'pass' });
  });

  it('always returns a decision the engine accepts', () => {
    let state = initialDominoState(1234, { mode: 'duel' });
    for (let step = 0; step < 12 && state.round.phase === 'play'; step += 1) {
      const seat = state.round.turn;
      const decision = botDominoDecision(dominoView(state, seat));
      if (decision.kind === 'play') {
        expect(legalDominoPlays(state, seat)).toContainEqual({ seat, tile: decision.tile, end: decision.end });
        state = playDomino(state, seat, decision.tile, decision.end).state;
      } else if (decision.kind === 'draw') {
        expect(mustDrawDomino(state, seat)).toBe(true);
        state = drawDomino(state, seat).state;
      } else {
        expect(canPlayDomino(state, seat)).toBe(false);
        expect(mustDrawDomino(state, seat)).toBe(false);
        state = passDomino(state, seat).state;
      }
    }
    expect(isDominoState(state)).toBe(true);
  });
});

describe('domino oriented board', () => {
  /** The chain must read as one connected line whose outer halves are the open ends. */
  function expectConnectedChain(board: number[], ends: [number, number] | null) {
    const chain: DominoTile[] = orientedDominoBoard(board, ends);
    expect(chain).toHaveLength(board.length);
    chain.forEach((pips, index) => {
      // Orientation only flips halves; the tile itself never changes.
      expect(tileId(pips)).toBe(board[index]);
      if (index > 0) expect(pips[0]).toBe(chain[index - 1][1]);
    });
    if (chain.length > 0 && ends) {
      expect(chain[0][0]).toBe(ends[0]);
      expect(chain[chain.length - 1][1]).toBe(ends[1]);
    }
  }

  it('reads the played chain left to right and flips halves to match', () => {
    expect(orientedDominoBoard([], null)).toEqual([]);
    expect(orientedDominoBoard([t(0, 1)], [0, 1])).toEqual([[0, 1]]);
    // The lone tile flips when the left open end is its high half.
    expect(orientedDominoBoard([t(0, 1)], [1, 0])).toEqual([[1, 0]]);
    // Board 4-3, 3-6 stored as canonical ids 3-4 and 3-6.
    expect(orientedDominoBoard([t(3, 4), t(3, 6)], [4, 6])).toEqual([[4, 3], [3, 6]]);
    expectConnectedChain([t(3, 4), t(3, 6)], [4, 6]);
  });

  it('keeps doubles upright and follows tiles added on the left', () => {
    const state = fixture({ mode: 'partners' }, {
      board: [t(3, 6), t(5, 6), t(3, 5)],
      ends: [3, 3],
      hands: [[t(3, 3)], [t(6, 6)], [t(0, 0)], [t(3, 4)]],
      turn: 0,
    });
    expect(orientedDominoBoard(state.round.board, state.round.ends))
      .toEqual([[3, 6], [6, 5], [5, 3]]);

    const closed = playDomino(state, 0, t(3, 3), 'left');
    expect(orientedDominoBoard(closed.state.round.board, closed.state.round.ends))
      .toEqual([[3, 3], [3, 6], [6, 5], [5, 3]]);
    expectConnectedChain(closed.state.round.board, closed.state.round.ends);
  });

  it('stays connected end to end while bots fill a partners board', () => {
    let state = initialDominoState(2024, { mode: 'partners' });
    for (let step = 0; step < 40 && state.round.phase === 'play'; step += 1) {
      expectConnectedChain(state.round.board, state.round.ends);
      const seat = state.round.turn;
      const decision = botDominoDecision(dominoView(state, seat));
      state = decision.kind === 'play'
        ? playDomino(state, seat, decision.tile, decision.end).state
        : decision.kind === 'draw'
          ? drawDomino(state, seat).state
          : passDomino(state, seat).state;
    }
    expectConnectedChain(state.round.board, state.round.ends);
    expect(state.round.board.length).toBeGreaterThan(3);
  });
});

describe('domino starter after a blocked round', () => {
  const blockedGeneral = (hands: number[][], turn: DominoSeat, lastSeat: DominoSeat) =>
    passDomino(fixture({ mode: 'partners', blockedRule: 'general' }, {
      board: [t(1, 1)],
      ends: [1, 1],
      hands,
      turn,
      lastSeat,
      passes: 3,
    }), turn).state;

  it('hands the salida to the lightest seat of the winning team', () => {
    // Team 1 wins the block; seat 3 holds 4 pips against the 7 of seat 1.
    const over = blockedGeneral([[t(0, 2)], [t(3, 4)], [t(6, 6)], [t(2, 2)]], 3, 0);
    expect(over.round.result?.winnerTeam).toBe(1);
    expect(over.round.result?.winnerSeat).toBeNull();

    const next = nextDominoRound(over, 5);
    expect(next.starterSeat).toBe(3);
    expect(next.round.turn).toBe(3);
    expect(dominoTeam(next.starterSeat)).toBe(1);
    expect(next.round.opener).toBeNull();
    expect(nextDominoRound(over, 5)).toEqual(next);
  });

  it('breaks a tie inside the winning team in favor of the last seat that played', () => {
    // Team 1 wins with seats 1 and 3 tied on 4 pips each.
    const tiedHands = [[t(6, 6)], [t(2, 2)], [t(5, 6)], [t(0, 4)]];
    const lastOnWinner = blockedGeneral(tiedHands, 3, 3);
    expect(lastOnWinner.round.result?.winnerTeam).toBe(1);
    expect(nextDominoRound(lastOnWinner, 5).starterSeat).toBe(3);

    // With the last tile laid by the losing team the lowest winning seat opens.
    const lastOnLoser = blockedGeneral(tiedHands, 1, 0);
    expect(nextDominoRound(lastOnLoser, 5).starterSeat).toBe(1);
  });

  it('still keeps the previous starter when the block is a tie', () => {
    const tied = passDomino(fixture({ mode: 'duel', blockedRule: 'general' }, {
      board: [t(1, 1)],
      ends: [1, 1],
      hands: [[t(2, 2)], [t(0, 4)]],
      turn: 1,
      lastSeat: 0,
      passes: 1,
    }), 1).state;
    expect(tied.round.result?.tie).toBe(true);
    expect(nextDominoRound(tied, 5).starterSeat).toBe(tied.starterSeat);
  });
});

describe('domino bot judgement', () => {
  const botView = (patch: Partial<DominoView>): DominoView => ({
    seat: 0,
    turn: 0,
    hand: [],
    ends: null,
    played: [],
    handCounts: [7, 7, 7, 7],
    boneyardCount: 0,
    scores: [0, 0],
    opener: null,
    config: dominoConfig({ mode: 'partners' }),
    ...patch,
  });

  it('goes out whenever its last tile fits, whatever else the score suggests', () => {
    const closing = botView({
      hand: [t(0, 4)],
      ends: [4, 2],
      played: [t(2, 4)],
      handCounts: [1, 1, 3, 3],
    });
    expect(botDominoDecision(closing)).toMatchObject({ kind: 'play', tile: t(0, 4) });
  });

  it('spends the double first and saves the capicúa tile for the closing play', () => {
    // Board 3-6, 6-5 leaves a 3 and a 5 open. Playing 3-5 now wastes the 25 point
    // bonus and strands the double; the double keeps both ends alive instead.
    const view = botView({
      hand: [t(3, 3), t(3, 5)],
      ends: [3, 5],
      played: [t(3, 6), t(5, 6)],
      handCounts: [2, 4, 4, 4],
    });
    expect(botDominoDecision(view)).toEqual({ kind: 'play', tile: t(3, 3), end: 'left' });
  });

  it('opens a scarce pip against a rival down to its last tile', () => {
    // Six of the seven zeros sit in this hand, so only 0-5 can still be out there,
    // against five unseen sixes. Opening a zero beats unloading the heavier 4-6.
    const view = botView({
      hand: [t(0, 4), t(4, 6), t(0, 0), t(0, 1), t(0, 2), t(0, 3), t(0, 6)],
      ends: [4, 5],
      played: [t(1, 4), t(1, 1), t(1, 2), t(2, 3), t(3, 3), t(3, 5)],
      handCounts: [7, 1, 7, 7],
    });
    expect(botDominoDecision(view)).toEqual({ kind: 'play', tile: t(0, 4), end: 'left' });

    // No rival is about to go out, so weight rules again.
    expect(botDominoDecision({ ...view, handCounts: [7, 3, 7, 5] }))
      .toEqual({ kind: 'play', tile: t(4, 6), end: 'left' });
  });
});

describe('domino public round pips', () => {
  const ending = () => fixture({ mode: 'partners' }, {
    board: [t(2, 3), t(3, 5)],
    ends: [2, 5],
    hands: [[t(2, 6)], [t(6, 6)], [t(5, 6)], [t(3, 4)]],
    turn: 0,
  });

  it('publishes the leftovers of every seat only once the round is over', () => {
    const state = ending();
    // Nothing may leak while the tiles are still hidden in play.
    expect(dominoRoundPips(state)).toBeNull();

    const played = playDomino(state, 0, t(2, 6), 'left');
    expect(dominoRoundPips(played.state)).toEqual([0, 12, 11, 7]);
    expect(dominoRoundPips(played.state))
      .toEqual(played.state.round.hands.map((hand) => dominoHandPips(hand)));
  });

  it('exposes totals beside the result without touching its shape or the tile ids', () => {
    const played = playDomino(ending(), 0, t(2, 6), 'left');
    expect(Object.keys(played.result!).sort()).toEqual([
      'reason', 'winnerSeat', 'winnerTeam', 'tie', 'pips', 'capicua', 'bonus', 'awarded',
    ].sort());

    // Totals are one plain sum per seat, not the tiles that produced them.
    const pips = dominoRoundPips(played.state)!;
    expect(pips).toHaveLength(dominoSeatCount(played.state.config));
    expect(pips.every((total) => Number.isInteger(total) && total >= 0)).toBe(true);
    // Seat 1 holds a single 6-6: its total says 12 and hides the tile id 27.
    expect(played.state.round.hands[1]).toEqual([t(6, 6)]);
    expect(pips[1]).toBe(12);
  });
});
