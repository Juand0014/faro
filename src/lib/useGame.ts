import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { Member } from './session';
import { broadcastRematch, subscribeRematch } from './coupleLive';
import { initialStopState } from './stop';
import { initialHangState } from './hangman';

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

export function freshState(type: string, first: string, prev?: any) {
  if (type === 'c4') return { board: Array(42).fill(''), first };
  if (type === 'stop') return initialStopState(first, prev?.config);
  if (type === 'hang') return initialHangState(first, prev);
  return { board: Array(9).fill(''), first };
}

/**
 * Turno vigente para juegos de tablero. Si `turn` apunta a un asiento que ya no existe
 * (la pareja entró desde otro aparato) lo deduce de las fichas puestas, así nadie queda bloqueado.
 */
export function currentTurn(game: GameRow, meId: string, partnerId: string | null): string | null {
  if (game.turn === meId || (partnerId && game.turn === partnerId)) return game.turn;
  const board: string[] = game.state?.board ?? [];
  const first = game.state?.first === meId ? meId : partnerId;
  const other = first === meId ? partnerId : meId;
  return board.filter(Boolean).length % 2 === 0 ? first : other;
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
  const state = freshState(game.type, first, game.state);
  const turn = game.type === 'stop' ? null : game.type === 'hang' ? (state as { setter: string }).setter : first;
  const { data, error } = await supabase.from('games')
    .insert({ couple_id: game.couple_id, type: game.type, state, turn, status: 'active' })
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
    if (prev?.id === row.id && prev.status === 'active' && row.status === 'abandoned'
      && row.state?.stoppedBy && row.state.stoppedBy !== me.id) {
      setNotice('Tu pareja detuvo la partida');
    }
    setGame(row);
  }, [me.id]);

  const loadLatest = useCallback(async () => {
    const { data } = await supabase.from('games')
      .select('*').eq('couple_id', me.couple_id).eq('type', type)
      .order('updated_at', { ascending: false }).limit(12);
    const rows = (data as GameRow[]) ?? [];
    const pending = rows.find((g) => g.status !== 'active' && rematchOf(g)?.status === 'pending');
    if (pending) return pending;
    const active = rows.find((g) => g.status === 'active');
    if (active) return active;
    return rows[0] ?? null;
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
    }, 1500);

    const offLive = subscribeRematch((e) => {
      if (e.game.type !== type) return;
      if (e.rematch.status === 'pending') adopt(e.game, false);
      if (e.rematch.status === 'rejected' && e.rematch.from === me.id) {
        setNotice('Tu pareja rechazó la revancha');
        adopt(e.game, false);
      }
      if (e.rematch.status === 'accepted' && e.game.status === 'active') adopt(e.game, true);
    });

    return () => {
      alive = false;
      clearInterval(poll);
      offLive();
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

  /** Cierra la partida en curso para los dos: `reset` abre una nueva vacía, `exit` no abre ninguna. */
  const stopMatch = useCallback(async (mode: 'reset' | 'exit') => {
    const current = gameRef.current;
    if (!current) return;
    const stopped = { ...current.state, stoppedBy: me.id };
    delete stopped.rematch;
    await supabase.from('games')
      .update({ status: 'abandoned', state: stopped, updated_at: new Date().toISOString() })
      .eq('id', current.id);
    setNotice('');
    setGame({ ...current, status: 'abandoned', state: stopped });
    if (mode === 'exit') return;

    const state = freshState(type, me.id);
    const { data } = await supabase.from('games')
      .insert({ couple_id: me.couple_id, type, state, turn: type === 'stop' ? null : me.id, status: 'active' })
      .select().single();
    if (data) setGame(data as GameRow);
  }, [me.couple_id, me.id, type]);

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
    await broadcastRematch({ game: next, rematch: { from: me.id, status: 'pending' } });
  }, [me.id]);

  const acceptRematch = useCallback(async () => {
    const current = gameRef.current;
    if (!current) return;
    const started = await startAcceptedGame(current);
    if (started) {
      setNotice('Revancha aceptada');
      setGame(started);
      await broadcastRematch({ game: started, rematch: { from: current.state?.rematch?.from || me.id, status: 'accepted' } });
    }
  }, []);

  const rejectRematch = useCallback(async () => {
    const current = gameRef.current;
    if (!current) return;
    const next = await rejectRematchOn(current);
    setNotice('');
    setGame(next);
    const from = next.state?.rematch?.from;
    if (from) await broadcastRematch({ game: next, rematch: { from, status: 'rejected' } });
  }, []);

  return { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, stopMatch, reload: loadLatest, notice };
}
