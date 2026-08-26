import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { authErrorMessage, ensureAuth, rememberName, rememberedName, tz } from '../lib/session';
import { detectPlace } from '../lib/place';

export default function Pair({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState(rememberedName);
  const [codeIn, setCodeIn] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function place() {
    const detected = await detectPlace();
    return { timezone: detected.timezone || tz(), city: detected.city };
  }

  async function create() {
    setBusy(true); setErr('');
    try {
      await ensureAuth();
      const p = await place();
      const { data, error } = await supabase.rpc('create_couple', { p_name: name.trim(), p_timezone: p.timezone, p_city: p.city });
      if (error) return setErr(authErrorMessage(error));
      rememberName(name);
      setCreated(data as string);
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function join() {
    setBusy(true); setErr('');
    try {
      await ensureAuth();
      const p = await place();
      const { error } = await supabase.rpc('join_couple', { p_code: codeIn.toUpperCase(), p_name: name.trim(), p_timezone: p.timezone, p_city: p.city });
      if (error) {
        if (error.message === 'codigo_invalido') return setErr('Código no encontrado');
        if (error.message === 'pareja_llena') {
          return setErr('Esa pareja ya está completa. Entra con el mismo nombre que usaste en el otro aparato.');
        }
        return setErr(authErrorMessage(error));
      }
      rememberName(name);
      onDone();
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="center hero">
        <div className="hero-mark">🌊</div>
        <div className="title" style={{ fontSize: 32 }}>Faro</div>
        <p className="muted" style={{ textWrap: 'pretty' }}>Una pantalla, dos personas, cualquier distancia.</p>
      </div>

      {created ? (
        <div className="card">
          <p className="muted">Comparte este código con tu pareja:</p>
          <div className="code">{created}</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={onDone}>Entrar →</button>
        </div>
      ) : mode === 'choose' ? (
        <div className="card">
          <button className="btn" onClick={() => setMode('create')}>Crear nuestra pareja</button>
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setMode('join')}>Entrar en este dispositivo</button>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Si ya tienen pareja, entra con el código y tu mismo nombre. Así tomas tu asiento desde otro celular o computadora.
          </p>
        </div>
      ) : (
        <div className="card">
          {mode === 'join' && (<>
            <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>
              Código de la pareja y el nombre que ya usas. Si vienes de otro aparato, ese asiento pasa a este.
            </p>
            <label>Código de la pareja</label>
            <input className="input" style={{ letterSpacing: 6, textTransform: 'uppercase', textAlign: 'center' }} maxLength={6}
              value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase())} placeholder="ABC123" autoComplete="off" />
          </>)}
          <label>Tu nombre</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo te dice tu pareja" autoComplete="given-name" />
          <button className="btn" style={{ marginTop: 16 }} disabled={busy || !name.trim() || (mode === 'join' && codeIn.length !== 6)}
            onClick={mode === 'create' ? create : join}>
            {busy ? '…' : mode === 'create' ? 'Crear y obtener código' : 'Entrar aquí'}
          </button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => { setMode('choose'); setErr(''); }}>Atrás</button>
          {err && <p className="err">{err}</p>}
        </div>
      )}
    </div>
  );
}
