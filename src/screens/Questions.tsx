import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../lib/session';

const BANK = [
  '¿Qué pequeño detalle mío extrañas más cuando no estoy?',
  'Si pudiéramos teletransportarnos ahora mismo a un solo lugar juntos, ¿cuál sería?',
  '¿Cuál fue el momento exacto en que supiste que te estabas enamorando?',
  '¿Qué canción te hace pensar en mí sin falta?',
  '¿Qué te gustaría hacer la primera hora que volvamos a estar juntos?',
  '¿Hay algo que quisiste decirme esta semana y no encontraste el momento?',
  '¿Qué versión de nosotros dentro de cinco años te emociona más?',
  '¿Qué olor o comida te transporta directo a un recuerdo conmigo?',
  '¿Qué es algo tuyo que sientes que solo yo entiendo?',
  '¿Cuál fue tu momento favorito de hoy, por pequeño que sea?',
];
const todayStr = () => new Date().toISOString().slice(0, 10);
function promptFor(day: string) {
  let h = 0; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BANK[h % BANK.length];
}

export default function Questions({ me }: { me: Member }) {
  const day = todayStr();
  const prompt = promptFor(day);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('daily_answers').select('*').eq('couple_id', me.couple_id).eq('day', day);
    setRows(data ?? []);
    const mine = (data ?? []).find((r: any) => r.member_id === me.id);
    if (mine) setText(mine.answer);
  };
  useEffect(() => { load(); }, [me.couple_id]);

  async function submit() {
    setBusy(true);
    await supabase.from('daily_answers').upsert(
      { couple_id: me.couple_id, member_id: me.id, day, prompt, answer: text },
      { onConflict: 'couple_id,member_id,day' });
    await load();
    setBusy(false);
  }

  const both = rows.length >= 2;
  const iAnswered = rows.some((r) => r.member_id === me.id);

  return (
    <div className="wrap">
      <div className="title">Pregunta del día</div>
      <p className="muted">{day}</p>
      <div className="card">
        <div className="qtext">{prompt}</div>
        {!both ? (
          <>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe desde el corazón…" />
            <button className="btn" style={{ marginTop: 12 }} disabled={!text.trim() || busy} onClick={submit}>
              {iAnswered ? 'Actualizar mi respuesta' : 'Responder'}
            </button>
            <div className="locked">🔒 {iAnswered ? 'Ya respondiste. Se revela cuando tu pareja también responda.' : 'Las respuestas se revelan solo cuando ambos contestan.'}</div>
          </>
        ) : (
          <div style={{ marginTop: 8 }}>
            {rows.map((r) => (
              <div key={r.member_id} style={{ marginTop: 14 }}>
                <div className="muted">{r.member_id === me.id ? 'Tú' : 'Tu pareja'}</div>
                <div className="qans">"{r.answer}"</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
