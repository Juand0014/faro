import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { rematchOf, type GameRow } from './useGame';

export const GAME_META: Record<string, { name: string; href: string; icon: string }> = {
  ttt: { name: 'Tres en raya', href: '#/game/ttt', icon: '⭕' },
  c4: { name: '4 en línea', href: '#/game/c4', icon: '🔴' },
  stop: { name: 'Stop', href: '#/game/stop', icon: '✏️' },
  hang: { name: 'Ahorcado', href: '#/game/hang', icon: '🪢' },
  draw: { name: 'Pictionary', href: '#/game/draw', icon: '🎨' },
  ships: { name: 'Batalla naval', href: '#/game/ships', icon: '🚢' },
  parchis: { name: 'Parchís', href: '#/game/parchis', icon: '🎲' },
  domino: { name: 'Dominó', href: '#/game/domino', icon: '🁫' },
  wordsearch: { name: 'Sopa de letras', href: '#/game/wordsearch', icon: '🔎' },
  look: { name: 'Atelier', href: '#/game/look', icon: '👗' },
};

export function useCoupleGames(coupleId: string) {
  const [active, setActive] = useState<GameRow[]>([]);
  const [rematches, setRematches] = useState<GameRow[]>([]);

  useEffect(() => {
    let alive = true;

    const split = (rows: GameRow[]) => {
      const latestByType = new Map<string, GameRow>();
      for (const row of rows) {
        const prev = latestByType.get(row.type);
        if (!prev || new Date(row.created_at || row.updated_at || 0) > new Date(prev.created_at || prev.updated_at || 0)) {
          latestByType.set(row.type, row);
        }
      }
      const list = [...latestByType.values()];
      setActive(list.filter((g) => g.status === 'active'));
      setRematches(list.filter((g) => {
        const r = rematchOf(g);
        return g.status !== 'active' && (r?.status === 'pending' || r?.status === 'rejected');
      }));
    };

    supabase.from('games').select('*').eq('couple_id', coupleId)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (alive) split((data as GameRow[]) ?? []); });

    const channel = supabase
      .channel(`couple-games:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const row = payload.new as GameRow | undefined;
          if (!row?.id) return;
          setActive((prevA) => {
            const rest = prevA.filter((g) => g.id !== row.id && g.type !== row.type);
            return row.status === 'active' ? [...rest, row] : rest;
          });
          setRematches((prevR) => {
            const rest = prevR.filter((g) => g.id !== row.id && g.type !== row.type);
            const r = rematchOf(row);
            const open = row.status !== 'active' && (r?.status === 'pending' || r?.status === 'rejected');
            return open ? [...rest, row] : rest;
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  return { active, rematches };
}

export const useActiveGames = useCoupleGames;
