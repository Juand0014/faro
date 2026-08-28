import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Member } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useGame, type GameRow } from '../lib/useGame';
import {
  PARCHIS_GOAL,
  globalCell,
  initialParchisState,
  isParchisState,
  isSafeCell,
  legalMoves,
  moveParchis,
  parchisSeatFor,
  type ParchisPieceCount,
  type ParchisSeat,
  type ParchisState,
} from '../lib/parchis';
import GameReactions from '../components/GameReactions';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';

const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function rpcError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (message.includes('estado_desactualizado') || message.includes('turno_invalido')) {
    return 'La partida avanzó en el otro teléfono. Ya la actualizamos.';
  }
  return 'No se pudo completar la jugada. Revisa tu conexión e intenta otra vez.';
}

export default function Parchis({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const [selectedPieceCount, setSelectedPieceCount] = useState<ParchisPieceCount>(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const makeInitial = useCallback(
    () => initialParchisState(me.id, selectedPieceCount),
    [me.id, selectedPieceCount],
  );
  const {
    game, loading, newGame, askRematch, acceptRematch, rejectRematch, stopMatch, reload, notice,
  } = useGame('parchis', me, makeInitial);

  const state = isParchisState(game?.state) ? game.state : null;
  const pieceCount = state?.pieceCount ?? selectedPieceCount;
  const seat = state ? parchisSeatFor(state.first, me.id) : 'a';
  const myTurn = Boolean(game && state && game.status === 'active' && game.turn === me.id);
  const moves = useMemo(
    () => state && myTurn && (state.phase === 'move' || state.phase === 'bonus')
      ? legalMoves(state, seat)
      : [],
    [myTurn, seat, state],
  );
  const movable = useMemo(() => new Set(moves.map((move) => move.piece)), [moves]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function roll() {
    if (!game || !state || !myTurn || state.phase !== 'roll' || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('roll_parchis', { p_game_id: game.id });
      if (error) throw error;
      const row = data as GameRow;
      const rolled = isParchisState(row?.state) ? row.state : null;
      if (!rolled) throw new Error('respuesta_invalida');
      if (!legalMoves(rolled, seat).length) {
        const passed = await supabase.rpc('pass_parchis', {
          p_game_id: game.id,
          p_expected_seq: rolled.seq,
        });
        if (passed.error) {
          if (mounted.current) setMessage('El dado quedó registrado. Pulsa Pasar turno para continuar.');
          await reload();
          return;
        }
        if (mounted.current) setMessage(`Sacaste ${rolled.dice}. No había movimientos posibles.`);
      } else {
        if (mounted.current) setMessage(`Sacaste ${rolled.dice}. Elige una ficha iluminada.`);
      }
      await reload();
    } catch (error) {
      if (mounted.current) setMessage(rpcError(error));
      await reload();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function passTurn() {
    if (!game || !state || !myTurn || state.phase !== 'move' || moves.length || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('pass_parchis', {
        p_game_id: game.id,
        p_expected_seq: state.seq,
      });
      if (error) throw error;
      if (mounted.current) setMessage('Turno pasado.');
      await reload();
    } catch (error) {
      if (mounted.current) setMessage(rpcError(error));
      await reload();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function move(piece: number) {
    if (!game || !state || !partnerId || !myTurn || !movable.has(piece) || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const transition = moveParchis(state, seat, piece);
      const nextTurn = transition.winnerSeat
        ? null
        : transition.nextSeat === seat ? me.id : partnerId;
      const { error } = await supabase.rpc('move_parchis', {
        p_game_id: game.id,
        p_expected_seq: state.seq,
        p_piece: piece,
        p_state: transition.state,
        p_next_turn: nextTurn,
        p_status: transition.winnerSeat ? 'won' : 'active',
        p_winner: transition.winnerSeat ? me.id : null,
      });
      if (error) throw error;
      if (transition.state.last?.capture != null && mounted.current) setMessage('¡Te comiste una ficha! Ahora tienes +20.');
      else if (transition.state.last?.to === PARCHIS_GOAL && !transition.winnerSeat && mounted.current) setMessage('¡Ficha en meta! Ahora tienes +10.');
      await reload();
    } catch (error) {
      if (mounted.current) setMessage(rpcError(error));
      await reload();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  if (loading) return <div className="wrap"><p className="muted">Preparando el tablero…</p></div>;
  if (!game) return (
    <div className="wrap parchis-wrap">
      <a className="muted" href="#/games" aria-label="Volver a Juegos">← Juegos</a>
      <h1 className="title">Parchís</h1>
      <div className="card parchis-start">
        <p>El de toda la vida, preparado para dos.</p>
        <p className="muted">Un 5 saca, los puentes bloquean y comer te regala 20 pasos.</p>
        <fieldset>
          <legend>Fichas por jugador</legend>
          <div className="parchis-count">
            {([2, 3, 4] as const).map((count) => (
              <button key={count} type="button" className={pieceCount === count ? 'selected' : ''}
                aria-pressed={pieceCount === count} onClick={() => setSelectedPieceCount(count)}>
                {count}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" className="btn" disabled={!partnerId} onClick={() => newGame(me.id)}>
          Empezar con {pieceCount} fichas
        </button>
        {!partnerId && <p className="muted">Esperando a que tu pareja esté vinculada.</p>}
      </div>
    </div>
  );

  if (!state) return (
    <div className="wrap">
      <a className="muted" href="#/games" aria-label="Volver a Juegos">← Juegos</a>
      <h1 className="title">Parchís</h1>
      <div className="card"><p className="err">Esta partida tiene un estado incompatible.</p></div>
    </div>
  );

  const status = game.status === 'abandoned'
    ? 'Partida detenida'
    : game.status === 'won'
      ? game.winner === me.id ? '¡Ganaste! Todas tus fichas llegaron a casa.' : 'Tu pareja ganó esta vez.'
      : !myTurn
        ? state.phase === 'roll' ? 'Tu pareja va a tirar.' : 'Tu pareja está moviendo.'
        : state.phase === 'roll'
          ? 'Tu turno: tira el dado.'
          : state.phase === 'bonus'
            ? `Tu premio: mueve ${state.bonus} pasos.`
            : moves.length ? 'Elige una ficha iluminada.' : 'No hay movimientos. Pasa el turno.';
  const turnSeat: ParchisSeat = game.turn === state.first ? 'a' : 'b';

  return (
    <div className="wrap parchis-wrap">
      <a className="muted" href="#/games" aria-label="Volver a Juegos">← Juegos</a>
      <header className="parchis-heading">
        <div>
          <h1 className="title">Parchís</h1>
          <p className="muted">{state.pieceCount} fichas por jugador</p>
        </div>
        <div className={`parchis-turn-dot seat-${turnSeat}`}
          role="img"
          aria-label={`Turno del color ${turnSeat === 'a' ? 'coral' : 'turquesa'}`} />
      </header>
      {notice && <div className="livepill" role="status">{notice}</div>}
      <div className="turnbar" role="status">{status}</div>

      <div className="parchis-hud card">
        <div className="parchis-score" role="group" aria-label="Fichas en meta">
          <GoalDots label="Tú" seat={seat} pieces={state.pieces[seat]} />
          <GoalDots label="Pareja" seat={seat === 'a' ? 'b' : 'a'} pieces={state.pieces[seat === 'a' ? 'b' : 'a']} />
        </div>
        <button type="button" className="parchis-die" onClick={roll}
          disabled={!myTurn || state.phase !== 'roll' || busy}
          aria-label={state.phase === 'roll' ? 'Tirar el dado' : `Dado: ${state.dice}`}>
          <span aria-hidden="true">{state.dice ? DICE[state.dice - 1] : '🎲'}</span>
          <small>{busy ? 'Sincronizando…' : state.phase === 'roll' ? 'Tirar dado' : `Salió ${state.dice}`}</small>
        </button>
        <div className="parchis-six">
          <span>Seises {state.sixStreak}/3</span>
          <div aria-hidden="true">
            {[1, 2, 3].map((value) => <i key={value} className={value <= state.sixStreak ? 'on' : ''} />)}
          </div>
        </div>
      </div>
      {myTurn && state.phase === 'move' && moves.length === 0 && (
        <button type="button" className="btn ghost parchis-pass" disabled={busy} onClick={passTurn}>
          Pasar turno
        </button>
      )}

      <ParchisBoard state={state} mySeat={seat} movable={movable} disabled={!myTurn || busy} onPiece={move} />

      {message && <p className="ws-message" role="status">{message}</p>}
      <GameReactions gameId={game.id} gameType="parchis" memberId={me.id} celebration={game.status === 'won'} />

      <details className="card parchis-help">
        <summary>Reglas rápidas</summary>
        <ul>
          <li>Saca una ficha de casa con un 5.</li>
          <li>Dos fichas juntas forman un puente que nadie puede atravesar.</li>
          <li>No se come en los seguros. Comer da un movimiento de 20.</li>
          <li>Llegar a meta da 10. Hay que entrar con el número exacto.</li>
          <li>Un 6 permite volver a tirar; el tercero seguido termina el turno.</li>
        </ul>
      </details>

      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
      {game.status === 'active' && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}

function GoalDots({ label, seat, pieces }: { label: string; seat: ParchisSeat; pieces: number[] }) {
  const finished = pieces.filter((position) => position === PARCHIS_GOAL).length;
  return (
    <div>
      <span>{label}</span>
      <span className="sr-only">: {finished} de {pieces.length} fichas en meta</span>
      <div className={`parchis-goals seat-${seat}`} aria-hidden="true">
        {pieces.map((_, index) => <i key={index} className={index < finished ? 'home' : ''} />)}
      </div>
    </div>
  );
}

function trackPoint(cell: number) {
  const slot = cell - 1;
  if (slot <= 16) return { x: 60 + slot * 30, y: 45 };
  if (slot <= 33) return { x: 555, y: 60 + (slot - 17) * 30 };
  if (slot <= 50) return { x: 540 - (slot - 34) * 30, y: 555 };
  return { x: 45, y: 540 - (slot - 51) * 30 };
}

function tokenPoint(seat: ParchisSeat, position: number, index: number, count: number) {
  if (position === -1) {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const center = seat === 'a' ? { x: 130, y: 155 } : { x: 470, y: 445 };
    return { x: center.x + Math.cos(angle) * 45, y: center.y + Math.sin(angle) * 45 };
  }
  if (position <= 67) return trackPoint(globalCell(seat, position)!);
  if (position < PARCHIS_GOAL) {
    const lane = position - 68;
    const start = trackPoint(seat === 'a' ? 5 : 39);
    const progress = (lane + 1) / 8;
    return {
      x: start.x + (300 - start.x) * progress,
      y: start.y + (300 - start.y) * progress,
    };
  }
  const angle = (Math.PI * 2 * index) / count;
  return { x: 300 + Math.cos(angle) * 20, y: 300 + Math.sin(angle) * 20 };
}

function ParchisBoard({
  state,
  mySeat,
  movable,
  disabled,
  onPiece,
}: {
  state: ParchisState;
  mySeat: ParchisSeat;
  movable: ReadonlySet<number>;
  disabled: boolean;
  onPiece: (piece: number) => void;
}) {
  return (
    <div className="parchis-board" role="region" aria-label="Tablero de Parchís">
      <svg viewBox="0 0 600 600" aria-hidden="true">
        <rect className="parchis-paper" x="20" y="20" width="560" height="560" rx="42" />
        <circle className="parchis-yard yard-a" cx="130" cy="155" r="78" />
        <circle className="parchis-yard yard-b" cx="470" cy="445" r="78" />
        <path className="parchis-center" d="M300 245 355 300 300 355 245 300Z" />
        {Array.from({ length: 68 }, (_, index) => {
          const cell = index + 1;
          const point = trackPoint(cell);
          const lastCell = state.last && state.last.to <= 67 ? globalCell(state.last.seat, state.last.to) : null;
          return <circle key={cell}
            className={`parchis-cell${isSafeCell(cell) ? ' safe' : ''}${cell === 5 ? ' start-a' : ''}${cell === 39 ? ' start-b' : ''}${lastCell === cell ? ' last' : ''}`}
            cx={point.x} cy={point.y} r="11" />;
        })}
        {(['a', 'b'] as const).flatMap((seat) =>
          Array.from({ length: 7 }, (_, index) => {
            const point = tokenPoint(seat, 68 + index, index, 7);
            const last = state.last?.seat === seat && state.last.to === 68 + index;
            return <circle key={`${seat}-${index}`} className={`parchis-cell lane seat-${seat}${last ? ' last' : ''}`}
              cx={point.x} cy={point.y} r="11" />;
          }))}
      </svg>
      {(['a', 'b'] as const).flatMap((seat) =>
        state.pieces[seat].map((position, index) => {
          const base = tokenPoint(seat, position, index, state.pieceCount);
          const stackIndex = state.pieces[seat].slice(0, index).filter((value) => value === position).length;
          const stackSize = state.pieces[seat].filter((value) => value === position).length;
          const stackOffset = position >= 0 && position < PARCHIS_GOAL
            ? (stackIndex - (stackSize - 1) / 2) * 13
            : 0;
          const point = { x: base.x + stackOffset, y: base.y - stackOffset };
          const mine = seat === mySeat;
          const canMove = mine && movable.has(index);
          const style = { '--piece-x': `${point.x / 6}%`, '--piece-y': `${point.y / 6}%` } as CSSProperties;
          return (
            <button key={`${seat}-${index}`} type="button" style={style}
              className={`parchis-piece seat-${seat}${canMove ? ' can-move' : ''}`}
              disabled={!canMove || disabled} onClick={() => onPiece(index)}
              aria-label={`${mine ? 'Tu' : 'Su'} ficha ${index + 1}, ${positionLabel(seat, position)}${canMove ? ', se puede mover' : ''}`}>
              <span>{index + 1}</span>
            </button>
          );
        }))}
    </div>
  );
}

function positionLabel(seat: ParchisSeat, position: number) {
  if (position === -1) return 'en casa';
  if (position === PARCHIS_GOAL) return 'en meta';
  if (position >= 68) return `en el pasillo, casilla ${position - 67}`;
  const cell = globalCell(seat, position)!;
  return `en casilla ${cell}${isSafeCell(cell) ? ', seguro' : ''}`;
}
