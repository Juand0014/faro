import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { Member } from './session';

export type GameRow = {
  id: string; couple_id: string; type: string; state: any;
  turn: string | null; status: string; winner: string | null;
};

// Carga (o crea) la partida activa de un tipo para la pareja y la mantiene en vivo.
export function useGame(type: string, me: Member, initial: () => any) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribe = useCallback((id: string) => {
    chan.current?.unsubscribe();
    chan.current = supabase
      .channel(`game:${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` },
        (payload) => setGame(payload.new as GameRow))
      .subscribe();
  }, []);

  const loadActive = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('games')
      .select('*').eq('couple_id', me.couple_id).eq('type', type).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data) { setGame(data as GameRow); subscribe((data as GameRow).id); }
    else setGame(null);
    setLoading(false);
  }, [me.couple_id, type, subscribe]);

  useEffect(() => { loadActive(); return () => { chan.current?.unsubscribe(); }; }, [loadActive]);

  const newGame = useCallback(async (firstTurn: string) => {
    const { data } = await supabase.from('games')
      .insert({ couple_id: me.couple_id, type, state: initial(), turn: firstTurn, status: 'active' })
      .select().single();
    if (data) { setGame(data as GameRow); subscribe((data as GameRow).id); }
  }, [me.couple_id, type, initial, subscribe]);

  // Aplica una jugada: recibe el estado actual y devuelve los cambios a persistir.
  const applyMove = useCallback(async (patch: Partial<GameRow>) => {
    if (!game) return;
    const next = { ...patch, updated_at: new Date().toISOString() };
    setGame({ ...game, ...(next as any) }); // optimista
    await supabase.from('games').update(next).eq('id', game.id);
  }, [game]);

  return { game, loading, newGame, applyMove, reload: loadActive };
}
