import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { Member } from './session';

export type Rematch = { from: string; status: 'pending' | 'accepted' | 'rejected' };

export type GameRow = {
  id: string; couple_id: string; type: string; state: any;
  turn: string | null; status: string; winner: string | null;
  created_at?: string; updated_at?: string;
};

export function rematchOf(game: GameRow | null): Rematch | null {
  const r = game?.state?.rematch;
  if (r?.from && (r.status === 'pending' || r.status === 'rejected' || r.status === 'accepted')) return r;
  return null;
}

export function freshState(type: string, first: string) {
  if (type === 'c4') return { board: Array(42).fill(''), first };
  return { board: Array(9).fill(''), first };
}

function sameGame(a: GameRow | null, b: GameRow) {
  if (!a) return false;
  return a.id === b.id && a.turn === b.turn && a.status === b.status && a.winner === b.winner
    && a.updated_at === b.updated_at && JSON.stringify(a.state) === JSON.stringify(b.state);
}

async function saveState(game: GameRow, rematch: Rematch) {
  const next = { ...game, state: { ...game.state, rematch }, updated_at: new Date().toISOString() };
  await supabase.from('games').update({ state: next.state, updated_at: next.updated_at }).eq('id', game.id);
  return next;
}

export async function startAcceptedGame(game: GameRow) {
  const first = game.state?.rematch?.from || game.state?.first;
  await saveState(game, { from: first, status: 'accepted' });
  const { data, error } = await supabase.from('games')
    .insert({ couple_id: game.couple_id, type: game.type, state: freshState(game.type, first), turn: first, status: 'active' })
    .select().single();
  if (error) {
    const { data: existing } = await supabase.from('games')
      .select('*').eq('couple_id', game.couple_id).eq('type', game.type).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return (existing as GameRow) ?? null;
  }
  return (data as GameRow) ?? null;
}

export async function rejectRematchOn(game: GameRow) {
  const from = game.state?.rematch?.from;
  if (!from) return game;
  return saveState(game, { from, status: 'rejected' });
}

// Carga (o crea) la partida de un tipo para la pareja y la mantiene en vivo.
export function useGame(type: string, me: Member, initial: () => any) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const gameRef = useRef<GameRow | null>(null);
  gameRef.current = game;

  const adopt = useCallback((row: GameRow, fromPartner: boolean) => {
    const prev = gameRef.current;
    if (sameGame(prev, row)) return;
    if (fromPartner && prev?.id !== row.id && row.status === 'active') {
      setNotice(prev && prev.status !== 'active' ? 'Revancha aceptada' : 'Tu pareja empezó la partida');
    }
    setGame(row);
  }, []);

  const loadLatest = useCallback(async () => {
    const { data: active } = await supabase.from('games')
      .select('*').eq('couple_id', me.couple_id).eq('type', type).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (active) return active as GameRow;
    const { data } = await supabase.from('games')
      .select('*').eq('couple_id', me.couple_id).eq('type', type)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return (data as GameRow) ?? null;
  }, [me.couple_id, type]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const row = await loadLatest();
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
          if (!prev || prev.id === next.id || (next.status !== 'active' && !prev.status)) adopt(next, false);
          else if (prev.status !== 'active' && next.status !== 'active' && next.id !== prev.id
            && new Date(next.updated_at || 0) > new Date(prev.updated_at || 0)) {
            adopt(next, false);
          }
        },
      )
      .subscribe();

    const poll = setInterval(async () => {
      const row = await loadLatest();
      if (!row) return;
      const prev = gameRef.current;
      const fromPartner = row.status === 'active' && row.state?.first && row.state.first !== me.id && prev?.id !== row.id;
      adopt(row, Boolean(fromPartner));
    }, 2500);

    return () => {
      alive = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [adopt, loadLatest, me.couple_id, me.id, type]);

  const newGame = useCallback(async (firstTurn: string) => {
    const latest = await loadLatest();
    if (latest?.status === 'active') {
      adopt(latest, latest.state?.first !== me.id);
      return;
    }
    const { data, error } = await supabase.from('games')
      .insert({ couple_id: me.couple_id, type, state: initial(), turn: firstTurn, status: 'active' })
      .select().single();
    if (error) {
      const raced = await loadLatest();
      if (raced) adopt(raced, raced.state?.first !== me.id);
      return;
    }
    if (data) { setNotice(''); setGame(data as GameRow); }
  }, [adopt, initial, loadLatest, me.id, type]);

  const applyMove = useCallback(async (patch: Partial<GameRow>) => {
    if (!game) return;
    const state = { ...(patch.state ?? game.state) };
    delete state.rematch;
    const next = { ...patch, state, updated_at: new Date().toISOString() };
    setGame({ ...game, ...(next as any) });
    await supabase.from('games').update(next).eq('id', game.id);
  }, [game]);

  const askRematch = useCallback(async () => {
    const current = gameRef.current;
    if (!current || current.status === 'active') return;
    const pending = rematchOf(current);
    if (pending?.status === 'pending' && pending.from !== me.id) {
      const started = await startAcceptedGame(current);
      if (started) { setNotice(''); setGame(started); }
      return;
    }
    const next = await saveState(current, { from: me.id, status: 'pending' });
    setNotice('Esperando a que tu pareja acepte…');
    setGame(next);
  }, [me.id]);

  const acceptRematch = useCallback(async () => {
    const current = gameRef.current;
    if (!current) return;
    const started = await startAcceptedGame(current);
    if (started) { setNotice('Revancha aceptada'); setGame(started); }
  }, []);

  const rejectRematch = useCallback(async () => {
    const current = gameRef.current;
    if (!current) return;
    const next = await rejectRematchOn(current);
    setNotice('');
    setGame(next);
  }, []);

  return { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, reload: loadLatest, notice };
}
