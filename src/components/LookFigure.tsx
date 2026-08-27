import { useId, useMemo, type ReactNode } from 'react';
import {
  ACCS, BOTTOMS, DRESSES, HAIRS, MATERIALS, OUTERS, SHOES, TOPS,
  normalizeOutfit, type FabricMaterial, type FashionPoint, type GarmentLayer, type Outfit,
} from '../lib/fashion';

/**
 * Croquis editorial dibujado con curvas Bézier sobre un canon alargado de
 * ilustración de moda (cráneo 22, mentón 72, cintura 168, cadera 200, suelo 384).
 * Todas las prendas se derivan de las mismas siluetas base recortadas por zonas
 * de cobertura, así escotes, largos y mangas comparten anatomía y se combinan
 * sin romper la figura.
 */
const BODY = {
  head: 'M110 22.5C122.6 22.5 133 32.2 133 46c0 10.4-4.2 18-10.4 22.6-4.1 3.1-8.3 4.6-12.6 4.6s-8.5-1.5-12.6-4.6C91.2 64 87 56.4 87 46c0-13.8 10.4-23.5 23-23.5Z',
  neck: 'M103 58v26c0 7-3 12-8.5 16h31c-5.5-4-8.5-9-8.5-16V58Z',
  torso: 'M86 102c-4 13-2 27 1 39 3 12 10.5 16 11 26 .5 12-8.5 18-10 30-1 10 2.5 17 9.5 19h26c7-2 10.5-9 9.5-19-1.5-12-10.5-18-10-30 .5-10 8-14 11-26 3-12 5-26 1-39-7-5-16-7-24-7s-17 2-24 7Z',
  arm: 'M85 98c-8 17-11 47-13 76-2 22-4.5 46-6 64-.5 10 2.5 16.5 8 16.5s7.5-6.5 8-14.5c1.5-20 3.5-44 5.5-66 2.5-29 6.5-58 11.5-73Z',
  leg: 'M86 205c-2 27 1 53 3.5 81 1.5 18 0 32-.5 46-.3 12-.5 20-.5 28h10.5c0-8 0-16 .5-28 .5-16 2.5-28 4-46 2.5-28 4.5-54 3.5-82Z',
  foot: 'M88.4 352c-2 8-3.5 16-2.5 22 3.5 3.6 11.5 3.6 15 0 1-7-.7-14-1-22Z',
  ear: 'M87.6 44c-3-1.5-5.5.5-5 4 .4 3.4 3 6 5.6 6Z',
};

/** Siluetas de prenda según el fit elegido. */
const TORSO_FIT = 'M84 100c-3 13-1 28 2 40 3 12 10 15 10.5 26 .5 12-8 18-9.5 30-1 10 2.5 18 9.5 20h26c7-2 10.5-10 9.5-20-1.5-12-10-18-9.5-30 .5-11 7.5-14 10.5-26 3-12 5-27 2-40-7-5-16-7-24-7s-17 2-24 7Z';
const TORSO_G = 'M82 99c-4 14-2 29 2 42 3 12 11 16 11.5 27 .5 12-8.5 18-10 30-1 11 2.5 19 10.5 21h28c8-2 11.5-10 10.5-21-1.5-12-10.5-18-10-30 .5-11 8.5-15 11.5-27 4-13 6-28 2-42-8-5-18-7-26-7s-18 2-26 7Z';
const TORSO_BOX = 'M78 96c-5 15-4 31-2 47 2 16 2 34 2 54 0 14 2 22 6 26h52c4-4 6-12 6-26 0-20 0-38 2-54 2-16 3-32-2-47-10-6-24-8-32-8s-22 2-32 8Z';
const ARM_G = 'M84.5 96c-8 18-11.5 48-13.5 78-2 22-4.5 46-6 64-.5 11 3 17.5 9 17.5s8-6.5 8.5-15c1.5-20 3.5-44 5.5-66 2.5-29 6.5-59 11.5-75Z';
const ARM_BOX = 'M83 94c-10 19-14 51-17 82-2.5 24-5 48-6.5 66-.5 11 3.5 18 10 18s9-7 9.5-16c1.5-20 4-44 6.5-66 3-31 8-61 14-79Z';

const NECK_ROUND = 'M97 92c2 16 5 22 13 22s11-6 13-22Z';
const NECK_V = 'M96 92 110 124 124 92Z';
const NECK_SQUARE = 'M97 92h26v18c0 3-2 4.5-5 4.5h-16c-3 0-5-1.5-5-4.5Z';
const SWEETHEART = 'M82 132c8-9 20-7 28 1 8-8 20-10 28-1v94H82Z';
const MIRROR = 'translate(220,0) scale(-1,1)';

const mirror = (v: number) => 220 - v;
const round = (n: number) => Math.round(n * 10) / 10;

/** Dobladillo ondulado para melenas y faldas con vuelo. */
function waveHem(x0: number, x1: number, y: number, steps: number, amp: number) {
  const step = (x1 - x0) / steps;
  let d = '';
  for (let i = 0; i < steps; i += 1) {
    const x = x0 + step * i;
    d += `Q${round(x + step / 2)} ${round(y + (i % 2 ? -amp : amp))} ${round(x + step)} ${round(y)}`;
  }
  return d;
}

function skirtPath(hemY: number, half: number, rise = 176) {
  const l = round(110 - half);
  const r = round(110 + half);
  const mid = round(rise + (hemY - rise) * 0.5);
  return `M93 ${rise}C88 ${rise + 4} 86 ${rise + 12} 85 ${rise + 22}`
    + `C83 ${mid} ${l + 2} ${hemY - 28} ${l} ${hemY}`
    + `C${l + 8} ${hemY + 8} ${r - 8} ${hemY + 8} ${r} ${hemY}`
    + `C${r - 2} ${hemY - 28} 137 ${mid} 135 ${rise + 22}`
    + `C134 ${rise + 12} 132 ${rise + 4} 127 ${rise}`
    + `C122 ${rise - 3} 98 ${rise - 3} 93 ${rise}Z`;
}

function pantsPath(flare: number, hemY: number, rise: number) {
  const oKnee = round(88 - flare * 0.4);
  const oHem = round(86.5 - flare);
  const iHem = round(100.5 - flare * 0.4);
  const iKnee = 103;
  return `M84.5 ${rise}C82 ${rise + 26} 84 250 ${oKnee} 286`
    + `C${oKnee - 1} 312 ${oHem} 334 ${oHem} ${hemY}`
    + `L${iHem} ${hemY}C${iHem} 330 ${iKnee} 310 ${iKnee} 286`
    + `C104 256 108 234 110 221`
    + `C112 234 ${mirror(iKnee) - 4} 256 ${mirror(iKnee)} 286`
    + `C${mirror(iKnee)} 310 ${mirror(iHem)} 330 ${mirror(iHem)} ${hemY}`
    + `L${mirror(oHem)} ${hemY}C${mirror(oHem)} 334 ${mirror(oKnee) + 1} 312 ${mirror(oKnee)} 286`
    + `C136 250 138 ${rise + 26} 135.5 ${rise}`
    + `C132 ${rise - 4} 88 ${rise - 4} 84.5 ${rise}Z`;
}

type Length = Outfit['bottomLength'];
type Sleeve = { to: number; box?: boolean; puff?: boolean };

type Piece = {
  /** Siluetas rellenas con el color o el estampado de la prenda. */
  shapes: string[];
  /** Zona de cobertura (unión de formas): escotes, tirantes y largos. */
  cover?: ReactNode;
  /** Costuras, pliegues y adornos dibujados sobre el relleno. */
  detail?: ReactNode;
  /** Manga: largo medido desde el hombro. */
  sleeve?: Sleeve;
  /** Recorte de piel que abre el escote sobre la prenda. */
  neckline?: string;
};

const coverBelow = (y: number, to: number) => <rect x="56" y={y} width="108" height={to - y} />;

/** El largo elegido desplaza el dobladillo propio de cada prenda. */
const hemFor = (base: number, length: Length) =>
  Math.max(246, Math.min(354, base + (length === 'mini' ? -46 : length === 'maxi' ? 46 : 0)));
const sweepFor = (half: number, length: Length) =>
  Math.max(24, half + (length === 'mini' ? -4 : length === 'maxi' ? 8 : 0));

const necklineFor = (kind: Outfit['neckline']) =>
  kind === 'v' ? NECK_V : kind === 'square' ? NECK_SQUARE : NECK_ROUND;

export default function LookFigure({ outfit, compact }: { outfit: Outfit; compact?: boolean }) {
  const look = useMemo(() => normalizeOutfit(outfit), [outfit]);
  const uid = useId().replace(/:/g, '');
  const fine = !compact;
  const dressed = look.dress !== 'none';

  const paint = (layer: GarmentLayer) =>
    look[`${layer}Pattern`] === 'solid' ? look[`${layer}Color`] : `url(#${uid}-${layer})`;

  const top = dressed ? null : topPiece(look, fine);
  const bottom = dressed ? null : bottomPiece(look, fine);
  const dress = dressed ? dressPiece(look, fine) : null;
  const outer = look.outer === 'none' ? null : outerPiece(look, fine);
  const layers: [string, Piece | null, FabricMaterial][] = [
    ['top', top, look.topMaterial],
    ['bottom', bottom, look.bottomMaterial],
    ['dress', dress, look.dressMaterial],
    ['outer', outer, look.outerMaterial],
  ];

  const artPath = (points: FashionPoint[], target: GarmentLayer) => {
    const box = target === 'top'
      ? { x: 78, y: 100, w: 64, h: 118 }
      : target === 'bottom'
        ? { x: 72, y: 188, w: 76, h: 152 }
        : { x: 66, y: 100, w: 88, h: 240 };
    const d = points.map((point, i) =>
      `${i ? 'L' : 'M'}${round(box.x + point.x * box.w / 100)} ${round(box.y + point.y * box.h / 100)}`).join(' ');
    return points.length === 1 ? `${d}l.01.01` : d;
  };

  return (
    <svg className={'look-fig atelier' + (compact ? ' compact' : '')} viewBox="0 0 220 400"
      role="img" aria-label="Croquis editorial con el look diseñado" aria-describedby={`${uid}-desc`}>
      <desc id={`${uid}-desc`}>{describe(look)}</desc>
      <defs>
        {(['top', 'bottom', 'dress'] as const).map((layer) => (
          <GarmentPattern key={layer} id={`${uid}-${layer}`} color={look[`${layer}Color`]}
            pattern={look[`${layer}Pattern`]} />
        ))}
        {layers.map(([id, piece, material]) => piece && (
          <Finish key={`fin${id}`} id={`${uid}-${id}-fin`} material={material} />
        ))}
        {fine && layers.map(([id, piece, material]) => piece && (
          <Weave key={`tex${id}`} id={`${uid}-${id}-tex`} material={material} />
        ))}
        <linearGradient id={`${uid}-vol`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".17" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".02" />
          <stop offset=".62" stopColor="#000" stopOpacity=".04" />
          <stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
        <linearGradient id={`${uid}-skin`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".14" />
          <stop offset=".34" stopColor="#fff" stopOpacity=".03" />
          <stop offset=".68" stopColor="#000" stopOpacity=".05" />
          <stop offset="1" stopColor="#000" stopOpacity=".24" />
        </linearGradient>
        <linearGradient id={`${uid}-hairv`} x1=".1" x2=".9" y1="0" y2=".4">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
        <radialGradient id={`${uid}-floor`}>
          <stop offset="0" stopColor="#5c4645" stopOpacity=".38" />
          <stop offset="1" stopColor="#5c4645" stopOpacity="0" />
        </radialGradient>
        {layers.map(([id, piece]) => piece && (
          <clipPath key={`sil${id}`} id={`${uid}-${id}-sil`}>
            {piece.shapes.map((d, i) => <path key={i} d={d} />)}
          </clipPath>
        ))}
        {layers.map(([id, piece]) => piece?.cover && (
          <clipPath key={`cov${id}`} id={`${uid}-${id}-cov`}>{piece.cover}</clipPath>
        ))}
        {layers.map(([id, piece]) => piece?.sleeve && (
          <clipPath key={`slv${id}`} id={`${uid}-${id}-slv`}>
            <rect x="38" y="86" width="144" height={piece.sleeve.to - 86} />
          </clipPath>
        ))}
        {!dressed && look.bottom === 'slit' && (
          <clipPath id={`${uid}-slit`}><path d="M104 248h22v100h-22Z" /></clipPath>
        )}
      </defs>

      <ellipse cx="110" cy="384" rx="62" ry="10" fill={`url(#${uid}-floor)`} />

      <BackHair look={look} uid={uid} fine={fine} />
      <BackAccessory look={look} uid={uid} />
      <Skin look={look} uid={uid} fine={fine} />
      <Face look={look} fine={fine} />
      <Shoes look={look} uid={uid} fine={fine} />

      {bottom && <Garment uid={uid} id="bottom" piece={bottom} fill={paint('bottom')}
        material={look.bottomMaterial} skin={look.skin} fine={fine} />}
      {bottom && look.bottom === 'slit' && (
        <g clipPath={`url(#${uid}-slit)`}>
          <g clipPath={`url(#${uid}-bottom-sil)`} transform={MIRROR}>
            <path d={BODY.leg} fill={look.skin} />
            <path d={BODY.leg} fill={`url(#${uid}-skin)`} />
          </g>
        </g>
      )}
      {top && <Garment uid={uid} id="top" piece={top} fill={paint('top')}
        material={look.topMaterial} skin={look.skin} fine={fine} />}
      {dress && <Garment uid={uid} id="dress" piece={dress} fill={paint('dress')}
        material={look.dressMaterial} skin={look.skin} fine={fine} />}

      {(['top', 'bottom', 'dress'] as const).map((target) => {
        if ((target === 'dress') !== dressed) return null;
        const piece = target === 'top' ? top : target === 'bottom' ? bottom : dress;
        const strokes = look.art.filter((stroke) => stroke.target === target);
        if (!piece || !strokes.length) return null;
        const inked = (
          <g clipPath={`url(#${uid}-${target}-sil)`}>
            {strokes.map((stroke) => (
              <path key={stroke.id} d={artPath(stroke.points, target)} fill="none" stroke={stroke.color}
                strokeWidth={round(stroke.width * 0.8)} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        );
        return piece.cover
          ? <g key={target} clipPath={`url(#${uid}-${target}-cov)`}>{inked}</g>
          : <g key={target}>{inked}</g>;
      })}

      {outer && <Garment uid={uid} id="outer" piece={outer} fill={look.outerColor}
        material={look.outerMaterial} skin={look.skin} fine={fine}
        opacity={look.outer === 'cardigan' ? 0.94 : undefined} />}

      <FrontHair look={look} uid={uid} fine={fine} />
      <Accessory look={look} uid={uid} fine={fine} />
    </svg>
  );
}

/* --------------------------------------------------------------- pintado */

function Garment({ uid, id, piece, fill, material, skin, fine, opacity }: {
  uid: string; id: string; piece: Piece; fill: string; material: FabricMaterial;
  skin: string; fine: boolean; opacity?: number;
}) {
  const body = (
    <>
      {piece.shapes.map((d, i) => <path key={`f${i}`} d={d} fill={fill} />)}
      {piece.shapes.map((d, i) => <path key={`v${i}`} d={d} fill={`url(#${uid}-${id}-fin)`} />)}
      {fine && hasWeave(material) && piece.shapes.map((d, i) => (
        <path key={`t${i}`} d={d} fill={`url(#${uid}-${id}-tex)`} />
      ))}
      {piece.neckline && <>
        <path d={piece.neckline} fill={skin} />
        <path d={piece.neckline} fill={`url(#${uid}-skin)`} />
      </>}
      {piece.detail}
    </>
  );
  return (
    <g data-material={material} opacity={opacity}>
      {piece.sleeve && <SleeveArm uid={uid} id={id} fill={fill} sleeve={piece.sleeve} />}
      {piece.cover ? <g clipPath={`url(#${uid}-${id}-cov)`}>{body}</g> : body}
    </g>
  );
}

function SleeveArm({ uid, id, fill, sleeve }: { uid: string; id: string; fill: string; sleeve: Sleeve }) {
  const d = sleeve.box ? ARM_BOX : ARM_G;
  const puff = <ellipse cx="80" cy="116" rx="14" ry="17" transform="rotate(-14 80 116)" />;
  const one = (
    <>
      <g clipPath={`url(#${uid}-${id}-slv)`}>
        {sleeve.puff && <g fill={fill}>{puff}</g>}
        <path d={d} fill={fill} />
        <g fill={`url(#${uid}-${id}-fin)`}>
          {sleeve.puff && puff}
          <path d={d} />
        </g>
      </g>
      <Ink d={`M${sleeve.box ? 63 : 69} ${sleeve.to - 3}c5 4 13 4 18 1`} w="1.4" o=".2" />
    </>
  );
  return <>{one}<g transform={MIRROR}>{one}</g></>;
}

function Ink({ d, w = '1.2', o = '.22', c = '#0b0710', dash }: {
  d: string; w?: string; o?: string; c?: string; dash?: string;
}) {
  return <path d={d} fill="none" stroke={c} strokeOpacity={o} strokeWidth={w}
    strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />;
}

/** Estampado plano de la prenda: liso, rayas, lunares o cuadros. */
function GarmentPattern({ id, color, pattern }: { id: string; color: string; pattern: string }) {
  return (
    <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill={color} />
      {pattern === 'stripes' && (
        <path d="M-3 3 3-3M0 12 12 0M9 15 15 9" stroke="#fff" strokeOpacity=".26" strokeWidth="2.6" />
      )}
      {pattern === 'dots' && <>
        <circle cx="3" cy="3" r="1.7" fill="#fff" fillOpacity=".42" />
        <circle cx="9" cy="9" r="1.7" fill="#fff" fillOpacity=".42" />
      </>}
      {pattern === 'check' && <>
        <rect width="6" height="6" fill="#000" fillOpacity=".18" />
        <rect x="6" y="6" width="6" height="6" fill="#000" fillOpacity=".18" />
        <path d="M6 0v12M0 6h12" stroke="#fff" strokeOpacity=".14" strokeWidth=".8" />
      </>}
    </pattern>
  );
}

/** Caída de la luz según el tejido: el satén brilla, el algodón apaga. */
function Finish({ id, material }: { id: string; material: FabricMaterial }) {
  const stops: [string, string, string][] = material === 'satin'
    ? [['0', '#000', '.2'], ['.24', '#fff', '.04'], ['.4', '#fff', '.62'], ['.53', '#fff', '.08'],
      ['.78', '#000', '.16'], ['1', '#000', '.38']]
    : material === 'leather'
      ? [['0', '#fff', '.06'], ['.22', '#fff', '.36'], ['.4', '#fff', '.02'], ['.7', '#000', '.14'],
        ['1', '#000', '.42']]
      : material === 'denim'
        ? [['0', '#fff', '.11'], ['.35', '#fff', '.02'], ['.7', '#000', '.08'], ['1', '#000', '.32']]
        : material === 'knit'
          ? [['0', '#fff', '.13'], ['.4', '#fff', '.02'], ['1', '#000', '.27']]
          : material === 'lace'
            ? [['0', '#fff', '.2'], ['.45', '#fff', '.04'], ['1', '#000', '.22']]
            : [['0', '#fff', '.17'], ['.3', '#fff', '.02'], ['.62', '#000', '.04'], ['1', '#000', '.3']];
  return (
    <linearGradient id={id} x1="0" x2="1">
      {stops.map(([offset, color, opacity]) => (
        <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
      ))}
    </linearGradient>
  );
}

const hasWeave = (material: FabricMaterial) =>
  material === 'denim' || material === 'knit' || material === 'lace';

/** Textura del tejido: sarga del denim, canalé del punto, calado del encaje. */
function Weave({ id, material }: { id: string; material: FabricMaterial }) {
  if (!hasWeave(material)) return null;
  if (material === 'denim') {
    return (
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M-1 5 5-1M2 8 8 2" stroke="#fff" strokeOpacity=".08" strokeWidth="1.1" />
      </pattern>
    );
  }
  if (material === 'knit') {
    return (
      <pattern id={id} width="5" height="7" patternUnits="userSpaceOnUse">
        <path d="M1.2 0v7" stroke="#000" strokeOpacity=".1" strokeWidth="1.4" />
        <path d="M3.6 0v7" stroke="#fff" strokeOpacity=".09" strokeWidth="1.2" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="11" height="11" patternUnits="userSpaceOnUse">
      <circle cx="5.5" cy="5.5" r="3.4" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth=".9" />
      <circle cx="0" cy="0" r="1.6" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth=".9" />
      <circle cx="11" cy="11" r="1.6" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth=".9" />
    </pattern>
  );
}

/* ---------------------------------------------------------------- figura */

function Skin({ look, uid, fine }: { look: Outfit; uid: string; fine: boolean }) {
  const shade = `url(#${uid}-skin)`;
  const both = (d: string) => (
    <>
      <path d={d} fill={look.skin} />
      <path d={d} fill={shade} />
      <g transform={MIRROR}>
        <path d={d} fill={look.skin} />
        <path d={d} fill={shade} />
      </g>
    </>
  );
  return (
    <>
      {both(BODY.leg)}
      {both(BODY.foot)}
      {both(BODY.arm)}
      <path d={BODY.torso} fill={look.skin} />
      <path d={BODY.torso} fill={shade} />
      <path d={BODY.neck} fill={look.skin} />
      <path d={BODY.neck} fill={shade} />
      <path d="M99 70c4 8 18 8 22 0 2 8 1 14-11 14s-13-6-11-14Z" fill="#000" fillOpacity=".13" />
      {both(BODY.ear)}
      <path d={BODY.head} fill={look.skin} />
      <path d={BODY.head} fill={shade} />
      {fine && <>
        <Ink d="M97 170c8 4 18 4 26 0" w="1.2" o=".13" />
        <Ink d="M92 286c4 2 9 2 12 0M116 286c3 2 8 2 12 0" w="1.2" o=".11" />
        <Ink d="M96 132c4 6 4 14 2 20M124 132c-4 6-4 14-2 20" w="1.2" o=".09" />
      </>}
    </>
  );
}

function Face({ look, fine }: { look: Outfit; fine: boolean }) {
  const bold = look.face === 'bold';
  const eye = (cx: number) => (
    <>
      <path d={`M${cx - 5} 47c2-4.4 8-4.4 10 0-2 3.8-8 3.8-10 0Z`} fill="#fdfbf7" fillOpacity=".92" />
      <circle cx={cx} cy="47" r="2.6" fill="#2b2331" />
      <circle cx={cx + 0.9} cy="46" r=".8" fill="#fff" fillOpacity=".85" />
      <Ink d={`M${cx - 5} 47c2-4.6 8-4.6 10 0`} c="#241d2b" o={bold ? '.92' : '.72'} w={bold ? '1.9' : '1.3'} />
      {bold && <Ink d={`M${cx + 4.6} 46.4 ${cx + 7.8} 44`} c="#241d2b" o=".9" w="1.4" />}
    </>
  );
  return (
    <>
      <Ink d="M94 38.6c4-3.2 9.6-2.8 12.6.4" c={look.hairColor} o={bold ? '.95' : '.72'} w={bold ? '2.4' : '1.8'} />
      <Ink d="M113.4 39c3-3.2 8.6-3.6 12.6-.4" c={look.hairColor} o={bold ? '.95' : '.72'} w={bold ? '2.4' : '1.8'} />
      {eye(101)}
      {look.face === 'wink'
        ? <Ink d="M114 47.4c2.6 2.8 7.4 2.8 10 0" c="#241d2b" o=".88" w="1.9" />
        : eye(119)}
      <Ink d="M108.4 53.6c-.8 4-.2 6 2.6 6.4" w="1.3" o=".26" />
      <path d="M103.6 65.4c2.4-2.4 4.6-1.6 6.4-.2 1.8-1.4 4-2.2 6.4.2-1.8 4.6-4 6.2-6.4 6.2s-4.6-1.6-6.4-6.2Z"
        fill="#a4505f" fillOpacity={bold ? '.96' : '.82'} />
      <Ink d="M103.6 65.4c4 1.6 8.8 1.6 12.8 0" c="#5d2a35" o=".5" w=".9" />
      {look.face === 'freckles' && <g fill="#9d5f47" fillOpacity=".62">
        <circle cx="96" cy="56" r="1.1" /><circle cx="101" cy="58.6" r="1" />
        <circle cx="119" cy="58.6" r="1" /><circle cx="124" cy="56" r="1.1" />
        <circle cx="105.6" cy="55" r=".9" /><circle cx="114.4" cy="55" r=".9" />
      </g>}
      {fine && <>
        <ellipse cx="96" cy="56.5" rx="5.5" ry="3.4" fill="#c96a72" fillOpacity=".16" />
        <ellipse cx="124" cy="56.5" rx="5.5" ry="3.4" fill="#c96a72" fillOpacity=".16" />
      </>}
    </>
  );
}

/* --------------------------------------------------------------- prendas */

/** Prendas sin hombros: ignoran manga y escote. */
const STRAPLESS = ['bustier', 'corset'];

function topPiece(look: Outfit, fine: boolean): Piece {
  const kindBoxy = look.top === 'hoodie' || look.top === 'oversized';
  const boxy = kindBoxy || look.topFit === 'oversized';
  const shape = boxy ? TORSO_BOX : look.topFit === 'fitted' ? TORSO_FIT : TORSO_G;
  const bare = STRAPLESS.includes(look.top) || look.top === 'tank';
  const sleeve: Sleeve | undefined = bare || look.sleeve === 'sleeveless'
    ? undefined
    : {
      to: look.sleeve === 'short' ? (boxy ? 170 : 146) : boxy ? 244 : 236,
      box: boxy,
      puff: look.top === 'blouse' && look.sleeve === 'long',
    };
  const neck = look.top === 'turtleneck' || bare ? undefined : necklineFor(look.neckline);

  switch (look.top) {
    case 'blouse':
      return {
        shapes: [shape], sleeve, neckline: neck,
        cover: coverBelow(88, 206),
        detail: <>
          <Ink d="M110 122v82" w="1.4" o=".26" />
          {fine && <g fill="#fff" fillOpacity=".5">
            {[138, 154, 170, 186].map((y) => <circle key={y} cx="110" cy={y} r="1.6" />)}
          </g>}
          <Ink d="M97 118c-3 22-4 46-2 68M123 118c3 22 4 46 2 68" w="1.1" o=".15" />
        </>,
      };
    case 'crop':
      return {
        shapes: [shape], sleeve, neckline: neck,
        cover: coverBelow(88, 154),
        detail: <Ink d="M86 149c14 5 34 5 48 0" w="1.4" o=".22" />,
      };
    case 'turtleneck':
      return {
        shapes: [shape, 'M100 76c6 4 14 4 20 0 1 14 1 24-10 26s-11-12-10-26Z'],
        sleeve,
        cover: coverBelow(74, 208),
        detail: <>
          <Ink d="M100 84c6 4 14 4 20 0M100 92c6 4 14 4 20 0" c="#fff" o=".2" w="1.2" />
          {fine && <Ink d="M97 120c-2 26-2 52 0 78M123 120c2 26 2 52 0 78" w="1.1" o=".13" />}
        </>,
      };
    case 'bustier':
      return {
        shapes: [shape],
        cover: <path d={SWEETHEART} />,
        detail: <>
          <Ink d="M110 134v38" w="1.2" o=".2" />
          <Ink d="M93 141c2 17 4 25 8 31M127 141c-2 17-4 25-8 31" w="1.2" o=".2" />
        </>,
      };
    case 'tank':
      return {
        shapes: [shape],
        cover: <>
          {coverBelow(126, 204)}
          <rect x="96" y="90" width="7" height="42" />
          <rect x="117" y="90" width="7" height="42" />
        </>,
        detail: <Ink d="M96 128c8 4 20 4 28 0" w="1.2" o=".18" />,
      };
    case 'corset':
      return {
        shapes: [shape],
        cover: <path d={SWEETHEART} />,
        detail: <>
          <Ink d="M99 137c-2 20-1 38 2 52M121 137c2 20 1 38-2 52" c="#fff" o=".3" w="1.4" />
          {[142, 152, 162, 172].map((y) => (
            <Ink key={y} d={`M100 ${y} 120 ${y + 6}M120 ${y} 100 ${y + 6}`} c="#fff" o=".36" w="1.1" />
          ))}
        </>,
      };
    case 'hoodie':
      return {
        shapes: [shape], sleeve,
        cover: coverBelow(84, 226),
        detail: <>
          <path d="M86 106c6-14 16-21 24-21s18 7 24 21c-8 8-16 11-24 11s-16-3-24-11Z" fill="#000" fillOpacity=".2" />
          <Ink d="M104 116v24M116 116v24" c="#fff" o=".42" w="2.4" />
          <path d="M86 182c8 4 40 4 48 0v22c-8 4-40 4-48 0Z" fill="#000" fillOpacity=".14" />
          <Ink d="M86 182c8 4 40 4 48 0" o=".22" w="1.5" />
        </>,
      };
    case 'oversized':
      return {
        shapes: [shape], sleeve, neckline: neck,
        cover: coverBelow(88, 228),
        detail: <>
          <Ink d="M84 168c14 8 38 8 52 0" w="1.4" o=".15" />
          <Ink d="M88 212c12 6 32 6 44 0" w="1.2" o=".13" />
        </>,
      };
    default:
      return {
        shapes: [shape], sleeve, neckline: neck,
        cover: coverBelow(88, 204),
        detail: fine
          ? <Ink d="M92 199c12 5 24 5 36 0M97 128c-3 22-4 44-3 66" w="1.1" o=".15" />
          : null,
      };
  }
}

function bottomPiece(look: Outfit, fine: boolean): Piece {
  const hem = (base: number) => hemFor(base, look.bottomLength);
  const sweep = (half: number) => sweepFor(half, look.bottomLength);

  switch (look.bottom) {
    case 'trousers': {
      const to = hem(350);
      return {
        shapes: [pantsPath(5, to, 174)],
        detail: <>
          <Ink d={`M97 200c-2 44-3 96-3 ${to - 202}M123 200c2 44 3 96 3 ${to - 202}`} c="#fff" o=".2" w="1.2" />
          <Ink d="M86 184c16 5 32 5 48 0" o=".2" w="1.4" />
        </>,
      };
    }
    case 'cargo':
      return {
        shapes: [pantsPath(7, hem(348), 186)],
        detail: <>
          <path d="M82 244h20v26H82zM118 244h20v26h-20z" fill="#000" fillOpacity=".18" />
          <Ink d="M82 244h20M118 244h20" o=".3" w="1.6" />
          {fine && <Ink d="M84 196c14 4 38 4 52 0" o=".2" w="1.2" dash="4 3" />}
        </>,
      };
    case 'wideleg':
      return {
        shapes: [pantsPath(17, hem(352), 172)],
        detail: <>
          <Ink d="M96 190c-6 50-10 106-11 152M124 190c6 50 10 106 11 152" o=".15" w="1.2" />
          <Ink d="M86 182c16 5 32 5 48 0" o=".2" w="1.4" />
        </>,
      };
    case 'jogger': {
      const to = hem(340);
      return {
        shapes: [pantsPath(-1, to, 184)],
        detail: <>
          <path d={`M86 ${to - 14}c8 4 22 4 30 0v14c-8 4-22 4-30 0ZM104 ${to - 14}c8 4 22 4 30 0v14c-8 4-22 4-30 0Z`}
            fill="#000" fillOpacity=".16" />
          <Ink d="M104 190c2 6 2 10 0 14M116 190c-2 6-2 10 0 14" c="#fff" o=".38" w="1.8" />
        </>,
      };
    }
    case 'shorts': {
      const to = hem(262);
      return {
        shapes: [pantsPath(5, to, 184)],
        detail: <>
          <Ink d={`M84 ${to - 8}c12 5 22 5 30 0M106 ${to - 8}c12 5 22 5 30 0`} o=".2" w="1.4" />
          <Ink d="M86 192c16 4 32 4 48 0" o=".18" w="1.2" />
        </>,
      };
    }
    case 'mini': {
      const to = hem(256);
      return {
        shapes: [skirtPath(to, sweep(32), 178)],
        detail: <Ink d={`M96 190c-2 22-4 42-6 ${to - 194}M124 190c2 22 4 42 6 ${to - 194}`} o=".16" w="1.2" />,
      };
    }
    case 'maxi': {
      const to = hem(348);
      return {
        shapes: [skirtPath(to, sweep(54), 172)],
        detail: <>
          <Ink d={`M100 186c-8 52-16 104-24 ${to - 192}M120 186c8 52 16 104 24 ${to - 192}M110 188v${to - 190}`}
            o=".14" w="1.3" />
          {fine && <Ink d={`M92 190c-6 50-12 100-20 ${to - 198}`} c="#fff" o=".12" w="1.2" />}
        </>,
      };
    }
    case 'pleated': {
      const to = hem(292);
      return {
        shapes: [skirtPath(to, sweep(46), 176)],
        detail: <>
          {[-34, -22, -11, 0, 11, 22, 34].map((dx) => (
            <Ink key={dx} d={`M${round(110 + dx * 0.4)} 190 ${110 + dx} ${to + 3}`}
              c={dx % 22 === 0 ? '#fff' : '#000'} o={dx % 22 === 0 ? '.24' : '.2'} w="1.6" />
          ))}
        </>,
      };
    }
    case 'slit': {
      const to = hem(332);
      return {
        shapes: [skirtPath(to, sweep(36), 176)],
        detail: <>
          <Ink d={`M112 248c1 30 2 60 2 ${to - 250}`} o=".26" w="1.4" />
          <Ink d={`M96 190c-4 44-8 92-10 ${to - 196}`} o=".14" w="1.2" />
        </>,
      };
    }
    case 'jeans': {
      const to = hem(350);
      return {
        shapes: [pantsPath(1, to, 188)],
        detail: <>
          <Ink d={`M110 192v${to - 194}`} c="#fff" o=".18" w="1.2" />
          <Ink d="M87 202c8 8 14 10 20 10M133 202c-8 8-14 10-20 10" c="#e6c07a" o=".55" w="1.2" dash="3 2.6" />
          <Ink d="M86 190c16 5 32 5 48 0" c="#e6c07a" o=".45" w="1.2" dash="3 2.6" />
          {fine && <Ink d={`M88 ${to - 10}c10 4 18 4 26 0M106 ${to - 10}c10 4 18 4 26 0`}
            c="#e6c07a" o=".4" w="1" dash="3 2.6" />}
        </>,
      };
    }
    default: {
      const to = hem(298);
      return {
        shapes: [skirtPath(to, sweep(44), 176)],
        detail: <>
          <Ink d={`M98 188c-6 34-12 68-18 ${to - 196}M122 188c6 34 12 68 18 ${to - 196}`} o=".15" w="1.2" />
          {fine && <Ink d={`M110 190v${to - 194}`} c="#fff" o=".12" w="1.2" />}
        </>,
      };
    }
  }
}

function dressPiece(look: Outfit, fine: boolean): Piece {
  const hem = (base: number) => hemFor(base, look.dressLength);
  const sweep = (half: number) => sweepFor(half, look.dressLength);
  const neck = necklineFor(look.neckline);
  const sleeve: Sleeve | undefined = look.sleeve === 'sleeveless'
    ? undefined
    : { to: look.sleeve === 'short' ? 146 : 236 };

  switch (look.dress) {
    case 'cocktail': {
      const to = hem(290);
      return {
        shapes: [TORSO_G, skirtPath(to, sweep(50), 168)],
        cover: <><path d={SWEETHEART} />{coverBelow(168, to + 30)}</>,
        detail: <>
          <Ink d="M110 136v32" o=".2" w="1.2" />
          <Ink d={`M94 186c-6 34-12 68-16 ${to - 190}M126 186c6 34 12 68 16 ${to - 190}`} o=".16" w="1.3" />
          <Ink d="M86 178c14 6 34 6 48 0" o=".22" w="1.5" />
        </>,
      };
    }
    case 'shirt': {
      const to = hem(300);
      return {
        shapes: [TORSO_G, skirtPath(to, sweep(40), 168)],
        cover: <>{coverBelow(88, 208)}{coverBelow(168, to + 30)}</>,
        sleeve: sleeve ?? { to: 146 },
        detail: <>
          <path d="M99 94c5-6 17-6 22 0l-4 12c-4-5-14-5-18 0Z" fill="#000" fillOpacity=".22" />
          <Ink d={`M110 106v${to - 108}`} c="#fff" o=".3" w="1.6" />
          {fine && <g fill="#fff" fillOpacity=".5">
            {[126, 146, 166, 190, 220, 250].filter((y) => y < to - 12).map((y) => (
              <circle key={y} cx="110" cy={y} r="1.6" />
            ))}
          </g>}
          <Ink d="M86 176c16 6 32 6 48 0" o=".24" w="2" />
        </>,
      };
    }
    case 'mini': {
      const to = hem(252);
      return {
        shapes: [TORSO_G, skirtPath(to, sweep(34), 168)],
        cover: <>{coverBelow(94, 208)}{coverBelow(168, to + 30)}</>,
        neckline: neck, sleeve,
        detail: <Ink d={`M96 186c-4 24-8 44-12 ${to - 190}M124 186c4 24 8 44 12 ${to - 190}`} o=".16" w="1.2" />,
      };
    }
    case 'gala': {
      const to = hem(350);
      return {
        shapes: [TORSO_G, skirtPath(to, sweep(60), 166)],
        cover: <><path d={SWEETHEART} /><rect x="40" y="166" width="140" height={to - 150} /></>,
        detail: <>
          <Ink d={`M92 180c-10 56-20 112-32 ${to - 182}M128 180c10 56 20 112 32 ${to - 182}M110 182v${to - 184}`}
            o=".15" w="1.3" />
          {fine && <>
            <Ink d={`M100 182c-8 56-16 112-26 ${to - 184}`} c="#fff" o=".12" w="1.2" />
            <Ink d={`M120 182c8 56 16 112 26 ${to - 184}`} c="#fff" o=".12" w="1.2" />
          </>}
          <Ink d="M86 176c14 6 34 6 48 0" o=".22" w="1.6" />
        </>,
      };
    }
    case 'bodycon': {
      const to = hem(320);
      return {
        shapes: [TORSO_G, skirtPath(to, sweep(26), 168)],
        cover: <>{coverBelow(102, 208)}{coverBelow(168, to + 30)}</>,
        neckline: neck, sleeve,
        detail: <>
          <Ink d="M97 130c-3 30-3 64 0 94M123 130c3 30 3 64 0 94" o=".16" w="1.2" />
          <Ink d="M88 240c14 5 30 5 44 0M88 280c12 4 32 4 44 0" o=".14" w="1.2" />
        </>,
      };
    }
    case 'pinafore': {
      const to = hem(284);
      return {
        shapes: [TORSO_G, skirtPath(to, sweep(44), 168)],
        cover: <>
          <rect x="94" y="122" width="32" height="62" />
          <rect x="95" y="90" width="8" height="42" />
          <rect x="117" y="90" width="8" height="42" />
          {coverBelow(168, to + 30)}
        </>,
        detail: <>
          <Ink d="M95 124h30" c="#fff" o=".3" w="1.6" />
          <Ink d="M99 94v30M121 94v30" c="#fff" o=".22" w="1.2" />
          <circle cx="99" cy="126" r="2" fill="#fff" fillOpacity=".45" />
          <circle cx="121" cy="126" r="2" fill="#fff" fillOpacity=".45" />
        </>,
      };
    }
    default: {
      const to = hem(302);
      return {
        shapes: [TORSO_G, skirtPath(to, sweep(34), 166)],
        cover: <>
          {coverBelow(124, 208)}
          <rect x="97" y="90" width="4.5" height="38" />
          <rect x="118.5" y="90" width="4.5" height="38" />
          {coverBelow(166, to + 30)}
        </>,
        detail: <>
          <Ink d="M96 128c6 5 22 5 28 0" o=".2" w="1.3" />
          <Ink d={`M92 182c-4 40-8 78-12 ${to - 186}M128 182c4 40 8 78 12 ${to - 186}`} o=".14" w="1.2" />
          {fine && <Ink d={`M104 186c-2 40-4 78-6 ${to - 188}`} c="#fff" o=".1" w="1.2" />}
        </>,
      };
    }
  }
}

function outerPiece(look: Outfit, fine: boolean): Piece {
  const hem = look.outer === 'coat' ? 316 : look.outer === 'cardigan' ? 252
    : look.outer === 'denim' ? 214 : look.outer === 'leather' ? 218 : 234;
  const wide = look.outer === 'coat' || look.outer === 'cardigan';
  const edge = wide ? 76 : 79;
  const side = (dir: 1 | -1) => {
    const x = (v: number) => (dir === 1 ? v : mirror(v));
    return `M${x(97)} 93C${x(88)} 95 ${x(edge + 1)} 103 ${x(edge)} 119`
      + `C${x(edge - 1.5)} 139 ${x(edge - 1)} 161 ${x(edge - .5)} 183`
      + `C${x(edge)} 205 ${x(edge + .5)} ${hem - 20} ${x(edge + 1)} ${hem}`
      + `L${x(106)} ${hem}C${x(105.6)} ${hem - 40} ${x(105)} 200 ${x(104.4)} 170`
      + `C${x(103.8)} 140 ${x(100)} 111 ${x(97)} 93Z`;
  };
  const lapel = 'M97 93c4 18 7 47 7.4 77L114 116 105 91Z';

  return {
    shapes: [side(1), side(-1)],
    sleeve: { to: wide ? 248 : 238, box: wide },
    detail: <>
      <path d="M98 94c6-7 18-7 24 0l-3 9c-5-5-13-5-18 0Z" fill="#000" fillOpacity=".24" />
      <path d={lapel} fill="#fff" fillOpacity=".14" />
      <path d={lapel} transform={MIRROR} fill="#fff" fillOpacity=".14" />
      <Ink d={`M110 118v${hem - 120}`} o=".2" w="1.2" />
      {look.outer === 'denim' && <>
        <path d="M84 148h18v18H84zM118 148h18v18h-18z" fill="#000" fillOpacity=".16" />
        <Ink d="M84 148h18M118 148h18" c="#e6c07a" o=".5" w="1.2" dash="3 2.6" />
        <Ink d="M84 206c8 3 14 3 20 0M116 206c8 3 14 3 20 0" c="#e6c07a" o=".45" w="1.2" dash="3 2.6" />
      </>}
      {look.outer === 'leather' && <>
        <Ink d="M104 116 86 148M116 116l18 32" c="#fff" o=".26" w="2.4" />
        <path d="M87 174h14v6H87zM119 174h14v6h-14z" fill="#c9c9d2" fillOpacity=".4" />
      </>}
      {look.outer === 'blazer' && fine && <>
        <Ink d="M86 190c8 3 12 3 16 0M118 190c8 3 12 3 16 0" o=".26" w="1.4" />
        <circle cx="106" cy="186" r="2" fill="#fff" fillOpacity=".4" />
      </>}
      {look.outer === 'coat' && <>
        <Ink d="M86 200c-2 40-3 80-3 112M134 200c2 40 3 80 3 112" o=".14" w="1.3" />
        {[150, 186, 222].map((y) => <g key={y} fill="#fff" fillOpacity=".4">
          <circle cx="103" cy={y} r="2.4" /><circle cx="117" cy={y} r="2.4" />
        </g>)}
      </>}
      {look.outer === 'cardigan' && <>
        <Ink d="M100 120c-2 40-3 80-3 122M120 120c2 40 3 80 3 122" c="#fff" o=".16" w="1.6" />
        <Ink d={`M80 ${hem - 6}c14 5 46 5 60 0`} o=".16" w="1.4" />
      </>}
    </>,
  };
}

/* --------------------------------------------------------------- calzado */

function Shoes({ look, uid, fine }: { look: Outfit; uid: string; fine: boolean }) {
  const c = look.shoesColor;
  const vol = `url(#${uid}-vol)`;
  const solid = (d: string) => <><path d={d} fill={c} /><path d={d} fill={vol} /></>;
  let shoe: ReactNode;
  switch (look.shoes) {
    case 'boots':
      shoe = <>
        {solid('M85.5 296c-2 22-1.5 42-.5 58-1.5 10-3 18-1.5 24 4 3.6 12.5 3.6 16.5 0 1-7-.5-14-.8-24 1-16 1.5-36 .3-58Z')}
        <Ink d="M84.5 352c5 3 11 3 15.5 0" c="#fff" o=".2" w="1.4" />
        {fine && <Ink d="M86 300c5 3 12 3 15 0" c="#fff" o=".16" w="1.4" />}
      </>;
      break;
    case 'sneakers':
      shoe = <>
        {solid('M85 350c-3 8-5 16-4 22h23c1-7-1-15-1.4-22Z')}
        <path d="M80.5 370h23.5c1 6 0 9-3 9.6H84c-3-.6-4.5-3.6-3.5-9.6Z" fill="#f4efe6" />
        <Ink d="M87 356c4 2 9 2 13 0M87.5 363c4 2 9 2 13 0" c="#fff" o=".5" w="1.3" />
      </>;
      break;
    case 'sandals':
      shoe = <>
        {solid('M85 371h18c1 5 0 7.6-2.4 8H87c-2.4-.4-3.4-3-2-8Z')}
        <Ink d="M87 366c4-6 9-9 14-8M86.5 358c5-4 10-6 14-4M88 348c4 2 8 2 11 1" c={c} o=".95" w="2.6" />
      </>;
      break;
    case 'platforms':
      shoe = <>
        {solid('M85 344c-3 10-4 18-3.5 24h22c.5-7-1-16-1.5-24Z')}
        <path d="M81 366h22.5c.5 8 0 12-2 13.6H83.5c-2.5-1.6-3-6-2.5-13.6Z" fill={c} fillOpacity=".85" />
        <Ink d="M81.5 372h22" c="#fff" o=".2" w="1.4" />
      </>;
      break;
    case 'loafers':
      shoe = <>
        {solid('M86 354c-2.5 8-3.5 16-2.5 22 4 3 14 3 18 0 .6-7-.6-15-1-22Z')}
        <path d="M83.5 374h18c.6 4 0 6-2 6.6H85.5c-2-.6-2.6-2.6-2-6.6Z" fill="#000" fillOpacity=".35" />
        <path d="M88 358h12v5H88z" fill="#fff" fillOpacity=".22" />
      </>;
      break;
    default:
      shoe = <>
        {solid('M88 350c-3 10-6 22-4 28 3.6 3 11.6 3 15.6-.4 1.4-10-.6-18-1-27.6Z')}
        <path d="M91 376h6l2 14h-5Z" fill={c} />
        <Ink d="M89 356c4 2 9 2 12 0" c="#fff" o=".24" w="1.3" />
      </>;
  }
  return <>{shoe}<g transform={MIRROR}>{shoe}</g></>;
}

/* --------------------------------------------------------------- cabello */

function BackHair({ look, uid, fine }: { look: Outfit; uid: string; fine: boolean }) {
  const vol = `url(#${uid}-hairv)`;
  const mass = (d: string) => <><path d={d} fill={look.hairColor} /><path d={d} fill={vol} /></>;
  const long = `M84 40C77 64 75 120 78 176C79 196 81 208 84 216${waveHem(84, 136, 216, 4, 7)}`
    + 'C139 208 141 196 142 176C145 120 143 64 136 40Z';
  const waves = `M82 40C73 66 71 116 76 168C77.5 188 80 202 84 210${waveHem(84, 136, 210, 5, 9)}`
    + 'C140 202 142.5 188 144 168C149 116 147 66 138 40Z';

  switch (look.hair) {
    case 'long': return mass(long);
    case 'waves': return mass(waves);
    case 'bob': return mass('M84 40C78 60 76 90 78 108c1 10 3 16 6 20h52c3-4 5-10 6-20 2-18 0-48-6-68Z');
    case 'ponytail': case 'braids': return mass('M86 38C81 52 79 70 80 86h60c1-16-1-34-6-48Z');
    case 'bun': return mass('M88 36C84 48 82 62 83 74h54c1-12-1-26-5-38Z');
    case 'pixie': return mass('M88 34C85 46 84 56 85 64h50c1-8 0-18-3-30Z');
    case 'afro': return <>
      <g fill={look.hairColor}>
        {[[74, 30], [110, 14], [146, 30], [66, 54], [154, 54], [80, 76], [140, 76]].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="15" />
        ))}
      </g>
      {mass('M110 12c26 0 44 18 44 40s-18 40-44 40-44-18-44-40 18-40 44-40Z')}
      {fine && <g fill="#fff" fillOpacity=".09">
        <circle cx="82" cy="34" r="10" /><circle cx="138" cy="34" r="10" />
        <circle cx="72" cy="58" r="9" /><circle cx="148" cy="58" r="9" />
      </g>}
    </>;
    default: return null;
  }
}

function FrontHair({ look, uid, fine }: { look: Outfit; uid: string; fine: boolean }) {
  const vol = `url(#${uid}-hairv)`;
  const piece = (d: string) => <><path d={d} fill={look.hairColor} /><path d={d} fill={vol} /></>;
  const cap = 'M86.6 50C85 30 96 20 110 20s25 10 23.4 30c-2-9-6.5-14.5-13.4-17-8 6.5-21 7.5-27.5 3.5C89.5 39 87.6 44 86.6 50Z';
  const pixie = 'M86.6 50C85 28 96 18 110 18s25 10 23.4 32c-1.5-11-6-17-10-19-6 5-24 6-30 2-3 2-5.5 8-6.8 17Z';
  const fringe = 'M88 44C88 24 97 14 110 14s22 10 22 30c-4-10-10-15-22-15s-18 5-22 15Z';

  return (
    <>
      {look.hair === 'afro' ? piece(fringe) : piece(look.hair === 'pixie' ? pixie : cap)}
      {look.hair === 'bun' && <>
        {piece('M97 20c4-9 22-9 26 0 2 6-4 11-13 11s-15-5-13-11Z')}
        {piece('M100 4c10-4 22 2 21 12-1 8-10 12-19 10-9-2-13-8-11-14 1-4 5-7 9-8Z')}
      </>}
      {look.hair === 'ponytail' && <>
        {piece('M131 40c11 3 18 13 20 29 2.4 20 1.4 40-1.4 58-1.4 9-4 14-7.4 13.6-3.4-.4-4.8-5.6-4.6-13.6.4-18 1.4-36 .4-52-.8-14-3.2-25-7-35Z')}
        <Ink d="M130 50c5 2 9 6 11 11" c="#fff" o=".18" w="1.6" />
      </>}
      {look.hair === 'braids' && <>
        {piece('M89 54c-5 2-7.4 8-7 15 1 26 2.6 52 4.6 78 .4 6 1.8 9 3.8 9s3.2-3 3.6-9c1.4-26 1.6-52.4.6-78-.3-7-1.4-13-5.6-15Z')}
        {piece('M131 54c5 2 7.4 8 7 15-1 26-2.6 52-4.6 78-.4 6-1.8 9-3.8 9s-3.2-3-3.6-9c-1.4-26-1.6-52.4-.6-78 .3-7 1.4-13 5.6-15Z')}
        {fine && <g stroke="#000" strokeOpacity=".22" strokeWidth="1.1" fill="none">
          {[76, 94, 112, 130].map((y) => (
            <path key={y} d={`M83 ${y}c3 4 8 4 11 0M126 ${y}c3 4 8 4 11 0`} />
          ))}
        </g>}
      </>}
      {fine && look.hair !== 'afro' && <Ink d="M96 30c8 5 18 6 26 3" c="#fff" o=".16" w="1.6" />}
    </>
  );
}

/* ------------------------------------------------------------ accesorios */

/** Piezas que se llevan por detrás: se pintan antes del cuerpo. */
function BackAccessory({ look, uid }: { look: Outfit; uid: string }) {
  if (look.acc !== 'backpack') return null;
  const pack = 'M74 122h72c6 24 6 52 0 76H74c-6-24-6-52 0-76Z';
  return (
    <>
      <path d={pack} fill="#7a1f3d" />
      <path d={pack} fill={`url(#${uid}-vol)`} />
      <Ink d="M78 164h64" o=".22" w="1.8" />
    </>
  );
}

function Accessory({ look, uid, fine }: { look: Outfit; uid: string; fine: boolean }) {
  const vol = `url(#${uid}-vol)`;
  const gold = (d: string) => <><path d={d} fill="#d4a054" /><path d={d} fill={vol} /></>;

  switch (look.acc) {
    case 'necklace':
      return <>
        <Ink d="M99 92c1 12 5 20 11 22 6-2 10-10 11-22" c="#d4a054" o=".95" w="1.8" />
        <circle cx="110" cy="116" r="3.4" fill="#d4a054" />
        <circle cx="109" cy="115" r="1.2" fill="#fff" fillOpacity=".6" />
      </>;
    case 'glasses':
      return <>
        <rect x="92" y="40.5" width="18" height="13" rx="6" fill="#0d0a12" fillOpacity=".1"
          stroke="#17121d" strokeWidth="2" />
        <rect x="110" y="40.5" width="18" height="13" rx="6" fill="#0d0a12" fillOpacity=".1"
          stroke="#17121d" strokeWidth="2" />
        <Ink d="M92 44 87.5 45.5M128 44l4.5 1.5" c="#17121d" o="1" w="2" />
      </>;
    case 'bag':
      return <>
        <Ink d="M130 106c9 22 15 48 17 74" c="#8a6a3a" o=".85" w="2.6" />
        {gold('M134 180h30c3 18 3 32 0 42h-30c-3-10-3-24 0-42Z')}
        <Ink d="M134 194h30" o=".22" w="1.6" />
      </>;
    case 'belt':
      return <>
        {gold('M85 174c16 7 34 7 50 0v13c-16 7-34 7-50 0Z')}
        <rect x="104" y="175" width="12" height="12" rx="2" fill="#f2d79a" />
      </>;
    case 'earrings':
      return <>
        <circle cx="88" cy="56" r="2.4" fill="#d4a054" />
        <circle cx="132" cy="56" r="2.4" fill="#d4a054" />
        <path d="M86.6 58.5h2.8l1.4 9-2.8 2.4-2.8-2.4Z" fill="#d4a054" />
        <path d="M130.6 58.5h2.8l1.4 9-2.8 2.4-2.8-2.4Z" fill="#d4a054" />
      </>;
    case 'hat':
      return <>
        <ellipse cx="110" cy="26" rx="46" ry="10" fill="#7a1f3d" />
        <ellipse cx="110" cy="26" rx="46" ry="10" fill={vol} />
        <path d="M92 26c-2-16 2-24 18-24s20 8 18 24c-6 4-30 4-36 0Z" fill="#7a1f3d" />
        <path d="M92 26c-2-16 2-24 18-24s20 8 18 24c-6 4-30 4-36 0Z" fill={vol} />
        <path d="M91.6 21c6 3 30.8 3 36.8 0l.6 5c-6 3-32 3-38 0Z" fill="#000" fillOpacity=".3" />
      </>;
    case 'backpack':
      return <>
        <Ink d="M96 100c-3 20-4 40-3 58M124 100c3 20 4 40 3 58" c="#5c1329" o=".9" w="4" />
        {fine && <Ink d="M95 132h30" c="#5c1329" o=".5" w="2" />}
      </>;
    default:
      return null;
  }
}

/* -------------------------------------------------------------- etiqueta */

function describe(look: Outfit) {
  const name = (list: { id: string; name: string }[], id: string) =>
    list.find((item) => item.id === id)?.name.toLowerCase();
  const fabric = (material: FabricMaterial) => name(MATERIALS, material) ?? material;
  const parts = [
    look.dress !== 'none'
      ? `vestido ${name(DRESSES, look.dress) ?? look.dress} en ${fabric(look.dressMaterial)}`
      : `${name(TOPS, look.top) ?? look.top} de ${fabric(look.topMaterial)}`
        + ` con ${name(BOTTOMS, look.bottom) ?? look.bottom} de ${fabric(look.bottomMaterial)}`,
    look.outer !== 'none' ? `${name(OUTERS, look.outer)} de ${fabric(look.outerMaterial)}` : null,
    name(SHOES, look.shoes),
    look.acc !== 'none' ? name(ACCS, look.acc) : null,
    `pelo ${name(HAIRS, look.hair) ?? look.hair}`,
    look.art.length ? `${look.art.length} trazos dibujados a mano` : null,
  ].filter(Boolean);
  return `${parts.join(', ')}.`;
}
