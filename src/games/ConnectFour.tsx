import { useGame } from '../lib/useGame';
import type { Member } from '../lib/session';
import RematchPanel from '../components/RematchPanel';

const ROWS = 6, COLS = 7;
const empty = () => Array(ROWS * COLS).fill('');
const at = (b: string[], r: number, c: number) => b[r * COLS + c];

function winner(b: string[]): string | null {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = at(b, r, c); if (!v) continue;
    for (const [dr, dc] of dirs) {
      let k = 1;
      while (k < 4) { const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || at(b, rr, cc) !== v) break; k++; }
      if (k === 4) return v;
    }
  }
  return null;
}

export default function ConnectFour({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, notice } =
    useGame('c4', me, () => ({ board: empty(), first: me.id }));

  if (loading) return <div className="wrap"><p className="muted">Cargando…</p></div>;

  if (!game) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>4 en línea</div>
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
  const colorFor = (id: string) => (id === firstId ? 'R' : 'Y');
  const mine = game.turn === me.id && game.status === 'active';

  function drop(col: number) {
    if (!game || !mine) return;
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) if (!at(board, r, col)) { row = r; break; }
    if (row < 0) return; // columna llena
    const nb = board.slice(); nb[row * COLS + col] = colorFor(me.id);
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
      <div className="title" style={{ marginTop: 8 }}>4 en línea</div>
      {notice && <div className="livepill">{notice}</div>}
      <div className="turnbar">
        {game.status === 'won' ? (game.winner === me.id ? '🎉 ¡Ganaste!' : '😅 Ganó tu pareja')
          : game.status === 'draw' ? '🤝 Empate'
          : mine ? `Tu turno (${colorFor(me.id) === 'R' ? '🔴' : '🟡'})` : 'Turno de tu pareja…'}
      </div>
      <div className="c4">
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((_, c) => {
            const v = at(board, r, c);
            return <div key={r + '-' + c} className={'slot ' + v} onClick={() => drop(c)} />;
          })
        )}
      </div>
      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
    </div>
  );
}
