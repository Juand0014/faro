import { FormEvent, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../lib/session';
import { chatCutoff } from '../lib/clock';

export type ChatMsg = { id: number; from_id: string; body: string; created_at: string };

const MAX = 280;
const seenKey = (coupleId: string) => `faro-chat-seen:${coupleId}`;

export function markChatSeen(coupleId: string, lastId: number) {
  if (lastId > 0) localStorage.setItem(seenKey(coupleId), String(lastId));
}

export default function Chat({ me }: { me: Member }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [rows, setRows] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const zones = members.map((m) => m.timezone);

  async function sweepAndLoad() {
    const cutoff = chatCutoff(zones.length ? zones : [me.timezone]);
    await supabase.from('chat_messages').delete()
      .eq('couple_id', me.couple_id).lt('created_at', cutoff.toISOString());
    const { data } = await supabase.from('chat_messages')
      .select('id, from_id, body, created_at')
      .eq('couple_id', me.couple_id)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: true })
      .limit(200);
    const next = (data as ChatMsg[]) ?? [];
    setRows(next);
    const last = next[next.length - 1];
    if (last) markChatSeen(me.couple_id, last.id);
  }

  useEffect(() => {
    supabase.from('members').select('*').eq('couple_id', me.couple_id)
      .then(({ data }) => setMembers((data as Member[]) ?? [me]));
  }, [me.couple_id, me]);

  useEffect(() => {
    if (!members.length) return;
    sweepAndLoad();
    const channel = supabase.channel(`chat:${me.couple_id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `couple_id=eq.${me.couple_id}` },
        (payload) => {
          const row = payload.new as ChatMsg;
          if (!row?.id) return;
          const cutoff = chatCutoff(zones.length ? zones : [me.timezone]);
          if (new Date(row.created_at) < cutoff) return;
          setRows((cur) => cur.some((m) => m.id === row.id) ? cur : [...cur, row]);
          markChatSeen(me.couple_id, row.id);
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `couple_id=eq.${me.couple_id}` },
        (payload) => {
          const id = (payload.old as { id?: number })?.id;
          if (id) setRows((cur) => cur.filter((m) => m.id !== id));
        })
      .subscribe();
    const tick = setInterval(sweepAndLoad, 60_000);
    return () => {
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [me.couple_id, me.timezone, members.map((m) => m.timezone).join('|')]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [rows.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim().slice(0, MAX);
    if (!body || busy) return;
    setBusy(true);
    setErr('');
    setDraft('');
    const { error } = await supabase.from('chat_messages').insert({
      couple_id: me.couple_id, from_id: me.id, body,
    });
    if (error) {
      setDraft(body);
      setErr('No se pudo enviar. Intenta de nuevo.');
    }
    setBusy(false);
  }

  function who(id: string) {
    if (id === me.id) return 'Tú';
    return members.find((m) => m.id === id)?.name || 'Tu pareja';
  }

  function stamp(iso: string) {
    return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="wrap chat-wrap">
      <div className="title">Chat</div>
      <p className="muted">Mini recado de hoy. A las 11 de la noche se borra solo.</p>

      <div className="chat-log" ref={logRef}>
        {!rows.length && (
          <div className="card center">
            <p className="muted">Todavía no hay nada. Escribe lo que se te ocurra — mañana no va a estar.</p>
          </div>
        )}
        {rows.map((m) => (
          <div key={m.id} className={'bubble' + (m.from_id === me.id ? ' me' : ' you')}>
            <div className="bubble-who">{who(m.from_id)} · {stamp(m.created_at)}</div>
            {m.body}
          </div>
        ))}
      </div>

      <form className="chat-composer" onSubmit={send}>
        <input className="input" value={draft} maxLength={MAX} autoComplete="off"
          placeholder="Escribe aquí…"
          onChange={(e) => setDraft(e.target.value)} />
        <button className="btn" disabled={busy || !draft.trim()}>Enviar</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
