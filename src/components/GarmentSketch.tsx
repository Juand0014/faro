import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  MAX_FASHION_STROKES,
  MAX_FASHION_TOTAL_POINTS,
  addFashionPoint,
  type FashionPoint,
  type FashionStroke,
  type GarmentLayer,
} from '../lib/fashion';

const INKS = [
  { color: '#f4efe6', name: 'Marfil' },
  { color: '#1a1520', name: 'Negro' },
  { color: '#f2b357', name: 'Oro' },
  { color: '#d24f76', name: 'Rosa' },
  { color: '#c23b4c', name: 'Rojo' },
  { color: '#2c6d80', name: 'Turquesa' },
  { color: '#b8a0c8', name: 'Lila' },
];

const TARGETS: { id: GarmentLayer; name: string }[] = [
  { id: 'top', name: 'Parte de arriba' },
  { id: 'bottom', name: 'Falda o pantalón' },
  { id: 'dress', name: 'Vestido' },
];

function path(points: FashionPoint[]) {
  const value = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  return points.length === 1 ? `${value} l .01 .01` : value;
}

export default function GarmentSketch({
  art,
  onChange,
  onTargetChange,
  initialTarget,
}: {
  art: FashionStroke[];
  onChange: (art: FashionStroke[]) => void;
  onTargetChange: (target: GarmentLayer) => void;
  initialTarget: GarmentLayer;
}) {
  const [target, setTarget] = useState<GarmentLayer>(initialTarget);
  const [color, setColor] = useState('#f4efe6');
  const [width, setWidth] = useState(4);
  const [draft, setDraft] = useState(art);
  const [cursor, setCursor] = useState<FashionPoint>({ x: 50, y: 50 });
  const gridId = useId().replace(/:/g, '');
  const artRef = useRef(art);
  const activeId = useRef<string | null>(null);
  const activePointer = useRef<number | null>(null);
  const keyboardDrawing = useRef(false);

  useEffect(() => {
    if (activePointer.current !== null) return;
    artRef.current = art;
    setDraft(art);
  }, [art]);

  const commit = (next: FashionStroke[], publish = false) => {
    artRef.current = next;
    setDraft(next);
    if (publish) onChange(next);
  };

  const pointFor = (event: PointerEvent<SVGSVGElement>): FashionPoint => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    };
  };

  const begin = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary || activePointer.current !== null || keyboardDrawing.current) return;
    const used = artRef.current.reduce((sum, stroke) => sum + stroke.points.length, 0);
    if (artRef.current.length >= MAX_FASHION_STROKES || used >= MAX_FASHION_TOTAL_POINTS) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    const stroke: FashionStroke = {
      id: crypto.randomUUID(),
      target,
      color,
      width,
      points: [pointFor(event)],
    };
    activeId.current = stroke.id;
    commit([...artRef.current, stroke]);
  };

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (activePointer.current !== event.pointerId || !activeId.current
      || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const used = artRef.current.reduce((sum, stroke) => sum + stroke.points.length, 0);
    if (used >= MAX_FASHION_TOTAL_POINTS) return;
    const id = activeId.current;
    const next = artRef.current.map((stroke) =>
      stroke.id === id ? addFashionPoint(stroke, pointFor(event)) : stroke);
    if (next.some((stroke, i) => stroke !== artRef.current[i])) commit(next);
  };

  const end = (event: PointerEvent<SVGSVGElement>) => {
    if (activePointer.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeId.current = null;
    activePointer.current = null;
    onChange(artRef.current);
  };

  const keyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const arrows: Record<string, FashionPoint> = {
      ArrowLeft: { x: -2, y: 0 },
      ArrowRight: { x: 2, y: 0 },
      ArrowUp: { x: 0, y: -2 },
      ArrowDown: { x: 0, y: 2 },
    };
    if (event.key === ' ' && !event.repeat && !keyboardDrawing.current) {
      event.preventDefault();
      const used = artRef.current.reduce((sum, stroke) => sum + stroke.points.length, 0);
      if (artRef.current.length >= MAX_FASHION_STROKES || used >= MAX_FASHION_TOTAL_POINTS) return;
      const stroke: FashionStroke = {
        id: crypto.randomUUID(), target, color, width, points: [cursor],
      };
      keyboardDrawing.current = true;
      activeId.current = stroke.id;
      commit([...artRef.current, stroke]);
      return;
    }
    const delta = arrows[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = {
      x: Math.max(0, Math.min(100, cursor.x + delta.x)),
      y: Math.max(0, Math.min(100, cursor.y + delta.y)),
    };
    setCursor(next);
    if (!keyboardDrawing.current || !activeId.current) return;
    const used = artRef.current.reduce((sum, stroke) => sum + stroke.points.length, 0);
    if (used >= MAX_FASHION_TOTAL_POINTS) return;
    const id = activeId.current;
    commit(artRef.current.map((stroke) => stroke.id === id ? addFashionPoint(stroke, next) : stroke));
  };

  const finishKeyboardStroke = () => {
    if (!keyboardDrawing.current) return;
    keyboardDrawing.current = false;
    activeId.current = null;
    onChange(artRef.current);
  };

  const keyUp = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== ' ') return;
    event.preventDefault();
    finishKeyboardStroke();
  };

  const visible = draft.filter((stroke) => stroke.target === target);
  const totalPoints = draft.reduce((sum, stroke) => sum + stroke.points.length, 0);

  return (
    <div className="look-sketch">
      <div className="look-sketch-head">
        <div>
          <strong>Taller de bocetos</strong>
          <span>Dibuja con el dedo. El estampado se aplica al look.</span>
        </div>
        <span className="look-stroke-count" aria-live="polite">
          {totalPoints}/{MAX_FASHION_TOTAL_POINTS} puntos
        </span>
      </div>

      <div className="look-targets" role="group" aria-label="Prenda para dibujar">
        {TARGETS.map((item) => (
          <button key={item.id} type="button" aria-pressed={target === item.id}
            className={target === item.id ? 'on' : ''}
            onClick={() => {
              setTarget(item.id);
              onTargetChange(item.id);
            }}>{item.name}</button>
        ))}
      </div>

      <div role="group" aria-label={`Lienzo para dibujar en ${TARGETS.find((item) => item.id === target)?.name}`}>
        <svg className="look-drawing" viewBox="0 0 100 100" tabIndex={0} role="application"
          aria-roledescription="Lienzo de dibujo"
          aria-label="Dibuja con el puntero o usa flechas para mover el cursor y mantén espacio para trazar"
          onKeyDown={keyDown} onKeyUp={keyUp} onBlur={finishKeyboardStroke}
          onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <defs>
          <pattern id={gridId} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d9d1c4" strokeWidth=".35" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="#f7f1e7" />
        <rect width="100" height="100" fill={`url(#${gridId})`} />
        {target === 'top' && <path d="M18 22 L34 12 H66 L82 22 L74 82 H26 Z" className="look-paper-shape" />}
        {target === 'bottom' && <path d="M30 10 H70 L84 90 H16 Z" className="look-paper-shape" />}
        {target === 'dress' && <path d="M34 8 H66 L74 40 L92 92 H8 L26 40 Z" className="look-paper-shape" />}
        {visible.map((stroke) => (
          <path key={stroke.id} d={path(stroke.points)} fill="none" stroke={stroke.color}
            strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <path className="look-key-cursor"
          d={`M${cursor.x - 3} ${cursor.y}H${cursor.x + 3}M${cursor.x} ${cursor.y - 3}V${cursor.y + 3}`} />
        </svg>
      </div>

      <div className="look-inkbar">
        {INKS.map((ink) => (
          <button key={ink.color} type="button" aria-label={ink.name} title={ink.name}
            aria-pressed={color === ink.color} className={color === ink.color ? 'on' : ''}
            style={{ background: ink.color }}
            onClick={() => setColor(ink.color)} />
        ))}
        {[2, 4, 7].map((size) => (
          <button key={size} type="button" className={`look-width${width === size ? ' on' : ''}`}
            aria-pressed={width === size}
            aria-label={`Trazo ${size === 2 ? 'fino' : size === 4 ? 'medio' : 'grueso'}`}
            onClick={() => setWidth(size)}>
            <span style={{ height: size }} />
          </button>
        ))}
      </div>

      <div className="look-sketch-actions">
        <button type="button" disabled={!visible.length} onClick={() => {
          const last = [...artRef.current].reverse().find((stroke) => stroke.target === target);
          if (last) commit(artRef.current.filter((stroke) => stroke.id !== last.id), true);
        }}>↶ Deshacer</button>
        <button type="button" disabled={!visible.length}
          onClick={() => commit(artRef.current.filter((stroke) => stroke.target !== target), true)}>
          Limpiar prenda
        </button>
      </div>
    </div>
  );
}
