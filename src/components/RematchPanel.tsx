import type { Member } from '../lib/session';
import { rematchOf, type GameRow } from '../lib/useGame';

export default function RematchPanel({
  me, game, onAsk, onAccept, onReject,
}: {
  me: Member;
  game: GameRow;
  onAsk: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  if (game.status === 'active') return null;
  const rematch = rematchOf(game);

  if (rematch?.status === 'pending' && rematch.from !== me.id) {
    return (
      <div className="card center" style={{ marginTop: 16 }}>
        <div className="livepill">Tu pareja quiere la revancha</div>
        <p className="muted" style={{ margin: '10px 0 0' }}>¿Juegan otra?</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={onAccept}>Aceptar</button>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={onReject}>Rechazar</button>
      </div>
    );
  }

  if (rematch?.status === 'pending' && rematch.from === me.id) {
    return (
      <div className="card center" style={{ marginTop: 16 }}>
        <p className="muted">Le avisamos. Esperando a que acepte o rechace…</p>
      </div>
    );
  }

  if (rematch?.status === 'rejected' && rematch.from === me.id) {
    return (
      <div className="card center" style={{ marginTop: 16 }}>
        <p className="err">Tu pareja rechazó la revancha</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={onAsk}>Pedir de nuevo</button>
      </div>
    );
  }

  return (
    <button className="btn" style={{ marginTop: 16 }} onClick={onAsk}>Revancha</button>
  );
}
