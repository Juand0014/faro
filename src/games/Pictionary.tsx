import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Member } from '../lib/session';
import { useGame } from '../lib/useGame';
import {
  initialPictionaryState, isCorrectGuess, MAX_DRAW_STROKES, MAX_STROKE_POINTS, wordChoices,
  type DrawPoint, type DrawStroke, type PictionaryState,
} from '../lib/pictionary';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';

const COLORS = [
  { value: '#171b33', name: 'Negro' },
  { value: '#f2b357', name: 'Dorado' },
  { value: '#d24f76', name: 'Rosa' },
  { value: '#2c9bb8', name: 'Azul' },
];

export default function Pictionary({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const makeInitial = useCallback(() => initialPictionaryState(me.id), [me.id]);
  const { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, stopMatch, notice } =
    useGame('draw', me, makeInitial);
  const [choices, setChoices] = useState(() => wordChoices());
  const [guess, setGuess] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [color, setColor] = useState(COLORS[0].value);
  const drawing = useRef<DrawPoint[] | null>(null);
  const strokesRef = useRef<DrawStroke[]>([]);

  useEffect(() => {
    if (!game) return;
    // Las respuestas fallidas son privadas y locales para no competir con las escrituras del lienzo.
    setGuesses([]);
    setChoices(wordChoices());
  }, [game?.id]);

  useEffect(() => {
    strokesRef.current = game?.state?.strokes ?? [];
  }, [game?.state?.strokes]);

  if (loading) return <div className="wrap"><p className="muted">Cargando…</p></div>;
  if (!game) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Pictionary</div>
      <div className="card center">
        <p className="muted">Dibuja una palabra secreta para que tu pareja la adivine.</p>
        <button className="btn" style={{ marginTop: 10 }} disabled={!partnerId} onClick={() => newGame(me.id)}>
          Empezar partida
        </button>
      </div>
    </div>
  );

  const st: PictionaryState = game.state;
  const drawer = (st.drawer || st.first) === me.id ? me.id : partnerId;
  const guesser = drawer === me.id ? partnerId : me.id;
  const iDraw = drawer === me.id;
  const iGuess = guesser === me.id;
  const active = game.status === 'active';

  function chooseWord(word: string) {
    if (!iDraw || !partnerId) return;
    applyMove({
      state: { ...st, drawer: me.id, guesser: partnerId, word, phase: 'draw', strokes: [] },
      turn: partnerId,
    });
  }

  function point(e: PointerEvent<SVGSVGElement>): DrawPoint {
    const box = e.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, ((e.clientX - box.left) / box.width) * 1000)),
      Math.max(0, Math.min(700, ((e.clientY - box.top) / box.height) * 700)),
    ];
  }

  function startStroke(e: PointerEvent<SVGSVGElement>) {
    if (!active || !iDraw || st.phase !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = [point(e)];
  }

  function extendStroke(e: PointerEvent<SVGSVGElement>) {
    if (!drawing.current || drawing.current.length >= MAX_STROKE_POINTS) return;
    const next = point(e);
    const last = drawing.current[drawing.current.length - 1];
    if (Math.hypot(next[0] - last[0], next[1] - last[1]) >= 4) drawing.current.push(next);
  }

  function finishStroke(e: PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    extendStroke(e);
    const points = drawing.current;
    drawing.current = null;
    if (points.length < 2) points.push([points[0][0] + 1, points[0][1] + 1]);
    const strokes = [...strokesRef.current, { id: crypto.randomUUID(), points, color, width: 10 }]
      .slice(-MAX_DRAW_STROKES);
    strokesRef.current = strokes;
    applyMove({ state: { ...st, strokes } });
  }

  function undo() {
    if (!iDraw || !strokesRef.current.length) return;
    const strokes = strokesRef.current.slice(0, -1);
    strokesRef.current = strokes;
    applyMove({ state: { ...st, strokes } });
  }

  function clearDrawing() {
    if (!iDraw || !strokesRef.current.length) return;
    strokesRef.current = [];
    applyMove({ state: { ...st, strokes: [] } });
  }

  function submitGuess() {
    const value = guess.trim();
    if (!active || !iGuess || !value) return;
    setGuess('');
    setGuesses((current) => [...current.slice(-5), value]);
    if (isCorrectGuess(st.word, value)) {
      applyMove({
        status: 'won',
        winner: me.id,
        turn: null,
      });
    }
  }

  return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Pictionary</div>
      {notice && <div className="livepill">{notice}</div>}

      {st.phase === 'choose' && active && (
        <div className="card center">
          {iDraw ? (
            <>
              <p className="muted">Elige qué dibujar. Tu pareja no verá la palabra.</p>
              <div className="draw-choices">
                {choices.map((word) => <button key={word} className="btn ghost" onClick={() => chooseWord(word)}>{word}</button>)}
              </div>
              <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setChoices(wordChoices())}>Otras palabras</button>
            </>
          ) : <p className="muted">Tu pareja está eligiendo qué dibujar…</p>}
        </div>
      )}

      {(st.phase === 'draw' || !active) && (
        <>
          <div className="turnbar">
            {!active
              ? game.status === 'abandoned' ? '⏹️ Partida detenida'
                : game.winner === me.id ? '🎉 ¡Adivinaste!' : 'Tu pareja adivinó'
              : iDraw ? <>Dibuja: <strong className="draw-word">{st.word}</strong></>
                : '¿Qué está dibujando?'}
          </div>
          <svg className="draw-canvas" viewBox="0 0 1000 700"
            role={iDraw ? 'application' : 'img'}
            aria-label={iDraw ? 'Lienzo de dibujo' : 'Dibujo de tu pareja'}
            onPointerDown={startStroke} onPointerMove={extendStroke}
            onPointerUp={finishStroke} onPointerCancel={finishStroke}>
            <rect width="1000" height="700" fill="#fff" />
            {st.strokes.map((stroke: DrawStroke) => (
              <polyline key={stroke.id} points={stroke.points.map((p) => p.join(',')).join(' ')}
                fill="none" stroke={stroke.color} strokeWidth={stroke.width}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>

          {active && iDraw && (
            <div className="draw-tools">
              {COLORS.map((c) => (
                <button key={c.value} aria-label={`Color ${c.name}`} className={color === c.value ? 'on' : ''}
                  style={{ background: c.value }} onClick={() => setColor(c.value)} />
              ))}
              <button className="draw-undo" aria-label="Deshacer trazo" onClick={undo} disabled={!st.strokes.length}>↶</button>
              <button className="draw-undo" onClick={clearDrawing}
                disabled={!st.strokes.length}>Borrar</button>
            </div>
          )}

          {active && iGuess && (
            <div className="card">
              <label htmlFor="draw-guess">Tu respuesta</label>
              <div className="row">
                <input id="draw-guess" className="input" value={guess} autoComplete="off"
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitGuess(); }} />
                <button className="btn draw-send" disabled={!guess.trim()} onClick={submitGuess}>Probar</button>
              </div>
              {!!guesses.length && <p className="locked">Intentos: {guesses.join(' · ')}</p>}
            </div>
          )}

          {!active && game.status !== 'abandoned' && (
            <div className="card center">La palabra era <strong className="draw-word">{st.word}</strong></div>
          )}
        </>
      )}

      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
      {active && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}
