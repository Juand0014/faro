import { describe, expect, it } from "vitest";
import { initialDominoState } from "./domino";
import {
  commitErrorResponse,
  humanTurnId,
  lobbyDominoState,
  makeSeats,
  publicDominoState,
  runBots,
} from "../../supabase/functions/_shared/domino-server";

const creator = { id: "11111111-1111-4111-8111-111111111111", name: "Ana" };
const partner = { id: "22222222-2222-4222-8222-222222222222", name: "Luis" };

describe("domino server views", () => {
  it("never serializes hands or boneyard into the public state", () => {
    const state = initialDominoState(42, { mode: "duel" });
    const seats = makeSeats("duel", creator.id, [creator, partner]);
    const publicState = publicDominoState(state, [creator.id, partner.id], seats, []);
    const serialized = JSON.stringify(publicState);

    expect(serialized).not.toContain('"hands"');
    expect(serialized).not.toContain('"boneyard"');
    expect(publicState.handCounts).toEqual([7, 7]);
    expect(publicState.boneyardCount).toBe(14);
    expect(publicState.roundPips).toBeNull();
    expect(humanTurnId(state, seats)).toBe(seats[state.round.turn].memberId);
  });

  it("uses opposite human seats and resolves bot turns before returning", () => {
    const seats = makeSeats("partners", creator.id, [creator, partner]);
    let state = initialDominoState(1, { mode: "partners" });
    state = {
      ...state,
      round: { ...state.round, turn: 1, opener: null },
    };
    const result = runBots(state, seats, []);

    expect(seats.map((seat) => seat.memberId)).toEqual([creator.id, null, partner.id, null]);
    expect(result.state.round.phase === "over" || !seats[result.state.round.turn].bot).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it("honors the persisted first player instead of the caller order", () => {
    const seats = makeSeats("duel", partner.id, [creator, partner]);

    expect(seats.map((seat) => seat.memberId)).toEqual([partner.id, creator.id]);
    expect(publicDominoState(initialDominoState(42), [], seats, []).first).toBe(partner.id);
  });

  it("builds a normalized lobby snapshot instead of returning stored dirty state", () => {
    const seats = makeSeats("partners", creator.id, [partner, creator]);
    const state = lobbyDominoState(creator.id, { mode: "partners" }, [creator.id], seats, 0);

    expect(state).toMatchObject({
      first: creator.id,
      phase: "lobby",
      confirmations: [creator.id],
      seats,
      board: [],
      seq: 0,
    });
    expect(Object.keys(state).sort()).toEqual([
      "version", "first", "phase", "config", "confirmations", "seats", "scores",
      "roundNo", "turnSeat", "opener", "board", "ends", "handCounts",
      "boneyardCount", "passes", "result", "roundPips", "winnerTeam", "seq", "lastEvents",
    ].sort());
  });
});

describe("domino commit errors", () => {
  it("maps database errors to stable public codes", () => {
    expect(commitErrorResponse("estado_desactualizado")).toEqual({ code: "stale_state", status: 409 });
    expect(commitErrorResponse("seq_publico_invalido")).toEqual({ code: "stale_state", status: 409 });
    expect(commitErrorResponse("seq_privado_invalido")).toEqual({ code: "stale_state", status: 409 });
    expect(commitErrorResponse("turno_fuera_de_pareja")).toEqual({ code: "invalid_next_turn", status: 409 });
    expect(commitErrorResponse("estado_publico_inseguro")).toEqual({ code: "invalid_public_state", status: 409 });
    expect(commitErrorResponse("estado_privado_requerido")).toEqual({ code: "invalid_public_state", status: 409 });
    expect(commitErrorResponse("partida_invalida")).toEqual({ code: "game_not_found", status: 404 });
    expect(commitErrorResponse("arbitrary database detail")).toEqual({ code: "commit_failed", status: 500 });
  });
});
