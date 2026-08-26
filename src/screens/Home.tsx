import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../lib/session';
import { localTime, dayStatus, STATUS_ES } from '../lib/clock';
import { prettyPlace } from '../lib/place';
import { GAME_META } from '../lib/useActiveGames';
import { rejectRematchOn, rematchOf, startAcceptedGame, type GameRow } from '../lib/useGame';

export default function Home({ me, activeGames, rematches }: { me: Member; activeGames: GameRow[]; rematches: GameRow[] }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [beacon, setBeacon] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    supabase.from('members').select('*').eq('couple_id', me.couple_id).then(({ data }) => setMembers((data as Member[]) ?? []));
    const t = setInterval(() => tick((n) => n + 1), 30000); // refresca relojes
    return () => clearInterval(t);
  }, [me.couple_id]);

  useEffect(() => {
    // pings entrantes
    const pingCh = supabase.channel('pings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pings', filter: `couple_id=eq.${me.couple_id}` },
        (p: any) => { if (p.new.from_id !== me.id) { setBeacon(true); setFlash('💛 Está pensando en ti'); navigator.vibrate?.(200); setTimeout(() => setBeacon(false), 900); setTimeout(() => setFlash(null), 3000); } })
      .subscribe();
    // presencia
    const presCh = supabase.channel('presence', { config: { presence: { key: me.id } } });
    presCh.on('presence', { event: 'sync' }, () => {
      const st = presCh.presenceState(); setOnline(new Set(Object.keys(st)));
    }).subscribe(async (s) => { if (s === 'SUBSCRIBED') await presCh.track({ at: Date.now() }); });
    return () => { supabase.removeChannel(pingCh); supabase.removeChannel(presCh); };
  }, [me.couple_id, me.id]);

  async function think() {
    setBeacon(true); navigator.vibrate?.(60); setFlash('Señal enviada 🌟');
    setTimeout(() => setBeacon(false), 900); setTimeout(() => setFlash(null), 2000);
    await supabase.from('pings').insert({ couple_id: me.couple_id, from_id: me.id });
  }

  const partner = members.find((m) => m.id !== me.id) || null;
  const mine = members.find((m) => m.id === me.id) || me;

  const panel = (m: Member | null, isMe: boolean) => {
    const isOnline = m ? online.has(m.id) : false;
    const status = m ? (isOnline ? 'online' : dayStatus(m.timezone)) : 'offline';
    return (
      <div className={'p' + (isMe ? ' me' : ' you')}>
        <div className="who">{isMe ? 'Tú' : 'Tu pareja'}</div>
        <div className="nm">{m?.name ?? '—'}</div>
        <div className="tz">{m ? prettyPlace(m.city, m.timezone) : '—'}</div>
        <div className="clock">{m ? localTime(m.timezone) : '--:--'}</div>
        <div className="pill"><span className={'dot ' + status} />{STATUS_ES[status] ?? '—'}</div>
      </div>
    );
  };

  return (
    <div className="wrap">
      <div className={'beacon' + (beacon ? ' on' : '')} />
      <div className="title">Mismo cielo</div>
      <p className="muted">Ahora mismo, los dos, aunque el reloj no coincida.</p>
      <div className="sky" style={{ marginTop: 14 }}>{panel(mine, true)}{panel(partner, false)}</div>

      <button className="think" onClick={think}>Pienso en ti<span>Un toque enciende su faro</span></button>

      {!partner && (
        <div className="card">
          <p className="muted">Aún falta tu pareja. Comparte tu código desde la pantalla de inicio, o pídeselo.</p>
        </div>
      )}

      {activeGames.filter((g) => g.state?.first && g.state.first !== me.id).map((g) => {
        const meta = GAME_META[g.type];
        if (!meta) return null;
        return (
          <a key={g.id} href={meta.href} className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <div className="livepill">{meta.icon} Tu pareja empezó {meta.name}</div>
            <p className="muted" style={{ margin: '8px 0 0' }}>Entra a la misma partida →</p>
          </a>
        );
      })}

      {rematches.map((g) => {
        const meta = GAME_META[g.type];
        const ask = rematchOf(g);
        if (!meta || !ask) return null;
        if (ask.status === 'rejected' && ask.from === me.id) {
          return (
            <div key={g.id} className="card">
              <p className="err">{meta.icon} Tu pareja rechazó la revancha de {meta.name}</p>
            </div>
          );
        }
        if (ask.status !== 'pending') return null;
        if (ask.from === me.id) {
          return (
            <div key={g.id} className="card">
              <div className="livepill">{meta.icon} Esperando revancha de {meta.name}</div>
              <p className="muted" style={{ margin: '8px 0 0' }}>Tu pareja aún no responde.</p>
            </div>
          );
        }
        return (
          <div key={g.id} className="card">
            <div className="livepill">{meta.icon} Tu pareja quiere revancha en {meta.name}</div>
            <button className="btn" style={{ marginTop: 12 }} onClick={async () => {
              const started = await startAcceptedGame(g);
              if (started) window.location.hash = meta.href.slice(1);
            }}>Aceptar</button>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => rejectRematchOn(g)}>Rechazar</button>
          </div>
        );
      })}

      {flash && (
        <div style={{ position: 'fixed', bottom: 92, left: 0, right: 0, textAlign: 'center', zIndex: 60 }}>
          <span className="pill" style={{ background: 'rgba(242,179,87,.18)', color: 'var(--gold)' }}>{flash}</span>
        </div>
      )}
    </div>
  );
}
