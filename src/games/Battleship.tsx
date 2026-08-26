import { useEffect, useState } from 'react';
import type { Member } from '../lib/session';
import { useGame } from '../lib/useGame';
import {
  allSunk, canPlace, FLEET, initialBattleshipState, otherRole, roleFor,
  SEA_SIZE, shipCells, type BattleshipState,
} from '../lib/battleship';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';

export default function Battleship({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, stopMatch, notice } =
    useGame('ships', me, () => initialBattleshipState(me.id));
  const [ships, setShips] = useState<number[][]>([]);
  const [vertical, setVertical] = useState(false);
  const [placeError, setPlaceError] = useState('');

  const state = game?.state as BattleshipState | undefined;
  const role = state ? roleFor(state.first, me.id) : 'first';

  useEffect(() => {
    if (!game || !state) return;
    setShips(state.boards[role]?.ships ?? []);
    setPlaceError('');
  }, [game?.id, state?.boards?.[role]?.ready, role]);

  if (loading) return <div className="wrap"><p className="muted">Cargando…</p></div>;
  if (!game || !state) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Batalla naval</div>
      <div className="card center">
        <p className="muted">Esconde tu flota y hunde los barcos de tu pareja.</p>
        <button className="btn" style={{ marginTop: 10 }} disabled={!partnerId} onClick={() => newGame(me.id)}>
          Empezar partida
        </button>
      </div>
    </div>
  );

  const enemy = otherRole(role);
  const mine = state.boards[role];
  const theirs = state.boards[enemy];
  const myShots = state.shots[role];
  const theirShots = state.shots[enemy];
  const setup = !mine.ready || !theirs.ready;
  const mySetupTurn = state.setupTurn === role;
  const turnIsCurrent = game.turn === me.id || (partnerId && game.turn === partnerId);
  const inferredRole = (myShots.length + theirShots.length) % 2 === 0 ? 'first' : 'second';
  const myTurn = game.status === 'active' && !setup
    && (turnIsCurrent ? game.turn === me.id : inferredRole === role);

  function placeShip(cell: number) {
    if (!mySetupTurn || mine.ready || ships.length >= FLEET.length) return;
    const next = shipCells(cell, FLEET[ships.length], vertical);
    if (!canPlace(ships, next)) {
      setPlaceError('Ese barco no cabe ahí o se cruza con otro.');
      return;
    }
    setPlaceError('');
    setShips([...ships, next!]);
  }

  function confirmFleet() {
    if (!partnerId || ships.length !== FLEET.length || !mySetupTurn) return;
    const current = state!;
    const boards = { ...current.boards, [role]: { ships, ready: true } };
    const firstReady = role === 'first';
    applyMove({
      state: { ...current, boards, setupTurn: firstReady ? 'second' : 'first' },
      turn: partnerId,
    });
  }

  function fire(cell: number) {
    if (!myTurn || myShots.includes(cell) || !partnerId) return;
    const current = state!;
    const shots = [...myShots, cell];
    const won = allSunk(theirs.ships, shots);
    applyMove({
      state: { ...current, shots: { ...current.shots, [role]: shots } },
      turn: won ? null : partnerId,
      status: won ? 'won' : 'active',
      winner: won ? me.id : null,
    });
  }

  return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Batalla naval</div>
      {notice && <div className="livepill">{notice}</div>}

      {setup && game.status === 'active' && (
        <div className="card">
          {!mySetupTurn && !mine.ready && <p className="muted center">Tu pareja está colocando su flota…</p>}
          {mine.ready && <p className="muted center">Flota lista. Esperando a tu pareja…</p>}
          {mySetupTurn && !mine.ready && (
            <>
              <div className="turnbar">
                Coloca el barco de {FLEET[ships.length] ?? 0} casillas
              </div>
              <SeaGrid ships={ships} shots={[]} reveal onCell={placeShip} label="Coloca tu flota" />
              {placeError && <p className="err">{placeError}</p>}
              <div className="row" style={{ marginTop: 10 }}>
                <button className={'btn ghost' + (!vertical ? ' on' : '')} onClick={() => setVertical(false)}>Horizontal</button>
                <button className={'btn ghost' + (vertical ? ' on' : '')} onClick={() => setVertical(true)}>Vertical</button>
              </div>
              <button className="btn ghost" style={{ marginTop: 10 }} disabled={!ships.length}
                onClick={() => setShips(ships.slice(0, -1))}>Deshacer barco</button>
              <button className="btn" style={{ marginTop: 10 }} disabled={ships.length !== FLEET.length}
                onClick={confirmFleet}>Flota lista</button>
            </>
          )}
        </div>
      )}

      {!setup && (
        <>
          <div className="turnbar">
            {game.status === 'abandoned' ? '⏹️ Partida detenida'
              : game.status === 'won' ? (game.winner === me.id ? '🎉 ¡Hundiste toda la flota!' : 'Tu pareja hundió tu flota')
                : myTurn ? 'Tu turno: dispara' : 'Turno de tu pareja…'}
          </div>
          <div className="sea-title">Aguas enemigas</div>
          <SeaGrid ships={theirs.ships} shots={myShots} reveal={game.status !== 'active'}
            onCell={fire} disabled={!myTurn} label="Aguas enemigas" />
          <div className="sea-title">Tu flota</div>
          <SeaGrid ships={mine.ships} shots={theirShots} reveal disabled label="Tu flota" />
        </>
      )}

      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
      {game.status === 'active' && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}

function SeaGrid({
  ships, shots, reveal, onCell, disabled, label,
}: {
  ships: number[][];
  shots: number[];
  reveal: boolean;
  onCell?: (cell: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const occupied = new Set(ships.flat());
  const fired = new Set(shots);
  return (
    <div className="sea-grid" role="grid" aria-label={label}>
      {Array.from({ length: SEA_SIZE * SEA_SIZE }, (_, cell) => {
        const ship = occupied.has(cell);
        const shot = fired.has(cell);
        const className = `sea-cell${reveal && ship ? ' ship' : ''}${shot && ship ? ' hit' : ''}${shot && !ship ? ' miss' : ''}`;
        return (
          <button key={cell} role="gridcell" className={className} disabled={disabled || shot}
            aria-label={`Fila ${Math.floor(cell / SEA_SIZE) + 1}, columna ${(cell % SEA_SIZE) + 1}${shot ? (ship ? ', impacto' : ', agua') : ''}`}
            onClick={() => onCell?.(cell)}>
            {shot ? (ship ? '✕' : '·') : ''}
          </button>
        );
      })}
    </div>
  );
}
