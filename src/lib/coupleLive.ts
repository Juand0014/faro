import { supabase } from './supabase';
import type { GameRow, Rematch } from './useGame';
import { isGameReactionEvent, type GameReactionEvent } from './gameReactions';

export type RematchEvent = {
  game: GameRow;
  rematch: Rematch;
};

type Listener = (e: RematchEvent) => void;
const listeners = new Set<Listener>();
type ReactionListener = (event: GameReactionEvent) => void;
const reactionListeners = new Set<ReactionListener>();
let live: ReturnType<typeof supabase.channel> | null = null;

export function subscribeRematch(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit(e: RematchEvent) {
  listeners.forEach((fn) => fn(e));
}

export function subscribeGameReaction(fn: ReactionListener) {
  reactionListeners.add(fn);
  return () => { reactionListeners.delete(fn); };
}

function emitReaction(event: GameReactionEvent) {
  reactionListeners.forEach((fn) => fn(event));
}

export function connectCoupleLive(coupleId: string) {
  if (live) supabase.removeChannel(live);
  live = supabase
    .channel(`couple-live:${coupleId}`, { config: { broadcast: { self: false, ack: true } } })
    .on('broadcast', { event: 'rematch' }, ({ payload }) => {
      const e = payload as RematchEvent;
      if (e?.game && e?.rematch) emit(e);
    })
    .on('broadcast', { event: 'game-reaction' }, ({ payload }) => {
      if (isGameReactionEvent(payload)) emitReaction(payload);
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `couple_id=eq.${coupleId}` },
      (payload) => {
        const game = payload.new as GameRow | undefined;
        const rematch = game?.state?.rematch as Rematch | undefined;
        if (game && rematch?.from && rematch.status) emit({ game, rematch });
      },
    )
    .subscribe();
  return () => {
    if (live) supabase.removeChannel(live);
    live = null;
  };
}

export async function broadcastRematch(event: RematchEvent) {
  if (!live) return;
  await live.send({ type: 'broadcast', event: 'rematch', payload: event });
}

export async function broadcastGameReaction(event: GameReactionEvent) {
  if (!live) return;
  await live.send({ type: 'broadcast', event: 'game-reaction', payload: event });
}
