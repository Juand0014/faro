import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { Member } from './session';

export type GameRow = {
  id: string; couple_id: string; type: string; state: any;
  turn: string | null; status: string; winner: string | null;
  updated_at?: string;
};

function sameGame(a: GameRow | null, b: GameRow) {
  if (!a) return false;
  return a.id === b.id && a.turn === b.turn && a.status === b.status && a.winner === b.winner
    && a.updated_at === b.updated_at && JSON.stringify(a.state) === JSON.stringify(b.state);
}

// Carga (o crea) la partida activa de un tipo para la pareja y la mantiene en vivo.
export function useGame(type: string, me: Member, initial: () => any) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const gameRef = useRef<GameRow | null>(null);
  gameRef.current = game;

  const adopt = useCallback((row: GameRow, fromPartner: boolean) => {
    const prev = gameRef.current;
    if (sameGame(prev, row)) return;
    if (fromPartner && prev?.id !== row.id) {
      setNotice(prev && prev.status !== 'active' ? 'Tu pareja pidió revancha' : 'Tu pareja empezó la partida');
    }
    setGame(row);
  }, []);

  const loadActive = useCallback(async () => {
    const { data } = await supabase.from('games')
      .select('*').eq('couple_id', me.couple_id).eq('type', type).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return (data as GameRow) ?? null;
  }, [me.couple_id, type]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const row = await loadActive();
      if (alive) { setGame(row); setLoading(false); }
    })();

    const channel = supabase
      .channel(`games:${me.couple_id}:${type}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `couple_id=eq.${me.couple_id}` },
        (payload) => {
          const next = payload.new as GameRow | undefined;
          if (!next?.id || next.type !== type) return;
          const prev = gameRef.current;
          const fromPartner = next.state?.first && next.state.first !== me.id;
          if (next.status === 'active' && prev?.id !== next.id) {
            adopt(next, Boolean(fromPartner));
            return;
          }
          if (prev?.id === next.id) adopt(next, false);
        },
      )
      .subscribe();

    // Por si Realtime se atrasa: si el otro ya creó/revanchó, entramos a esa fila.
    const poll = setInterval(async () => {
      const row = await loadActive();
      if (!row) return;
      const prev = gameRef.current;
      const fromPartner = row.state?.first && row.state.first !== me.id && prev?.id !== row.id;
      adopt(row, Boolean(fromPartner));
    }, 2500);

    return () => {
      alive = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [adopt, loadActive, me.couple_id, me.id, type]);

  const newGame = useCallback(async (firstTurn: string) => {
    const existing = await loadActive();
    if (existing) {
      adopt(existing, existing.state?.first !== me.id);
      return;
    }
    const { data, error } = await supabase.from('games')
      .insert({ couple_id: me.couple_id, type, state: initial(), turn: firstTurn, status: 'active' })
      .select().single();
    if (error) {
      const raced = await loadActive();
      if (raced) adopt(raced, raced.state?.first !== me.id);
      return;
    }
    if (data) { setNotice(''); setGame(data as GameRow); }
  }, [adopt, initial, loadActive, me.id, type]);

  const applyMove = useCallback(async (patch: Partial<GameRow>) => {
    if (!game) return;
    const next = { ...patch, updated_at: new Date().toISOString() };
    setGame({ ...game, ...(next as any) });
    await supabase.from('games').update(next).eq('id', game.id);
  }, [game]);

  return { game, loading, newGame, applyMove, reload: loadActive, notice };
}
