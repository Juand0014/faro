import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent, type PointerEvent,
} from 'react';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';
import type { Member } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useGame } from '../lib/useGame';
import {
  buildWordSearch, initialWordSearchState, isWordSearchState, scoresFromClaims, selectedWord, selectionCells,
  type WordCell,
} from '../lib/wordSearch';
import { WORD_CATEGORIES, WORD_COUNT, wordCategory } from '../lib/wordSearchWords';

const cellKey = ({ row, col }: WordCell) => `${row}:${col}`;

const LETTER_SIZES = [
  { id: 'fit', label: 'Ajustado', cell: 'auto' },
  { id: 'big', label: 'Grande', cell: '2.3rem' },
  { id: 'max', label: 'Muy grande', cell: '3.1rem' },
] as const;
type LetterSize = typeof LETTER_SIZES[number]['id'];
const SIZE_KEY = 'faro-ws-letter-size';

function storedLetterSize(): LetterSize {
  try {
    const saved = localStorage.getItem(SIZE_KEY);
    if (LETTER_SIZES.some((option) => option.id === saved)) return saved as LetterSize;
  } catch { /* private mode keeps the default */ }
  return 'big';
}

export default function WordSearch({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const [category, setCategory] = useState('aeropuertos');
  const [letterSize, setLetterSize] = useState<LetterSize>(storedLetterSize);
  const [selection, setSelection] = useState<{ start: WordCell; end: WordCell } | null>(null);
  const [cursor, setCursor] = useState<WordCell>({ row: 0, col: 0 });
  const [keyboardStart, setKeyboardStart] = useState<WordCell | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    start: WordCell; end: WordCell; pointer: number;
    anchor: WordCell | null; dragging: boolean; moved: boolean;
  } | null>(null);
  const makeInitialState = useCallback(
    () => initialWordSearchState(me.id, category),
    [me.id, category],
  );

  const {
    game, loading, newGame, askRematchWithState, acceptRematch, rejectRematch, stopMatch, reload, notice,
  } = useGame('wordsearch', me, makeInitialState);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from('members').select('id,name').eq('couple_id', me.couple_id);
        if (alive) setNames(Object.fromEntries((data ?? [])
          .filter((member) => typeof member.id === 'string' && typeof member.name === 'string')
          .map((member) => [member.id, member.name])));
      } catch { /* fallback labels remain visible */ }
    })();
    return () => { alive = false; };
  }, [me.couple_id]);

  useEffect(() => {
    try { localStorage.setItem(SIZE_KEY, letterSize); } catch { /* nothing to persist */ }
  }, [letterSize]);

  const state = isWordSearchState(game?.state) ? game.state : null;
  useEffect(() => {
    if (state?.category) setCategory(state.category);
  }, [game?.id, state?.category]);
  const puzzle = useMemo(() => {
    if (!state) return null;
    try {
      const next = buildWordSearch(state.category, state.seed);
      return next.words.every((word, index) => word === state.words[index]) ? next : null;
    } catch { return null; }
  },
    [state?.category, state?.seed]);
  const scores = useMemo(() => state ? scoresFromClaims(state.found) : {}, [state?.found]);
  const players = useMemo(() =>
    [me.id, partnerId].filter((id): id is string => id !== null), [me.id, partnerId]);
  const chosen = useMemo(() => selection
    ? new Set(selectionCells(selection.start, selection.end).map(cellKey))
    : new Set<string>(), [selection]);
  const claimedCells = useMemo(() => {
    const result = new Map<string, string>();
    if (!state || !puzzle) return result;
    for (const placement of puzzle.placements) {
      const owner = state.found[placement.word];
      if (!owner) continue;
      for (const cell of selectionCells(placement.start, placement.end)) result.set(cellKey(cell), owner);
    }
    return result;
  }, [puzzle, state?.found]);

  function pointFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!state) return null;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const cell = target instanceof Element ? target.closest<HTMLElement>('[data-row]') : null;
    if (cell?.dataset.row && cell.dataset.col) {
      return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
    }
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.max(0, Math.min(state.size - 1,
      Math.floor((event.clientX - rect.left) / rect.width * state.size)));
    const row = Math.max(0, Math.min(state.size - 1,
      Math.floor((event.clientY - rect.top) / rect.height * state.size)));
    return { row, col };
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!state || game?.status !== 'active' || busy) return;
    const point = pointFromPointer(event);
    if (!point) return;
    // An enlarged board must stay pannable, so touch drags only select when it fits the screen.
    const dragging = event.pointerType !== 'touch' || letterSize === 'fit';
    if (event.pointerType !== 'touch') event.preventDefault();
    if (dragging) event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      start: point, end: point, pointer: event.pointerId,
      anchor: keyboardStart, dragging, moved: false,
    };
    setKeyboardStart(null);
    if (dragging) setSelection({ start: point, end: point });
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const point = pointFromPointer(event);
    if (!point || cellKey(point) === cellKey(drag.end)) return;
    drag.moved = true;
    if (!drag.dragging) return;
    drag.end = point;
    setSelection({ start: drag.start, end: point });
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.dragging && cellKey(drag.start) !== cellKey(drag.end)) {
      claim(drag.start, drag.end);
      return;
    }
    if (drag.moved) {
      restoreAnchor(drag.anchor);
      return;
    }
    tapCell(drag.end, drag.anchor);
  }

  /** A tap marks the first letter, and the next tap closes the word. */
  function tapCell(cell: WordCell, anchor: WordCell | null) {
    setCursor(cell);
    if (!anchor) {
      setKeyboardStart(cell);
      setSelection({ start: cell, end: cell });
      setMessage('Primera letra marcada. Toca la última letra.');
      return;
    }
    if (cellKey(anchor) === cellKey(cell)) {
      setSelection(null);
      setMessage('Selección cancelada.');
      return;
    }
    claim(anchor, cell);
  }

  function restoreAnchor(anchor: WordCell | null) {
    setKeyboardStart(anchor);
    setSelection(anchor ? { start: anchor, end: anchor } : null);
  }

  function pointerCancel(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    dragRef.current = null;
    restoreAnchor(drag.anchor);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!state || game?.status !== 'active') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setKeyboardStart(null);
      setSelection(null);
      setMessage('Selección cancelada.');
      return;
    }
    const moves: Record<string, WordCell> = {
      ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 },
      ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 },
    };
    if (moves[event.key]) {
      event.preventDefault();
      const move = moves[event.key];
      const next = {
        row: Math.max(0, Math.min(state.size - 1, cursor.row + move.row)),
        col: Math.max(0, Math.min(state.size - 1, cursor.col + move.col)),
      };
      setCursor(next);
      if (keyboardStart) setSelection({ start: keyboardStart, end: next });
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!keyboardStart) {
      setKeyboardStart(cursor);
      setSelection({ start: cursor, end: cursor });
      setMessage('Selección iniciada. Muévete hasta la última letra y pulsa espacio.');
    } else {
      claim(keyboardStart, cursor);
      setKeyboardStart(null);
    }
  }

  async function claim(start: WordCell, end: WordCell) {
    if (!game || !state || !puzzle || busy) return;
    const trace = selectedWord(puzzle.board, start, end);
    const reverse = [...trace].reverse().join('');
    const word = state.words.find((candidate) => candidate === trace || candidate === reverse);
    if (!word) {
      setMessage(trace.length < 2 ? 'Marca desde la primera hasta la última letra.'
        : 'Esa selección no es una palabra de la lista.');
      setSelection(null);
      return;
    }
    if (state.found[word]) {
      setMessage(state.found[word] === me.id ? 'Ya encontraste esa palabra.' : 'Tu pareja llegó primero.');
      setSelection(null);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('claim_word_search_word', {
        p_game_id: game.id,
        p_word: word,
      });
      if (error) setMessage('No se pudo marcar. Comprueba la conexión e intenta otra vez.');
      else {
        const row = (Array.isArray(data) ? data[0] : data) as { state?: { found?: Record<string, string> } } | null;
        const owner = row?.state?.found?.[word];
        if (owner && owner !== me.id) setMessage('Tu pareja llegó primero por muy poco.');
        else {
          setMessage(`¡${word}! Punto para ti.`);
          navigator.vibrate?.(80);
        }
        await reload();
      }
    } catch {
      setMessage('Se perdió la conexión. Intenta marcar la palabra otra vez.');
    } finally {
      setSelection(null);
      setBusy(false);
    }
  }

  if (loading) return <div className="wrap"><p className="muted">Cargando…</p></div>;

  if (!game) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <h1 className="title ws-title">Sopa de letras</h1>
      <div className="card">
        <p className="muted">Encuentren las 14 palabras a la vez. Cada palabra es para quien la marque primero.</p>
        <label htmlFor="word-category">Categoría</label>
        <select id="word-category" className="input ws-select" value={category}
          onChange={(event) => setCategory(event.target.value)}>
          {WORD_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
          ))}
        </select>
        <p className="locked">{WORD_CATEGORIES.length} categorías · {WORD_COUNT.toLocaleString('es')} palabras locales</p>
        <button type="button" className="btn" disabled={!partnerId}
          onClick={() => newGame(me.id)}>Crear sopa</button>
        {!partnerId && <p className="locked">Necesitas a tu pareja enlazada para jugar.</p>}
      </div>
    </div>
  );

  if (!state || !puzzle) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <p className="err" role="alert">Esta partida tiene datos incompatibles. Deténla para empezar otra.</p>
      <StopMatchPanel onStop={stopMatch} />
    </div>
  );

  const finished = game.status !== 'active';
  return (
    <div className="wrap ws-wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="ws-head">
        <div>
          <h1 className="title">Sopa de letras</h1>
          <p className="muted">{wordCategory(state.category).icon} {wordCategory(state.category).name}</p>
        </div>
        <div className="ws-progress" aria-label={`${Object.keys(state.found).length} de ${state.words.length} encontradas`}>
          {Object.keys(state.found).length}/{state.words.length}
        </div>
      </div>
      {notice && <div className="livepill" role="status">{notice}</div>}

      <div className="ws-score" aria-label="Marcador">
        {players.map((id) => <div key={id} className={id === me.id ? 'me' : 'partner'}>
          <span>{id === me.id ? 'Tú' : names[id] || 'Tu pareja'}</span>
          <strong>{scores[id] || 0}</strong>
        </div>)}
      </div>

      {!finished && <fieldset className="ws-size">
        <legend>Tamaño de las letras</legend>
        {LETTER_SIZES.map((option) => (
          <button key={option.id} type="button" aria-pressed={letterSize === option.id}
            className={letterSize === option.id ? 'selected' : ''}
            onClick={() => setLetterSize(option.id)}>{option.label}</button>
        ))}
      </fieldset>}

      {!finished && <div className="ws-board-scroll"><div ref={boardRef}
        className={`ws-board ${letterSize === 'fit' ? 'fit' : 'zoom'}`} role="grid" tabIndex={0}
        aria-label="Tablero de sopa de letras. Toca la primera y la última letra de una palabra, o arrástralas; con teclado usa flechas y espacio."
        aria-rowcount={state.size} aria-colcount={state.size}
        aria-activedescendant={`ws-cell-${cursor.row}-${cursor.col}`}
        style={{
          '--ws-size': state.size,
          '--ws-cell': LETTER_SIZES.find((option) => option.id === letterSize)?.cell ?? 'auto',
        } as CSSProperties}
        onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={pointerUp} onPointerCancel={pointerCancel} onKeyDown={keyDown}>
        {puzzle.board.map((row, rowIndex) => (
          <span key={rowIndex} role="row" className="ws-row">
            {row.map((letter, colIndex) => {
              const key = `${rowIndex}:${colIndex}`;
              const owner = claimedCells.get(key);
              const ownerLabel = owner === me.id ? ', encontrada por ti'
                : owner ? `, encontrada por ${names[owner] || 'tu pareja'}` : '';
              return <span key={key} id={`ws-cell-${rowIndex}-${colIndex}`} role="gridcell"
                data-row={rowIndex} data-col={colIndex}
                aria-rowindex={rowIndex + 1} aria-colindex={colIndex + 1}
                aria-selected={chosen.has(key)}
                aria-label={`${letter}, fila ${rowIndex + 1}, columna ${colIndex + 1}${ownerLabel}`}
                className={[
                  chosen.has(key) ? 'selected' : '',
                  owner === me.id ? 'found-me' : owner ? 'found-partner' : '',
                  cursor.row === rowIndex && cursor.col === colIndex ? 'cursor' : '',
                ].filter(Boolean).join(' ')}>{letter}</span>;
            })}
          </span>
        ))}
      </div></div>}

      <p className="ws-message" role="status">{message}</p>
      {!finished && <p className="ws-hint">Toca la primera y la última letra, o arrastra sobre la palabra.</p>}

      <section className="card ws-words" aria-labelledby="ws-word-heading">
        <h2 id="ws-word-heading">Palabras</h2>
        <ul>
          {state.words.map((word) => {
            const owner = state.found[word];
            return <li key={word} className={owner === me.id ? 'mine' : owner ? 'theirs' : ''}>
              {word}{owner && <small>{owner === me.id ? 'tú' : names[owner] || 'pareja'}</small>}
            </li>;
          })}
        </ul>
      </section>

      {finished && <div className="card center">
        <div className="turnbar">
          {game.status === 'abandoned' ? 'Partida detenida'
            : game.status === 'draw' ? 'Empate'
              : game.winner === me.id ? '¡Ganaste!' : 'Ganó tu pareja'}
        </div>
        <p className="muted">Marcador final: {scores[me.id] || 0} – {partnerId ? scores[partnerId] || 0 : 0}</p>
        <label htmlFor="next-word-category">Cambiar categoría</label>
        <select id="next-word-category" className="input ws-select" value={category}
          onChange={(event) => setCategory(event.target.value)}>
          {WORD_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
          ))}
        </select>
      </div>}

      <RematchPanel me={me} game={game}
        onAsk={() => askRematchWithState(state ? { ...state, nextCategory: category } : undefined)}
        onAccept={acceptRematch} onReject={rejectRematch} />
      {!finished && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}
