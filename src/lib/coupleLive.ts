import { supabase } from './supabase';
import type { GameRow, Rematch } from './useGame';

export type RematchEvent = {
  game: GameRow;
  rematch: Rematch;
};

type Listener = (e: RematchEvent) => void;
const listeners = new Set<Listener>();
let live: ReturnType<typeof supabase.channel> | null = null;

export function subscribeRematch(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit(e: RematchEvent) {
  listeners.forEach((fn) => fn(e));
}

export function connectCoupleLive(coupleId: string) {
  if (live) supabase.removeChannel(live);
  live = supabase
    .channel(`couple-live:${coupleId}`, { config: { broadcast: { self: false, ack: true } } })
    .on('broadcast', { event: 'rematch' }, ({ payload }) => {
      const e = payload as RematchEvent;
      if (e?.game && e?.rematch) emit(e);
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
