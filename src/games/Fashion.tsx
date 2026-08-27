import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../lib/session';
import LookFigure from '../components/LookFigure';
import GarmentSketch from '../components/GarmentSketch';
import {
  ACCS, BOTTOMS, defaultOutfit, DRESSES, DYES, FACES, HAIR_COLORS, HAIRS,
  fashionChallenge, FITS, formatRatingNote, LENGTHS, MATERIALS, NECKLINES, normalizeOutfit,
  OUTERS, parseRatingNote, PATTERNS, SHOES, SKINS, SLEEVES, TOPS,
  type FashionReaction, type LookRow, type Outfit,
} from '../lib/fashion';
import {
  deleteFashionDraft, loadFashionDraft, purgeExpiredFashionDrafts, saveFashionDraft,
  wipeFashionDrafts,
} from '../lib/fashionDrafts';

type Tab = 'model' | 'silhouette' | 'palette' | 'details';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'model', icon: '①', label: 'Modelo' },
  { id: 'silhouette', icon: '②', label: 'Prendas' },
  { id: 'palette', icon: '③', label: 'Telas' },
  { id: 'details', icon: '④', label: 'Detalles' },
];

const REACTIONS: { id: FashionReaction; label: string }[] = [
  { id: 'love', label: 'Me encanta' },
  { id: 'wear', label: 'Me lo pondría' },
  { id: 'wow', label: 'Impactante' },
  { id: 'bold', label: 'Atrevido' },
];

const normalizeLook = (look: LookRow): LookRow => ({
  ...look,
  outfit: normalizeOutfit(look.outfit),
});

function isLookRow(value: unknown): value is LookRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.couple_id === 'string'
    && typeof row.designer_id === 'string'
    && typeof row.title === 'string'
    && typeof row.note === 'string'
    && typeof row.created_at === 'string'
    && (row.status === 'sent' || row.status === 'rated')
    && (row.rating === null || typeof row.rating === 'number')
    && typeof row.outfit === 'object' && row.outfit !== null;
}

async function fetchLooks(coupleId: string): Promise<LookRow[]> {
  const { data, error } = await supabase.from('looks').select('*')
    .eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(80);
  if (error) throw error;
  return (data ?? []).filter(isLookRow).map(normalizeLook);
}

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
    // Sufijo único: dos instancias del hook con el mismo tema comparten canal y el segundo `on`
    // explota por llegar después del `subscribe`.
    const ch = supabase.channel(`looks-inbox:${coupleId}:${crypto.randomUUID()}`)
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
  const [tab, setTab] = useState<Tab>('model');
  const [studioMode, setStudioMode] = useState<'free' | 'challenge'>('free');
  const [hasDraft, setHasDraft] = useState(false);
  const [note, setNote] = useState('');
  const [reaction, setReaction] = useState<FashionReaction>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const latestStudio = useRef({ outfit, title, studioMode });

  useEffect(() => {
    let alive = true;
    fetchLooks(me.couple_id)
      .then((rows) => { if (alive) setLooks(rows); })
      .catch(() => { if (alive) setErr('No se pudieron cargar los looks.'); });
    const ch = supabase.channel(`looks:${me.couple_id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'looks', filter: `couple_id=eq.${me.couple_id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: unknown })?.id;
            if (typeof id === 'string') setLooks((rows) => rows.filter((row) => row.id !== id));
            return;
          }
          const raw = payload.new;
          if (!isLookRow(raw)) return;
          const next = normalizeLook(raw);
          setLooks((rows) => [next, ...rows.filter((row) => row.id !== next.id)]
            .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80));
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [me.couple_id]);

  useEffect(() => {
    let alive = true;
    const inspect = async () => {
      const owner = `${me.couple_id}:${me.id}`;
      try {
        const prior = localStorage.getItem('faro-atelier-owner');
        if (prior && prior !== owner) await wipeFashionDrafts();
        localStorage.setItem('faro-atelier-owner', owner);
      } catch { /* storage can be unavailable in private mode */ }
      await purgeExpiredFashionDrafts();
      const draft = await loadFashionDraft(me.couple_id, me.id);
      if (alive) setHasDraft(Boolean(draft));
    };
    inspect();
    const onVisible = () => { if (document.visibilityState === 'visible') inspect(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
  }, [me.couple_id, me.id]);

  useEffect(() => {
    if (mode !== 'studio') return;
    const timer = window.setTimeout(() => {
      saveFashionDraft({
        coupleId: me.couple_id,
        designerId: me.id,
        title,
        outfit: normalizeOutfit(outfit),
        mode: studioMode,
      }).then(() => setHasDraft(true)).catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [mode, outfit, title, studioMode, me.couple_id, me.id]);

  useEffect(() => {
    latestStudio.current = { outfit, title, studioMode };
  }, [outfit, title, studioMode]);

  useEffect(() => {
    if (mode !== 'studio') return;
    const saveNow = () => {
      const latest = latestStudio.current;
      saveFashionDraft({
        coupleId: me.couple_id,
        designerId: me.id,
        title: latest.title,
        outfit: normalizeOutfit(latest.outfit),
        mode: latest.studioMode,
      }).catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') saveNow(); };
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode, me.couple_id, me.id]);

  const inbox = looks.filter((l) => l.status === 'sent' && l.designer_id !== me.id);
  const mineWaiting = looks.filter((l) => l.status === 'sent' && l.designer_id === me.id);
  const archive = looks.filter((l) => l.status === 'rated');

  function patch(partial: Partial<Outfit>) {
    setOutfit((o) => ({ ...o, ...partial }));
  }

  function startStudio(kind: 'free' | 'challenge') {
    const next = defaultOutfit();
    if (kind === 'challenge') next.challengeSeed = Date.now() % 1_000_000;
    setOutfit(next);
    setTitle('');
    setStudioMode(kind);
    setTab('model');
    setErr('');
    setMode('studio');
  }

  async function continueDraft() {
    const draft = await loadFashionDraft(me.couple_id, me.id);
    if (!draft) { setHasDraft(false); return; }
    setOutfit(normalizeOutfit(draft.outfit));
    setTitle(draft.title);
    setStudioMode(draft.mode);
    setTab('model');
    setErr('');
    setMode('studio');
  }

  async function leaveStudio() {
    await saveFashionDraft({
      coupleId: me.couple_id,
      designerId: me.id,
      title,
      outfit: normalizeOutfit(outfit),
      mode: studioMode,
    });
    setHasDraft(true);
    setMode('gallery');
  }

  async function sendLook() {
    if (busy) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('looks').insert({
      couple_id: me.couple_id,
      designer_id: me.id,
      title: title.trim().slice(0, 40),
      outfit: normalizeOutfit(outfit),
      status: 'sent',
    });
    setBusy(false);
    if (error) { setErr('No se pudo guardar. Intenta de nuevo.'); return; }
    await deleteFashionDraft(me.couple_id, me.id);
    setHasDraft(false);
    try { setLooks(await fetchLooks(me.couple_id)); } catch { /* realtime remains active */ }
    setMode('gallery');
  }

  async function rate(look: LookRow, rating: number) {
    if (busy || look.designer_id === me.id) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('looks').update({
      rating, note: formatRatingNote(reaction, note), status: 'rated',
    }).eq('id', look.id);
    setBusy(false);
    if (error) {
      setErr('No se pudo guardar la puntuación. Intenta de nuevo.');
      return;
    }
    setNote('');
    setReaction('');
    setCurrent(null);
    setMode('gallery');
    try { setLooks(await fetchLooks(me.couple_id)); } catch { /* realtime remains active */ }
  }

  if (mode === 'studio') {
    const challenge = outfit.challengeSeed === null ? null : fashionChallenge(outfit.challengeSeed);
    return (
      <div className="wrap">
        <button className="muted look-back" type="button" onClick={leaveStudio}>← Atelier</button>
        <div className="look-studio-title">
          <div>
            <div className="title">Atelier</div>
            <p className="muted">Tu mesa de croquis editorial.</p>
          </div>
          {!!outfit.art.length && <span className="pill">✏️ {outfit.art.length} trazos</span>}
        </div>
        {challenge && (
          <aside className="look-brief" aria-label="Reto sorpresa">
            <span>Reto sorpresa</span>
            <strong>{challenge.brief}</strong>
          </aside>
        )}
        <div className="look-stage"><LookFigure outfit={outfit} /></div>
        <input className="input" value={title} maxLength={40} placeholder="Nombre de la pieza (opcional)"
          aria-label="Nombre del look"
          onChange={(e) => setTitle(e.target.value)} />
        <div className="look-tabs" aria-label="Pasos del diseño">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id}
              className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <TabEditor tab={tab} outfit={outfit} onChange={patch} />
        <button className="btn look-send" type="button" disabled={busy} onClick={sendLook}>
          {busy ? 'Guardando…' : 'Terminar y enviar ✦'}
        </button>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    );
  }

  if (mode === 'rate' && current) {
    const challenge = current.outfit.challengeSeed === null
      ? null
      : fashionChallenge(current.outfit.challengeSeed);
    return (
      <div className="wrap">
        <button className="muted look-back" type="button" onClick={() => { setMode('gallery'); setCurrent(null); }}>← Atelier</button>
        <div className="title" style={{ marginTop: 8 }}>{current.title || 'Sin título'}</div>
        <p className="muted">Mira el croquis, deja una reacción y puntúa del 1 al 10.</p>
        {challenge && <div className="look-brief compact"><span>El reto era</span><strong>{challenge.brief}</strong></div>}
        <div className="look-stage">
          <LookFigure outfit={current.outfit} />
        </div>
        <div className="look-reactions" role="group" aria-label="Reacción al look">
          {REACTIONS.map((item) => (
            <button key={item.id} type="button" disabled={busy} aria-pressed={reaction === item.id}
              className={reaction === item.id ? 'on' : ''}
              onClick={() => setReaction((value) => value === item.id ? '' : item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <input className="input" value={note} maxLength={200} placeholder="Qué te gustó (opcional)"
          aria-label="Comentario sobre el look"
          onChange={(e) => setNote(e.target.value)} />
        <p className="look-label">Puntuación final</p>
        <div className="look-scores">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" disabled={busy} aria-label={`Puntuar ${n} de 10 y guardar`}
              onClick={() => rate(current, n)}>{n}</button>
          ))}
        </div>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    );
  }

  return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="look-cover">
        <span className="look-cover-mark">✦</span>
        <div>
          <div className="title">Atelier</div>
          <p>Diseña croquis, dibuja detalles y conviértelos en recuerdos de ustedes.</p>
        </div>
      </div>
      {hasDraft && (
        <button className="btn look-continue" type="button" onClick={continueDraft}>Continuar mi borrador</button>
      )}
      <div className="look-start">
        <button type="button" onClick={() => startStudio('free')}>
          <strong>Estudio libre</strong><span>Diseña sin reglas</span>
        </button>
        <button type="button" onClick={() => startStudio('challenge')}>
          <strong>Reto sorpresa</strong><span>Una ocasión, un estilo y una condición</span>
        </button>
      </div>

      {!!inbox.length && (
        <section>
          <div className="look-h">Para puntuar</div>
          <div className="look-grid">
            {inbox.map((l) => (
              <button key={l.id} type="button" className="look-card" onClick={() => {
                setCurrent(l); setNote(''); setReaction(''); setErr(''); setMode('rate');
              }}>
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
          {archive.map((l) => {
            const parsed = parseRatingNote(l.note);
            return (
              <div key={l.id} className="look-card">
                <LookFigure outfit={l.outfit} compact />
                <span>{l.title || 'Sin título'}</span>
                <b>{l.rating}/10</b>
                {parsed.reaction && (
                  <small>{REACTIONS.find((item) => item.id === parsed.reaction)?.label}</small>
                )}
                {parsed.note && <em>{parsed.note}</em>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TabEditor({ tab, outfit, onChange }: { tab: Tab; outfit: Outfit; onChange: (p: Partial<Outfit>) => void }) {
  if (tab === 'model') {
    return (
      <EditorSection title="Elige tu modelo">
        <p className="look-label">Tono de piel</p>
        <Swatches items={SKINS} value={outfit.skin} onPick={(id) => onChange({ skin: id })} />
        <p className="look-label">Expresión</p>
        <Choices items={FACES} value={outfit.face} onPick={(id) => onChange({ face: id })} />
        <p className="look-label">Peinado</p>
        <Choices items={HAIRS} value={outfit.hair} onPick={(id) => onChange({ hair: id })} />
        <Swatches items={HAIR_COLORS} value={outfit.hairColor} onPick={(id) => onChange({ hairColor: id })} />
      </EditorSection>
    );
  }
  if (tab === 'silhouette') {
    return (
      <EditorSection title="Construye la silueta">
        <p className="look-label">Vestido o prendas separadas</p>
        <Choices items={DRESSES} value={outfit.dress} onPick={(id) => onChange({ dress: id })} />
        {outfit.dress === 'none' && <>
          <p className="look-label">Parte de arriba</p>
          <Choices items={TOPS} value={outfit.top} onPick={(id) => onChange({ top: id })} />
          <Choices items={FITS} value={outfit.topFit} onPick={(id) => onChange({ topFit: id as Outfit['topFit'] })} />
          <Choices items={SLEEVES} value={outfit.sleeve} onPick={(id) => onChange({ sleeve: id as Outfit['sleeve'] })} />
          <Choices items={NECKLINES} value={outfit.neckline} onPick={(id) => onChange({ neckline: id as Outfit['neckline'] })} />
          <p className="look-label">Falda o pantalón</p>
          <Choices items={BOTTOMS} value={outfit.bottom} onPick={(id) => onChange({ bottom: id })} />
          <Choices items={LENGTHS} value={outfit.bottomLength} onPick={(id) => onChange({ bottomLength: id as Outfit['bottomLength'] })} />
        </>}
        {outfit.dress !== 'none' && (
          <Choices items={LENGTHS} value={outfit.dressLength} onPick={(id) => onChange({ dressLength: id as Outfit['dressLength'] })} />
        )}
        <p className="look-label">Tercera pieza</p>
        <Choices items={OUTERS} value={outfit.outer} onPick={(id) => onChange({ outer: id })} />
      </EditorSection>
    );
  }
  if (tab === 'palette') {
    const dress = outfit.dress !== 'none';
    return (
      <EditorSection title="Color, tela y estampado">
        {dress ? <>
          <p className="look-label">Vestido</p>
          <Swatches items={DYES} value={outfit.dressColor} onPick={(id) => onChange({ dressColor: id })} />
          <Choices items={MATERIALS} value={outfit.dressMaterial} onPick={(id) => onChange({ dressMaterial: id as Outfit['dressMaterial'] })} />
          <Choices items={PATTERNS} value={outfit.dressPattern} onPick={(id) => onChange({ dressPattern: id })} />
        </> : <>
          <p className="look-label">Parte de arriba</p>
          <Swatches items={DYES} value={outfit.topColor} onPick={(id) => onChange({ topColor: id })} />
          <Choices items={MATERIALS} value={outfit.topMaterial} onPick={(id) => onChange({ topMaterial: id as Outfit['topMaterial'] })} />
          <Choices items={PATTERNS} value={outfit.topPattern} onPick={(id) => onChange({ topPattern: id })} />
          <p className="look-label">Falda o pantalón</p>
          <Swatches items={DYES} value={outfit.bottomColor} onPick={(id) => onChange({ bottomColor: id })} />
          <Choices items={MATERIALS} value={outfit.bottomMaterial} onPick={(id) => onChange({ bottomMaterial: id as Outfit['bottomMaterial'] })} />
          <Choices items={PATTERNS} value={outfit.bottomPattern} onPick={(id) => onChange({ bottomPattern: id })} />
        </>}
        {outfit.outer !== 'none' && <>
          <p className="look-label">Tercera pieza</p>
          <Swatches items={DYES} value={outfit.outerColor} onPick={(id) => onChange({ outerColor: id })} />
          <Choices items={MATERIALS} value={outfit.outerMaterial} onPick={(id) => onChange({ outerMaterial: id as Outfit['outerMaterial'] })} />
        </>}
      </EditorSection>
    );
  }
  return (
    <EditorSection title="Detalles finales">
      <p className="look-label">Zapatos</p>
      <Choices items={SHOES} value={outfit.shoes} onPick={(id) => onChange({ shoes: id })} />
      <Swatches items={DYES} value={outfit.shoesColor} onPick={(id) => onChange({ shoesColor: id })} />
      <p className="look-label">Accesorio protagonista</p>
      <Choices items={ACCS} value={outfit.acc} onPick={(id) => onChange({ acc: id })} />
      <GarmentSketch art={outfit.art} onChange={(art) => onChange({ art })}
        initialTarget={outfit.dress !== 'none' ? 'dress' : 'top'}
        onTargetChange={(target) => {
          if (target === 'dress' && outfit.dress === 'none') onChange({ dress: 'slip' });
          if (target !== 'dress' && outfit.dress !== 'none') onChange({ dress: 'none' });
        }} />
    </EditorSection>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="look-editor"><div className="look-editor-title">{title}</div>{children}</section>;
}

function Choices({ items, value, onPick }: { items: { id: string; name: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="look-choices">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={value === it.id}
          className={value === it.id ? 'on' : ''} onClick={() => onPick(it.id)}>{it.name}</button>
      ))}
    </div>
  );
}

function Swatches({ items, value, onPick }: { items: { id: string; name: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="look-swatches">
      {items.map((it) => (
        <button key={it.id} type="button" aria-label={it.name} title={it.name}
          aria-pressed={value === it.id} className={value === it.id ? 'on' : ''}
          style={{ background: it.id }} onClick={() => onPick(it.id)} />
      ))}
    </div>
  );
}
