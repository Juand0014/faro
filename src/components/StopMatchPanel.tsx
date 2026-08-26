import { useState } from 'react';

export default function StopMatchPanel({ onStop }: { onStop: (mode: 'reset' | 'exit') => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(mode: 'reset' | 'exit') {
    if (busy) return;
    setBusy(true);
    try {
      await onStop(mode);
      if (mode === 'exit') window.location.hash = '#/games';
      else setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn ghost" style={{ marginTop: 16 }} onClick={() => setOpen(true)}>
        Detener partida
      </button>
    );
  }

  return (
    <div className="card center" style={{ marginTop: 16 }}>
      <p className="muted">Se cierra para los dos. ¿Qué hacemos?</p>
      <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => run('reset')}>
        Empezar de cero
      </button>
      <button className="btn ghost" style={{ marginTop: 10 }} disabled={busy} onClick={() => run('exit')}>
        Salir a Juegos
      </button>
      <button className="btn ghost" style={{ marginTop: 10 }} disabled={busy} onClick={() => setOpen(false)}>
        Seguir jugando
      </button>
    </div>
  );
}
