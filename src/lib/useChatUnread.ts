import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { chatCutoff } from './clock';

export function useChatUnread(coupleId: string, myId: string, onChat: boolean) {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (onChat) { setUnread(false); return; }
    let alive = true;

    async function check() {
      const { data: people } = await supabase.from('members').select('timezone').eq('couple_id', coupleId);
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
          const row = payload.new as { from_id?: string };
          if (row?.from_id && row.from_id !== myId) setUnread(true);
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [coupleId, myId, onChat]);

  return unread;
}
