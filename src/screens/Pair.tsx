import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { authErrorMessage, ensureAuth, tz } from '../lib/session';

export default function Pair({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true); setErr('');
    try {
      await ensureAuth();
      const { data, error } = await supabase.rpc('create_couple', { p_name: name, p_timezone: tz(), p_city: city || null });
      if (error) return setErr(authErrorMessage(error));
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
      const { error } = await supabase.rpc('join_couple', { p_code: codeIn.toUpperCase(), p_name: name, p_timezone: tz(), p_city: city || null });
      if (error) {
        return setErr(error.message === 'codigo_invalido' ? 'Código no encontrado' : error.message === 'pareja_llena' ? 'Esa pareja ya está completa' : authErrorMessage(error));
      }
      onDone();
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="center" style={{ margin: '38px 0 6px' }}>
        <div style={{ fontSize: 44 }}>🌊</div>
        <div className="title" style={{ fontSize: 30 }}>Faro</div>
        <p className="muted">Una pantalla, dos personas, cualquier distancia.</p>
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
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setMode('join')}>Tengo un código</button>
        </div>
      ) : (
        <div className="card">
          {mode === 'join' && (<>
            <label>Código de invitación</label>
            <input className="input" style={{ letterSpacing: 6, textTransform: 'uppercase' }} maxLength={6}
              value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase())} placeholder="ABC123" />
          </>)}
          <label>Tu nombre</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan" />
          <label>Tu ciudad (opcional, para "Mismo cielo")</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="La Vega" />
          <button className="btn" style={{ marginTop: 14 }} disabled={busy || !name || (mode === 'join' && codeIn.length !== 6)}
            onClick={mode === 'create' ? create : join}>
            {busy ? '...' : mode === 'create' ? 'Crear y obtener código' : 'Enlazar'}
          </button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => { setMode('choose'); setErr(''); }}>Atrás</button>
          {err && <p className="err">{err}</p>}
        </div>
      )}
    </div>
  );
}
