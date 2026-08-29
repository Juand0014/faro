import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  dominoConfig,
  drawDomino,
  initialDominoState,
  isDominoState,
  nextDominoRound,
  passDomino,
  playDomino,
  dominoView,
  type DominoEnd,
  type DominoMatchState,
} from "../_shared/domino.ts";
import {
  callerSeat,
  commitErrorResponse,
  humanTurnId,
  lobbyDominoState,
  makeSeats,
  publicDominoState,
  runBots,
  type DominoEvent,
  type DominoPublicState,
} from "../_shared/domino-server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const actions = new Set(["confirm", "snapshot", "play", "draw", "pass", "next_round"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

function randomSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] || 1;
}

function eventsFrom(value: unknown): DominoEvent[] {
  return Array.isArray(value) ? value.slice(-12).filter((event) =>
    event && typeof event === "object" && Number.isInteger(event.seq)
    && ["deal", "play", "draw", "pass", "round"].includes(event.kind)
  ) as DominoEvent[] : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const length = Number(req.headers.get("content-length") || 0);
    if (length > 4096) fail("body_too_large", 413);
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) fail("unauthorized", 401);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) fail("server_misconfigured", 500);
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) fail("unauthorized", 401);

    const raw = await req.text();
    if (raw.length > 4096) fail("body_too_large", 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      fail("invalid_json");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) fail("invalid_body");
    const gameId = body.gameId;
    const action = body.action;
    if (typeof gameId !== "string" || !uuid.test(gameId)) fail("invalid_game_id");
    if (typeof action !== "string" || !actions.has(action)) fail("invalid_action");

    const { data: me } = await admin.from("members").select("id,couple_id,name")
      .eq("id", user.id).maybeSingle();
    if (!me) fail("member_not_found", 403);
    const { data: game } = await admin.from("games")
      .select("id,couple_id,type,state,status").eq("id", gameId).maybeSingle();
    if (!game || game.type !== "domino" || game.couple_id !== me.couple_id) {
      fail("game_not_found", 404);
    }
    const current = game.state as Partial<DominoPublicState>;
    const currentSeq = Number(current?.seq);
    if (!Number.isInteger(currentSeq) || currentSeq < 0) fail("invalid_public_state", 409);

    const { data: members } = await admin.from("members").select("id,name")
      .eq("couple_id", me.couple_id).order("created_at", { ascending: true });
    if (!members || members.length !== 2) fail("couple_incomplete", 409);
    const memberIds = new Set(members.map((member) => member.id));
    let config = dominoConfig(current.config || {});
    const firstId = typeof current.first === "string" && memberIds.has(current.first)
      ? current.first
      : members[0].id;
    let seats = makeSeats(config.mode, firstId, members);
    let seat = callerSeat(seats, user.id);
    if (seat === null) fail("not_a_player", 403);

    const { data: privateRow } = await admin.from("domino_private").select("state")
      .eq("game_id", gameId).maybeSingle();
    const privateState = privateRow?.state as DominoMatchState | undefined;
    if (privateState && (!isDominoState(privateState) || privateState.seq !== currentSeq)) {
      fail("invalid_private_state", 409);
    }
    if (privateState) {
      config = privateState.config;
      seats = makeSeats(config.mode, firstId, members);
      seat = callerSeat(seats, user.id);
      if (seat === null) fail("not_a_player", 403);
    }
    let confirmations = Array.isArray(current.confirmations)
      ? [...new Set(current.confirmations.filter(
        (id): id is string => typeof id === "string" && memberIds.has(id),
      ))]
      : [];
    let events = eventsFrom(current.lastEvents);
    if (action === "snapshot") {
      if (game.status !== "active") fail("game_not_active", 409);
      if (!privateState && current.phase !== "lobby") fail("invalid_private_state", 409);
      const snapshot = privateState
        ? publicDominoState(privateState, confirmations, seats, events)
        : lobbyDominoState(firstId, config, confirmations, seats, currentSeq);
      const hand = privateState ? dominoView(privateState, seat).hand : [];
      return json({ gameId, state: snapshot, seat, hand });
    }
    if (game.status !== "active") fail("game_not_active", 409);
    const expectedSeq = body.expectedSeq;
    if (!Number.isInteger(expectedSeq) || expectedSeq !== currentSeq) fail("stale_state", 409);

    let state = privateState;
    if (action === "confirm") {
      if (state || current.phase !== "lobby") fail("already_dealt", 409);
      confirmations = [...new Set([...confirmations, user.id])];
      if (confirmations.length === 2) {
        state = initialDominoState(randomSeed(), config);
        state = { ...state, seq: currentSeq + 1 };
        events = [{ seq: state.seq, kind: "deal" }];
        ({ state, events } = runBots(state, seats, events));
      }
    } else {
      if (!state) fail("waiting_for_confirmations", 409);
      if (action !== "next_round" && (state.round.phase !== "play" || state.round.turn !== seat)) {
        fail("not_your_turn", 409);
      }
      if (action === "play") {
        if (!Number.isInteger(body.tile) || Number(body.tile) < 0 || Number(body.tile) > 27) {
          fail("invalid_tile");
        }
        if (body.end !== "left" && body.end !== "right") fail("invalid_end");
        state = playDomino(state, seat, Number(body.tile), body.end as DominoEnd).state;
        events.push({ seq: state.seq, kind: "play", seat, tile: Number(body.tile), end: body.end as DominoEnd });
      } else if (action === "draw") {
        state = drawDomino(state, seat).state;
        events.push({ seq: state.seq, kind: "draw", seat });
      } else if (action === "pass") {
        state = passDomino(state, seat).state;
        events.push({ seq: state.seq, kind: "pass", seat });
      } else if (action === "next_round") {
        if (state.round.phase !== "over" || state.winnerTeam !== null) fail("round_not_ready", 409);
        state = nextDominoRound(state, randomSeed());
        events.push({ seq: state.seq, kind: "round" });
      }
      ({ state, events } = runBots(state, seats, events));
    }

    const nextSeq = state?.seq ?? currentSeq + 1;
    const publicState: DominoPublicState = state
      ? publicDominoState(state, confirmations, seats, events)
      : lobbyDominoState(firstId, config, confirmations, seats, nextSeq);
    const status = state?.winnerTeam !== null && state?.winnerTeam !== undefined ? "won" : "active";
    const nextTurn = humanTurnId(state ?? null, seats);
    const { error: commitError } = await admin.rpc("domino_commit", {
      p_game_id: gameId,
      p_expected_seq: currentSeq,
      p_public_state: publicState,
      p_private_state: state ?? null,
      p_next_turn: nextTurn,
      p_status: status,
    });
    if (commitError) {
      const mapped = commitErrorResponse(commitError.message);
      fail(mapped.code, mapped.status);
    }
    return json({ gameId, state: publicState, seat, hand: state ? dominoView(state, seat).hand : [] });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 400;
    const message = error instanceof Error ? error.message : "request_failed";
    console.error("domino-game", message);
    return json({ error: status >= 500 ? "server_error" : message }, status);
  }
});
