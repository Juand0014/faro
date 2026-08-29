import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import GameReactions from '../components/GameReactions';
import { DominoBoard, DominoTileFace } from '../components/DominoTiles';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';
import {
  dominoConfig,
  tileFromId,
  type DominoConfig,
  type DominoEnd,
} from '../lib/domino';
import {
  initialDominoLobby,
  isDominoPublicState,
  type DominoAction,
  type DominoActionResponse,
  type DominoPublicSeat,
  type DominoPublicState,
} from '../lib/dominoClient';
import type { Member } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useGame } from '../lib/useGame';

type DominoProps = { me: Member; partnerId: string | null };
type TileChoice = {
  tile: number;
  ends: DominoEnd[];
  openEnds: [number, number];
} | null;

const TARGETS = [100, 200, 500] as const;
const HAND_SIZES = [7, 9] as const;
const CAPICUA_BONUSES = [0, 25, 50] as const;

function safeHand(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((tile) => Number.isInteger(tile) && tile >= 0 && tile <= 27)
    ? [...new Set(value as number[])]
    : null;
}

function responseFrom(value: unknown, gameId: string): DominoActionResponse | null {
  if (!value || typeof value !== 'object') return null;
  const response = value as Partial<DominoActionResponse>;
  const hand = safeHand(response.hand);
  if (response.gameId !== gameId || !isDominoPublicState(response.state) || hand === null
    || !Number.isInteger(response.seat) || response.seat! < 0
    || response.seat! >= response.state.handCounts.length
    || hand.length !== response.state.handCounts[response.seat!]) return null;
  return { ...response, hand } as DominoActionResponse;
}

function actionError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message)
    : '';
  if (/stale_state|desactualizado|invalid_private_state/i.test(message)) {
    return 'La mesa avanzó en otro dispositivo. Sincronizamos el estado más reciente.';
  }
  if (/not_your_turn/i.test(message)) return 'Ese turno ya terminó. Actualizamos la mesa.';
  if (/game_not_active/i.test(message)) return 'La partida ya no está activa.';
  return 'No pudimos completar la acción. Revisa tu conexión e inténtalo otra vez.';
}

async function normalizedFunctionError(error: unknown): Promise<Error> {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : null;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: unknown };
      if (typeof body.error === 'string') return new Error(body.error);
    } catch {
      // The generic SDK error still provides a safe fallback below.
    }
  }
  return error instanceof Error ? error : new Error('request_failed');
}

function playableEnds(
  tileId: number,
  state: DominoPublicState,
  hand: number[],
  seat: number,
): DominoEnd[] {
  if (state.phase !== 'play' || state.turnSeat !== seat || !hand.includes(tileId)) return [];
  if (state.opener !== null && hand.includes(state.opener) && tileId !== state.opener) return [];
  if (!state.ends) return ['right'];
  const [low, high] = tileFromId(tileId);
  const ends: DominoEnd[] = [];
  if (low === state.ends[0] || high === state.ends[0]) ends.push('left');
  if (low === state.ends[1] || high === state.ends[1]) ends.push('right');
  return ends;
}

function teamName(team: number, mySeat: number | null) {
  if (mySeat === null) return `Equipo ${team + 1}`;
  return team === mySeat % 2 ? 'Tu equipo' : 'Rivales';
}

function seatPosition(seat: number, mySeat: number, seatCount: number) {
  const relative = (seat - mySeat + seatCount) % seatCount;
  if (relative === 0) return 'south';
  if (seatCount === 2 || relative === 2) return 'north';
  return relative === 1 ? 'right' : 'left';
}

function ChoiceGroup<T extends string | number>({
  legend,
  value,
  options,
  label,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly T[];
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <fieldset className="domino-option-group">
      <legend>{legend}</legend>
      <div className="domino-options">
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={value === option}
            className={value === option ? 'selected' : ''} onClick={() => onChange(option)}>
            {label(option)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ConfigPanel({
  config,
  partnerId,
  busy,
  onChange,
  onCreate,
}: {
  config: DominoConfig;
  partnerId: string | null;
  busy: boolean;
  onChange: (patch: Partial<DominoConfig>) => void;
  onCreate: () => void;
}) {
  return (
    <section className="card domino-config" aria-labelledby="domino-config-title">
      <h2 id="domino-config-title">Prepara la mesa</h2>
      <ChoiceGroup legend="Modalidad" value={config.mode} options={['duel', 'partners'] as const}
        label={(value) => value === 'duel' ? 'Duelo 1 vs 1' : 'Parejas con bots'}
        onChange={(mode) => onChange({ mode, handSize: mode === 'partners' ? 7 : config.handSize })} />
      <ChoiceGroup legend="Meta de puntos" value={config.target} options={TARGETS}
        label={(value) => `${value}`} onChange={(target) => onChange({ target })} />
      {config.mode === 'duel' && (
        <ChoiceGroup legend="Fichas por mano" value={config.handSize} options={HAND_SIZES}
          label={(value) => `${value} fichas`} onChange={(handSize) => onChange({ handSize })} />
      )}
      {config.mode === 'duel' && (
        <ChoiceGroup legend="Cuando no hay jugada" value={config.drawFromBoneyard ? 'draw' : 'pass'}
          options={['draw', 'pass'] as const}
          label={(value) => value === 'draw' ? 'Robar del pozo' : 'Pasar'}
          onChange={(value) => onChange({ drawFromBoneyard: value === 'draw' })} />
      )}
      <ChoiceGroup legend="Cierre bloqueado" value={config.blockedRule}
        options={['general', 'patio'] as const}
        label={(value) => value === 'general'
          ? 'General: gana el equipo con menos pintas'
          : 'Patio: gana quien tenga menos pintas'}
        onChange={(blockedRule) => onChange({ blockedRule })} />
      <ChoiceGroup legend="Capicúa" value={config.capicuaBonus} options={CAPICUA_BONUSES}
        label={(value) => value ? `+${value}` : 'Sin bono'}
        onChange={(capicuaBonus) => onChange({ capicuaBonus })} />
      <button type="button" className="btn domino-create" disabled={!partnerId || busy} onClick={onCreate}>
        {busy ? 'Creando mesa…' : 'Crear mesa'}
      </button>
      {!partnerId && <p className="muted">Necesitas a tu pareja vinculada para jugar.</p>}
    </section>
  );
}

function Seat({
  seat,
  count,
  mySeat,
  turn,
  seatCount,
}: {
  seat: DominoPublicSeat;
  count: number;
  mySeat: number;
  turn: boolean;
  seatCount: number;
}) {
  const position = seatPosition(seat.seat, mySeat, seatCount);
  return (
    <div className={`domino-seat position-${position}${turn ? ' active' : ''}`}
      aria-current={turn ? 'true' : undefined}
      aria-label={`${seat.label}, ${count} fichas${turn ? ', tiene el turno' : ''}`}>
      <span className="domino-seat-name">{seat.seat === mySeat ? 'Tú' : seat.label}</span>
      {seat.bot && <span className="domino-bot-label">Bot</span>}
      <span className="domino-tile-count">{count} fichas</span>
      <span className="domino-hidden-stack" aria-hidden="true">
        {Array.from({ length: Math.min(count, 7) }, (_, index) => <i key={index} />)}
      </span>
    </div>
  );
}

function Scoreboard({ state, mySeat }: { state: DominoPublicState; mySeat: number | null }) {
  return (
    <section className="domino-scoreboard card" aria-label="Marcador">
      <div><span>{teamName(0, mySeat)}</span><strong>{state.scores[0]}</strong></div>
      <div className="domino-round-number">Ronda {state.roundNo || '—'} · meta {state.config.target}</div>
      <div><span>{teamName(1, mySeat)}</span><strong>{state.scores[1]}</strong></div>
    </section>
  );
}

function RoundResult({ state }: { state: DominoPublicState }) {
  const result = state.result;
  if (!result) return null;
  const title = result.tie
    ? 'Ronda empatada'
    : result.reason === 'blocked' ? 'Mesa cerrada' : '¡Dominó!';
  return (
    <section className="card domino-result" aria-live="polite" aria-labelledby="domino-result-title">
      <h2 id="domino-result-title">{title}</h2>
      {result.winnerTeam !== null && (
        <p>Equipo {result.winnerTeam + 1}: +{result.awarded[result.winnerTeam]} puntos.</p>
      )}
      {result.capicua && <p>Capicúa: bono de {result.bonus}.</p>}
      {state.roundPips && (
        <ul className="domino-round-pips" aria-label="Pintas restantes por jugador">
          {state.roundPips.map((pips, seat) => (
            <li key={seat}>{state.seats[seat]?.label ?? `Asiento ${seat + 1}`}: {pips} pintas</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EndChooser({
  choice,
  onChoose,
  onCancel,
}: {
  choice: NonNullable<TileChoice>;
  onChoose: (end: DominoEnd) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [low, high] = tileFromId(choice.tile);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    firstButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const buttons = [...dialogRef.current.querySelectorAll<HTMLButtonElement>('button')];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, []);

  return (
    <div className="domino-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div ref={dialogRef} className="domino-end-chooser card" role="dialog" aria-modal="true"
        aria-labelledby="domino-end-title" aria-describedby="domino-end-description">
        <h2 id="domino-end-title">Elige una punta</h2>
        <p id="domino-end-description">
          La ficha {low}-{high} sirve en las puntas {choice.openEnds[0]} y {choice.openEnds[1]}.
        </p>
        <button ref={firstButtonRef} type="button" className="btn"
          aria-label={`Jugar ficha ${low}-${high} a la izquierda, punta ${choice.openEnds[0]}`}
          onClick={() => onChoose('left')}>Izquierda · {choice.openEnds[0]}</button>
        <button type="button" className="btn"
          aria-label={`Jugar ficha ${low}-${high} a la derecha, punta ${choice.openEnds[1]}`}
          onClick={() => onChoose('right')}>Derecha · {choice.openEnds[1]}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function StatusLine({
  state,
  mySeat,
}: {
  state: DominoPublicState;
  mySeat: number | null;
}) {
  let text: ReactNode;
  if (mySeat === null) text = 'Sincronizando tu asiento y mano privada…';
  else if (state.phase === 'lobby') text = 'Confirmen los dos para repartir.';
  else if (state.phase === 'between') text = 'La ronda terminó. Pueden repartir la siguiente.';
  else if (state.phase === 'over') {
    text = state.winnerTeam === mySeat % 2 ? '¡Tu equipo ganó la partida!' : 'El equipo rival ganó la partida.';
  } else if (state.turnSeat === mySeat) text = 'Tu turno.';
  else {
    const current = state.seats.find((seat) => seat.seat === state.turnSeat);
    text = current ? `Turno de ${current.label}.` : 'Esperando el siguiente turno.';
  }
  return <p className="domino-status" role="status" aria-live="polite">{text}</p>;
}

function eventAnnouncement(state: DominoPublicState) {
  if (state.phase === 'play' && state.board.length === 0 && state.opener !== null) {
    return `Salida obligatoria: ficha ${tileFromId(state.opener).join('-')}.`;
  }
  const event = state.lastEvents[state.lastEvents.length - 1];
  if (!event) return '';
  const player = event.seat === undefined
    ? ''
    : state.seats.find((seat) => seat.seat === event.seat)?.label ?? `Asiento ${event.seat + 1}`;
  if (event.kind === 'play' && event.tile !== undefined) {
    return `${player} jugó la ficha ${tileFromId(event.tile).join('-')}.`;
  }
  if (event.kind === 'draw') return `${player} robó del pozo.`;
  if (event.kind === 'pass') return `${player} pasó el turno.`;
  return '';
}

export default function Domino({ me, partnerId }: DominoProps) {
  const [localConfig, setLocalConfig] = useState(() => dominoConfig());
  const [view, setView] = useState<DominoActionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [choice, setChoice] = useState<TileChoice>(null);
  const [syncRetry, setSyncRetry] = useState<{ key: string; attempt: number; exhausted: boolean } | null>(null);
  const mounted = useRef(true);
  const snapshotKey = useRef('');
  const snapshotInFlight = useRef('');
  const gameIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const requestRef = useRef(0);
  const latestRequestRef = useRef(0);
  const acceptedSeqRef = useRef(-1);
  const requiredSnapshotKeyRef = useRef('');
  const busyRef = useRef(false);
  const makeInitial = useCallback(
    () => initialDominoLobby(me.id, localConfig),
    [localConfig, me.id],
  );
  const {
    game,
    loading,
    newGame,
    askRematch,
    acceptRematch,
    rejectRematch,
    stopMatch,
    notice,
  } = useGame('domino', me, makeInitial);
  if (gameIdRef.current !== (game?.id ?? null)) {
    gameIdRef.current = game?.id ?? null;
    generationRef.current += 1;
    latestRequestRef.current = ++requestRef.current;
    snapshotKey.current = '';
    snapshotInFlight.current = '';
    acceptedSeqRef.current = -1;
  }
  const publicState = isDominoPublicState(game?.state) ? game.state : null;
  requiredSnapshotKeyRef.current = game?.id
    ? `${game.id}:${publicState?.seq ?? 'required'}`
    : '';
  const viewForGame = view && view.gameId === game?.id ? view : null;
  const state = viewForGame && (!publicState || viewForGame.state.seq >= publicState.seq)
    ? viewForGame.state
    : publicState;
  const seat = viewForGame?.seat ?? null;
  const hand = viewForGame && (!publicState || viewForGame.state.seq >= publicState.seq)
    ? viewForGame.hand
    : [];
  const privateViewSynchronized = Boolean(
    viewForGame
    && state
    && viewForGame.state.seq === state.seq
    && seat !== null
    && hand.length === state.handCounts[seat],
  );

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setView(null);
    setChoice(null);
    setSyncRetry(null);
    setMessage('');
  }, [game?.id]);

  const acceptResponse = useCallback((
    response: DominoActionResponse,
    scope: { gameId: string; generation: number; requestId: number },
  ) => {
    if (!mounted.current || gameIdRef.current !== scope.gameId
      || generationRef.current !== scope.generation
      || latestRequestRef.current !== scope.requestId) return false;
    if (response.state.seq < acceptedSeqRef.current) return false;
    acceptedSeqRef.current = response.state.seq;
    setView((current) => current?.gameId === scope.gameId
      && current.state.seq > response.state.seq ? current : response);
    return true;
  }, []);

  const snapshot = useCallback(async (gameId: string, attempt = 0, showErrors = true) => {
    const key = requiredSnapshotKeyRef.current.startsWith(`${gameId}:`)
      ? requiredSnapshotKeyRef.current
      : `${gameId}:required`;
    if (snapshotInFlight.current === key) return null;
    const scope = {
      gameId,
      generation: generationRef.current,
      requestId: ++requestRef.current,
    };
    latestRequestRef.current = scope.requestId;
    snapshotInFlight.current = key;
    try {
      const { data, error } = await supabase.functions.invoke('domino-game', {
        body: { gameId, action: 'snapshot' },
      });
      if (error) throw error;
      const response = responseFrom(data, gameId);
      if (!response) throw new Error('invalid_domino_response');
      if (acceptResponse(response, scope)) {
        snapshotKey.current = key;
        setSyncRetry(null);
        if (showErrors) setMessage('');
      }
      return response;
    } catch (error) {
      const normalized = await normalizedFunctionError(error);
      if (mounted.current && gameIdRef.current === gameId
        && generationRef.current === scope.generation
        && latestRequestRef.current === scope.requestId) {
        const exhausted = attempt >= 3;
        setSyncRetry({ key, attempt: attempt + 1, exhausted });
        if (showErrors || exhausted) {
          setMessage(exhausted
            ? 'No pudimos sincronizar la mano. Usa “Reintentar sincronización”.'
            : `${actionError(normalized)} Reintentando (${attempt + 1}/3)…`);
        }
        if (!exhausted) {
          window.setTimeout(() => {
            if (mounted.current && gameIdRef.current === gameId
              && generationRef.current === scope.generation
              && requiredSnapshotKeyRef.current === key && snapshotKey.current !== key) {
              void snapshot(gameId, attempt + 1, true);
            }
          }, Math.min(400 * (2 ** attempt), 1600));
        }
      }
      return null;
    } finally {
      if (snapshotInFlight.current === key) snapshotInFlight.current = '';
    }
  }, [acceptResponse]);

  useEffect(() => {
    if (!game?.id || !publicState || game.status !== 'active') {
      if (!game) setView(null);
      return;
    }
    const key = `${game.id}:${publicState.seq}`;
    if (snapshotKey.current === key) return;
    void snapshot(game.id, 0, false);
  }, [game?.id, publicState?.seq, snapshot]);

  useEffect(() => {
    if (publicState) setLocalConfig(publicState.config);
  }, [publicState?.config]);

  useEffect(() => {
    setChoice(null);
  }, [state?.seq]);

  async function createLobby() {
    if (!partnerId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      await newGame(me.id);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function invoke(action: DominoAction) {
    const currentGame = game;
    if (!currentGame || currentGame.status !== 'active' || !state || busyRef.current
      || !privateViewSynchronized) return null;
    const scope = {
      gameId: currentGame.id,
      generation: generationRef.current,
      requestId: ++requestRef.current,
    };
    latestRequestRef.current = scope.requestId;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('domino-game', {
        body: { gameId: currentGame.id, expectedSeq: state.seq, ...action },
      });
      if (error) throw error;
      const response = responseFrom(data, currentGame.id);
      if (!response) throw new Error('invalid_domino_response');
      acceptResponse(response, scope);
      return response;
    } catch (error) {
      const normalized = await normalizedFunctionError(error);
      if (mounted.current && gameIdRef.current === scope.gameId
        && generationRef.current === scope.generation
        && latestRequestRef.current === scope.requestId) {
        setMessage(actionError(normalized));
        await snapshot(currentGame.id, 0, false);
      }
      return null;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function selectTile(tile: number) {
    if (!state || seat === null || busyRef.current || !privateViewSynchronized) return;
    const ends = playableEnds(tile, state, hand, seat);
    if (ends.length === 1) void invoke({ action: 'play', tile, end: ends[0] });
    else if (ends.length === 2 && state.ends) setChoice({ tile, ends, openEnds: state.ends });
  }

  const legal = useMemo(() => {
    const options = new Map<number, DominoEnd[]>();
    if (!state || seat === null || !privateViewSynchronized) return options;
    hand.forEach((tile) => {
      const ends = playableEnds(tile, state, hand, seat);
      if (ends.length) options.set(tile, ends);
    });
    return options;
  }, [hand, privateViewSynchronized, seat, state]);
  const myTurn = privateViewSynchronized && state?.phase === 'play' && state.turnSeat === seat;
  const canDraw = Boolean(myTurn && !legal.size && state?.config.drawFromBoneyard
    && state.boneyardCount > 0);
  const canPass = Boolean(myTurn && !legal.size && (!state?.config.drawFromBoneyard
    || state.boneyardCount === 0));

  if (loading) return <div className="wrap"><p className="muted">Preparando la mesa…</p></div>;
  if (!game) {
    return (
      <main className="wrap domino-wrap">
        <a className="muted" href="#/games" aria-label="Volver a Juegos">← Juegos</a>
        <h1 className="title">Dominó dominicano</h1>
        <ConfigPanel config={localConfig} partnerId={partnerId} busy={busy}
          onChange={(patch) => setLocalConfig((current) => dominoConfig({ ...current, ...patch }))}
          onCreate={createLobby} />
        {message && <p className="err" role="alert">{message}</p>}
      </main>
    );
  }

  if (!state) {
    return (
      <main className="wrap domino-wrap">
        <a className="muted" href="#/games" aria-label="Volver a Juegos">← Juegos</a>
        <h1 className="title">Dominó dominicano</h1>
        <section className="card">
          <p className="err">La mesa tiene un formato incompatible o todavía se está sincronizando.</p>
          <button type="button" className="btn" disabled={busy}
            onClick={() => void snapshot(game.id)}>Volver a sincronizar</button>
          <StopMatchPanel onStop={stopMatch} />
        </section>
      </main>
    );
  }

  const confirmed = state.confirmations.includes(me.id);
  const seatCount = state.config.mode === 'partners' ? 4 : 2;
  const readyForPrivateView = privateViewSynchronized;
  const displaySeat = seat ?? state.seats.find((candidate) => candidate.memberId === me.id)?.seat ?? null;
  const requestRematch = () => askRematch();
  const announcement = eventAnnouncement(state);

  return (
    <main className="wrap domino-wrap">
      <a className="muted" href="#/games" aria-label="Volver a Juegos">← Juegos</a>
      <header className="domino-heading">
        <div>
          <h1 className="title">Dominó dominicano</h1>
          <p className="muted">
            {state.config.mode === 'duel' ? 'Duelo' : 'Parejas'} · {state.config.handSize} fichas · meta {state.config.target}
          </p>
        </div>
      </header>
      {notice && <div className="livepill" role="status">{notice}</div>}
      <Scoreboard state={state} mySeat={displaySeat} />
      <StatusLine state={state} mySeat={displaySeat} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      {state.phase === 'lobby' ? (
        <section className="card domino-lobby" aria-labelledby="domino-lobby-title">
          <h2 id="domino-lobby-title">Mesa creada</h2>
          <p>Ambos deben confirmar antes de repartir. Las reglas quedan bloqueadas al crear la mesa.</p>
          <ul>
            <li>{state.config.mode === 'duel' ? 'Duelo 1 vs 1' : 'Parejas, con bots a izquierda y derecha'}</li>
            <li>{state.config.drawFromBoneyard ? 'Se roba del pozo' : 'Se pasa sin robar'}</li>
            <li>Bloqueo: {state.config.blockedRule === 'general'
              ? 'general, gana el equipo con menos pintas'
              : 'patio, gana quien tenga menos pintas'}</li>
            <li>Capicúa: {state.config.capicuaBonus ? `+${state.config.capicuaBonus}` : 'sin bono'}</li>
          </ul>
          <p>{state.confirmations.length} de 2 jugadores confirmaron.</p>
          <button type="button" className="btn" disabled={confirmed || busy || !readyForPrivateView}
            onClick={() => void invoke({ action: 'confirm' })}>
            {confirmed ? 'Ya confirmaste' : busy ? 'Confirmando…' : 'Confirmar y sentarme'}
          </button>
        </section>
      ) : (
        <>
          <section className={`domino-table-layout seats-${seatCount}`} aria-label="Jugadores en la mesa">
            {(privateViewSynchronized || state.phase === 'over') && displaySeat !== null && state.seats.map((player) => (
              <Seat key={player.seat} seat={player} count={state.handCounts[player.seat] ?? 0}
                mySeat={displaySeat} seatCount={seatCount} turn={state.turnSeat === player.seat} />
            ))}
            <DominoBoard played={state.board} ends={state.ends} />
          </section>

          <section className="domino-hand" aria-labelledby="domino-hand-title">
            <h2 id="domino-hand-title">Tu mano</h2>
            <div className="domino-hand-tiles" role="list">
              {hand.map((tile) => {
                const playable = legal.has(tile);
                return (
                  <span key={tile} role="listitem">
                    <button type="button"
                      className={`domino-hand-tile${playable ? ' legal' : ''}`}
                      aria-disabled={!playable || busy}
                      aria-label={`Jugar ficha ${tileFromId(tile).join('-')}${
                        playable && legal.get(tile)?.length === 2 ? ', sirve en ambas puntas' : ''
                      }${!playable ? ', no disponible en este turno' : ''}`}
                      onClick={() => selectTile(tile)}>
                      <DominoTileFace tile={tileFromId(tile)} decorative />
                    </button>
                  </span>
                );
              })}
              {!hand.length && state.phase !== 'over' && <p className="muted">Sincronizando tu mano privada…</p>}
            </div>
          </section>

          {choice && <EndChooser choice={choice}
            onChoose={(end) => {
              const tile = choice.tile;
              setChoice(null);
              void invoke({ action: 'play', tile, end });
            }}
            onCancel={() => setChoice(null)} />}

          <div className="domino-controls" aria-label="Acciones del turno">
            {canDraw && <button type="button" className="btn" disabled={busy}
              onClick={() => void invoke({ action: 'draw' })}>Robar del pozo ({state.boneyardCount})</button>}
            {canPass && <button type="button" className="btn ghost" disabled={busy}
              onClick={() => void invoke({ action: 'pass' })}>Pasar turno</button>}
            {state.phase === 'between' && state.winnerTeam === null && (
              <button type="button" className="btn" disabled={busy || !readyForPrivateView}
                onClick={() => void invoke({ action: 'next_round' })}>Repartir siguiente ronda</button>
            )}
          </div>
          <RoundResult state={state} />
        </>
      )}

      {message && <p className="err" role="alert">{message}</p>}
      {syncRetry?.exhausted && (
        <button type="button" className="btn ghost domino-sync-retry"
          disabled={busy} onClick={() => void snapshot(game.id, 0, true)}>
          Reintentar sincronización
        </button>
      )}
      <GameReactions gameId={game.id} gameType="domino" memberId={me.id}
        celebration={state.phase === 'over'} />
      <RematchPanel me={me} game={game} onAsk={requestRematch}
        onAccept={acceptRematch} onReject={rejectRematch} />
      {game.status === 'active' && <StopMatchPanel onStop={stopMatch} />}
    </main>
  );
}
