import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Member } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useGame, type GameRow } from '../lib/useGame';
import {
  PARCHIS_GOAL,
  PARCHIS_LANE_START,
  globalCell,
  initialParchisState,
  isParchisState,
  isSafeCell,
  legalMoves,
  moveParchis,
  parchisSeatFor,
  type ParchisMove,
  type ParchisPieceCount,
  type ParchisSeat,
  type ParchisState,
} from '../lib/parchis';
import GameReactions from '../components/GameReactions';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';

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
  const [selectedSteps, setSelectedSteps] = useState<number | null>(null);
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
  const allMoves = useMemo(
    () => state && myTurn && (state.phase === 'move' || state.phase === 'bonus')
      ? legalMoves(state, seat)
      : [],
    [myTurn, seat, state],
  );
  const stepOptions = useMemo(
    () => [...new Set(allMoves.map((move) => move.steps))],
    [allMoves],
  );
  const moves = useMemo(
    () => selectedSteps === null ? [] : allMoves.filter((move) => move.steps === selectedSteps),
    [allMoves, selectedSteps],
  );
  const movable = useMemo(() => new Set(moves.map((move) => move.piece)), [moves]);
  const destinations = useMemo(
    () => new Map(moves.map((move) => [move.piece, move])),
    [moves],
  );

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!state || state.phase === 'roll') {
      setSelectedSteps(null);
      return;
    }
    setSelectedSteps(stepOptions.length === 1 ? stepOptions[0] : null);
  }, [state?.seq, state?.phase, stepOptions]);

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
        if (mounted.current) setMessage(`Sacaste ${rolled.dice?.join(' y ')}. No había movimientos posibles.`);
      } else {
        if (mounted.current) setMessage(`Sacaste ${rolled.dice?.join(' y ')}. Elige un dado y una ficha.`);
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
    if (!game || !state || !myTurn || state.phase !== 'move' || allMoves.length || busy) return;
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
    if (!game || !state || !partnerId || !myTurn || selectedSteps === null || !movable.has(piece) || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const transition = moveParchis(state, seat, piece, selectedSteps);
      const nextTurn = transition.winnerSeat
        ? null
        : transition.nextSeat === seat ? me.id : partnerId;
      const { error } = await supabase.rpc('move_parchis', {
        p_game_id: game.id,
        p_expected_seq: state.seq,
        p_piece: piece,
        p_steps: selectedSteps,
        p_state: transition.state,
        p_next_turn: nextTurn,
        p_status: transition.winnerSeat ? 'won' : 'active',
        p_winner: transition.winnerSeat ? me.id : null,
      });
      if (error) throw error;
      if (transition.state.phase === 'move' && transition.moves.length === 0) {
        const passed = await supabase.rpc('pass_parchis', {
          p_game_id: game.id,
          p_expected_seq: transition.state.seq,
        });
        if (passed.error) {
          if (mounted.current) setMessage('El movimiento se guardó. Pulsa Pasar turno para continuar.');
          await reload();
          return;
        }
        if (mounted.current) setMessage('El segundo dado no tenía movimientos. Turno pasado.');
      } else if (transition.state.last?.capture != null && mounted.current) {
        setMessage('¡Te comiste una ficha! Ahora tienes +20.');
      } else if (transition.state.last?.to === PARCHIS_GOAL && !transition.winnerSeat && mounted.current) {
        setMessage('¡Ficha en meta! Ahora tienes +10.');
      }
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
        <p className="muted">Dos dados, salidas obligatorias con 5, puentes y premios por capturar.</p>
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
      <div className="card">
        <p className="err">Esta partida usa las reglas antiguas de un dado. Deténla para estrenar el tablero nuevo.</p>
        <StopMatchPanel onStop={stopMatch} />
      </div>
    </div>
  );

  const status = game.status === 'abandoned'
    ? 'Partida detenida'
    : game.status === 'won'
      ? game.winner === me.id ? '¡Ganaste! Todas tus fichas llegaron a casa.' : 'Tu pareja ganó esta vez.'
      : !myTurn
        ? state.phase === 'roll' ? 'Tu pareja va a tirar.' : 'Tu pareja está moviendo.'
        : state.phase === 'roll'
          ? 'Tu turno: tira los dos dados.'
          : state.phase === 'bonus'
            ? `Tu premio: mueve ${state.bonus} pasos.`
            : !allMoves.length ? 'No hay movimientos. Pasa el turno.'
              : selectedSteps === null ? 'Elige cuál dado quieres usar primero.'
                : `Mueve ${selectedSteps} pasos con una ficha iluminada.`;
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
          aria-label={`Turno del color ${turnSeat === 'a' ? 'amarillo' : 'rojo'}`} />
      </header>
      {notice && <div className="livepill" role="status" aria-label="Aviso del juego">{notice}</div>}
      <div className={`parchis-status seat-${turnSeat}`} role="status" aria-label="Estado del turno">
        <span aria-hidden="true">{myTurn ? '●' : '○'}</span>
        {status}
      </div>

      <div className="parchis-hud card">
        <GoalDots label="Tú" seat={seat} pieces={state.pieces[seat]} active={myTurn} />
        <DiceControl state={state} busy={busy} myTurn={myTurn}
          selectedSteps={selectedSteps} stepOptions={stepOptions}
          onRoll={roll} onSelect={setSelectedSteps} />
        <GoalDots label="Pareja" seat={seat === 'a' ? 'b' : 'a'}
          pieces={state.pieces[seat === 'a' ? 'b' : 'a']} active={!myTurn} />
      </div>
      {state.doublesStreak > 0 && (
        <div className="parchis-streak" role="status" aria-live="polite" aria-atomic="true">
          <span>Racha de dobles: {state.doublesStreak}/3</span>
          <div aria-hidden="true">
            {[1, 2, 3].map((value) => <i key={value} className={value <= state.doublesStreak ? 'on' : ''} />)}
          </div>
        </div>
      )}
      {myTurn && state.phase === 'move' && allMoves.length === 0 && (
        <button type="button" className="btn ghost parchis-pass" disabled={busy} onClick={passTurn}>
          Pasar turno
        </button>
      )}

      <ParchisBoard state={state} mySeat={seat} movable={movable} destinations={destinations}
        disabled={!myTurn || busy} onPiece={move} />

      <p className="ws-message" role="status">{message}</p>
      <GameReactions gameId={game.id} gameType="parchis" memberId={me.id} celebration={game.status === 'won'} />

      <details className="card parchis-help">
        <summary>Reglas rápidas</summary>
        <ul>
          <li>Usa cada dado por separado. Puedes mover la misma ficha dos veces.</li>
          <li>Debes sacar ficha con un 5 o cuando ambos dados suman 5.</li>
          <li>Dos fichas juntas forman un puente que nadie puede atravesar.</li>
          <li>No se come en los seguros. Comer da un movimiento de 20.</li>
          <li>Llegar a meta da 10. Hay que entrar con el número exacto.</li>
          <li>Los dobles permiten volver a tirar; el tercer doble termina el turno.</li>
        </ul>
      </details>

      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
      {game.status === 'active' && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}

function GoalDots({
  label,
  seat,
  pieces,
  active,
}: {
  label: string;
  seat: ParchisSeat;
  pieces: number[];
  active: boolean;
}) {
  const finished = pieces.filter((position) => position === PARCHIS_GOAL).length;
  const running = pieces.filter((position) => position >= 0 && position < PARCHIS_GOAL).length;
  return (
    <div className={`parchis-player seat-${seat}${active ? ' active' : ''}`} role="group"
      aria-label={`${label}: ${finished} de ${pieces.length} fichas en meta${active ? ', turno activo' : ''}`}
      aria-current={active ? 'true' : undefined}>
      <span className="parchis-player-token" aria-hidden="true" />
      <span className="parchis-player-name">{label}</span>
      <span className="sr-only">: {finished} de {pieces.length} fichas en meta</span>
      <div className={`parchis-goals seat-${seat}`} aria-hidden="true">
        {pieces.map((_, index) => <i key={index} className={index < finished ? 'home' : ''} />)}
      </div>
      <small>{finished} meta · {running} pista</small>
    </div>
  );
}

const DIE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function remainingDice(dice: [number, number], remaining: number[]) {
  const pool = [...remaining];
  return dice.map((value) => {
    const index = pool.indexOf(value);
    if (index < 0) return false;
    pool.splice(index, 1);
    return true;
  });
}

function DiceControl({
  state,
  busy,
  myTurn,
  selectedSteps,
  stepOptions,
  onRoll,
  onSelect,
}: {
  state: ParchisState;
  busy: boolean;
  myTurn: boolean;
  selectedSteps: number | null;
  stepOptions: number[];
  onRoll: () => void;
  onSelect: (steps: number) => void;
}) {
  const dice = state.dice;
  const available = dice ? remainingDice(dice, state.remaining) : [false, false];
  const sumExit = Boolean(dice && state.remaining.length === 2
    && !state.remaining.includes(5) && state.remaining[0] + state.remaining[1] === 5
    && stepOptions.includes(5));

  if (state.phase === 'bonus') {
    return <div className="parchis-dice-control bonus" role="group"
      aria-label={`Premio de ${state.bonus} pasos`}>
      <DieFace value={null} rolling={false} bonus={state.bonus} />
      <small>Premio obligatorio</small>
    </div>;
  }

  return (
    <div className="parchis-dice-control">
      <div className="parchis-dice-pair" role="group" aria-label="Dados de este turno">
        {([0, 1] as const).map((index) => {
          const value = dice?.[index] ?? null;
          const canSelect = value !== null && available[index] && stepOptions.includes(value);
          return <button key={index} type="button"
            className={`parchis-die-choice${!available[index] && dice ? ' used' : ''}${
              canSelect && selectedSteps === value ? ' selected' : ''}`}
            aria-pressed={canSelect ? selectedSteps === value : undefined}
            disabled={!myTurn || busy || !canSelect}
            onClick={() => value !== null && onSelect(value)}
            aria-label={value === null ? `Dado ${index + 1} sin tirar`
              : `${value} en el dado ${index + 1}${available[index] ? '' : ', usado'}`}>
            <DieFace value={value} rolling={busy && state.phase === 'roll'} bonus={0} />
          </button>;
        })}
      </div>
      {state.phase === 'roll' ? (
        <button type="button" className="parchis-roll-button" onClick={onRoll}
          disabled={!myTurn || busy}>
          {busy ? 'Lanzando…' : 'Tirar los dados'}
        </button>
      ) : sumExit ? (
        <button type="button" className={`parchis-sum-five${selectedSteps === 5 ? ' selected' : ''}`}
          aria-pressed={selectedSteps === 5}
          disabled={!myTurn || busy} onClick={() => onSelect(5)}>
          {state.remaining.join(' + ')} = 5 · Sacar ficha
        </button>
      ) : (
        <small>{selectedSteps === null ? 'Elige un dado' : `Mover ${selectedSteps}`}</small>
      )}
    </div>
  );
}

function DieFace({ value, rolling, bonus }: { value: number | null; rolling: boolean; bonus: 0 | 10 | 20 }) {
  return (
    <span className={`parchis-die-cube${rolling ? ' rolling' : ''}${value === null ? ' ready' : ''}${bonus ? ' bonus' : ''}`}
      aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} className={!bonus && value !== null && DIE_DOTS[value].includes(index) ? 'visible' : ''} />
      ))}
      {bonus ? <b>+{bonus}</b> : value === null && <b>?</b>}
    </span>
  );
}

function trackPoint(cell: number) {
  const step = 192 / 7;
  if (cell <= 7) return { x: 364, y: 574 - (cell - 1) * step };
  if (cell === 8) return { x: 364, y: 388 };
  if (cell === 9) return { x: 388, y: 364 };
  if (cell <= 16) return { x: 410 + (cell - 10) * step, y: 364 };
  if (cell === 17) return { x: 574, y: 300 };
  if (cell <= 24) return { x: 574 - (cell - 18) * step, y: 236 };
  if (cell === 25) return { x: 388, y: 236 };
  if (cell === 26) return { x: 364, y: 212 };
  if (cell <= 33) return { x: 364, y: 190 - (cell - 27) * step };
  if (cell === 34) return { x: 300, y: 26 };
  if (cell <= 41) return { x: 236, y: 26 + (cell - 35) * step };
  if (cell === 42) return { x: 236, y: 212 };
  if (cell === 43) return { x: 212, y: 236 };
  if (cell <= 50) return { x: 190 - (cell - 44) * step, y: 236 };
  if (cell === 51) return { x: 26, y: 300 };
  if (cell <= 58) return { x: 26 + (cell - 52) * step, y: 364 };
  if (cell === 59) return { x: 212, y: 364 };
  if (cell === 60) return { x: 236, y: 388 };
  if (cell <= 67) return { x: 236, y: 410 + (cell - 61) * step };
  return { x: 300, y: 574 };
}

function lanePoint(seat: ParchisSeat, position: number) {
  const index = position - PARCHIS_LANE_START;
  const step = 192 / 7;
  return seat === 'a'
    ? { x: 300, y: 547 - index * step }
    : { x: 300, y: 53 + index * step };
}

function tokenPoint(seat: ParchisSeat, position: number, index: number, count: number) {
  if (position === -1) {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const center = seat === 'a' ? { x: 492, y: 492 } : { x: 108, y: 108 };
    return { x: center.x + Math.cos(angle) * 45, y: center.y + Math.sin(angle) * 45 };
  }
  if (position <= 63) return trackPoint(globalCell(seat, position)!);
  if (position < PARCHIS_GOAL) return lanePoint(seat, position);
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const center = seat === 'a' ? { x: 300, y: 326 } : { x: 300, y: 274 };
  return { x: center.x + Math.cos(angle) * 17, y: center.y + Math.sin(angle) * 17 };
}

function stackedTokenPoint(
  seat: ParchisSeat,
  position: number,
  index: number,
  count: number,
  pieces: number[],
) {
  const base = tokenPoint(seat, position, index, count);
  if (position < 0 || position >= PARCHIS_GOAL) return base;
  const stackIndex = pieces.slice(0, index).filter((value) => value === position).length;
  const stackSize = pieces.filter((value) => value === position).length;
  const offset = (stackIndex - (stackSize - 1) / 2) * 13;
  return { x: base.x + offset, y: base.y - offset };
}

function trackCellSize(cell: number) {
  const vertical = cell <= 8 || (cell >= 26 && cell <= 42) || cell >= 60;
  return vertical ? { width: 64, height: 27 } : { width: 27, height: 64 };
}

function Rosette({ x, y, colors }: { x: number; y: number; colors: [string, string] }) {
  return (
    <g className="parchis-rosette" transform={`translate(${x} ${y})`}>
      <circle r="24" />
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index * Math.PI / 6 - Math.PI / 2;
        const next = angle + Math.PI / 6;
        const point = (value: number) => `${Math.cos(value) * 21},${Math.sin(value) * 21}`;
        return <path key={index} d={`M0,0 L${point(angle)} L${point(next)} Z`}
          fill={colors[index % 2]} />;
      })}
      <circle r="6" />
    </g>
  );
}

export function ParchisBoard({
  state,
  mySeat,
  movable,
  destinations,
  disabled,
  onPiece,
}: {
  state: ParchisState;
  mySeat: ParchisSeat;
  movable: ReadonlySet<number>;
  destinations: ReadonlyMap<number, ParchisMove>;
  disabled: boolean;
  onPiece: (piece: number) => void;
}) {
  const pieceRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastSequence = useRef(state.seq);
  const svgId = useId().replace(/:/g, '');

  useEffect(() => {
    const last = state.last;
    if (!last || state.seq === lastSequence.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lastSequence.current = state.seq;
      return;
    }
    lastSequence.current = state.seq;
    const element = pieceRefs.current.get(`${last.seat}-${last.piece}`);
    const board = element?.parentElement;
    if (!element || !board) return;

    const finalPoint = stackedTokenPoint(
      last.seat, last.to, last.piece, state.pieceCount, state.pieces[last.seat],
    );
    const previousPieces = [...state.pieces[last.seat]];
    previousPieces[last.piece] = last.from;
    const positions = last.from === -1
      ? [-1, last.to]
      : Array.from({ length: last.to - last.from + 1 }, (_, index) => last.from + index);
    const scale = board.getBoundingClientRect().width / 600;
    const frames = positions.map((position, index) => {
      const point = index === 0
        ? stackedTokenPoint(last.seat, position, last.piece, state.pieceCount, previousPieces)
        : index === positions.length - 1
          ? finalPoint
          : tokenPoint(last.seat, position, last.piece, state.pieceCount);
      const lift = index > 0 && index < positions.length - 1 ? -10 : 0;
      return {
        transform: `translate(calc(-50% + ${(point.x - finalPoint.x) * scale}px), calc(-50% + ${(point.y - finalPoint.y) * scale + lift}px)) scale(${index === positions.length - 1 ? 1 : 1.05})`,
        offset: positions.length === 1 ? 1 : index / (positions.length - 1),
      };
    });
    const animation = element.animate(frames, {
      duration: Math.min(1050, 320 + positions.length * 70),
      easing: 'cubic-bezier(.22,.8,.25,1)',
    });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigator.vibrate?.(last.capture !== null ? [35, 35, 80] : last.to === PARCHIS_GOAL ? [40, 30, 40] : 25);
    }
    return () => animation.cancel();
  }, [state.seq]);

  const eventLabel = state.last?.capture != null
    ? '+20 · ¡Captura!'
    : state.last?.to === PARCHIS_GOAL
      ? state.phase === 'over' ? '¡Victoria!' : '+10 · ¡En casa!'
      : null;
  const targetMoves = Array.from(destinations.values()).filter(
    (move, index, all) => all.findIndex((candidate) => candidate.to === move.to) === index,
  );

  return (
    <div className={`parchis-board${state.last?.capture != null ? ' capture-event' : ''}`}
      role="region" aria-label="Tablero de Parchís">
      <svg viewBox="0 0 600 600" aria-hidden="true">
        <defs>
          <linearGradient id={`${svgId}-wood`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#74482c" />
            <stop offset=".45" stopColor="#b27a4d" />
            <stop offset="1" stopColor="#5b3524" />
          </linearGradient>
          <linearGradient id={`${svgId}-paper`} x1="0" y1="0" x2=".8" y2="1">
            <stop offset="0" stopColor="#fffdf4" />
            <stop offset=".55" stopColor="#f5ecd9" />
            <stop offset="1" stopColor="#e8d8bd" />
          </linearGradient>
          <filter id={`${svgId}-inset`}>
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".28" />
          </filter>
          <pattern id={`${svgId}-grain`} width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M0 8C10 3 20 13 34 7M0 25c12-7 23 6 34-1" fill="none"
              stroke="#6d4228" strokeOpacity=".2" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect className="parchis-wood" x="3" y="3" width="594" height="594" rx="8" fill={`url(#${svgId}-wood)`} />
        <rect x="3" y="3" width="594" height="594" rx="8" fill={`url(#${svgId}-grain)`} />
        <rect className="parchis-paper" x="12" y="12" width="576" height="576" fill={`url(#${svgId}-paper)`} />

        <g className="parchis-home home-b">
          <rect x="26" y="26" width="164" height="164" />
          <circle cx="108" cy="108" r="82" />
          <circle cx="108" cy="108" r="55" />
          <Rosette x={108} y={108} colors={['#ef1e2e', '#35a9e9']} />
        </g>
        <g className="parchis-home home-blue inactive">
          <rect x="410" y="26" width="164" height="164" />
          <circle cx="492" cy="108" r="82" />
          <circle cx="492" cy="108" r="55" />
          <Rosette x={492} y={108} colors={['#35a9e9', '#ffeb1b']} />
        </g>
        <g className="parchis-home home-green inactive">
          <rect x="26" y="410" width="164" height="164" />
          <circle cx="108" cy="492" r="82" />
          <circle cx="108" cy="492" r="55" />
          <Rosette x={108} y={492} colors={['#76ca3c', '#ef1e2e']} />
        </g>
        <g className="parchis-home home-a">
          <rect x="410" y="410" width="164" height="164" />
          <circle cx="492" cy="492" r="82" />
          <circle cx="492" cy="492" r="55" />
          <Rosette x={492} y={492} colors={['#ffeb1b', '#76ca3c']} />
        </g>

        <path className="parchis-center center-b" d="M204 204H396L300 300Z" />
        <path className="parchis-center center-blue" d="M396 204V396L300 300Z" />
        <path className="parchis-center center-a" d="M396 396H204L300 300Z" />
        <path className="parchis-center center-green" d="M204 396V204L300 300Z" />

        {Array.from({ length: 68 }, (_, index) => {
          const cell = index + 1;
          const point = trackPoint(cell);
          const size = trackCellSize(cell);
          const lastCell = state.last && state.last.to <= 63 ? globalCell(state.last.seat, state.last.to) : null;
          return <g key={cell}>
            <rect
              className={`parchis-cell${isSafeCell(cell) ? ' safe' : ''}${cell === 5 ? ' start-a' : ''}${cell === 39 ? ' start-b' : ''}${lastCell === cell ? ' last' : ''}`}
              x={point.x - size.width / 2} y={point.y - size.height / 2}
              width={size.width} height={size.height} />
            {isSafeCell(cell) && <circle className="parchis-safe-circle" cx={point.x} cy={point.y} r="11" />}
            <text className="parchis-cell-number" x={point.x} y={point.y + 4}
              transform={size.height > size.width ? `rotate(90 ${point.x} ${point.y})` : undefined}>{cell}</text>
          </g>;
        })}
        {(['a', 'b'] as const).flatMap((seat) =>
          Array.from({ length: 7 }, (_, index) => {
            const position = PARCHIS_LANE_START + index;
            const point = lanePoint(seat, position);
            const last = state.last?.seat === seat && state.last.to === position;
            return <rect key={`${seat}-${index}`} className={`parchis-cell lane seat-${seat}${last ? ' last' : ''}`}
              x={point.x - 32} y={point.y - 13.5} width="64" height="27" />;
          }))}
        {targetMoves.map((move) => {
          const point = tokenPoint(mySeat, move.to, move.piece, state.pieceCount);
          return <g key={`target-${move.to}`} className="parchis-target">
            <circle cx={point.x} cy={point.y} r="18" />
            <text x={point.x} y={point.y + 4}>+{move.steps}</text>
          </g>;
        })}
        <circle className="parchis-goal-ring" cx="300" cy="300" r="37" />
        <text className="parchis-goal-star" x="300" y="310">✦</text>
      </svg>
      {eventLabel && <div key={state.seq} className="parchis-event" aria-hidden="true">{eventLabel}</div>}
      {(['a', 'b'] as const).flatMap((seat) =>
        state.pieces[seat].map((position, index) => {
          const point = stackedTokenPoint(
            seat, position, index, state.pieceCount, state.pieces[seat],
          );
          const mine = seat === mySeat;
          const canMove = mine && movable.has(index);
          const destination = canMove ? destinations.get(index) : null;
          const moveSteps = destination?.steps;
          const style = { '--piece-x': `${point.x / 6}%`, '--piece-y': `${point.y / 6}%` } as CSSProperties;
          return (
            <button key={`${seat}-${index}`} ref={(node) => {
              if (node) pieceRefs.current.set(`${seat}-${index}`, node);
              else pieceRefs.current.delete(`${seat}-${index}`);
            }} type="button" style={style}
              className={`parchis-piece seat-${seat}${canMove ? ' can-move' : ''}`}
              disabled={!canMove || disabled} onClick={() => onPiece(index)}
              aria-label={`${mine ? 'Tu' : 'Su'} ficha ${index + 1}, ${positionLabel(seat, position)}${
                destination && moveSteps
                  ? `, mover ${moveSteps} pasos hasta ${positionLabel(seat, destination.to)}`
                  : canMove ? ', se puede mover' : ''
              }`}>
              <span>{index + 1}</span>
            </button>
          );
        }))}
      <span className="sr-only" aria-live="polite">
        {eventLabel ? `${state.last?.seat === mySeat ? 'Tú' : 'Tu pareja'}: ${eventLabel}` : ''}
      </span>
    </div>
  );
}

function positionLabel(seat: ParchisSeat, position: number) {
  if (position === -1) return 'en casa';
  if (position === PARCHIS_GOAL) return 'en meta';
  if (position >= PARCHIS_LANE_START) return `en el pasillo, casilla ${position - PARCHIS_LANE_START + 1}`;
  const cell = globalCell(seat, position)!;
  return `en casilla ${cell}${isSafeCell(cell) ? ', seguro' : ''}`;
}
