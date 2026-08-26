import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { GameRow } from './useGame';

export const GAME_META: Record<string, { name: string; href: string; icon: string }> = {
  ttt: { name: 'Tres en raya', href: '#/game/ttt', icon: '⭕' },
  c4: { name: '4 en línea', href: '#/game/c4', icon: '🔴' },
};

export function useActiveGames(coupleId: string) {
  const [active, setActive] = useState<GameRow[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.from('games').select('*').eq('couple_id', coupleId).eq('status', 'active')
      .then(({ data }) => { if (alive) setActive((data as GameRow[]) ?? []); });

    const channel = supabase
      .channel(`couple-games:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const row = payload.new as GameRow | undefined;
          if (!row?.id) return;
          setActive((prev) => {
            const rest = prev.filter((g) => g.id !== row.id && g.type !== row.type);
            return row.status === 'active' ? [...rest, row] : rest;
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  return active;
}
