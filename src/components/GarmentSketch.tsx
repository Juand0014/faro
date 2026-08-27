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
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} l .01 .01`;
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length - 1; i += 1) {
    const next = points[i + 1];
    commands.push(`Q ${points[i].x} ${points[i].y} ${(points[i].x + next.x) / 2} ${(points[i].y + next.y) / 2}`);
  }
  const last = points[points.length - 1];
  commands.push(`L ${last.x} ${last.y}`);
  return commands.join(' ');
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
  const [tool, setTool] = useState<'draw' | 'erase'>('draw');
  const [draft, setDraft] = useState(art);
  const [cursor, setCursor] = useState<FashionPoint>({ x: 50, y: 50 });
  const gridId = useId().replace(/:/g, '');
  const artRef = useRef(art);
  const totalPointsRef = useRef(art.reduce((sum, stroke) => sum + stroke.points.length, 0));
  const activeId = useRef<string | null>(null);
  const activePointer = useRef<number | null>(null);
  const keyboardDrawing = useRef(false);

  useEffect(() => {
    if (activePointer.current !== null) return;
    artRef.current = art;
    totalPointsRef.current = art.reduce((sum, stroke) => sum + stroke.points.length, 0);
    setDraft(art);
  }, [art]);

  const commit = (next: FashionStroke[], publish = false) => {
    artRef.current = next;
    totalPointsRef.current = next.reduce((sum, stroke) => sum + stroke.points.length, 0);
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
    const point = pointFor(event);
    if (tool === 'erase') {
      const nearest = [...artRef.current].reverse().find((stroke) =>
        stroke.target === target && stroke.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 9));
      if (nearest) commit(artRef.current.filter((stroke) => stroke.id !== nearest.id), true);
      return;
    }
    if (artRef.current.length >= MAX_FASHION_STROKES
      || totalPointsRef.current >= MAX_FASHION_TOTAL_POINTS) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    const stroke: FashionStroke = {
      id: crypto.randomUUID(),
      target,
      color,
      width,
      points: [point],
    };
    activeId.current = stroke.id;
    commit([...artRef.current, stroke]);
  };

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (activePointer.current !== event.pointerId || !activeId.current
      || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (totalPointsRef.current >= MAX_FASHION_TOTAL_POINTS) return;
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
      if (tool === 'erase') return;
      if (artRef.current.length >= MAX_FASHION_STROKES
        || totalPointsRef.current >= MAX_FASHION_TOTAL_POINTS) return;
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
    if (totalPointsRef.current >= MAX_FASHION_TOTAL_POINTS) return;
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
  const addStamp = (kind: 'seam' | 'zip' | 'flower') => {
    if (artRef.current.length >= MAX_FASHION_STROKES) return;
    const shapes = {
      seam: [{ x: 25, y: 55 }, { x: 75, y: 55 }],
      zip: [{ x: 50, y: 24 }, { x: 50, y: 76 }],
      flower: [
        { x: 50, y: 38 }, { x: 57, y: 47 }, { x: 68, y: 50 }, { x: 57, y: 55 },
        { x: 50, y: 66 }, { x: 43, y: 55 }, { x: 32, y: 50 }, { x: 43, y: 45 }, { x: 50, y: 38 },
      ],
    };
    if (totalPointsRef.current + shapes[kind].length > MAX_FASHION_TOTAL_POINTS) return;
    const stroke: FashionStroke = {
      id: crypto.randomUUID(), target, color, width: kind === 'flower' ? 3 : 2, points: shapes[kind],
    };
    commit([...artRef.current, stroke], true);
  };

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
        {target === 'top' && <path d="M16 25 Q26 17 36 12 Q42 19 50 19 Q58 19 64 12 Q74 17 84 25 L75 43 L71 84 Q50 91 29 84 L25 43 Z" className="look-paper-shape" />}
        {target === 'bottom' && <path d="M30 10 Q50 6 70 10 L78 45 Q85 68 88 91 H56 L50 48 L44 91 H12 Q15 68 22 45 Z" className="look-paper-shape" />}
        {target === 'dress' && <path d="M34 9 Q42 16 50 16 Q58 16 66 9 L74 31 Q70 42 69 47 Q83 68 91 93 H9 Q17 68 31 47 Q30 42 26 31 Z" className="look-paper-shape" />}
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
            onClick={() => { setColor(ink.color); setTool('draw'); }} />
        ))}
        {[2, 4, 7].map((size) => (
          <button key={size} type="button" className={`look-width${width === size ? ' on' : ''}`}
            aria-pressed={width === size}
            aria-label={`Trazo ${size === 2 ? 'fino' : size === 4 ? 'medio' : 'grueso'}`}
            onClick={() => { setWidth(size); setTool('draw'); }}>
            <span style={{ height: size }} />
          </button>
        ))}
      </div>

      <div className="look-sketch-tools" role="group" aria-label="Herramientas de dibujo">
        <button type="button" aria-pressed={tool === 'draw'} className={tool === 'draw' ? 'on' : ''}
          onClick={() => setTool('draw')}>Pincel</button>
        <button type="button" aria-pressed={tool === 'erase'} className={tool === 'erase' ? 'on' : ''}
          onClick={() => setTool('erase')}>Borrador</button>
        <button type="button" onClick={() => addStamp('seam')}>Costura</button>
        <button type="button" onClick={() => addStamp('zip')}>Cierre</button>
        <button type="button" onClick={() => addStamp('flower')}>Flor</button>
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
