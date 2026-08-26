import type { Member } from '../lib/session';
import { GAME_META } from '../lib/useActiveGames';
import { rejectRematchOn, rematchOf, startAcceptedGame, type GameRow } from '../lib/useGame';
import { broadcastRematch } from '../lib/coupleLive';

export default function RematchOverlay({
  me, game, onClose,
}: {
  me: Member;
  game: GameRow;
  onClose: () => void;
}) {
  const rematch = rematchOf(game);
  const meta = GAME_META[game.type];
  if (!rematch || rematch.from === me.id || rematch.status !== 'pending' || !meta) return null;
  const from = rematch.from;

  async function accept() {
    const started = await startAcceptedGame(game);
    await broadcastRematch({ game: started ?? game, rematch: { from, status: 'accepted' } });
    onClose();
    window.location.hash = meta.href.slice(1);
  }

  async function reject() {
    const next = await rejectRematchOn(game);
    await broadcastRematch({ game: next, rematch: { from, status: 'rejected' } });
    onClose();
  }

  return (
    <div className="overlay">
      <div className="card center" style={{ margin: 0, maxWidth: 360 }}>
        <div style={{ fontSize: 36 }}>{meta.icon}</div>
        <div className="title" style={{ marginTop: 8 }}>¿Revancha?</div>
        <p className="muted">Tu pareja quiere otra partida de {meta.name}.</p>
        <button className="btn" style={{ marginTop: 14 }} onClick={accept}>Aceptar</button>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={reject}>Rechazar</button>
      </div>
    </div>
  );
}
