import {
  botDominoDecision,
  dominoConfig,
  dominoRoundPips,
  dominoView,
  drawDomino,
  isDominoState,
  passDomino,
  playDomino,
  type DominoConfig,
  type DominoEnd,
  type DominoMatchState,
  type DominoSeat,
} from "./domino.ts";

export type DominoSeatInfo = {
  seat: number;
  memberId: string | null;
  label: string;
  bot: boolean;
};

export type DominoEvent = {
  seq: number;
  kind: "deal" | "play" | "draw" | "pass" | "round";
  seat?: number;
  tile?: number;
  end?: DominoEnd;
};

export type DominoPublicState = {
  version: 1;
  first: string;
  phase: "lobby" | "play" | "between" | "over";
  config: DominoConfig;
  confirmations: string[];
  seats: DominoSeatInfo[];
  scores: [number, number];
  roundNo: number;
  turnSeat: number | null;
  opener: number | null;
  board: number[];
  ends: [number, number] | null;
  handCounts: number[];
  boneyardCount: number;
  passes: number;
  result: DominoMatchState["round"]["result"];
  roundPips: number[] | null;
  winnerTeam: DominoMatchState["winnerTeam"];
  seq: number;
  lastEvents: DominoEvent[];
};

export function makeSeats(
  mode: DominoConfig["mode"],
  firstId: string,
  members: { id: string; name: string }[],
): DominoSeatInfo[] {
  const creator = members.find((member) => member.id === firstId) ?? members[0];
  const partner = members.find((member) => member.id !== creator?.id);
  if (!creator || !partner) throw new Error("couple_incomplete");
  if (mode === "duel") {
    return [
      { seat: 0, memberId: creator.id, label: creator.name, bot: false },
      { seat: 1, memberId: partner.id, label: partner.name, bot: false },
    ];
  }
  return [
    { seat: 0, memberId: creator.id, label: creator.name, bot: false },
    { seat: 1, memberId: null, label: "Bot Este", bot: true },
    { seat: 2, memberId: partner.id, label: partner.name, bot: false },
    { seat: 3, memberId: null, label: "Bot Oeste", bot: true },
  ];
}

export function lobbyDominoState(
  first: string,
  configPatch: Partial<DominoConfig>,
  confirmations: string[],
  seats: DominoSeatInfo[],
  seq: number,
): DominoPublicState {
  const config = dominoConfig(configPatch);
  return {
    version: 1,
    first,
    phase: "lobby",
    config,
    confirmations: [...confirmations],
    seats: seats.map((seat) => ({ ...seat })),
    scores: [0, 0],
    roundNo: 0,
    turnSeat: null,
    opener: null,
    board: [],
    ends: null,
    handCounts: seats.map(() => 0),
    boneyardCount: 0,
    passes: 0,
    result: null,
    roundPips: null,
    winnerTeam: null,
    seq,
    lastEvents: [],
  };
}

export function commitErrorResponse(message: string): { code: string; status: number } {
  if (/estado_desactualizado|seq_(publico|privado)?_?invalido/i.test(message)) {
    return { code: "stale_state", status: 409 };
  }
  if (/turno_fuera_de_pareja/i.test(message)) {
    return { code: "invalid_next_turn", status: 409 };
  }
  if (/estado_publico|estado_privado|estado_invalido/i.test(message)) {
    return { code: "invalid_public_state", status: 409 };
  }
  if (/partida_invalida/i.test(message)) {
    return { code: "game_not_found", status: 404 };
  }
  return { code: "commit_failed", status: 500 };
}

export function publicDominoState(
  state: DominoMatchState,
  confirmations: string[],
  seats: DominoSeatInfo[],
  lastEvents: DominoEvent[],
): DominoPublicState {
  const phase = state.winnerTeam !== null
    ? "over"
    : state.round.phase === "over"
    ? "between"
    : "play";
  return {
    version: 1,
    first: seats.find((seat) => !seat.bot)?.memberId ?? "",
    phase,
    config: state.config,
    confirmations: [...confirmations],
    seats: seats.map((seat) => ({ ...seat })),
    scores: [...state.scores] as [number, number],
    roundNo: state.roundNo,
    turnSeat: phase === "play" ? state.round.turn : null,
    opener: state.round.opener,
    board: [...state.round.board],
    ends: state.round.ends ? [...state.round.ends] as [number, number] : null,
    handCounts: state.round.hands.map((hand) => hand.length),
    boneyardCount: state.round.boneyard.length,
    passes: state.round.passes,
    result: state.round.result ? structuredClone(state.round.result) : null,
    roundPips: dominoRoundPips(state),
    winnerTeam: state.winnerTeam,
    seq: state.seq,
    lastEvents: lastEvents.slice(-12).map((event) => ({ ...event })),
  };
}

export function callerSeat(seats: DominoSeatInfo[], memberId: string): DominoSeat | null {
  const seat = seats.find((candidate) => !candidate.bot && candidate.memberId === memberId)?.seat;
  return seat === undefined ? null : seat as DominoSeat;
}

export function humanTurnId(
  state: DominoMatchState | null,
  seats: DominoSeatInfo[],
): string | null {
  if (!state || state.winnerTeam !== null || state.round.phase !== "play") return null;
  const seat = seats[state.round.turn];
  return seat && !seat.bot ? seat.memberId : null;
}

export function runBots(
  initial: DominoMatchState,
  seats: DominoSeatInfo[],
  initialEvents: DominoEvent[],
): { state: DominoMatchState; events: DominoEvent[] } {
  let state = initial;
  const events = [...initialEvents];
  let guard = 0;
  while (state.round.phase === "play" && seats[state.round.turn]?.bot) {
    if (guard++ >= 100) throw Object.assign(new Error("bot_loop"), { status: 500 });
    const seat = state.round.turn;
    // The bot receives exactly the same limited view as a player seat.
    const decision = botDominoDecision(dominoView(state, seat));
    if (decision.kind === "play") {
      state = playDomino(state, seat, decision.tile, decision.end).state;
      events.push({ seq: state.seq, kind: "play", seat, tile: decision.tile, end: decision.end });
    } else if (decision.kind === "draw") {
      state = drawDomino(state, seat).state;
      events.push({ seq: state.seq, kind: "draw", seat });
    } else {
      state = passDomino(state, seat).state;
      events.push({ seq: state.seq, kind: "pass", seat });
    }
  }
  if (!isDominoState(state)) {
    throw Object.assign(new Error("invalid_engine_state"), { status: 500 });
  }
  return { state, events: events.slice(-12) };
}
