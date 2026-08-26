import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../lib/session';
import LookFigure from '../components/LookFigure';
import {
  ACCS, BOTTOMS, defaultOutfit, DRESSES, DYES, HAIR_COLORS, HAIRS,
  OUTERS, SHOES, SKINS, TOPS, type LookRow, type Outfit,
} from '../lib/fashion';

type Tab = 'skin' | 'hair' | 'top' | 'bottom' | 'dress' | 'outer' | 'shoes' | 'acc';

const TABS: { id: Tab; label: string }[] = [
  { id: 'skin', label: 'Piel' },
  { id: 'hair', label: 'Pelo' },
  { id: 'top', label: 'Arriba' },
  { id: 'bottom', label: 'Abajo' },
  { id: 'dress', label: 'Vestido' },
  { id: 'outer', label: 'Abrigo' },
  { id: 'shoes', label: 'Zapatos' },
  { id: 'acc', label: 'Extra' },
];

export function useLooksInbox(coupleId: string, meId: string) {
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('looks').select('id,designer_id,status')
        .eq('couple_id', coupleId).eq('status', 'sent');
      const n = ((data as LookRow[]) ?? []).filter((l) => l.designer_id !== meId).length;
      if (alive) setWaiting(n);
    };
    load();
    const ch = supabase.channel(`looks-inbox:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'looks', filter: `couple_id=eq.${coupleId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [coupleId, meId]);
  return waiting;
}

export default function Fashion({ me }: { me: Member }) {
  const [looks, setLooks] = useState<LookRow[]>([]);
  const [mode, setMode] = useState<'gallery' | 'studio' | 'rate'>('gallery');
  const [current, setCurrent] = useState<LookRow | null>(null);
  const [outfit, setOutfit] = useState<Outfit>(defaultOutfit);
  const [title, setTitle] = useState('');
  const [tab, setTab] = useState<Tab>('hair');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase.from('looks').select('*')
      .eq('couple_id', me.couple_id).order('created_at', { ascending: false }).limit(80);
    setLooks((data as LookRow[]) ?? []);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel(`looks:${me.couple_id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'looks', filter: `couple_id=eq.${me.couple_id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me.couple_id]);

  const inbox = looks.filter((l) => l.status === 'sent' && l.designer_id !== me.id);
  const mineWaiting = looks.filter((l) => l.status === 'sent' && l.designer_id === me.id);
  const archive = looks.filter((l) => l.status === 'rated');

  function patch(partial: Partial<Outfit>) {
    setOutfit((o) => ({ ...o, ...partial }));
  }

  function startStudio() {
    setOutfit(defaultOutfit());
    setTitle('');
    setTab('hair');
    setErr('');
    setMode('studio');
  }

  async function sendLook() {
    if (busy) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('looks').insert({
      couple_id: me.couple_id,
      designer_id: me.id,
      title: title.trim().slice(0, 40),
      outfit,
      status: 'sent',
    });
    setBusy(false);
    if (error) { setErr('No se pudo guardar. Intenta de nuevo.'); return; }
    await load();
    setMode('gallery');
  }

  async function rate(look: LookRow, rating: number) {
    if (busy || look.designer_id === me.id) return;
    setBusy(true);
    await supabase.from('looks').update({
      rating, note: note.trim().slice(0, 200), status: 'rated', updated_at: new Date().toISOString(),
    }).eq('id', look.id);
    setBusy(false);
    setNote('');
    setCurrent(null);
    setMode('gallery');
    await load();
  }

  if (mode === 'studio') {
    return (
      <div className="wrap">
        <a className="muted" href="#/games" onClick={(e) => { e.preventDefault(); setMode('gallery'); }}>← Atelier</a>
        <div className="title" style={{ marginTop: 8 }}>Nuevo look</div>
        <p className="muted">Arma el outfit y envíaselo. Queda guardado para siempre.</p>
        <div className="look-stage">
          <LookFigure outfit={outfit} />
        </div>
        <input className="input" value={title} maxLength={40} placeholder="Nombre de la pieza (opcional)"
          onChange={(e) => setTitle(e.target.value)} />
        <div className="look-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <TabEditor tab={tab} outfit={outfit} onChange={patch} />
        <button className="btn" style={{ marginTop: 16 }} disabled={busy} onClick={sendLook}>Enviar a tu pareja</button>
        {err && <p className="err">{err}</p>}
      </div>
    );
  }

  if (mode === 'rate' && current) {
    return (
      <div className="wrap">
        <button className="muted look-back" type="button" onClick={() => { setMode('gallery'); setCurrent(null); }}>← Atelier</button>
        <div className="title" style={{ marginTop: 8 }}>{current.title || 'Sin título'}</div>
        <p className="muted">Puntúa del 1 al 10. El look queda en el archivo.</p>
        <div className="look-stage">
          <LookFigure outfit={current.outfit} />
        </div>
        <div className="look-scores">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" disabled={busy} onClick={() => rate(current, n)}>{n}</button>
          ))}
        </div>
        <input className="input" value={note} maxLength={200} placeholder="Qué te gustó (opcional)"
          onChange={(e) => setNote(e.target.value)} />
      </div>
    );
  }

  return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Atelier</div>
      <p className="muted">Diseña un look. Tu pareja lo valora del 1 al 10. Nada se borra.</p>
      <button className="btn" style={{ marginTop: 12 }} onClick={startStudio}>Nuevo look</button>

      {!!inbox.length && (
        <section>
          <div className="look-h">Para puntuar</div>
          <div className="look-grid">
            {inbox.map((l) => (
              <button key={l.id} type="button" className="look-card" onClick={() => { setCurrent(l); setNote(''); setMode('rate'); }}>
                <LookFigure outfit={l.outfit} compact />
                <span>{l.title || 'Sin título'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!mineWaiting.length && (
        <section>
          <div className="look-h">Esperando su nota</div>
          <div className="look-grid">
            {mineWaiting.map((l) => (
              <div key={l.id} className="look-card wait">
                <LookFigure outfit={l.outfit} compact />
                <span>{l.title || 'Sin título'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="look-h">Archivo</div>
        {!archive.length && <p className="locked">Todavía no hay looks puntuados.</p>}
        <div className="look-grid">
          {archive.map((l) => (
            <div key={l.id} className="look-card">
              <LookFigure outfit={l.outfit} compact />
              <span>{l.title || 'Sin título'}</span>
              <b>{l.rating}/10</b>
              {l.note && <em>{l.note}</em>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TabEditor({ tab, outfit, onChange }: { tab: Tab; outfit: Outfit; onChange: (p: Partial<Outfit>) => void }) {
  if (tab === 'skin') {
    return <Swatches items={SKINS} value={outfit.skin} onPick={(id) => onChange({ skin: id })} />;
  }
  if (tab === 'hair') {
    return (
      <>
        <Choices items={HAIRS} value={outfit.hair} onPick={(id) => onChange({ hair: id })} />
        <Swatches items={HAIR_COLORS} value={outfit.hairColor} onPick={(id) => onChange({ hairColor: id })} />
      </>
    );
  }
  if (tab === 'top') {
    return (
      <>
        <p className="locked">{outfit.dress !== 'none' ? 'El vestido cubre el arriba. Quítalo para usar polera o blusa.' : ''}</p>
        <Choices items={TOPS} value={outfit.top} onPick={(id) => onChange({ top: id, dress: 'none' })} />
        <Swatches items={DYES} value={outfit.topColor} onPick={(id) => onChange({ topColor: id })} />
      </>
    );
  }
  if (tab === 'bottom') {
    return (
      <>
        <p className="locked">{outfit.dress !== 'none' ? 'El vestido cubre el abajo.' : ''}</p>
        <Choices items={BOTTOMS} value={outfit.bottom} onPick={(id) => onChange({ bottom: id, dress: 'none' })} />
        <Swatches items={DYES} value={outfit.bottomColor} onPick={(id) => onChange({ bottomColor: id })} />
      </>
    );
  }
  if (tab === 'dress') {
    return (
      <>
        <Choices items={DRESSES} value={outfit.dress} onPick={(id) => onChange({ dress: id })} />
        {outfit.dress !== 'none' && <Swatches items={DYES} value={outfit.dressColor} onPick={(id) => onChange({ dressColor: id })} />}
      </>
    );
  }
  if (tab === 'outer') {
    return (
      <>
        <Choices items={OUTERS} value={outfit.outer} onPick={(id) => onChange({ outer: id })} />
        {outfit.outer !== 'none' && <Swatches items={DYES} value={outfit.outerColor} onPick={(id) => onChange({ outerColor: id })} />}
      </>
    );
  }
  if (tab === 'shoes') {
    return (
      <>
        <Choices items={SHOES} value={outfit.shoes} onPick={(id) => onChange({ shoes: id })} />
        <Swatches items={DYES} value={outfit.shoesColor} onPick={(id) => onChange({ shoesColor: id })} />
      </>
    );
  }
  return <Choices items={ACCS} value={outfit.acc} onPick={(id) => onChange({ acc: id })} />;
}

function Choices({ items, value, onPick }: { items: { id: string; name: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="look-choices">
      {items.map((it) => (
        <button key={it.id} type="button" className={value === it.id ? 'on' : ''} onClick={() => onPick(it.id)}>{it.name}</button>
      ))}
    </div>
  );
}

function Swatches({ items, value, onPick }: { items: { id: string; name: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="look-swatches">
      {items.map((it) => (
        <button key={it.id} type="button" aria-label={it.name} title={it.name}
          className={value === it.id ? 'on' : ''} style={{ background: it.id }} onClick={() => onPick(it.id)} />
      ))}
    </div>
  );
}
