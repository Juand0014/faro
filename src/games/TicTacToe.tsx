import { currentTurn, useGame } from '../lib/useGame';
import type { Member } from '../lib/session';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(b: string[]): string | null {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return null;
}

export default function TicTacToe({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, stopMatch, notice } =
    useGame('ttt', me, () => ({ board: Array(9).fill(''), first: me.id }));

  if (loading) return <div className="wrap"><p className="muted">Cargando…</p></div>;

  if (!game) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Tres en raya</div>
      <div className="card center">
        <p className="muted">No hay partida activa. Si tu pareja empieza, entras solo a la suya.</p>
        <button className="btn" style={{ marginTop: 10 }} disabled={!partnerId} onClick={() => newGame(me.id)}>Empezar partida</button>
        {partnerId && <p className="locked">Esperando a que alguien inicie…</p>}
        {!partnerId && <p className="locked">Necesitas a tu pareja enlazada para jugar.</p>}
      </div>
    </div>
  );

  const board: string[] = game.state.board;
  const firstId: string = game.state.first;
  const markFor = (id: string) => (id === firstId ? 'X' : 'O');
  const mine = currentTurn(game, me.id, partnerId) === me.id && game.status === 'active';

  function play(i: number) {
    if (!game || board[i] || !mine || !partnerId) return;
    const nb = board.slice();
    nb[i] = markFor(me.id);
    const w = winner(nb);
    applyMove({
      state: { ...game.state, board: nb },
      turn: partnerId,
      status: w ? 'won' : nb.every((c) => c) ? 'draw' : 'active',
      winner: w ? me.id : null,
    });
  }

  return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Tres en raya</div>
      {notice && <div className="livepill">{notice}</div>}
      <div className="turnbar">
        {game.status === 'won' ? (game.winner === me.id ? '🎉 ¡Ganaste!' : '😅 Ganó tu pareja')
          : game.status === 'draw' ? '🤝 Empate'
          : game.status !== 'active' ? '⏹️ Partida detenida'
          : mine ? `Tu turno (${markFor(me.id)})` : 'Turno de tu pareja…'}
      </div>
      <div className="board">
        {board.map((c, i) => (
          <button key={i} className={'cell ' + c} disabled={!mine || !!c} onClick={() => play(i)}>{c}</button>
        ))}
      </div>
      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
      {game.status === 'active' && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}
