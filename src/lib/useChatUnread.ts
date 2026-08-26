import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { chatCutoff } from './clock';
import { showPingNotice } from './notify';

export function useChatUnread(coupleId: string, myId: string, onChat: boolean) {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (onChat) { setUnread(false); return; }
    let alive = true;
    const names = new Map<string, string>();

    async function check() {
      const { data: people } = await supabase.from('members').select('id,name,timezone').eq('couple_id', coupleId);
      for (const m of (people as { id: string; name: string; timezone: string }[]) ?? []) {
        names.set(m.id, m.name);
      }
      const zones = ((people as { timezone: string }[]) ?? []).map((m) => m.timezone);
      const cutoff = chatCutoff(zones.length ? zones : ['UTC']);
      const seen = Number(localStorage.getItem(`faro-chat-seen:${coupleId}`) || 0);
      const { data } = await supabase.from('chat_messages').select('id, from_id')
        .eq('couple_id', coupleId)
        .gte('created_at', cutoff.toISOString())
        .order('id', { ascending: false }).limit(1);
      const last = data?.[0] as { id: number; from_id: string } | undefined;
      if (alive) setUnread(Boolean(last && last.id > seen && last.from_id !== myId));
    }

    check();
    const channel = supabase.channel(`chat-unread:${coupleId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const row = payload.new as { from_id?: string; body?: string };
          if (!row?.from_id || row.from_id === myId) return;
          setUnread(true);
          if (document.visibilityState !== 'visible') return;
          const who = names.get(row.from_id) || 'Tu pareja';
          navigator.vibrate?.(200);
          showPingNotice(row.body || '', 'faro-chat', `Desde faro · ${who}`, './#/chat');
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [coupleId, myId, onChat]);

  return unread;
}
