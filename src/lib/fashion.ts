export type FashionPoint = { x: number; y: number };
export type GarmentLayer = 'top' | 'bottom' | 'dress';
export type FashionStroke = {
  id: string;
  target: GarmentLayer;
  color: string;
  width: number;
  points: FashionPoint[];
};

export const MAX_FASHION_STROKES = 16;
export const MAX_FASHION_POINTS = 96;
export const MAX_FASHION_TOTAL_POINTS = 400;
export const OUTFIT_VERSION = 3 as const;

export type FabricMaterial = 'cotton' | 'denim' | 'satin' | 'leather' | 'knit' | 'lace';
export type FashionReaction = '' | 'wow' | 'love' | 'wear' | 'bold';

export type Outfit = {
  version: typeof OUTFIT_VERSION;
  skin: string;
  face: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  topPattern: string;
  topMaterial: FabricMaterial;
  topFit: 'fitted' | 'classic' | 'oversized';
  sleeve: 'sleeveless' | 'short' | 'long';
  neckline: 'round' | 'v' | 'square';
  bottom: string;
  bottomColor: string;
  bottomPattern: string;
  bottomMaterial: FabricMaterial;
  bottomLength: 'mini' | 'midi' | 'maxi';
  dress: string;
  dressColor: string;
  dressPattern: string;
  dressMaterial: FabricMaterial;
  dressLength: 'mini' | 'midi' | 'maxi';
  outer: string;
  outerColor: string;
  outerMaterial: FabricMaterial;
  shoes: string;
  shoesColor: string;
  acc: string;
  challengeSeed: number | null;
  art: FashionStroke[];
};

export type FashionChallenge = {
  seed: number;
  occasion: string;
  style: string;
  requirement: string;
  palette: string;
  brief: string;
};

export type LookRow = {
  id: string;
  couple_id: string;
  designer_id: string;
  title: string;
  outfit: Outfit;
  rating: number | null;
  note: string;
  status: 'sent' | 'rated';
  created_at: string;
  updated_at?: string;
};

export const SKINS = [
  { id: '#f3d0b8', name: 'Porcelana' },
  { id: '#e8b89a', name: 'Melocotón' },
  { id: '#c9845c', name: 'Canela' },
  { id: '#8d5524', name: 'Caramelo' },
  { id: '#5c3317', name: 'Cacao' },
];

export const HAIR_COLORS = [
  { id: '#1a120d', name: 'Ónix' },
  { id: '#4a2c14', name: 'Castaño' },
  { id: '#c9a227', name: 'Rubio' },
  { id: '#8a2b1c', name: 'Cobre' },
  { id: '#d24f76', name: 'Rosa' },
  { id: '#c5c8d4', name: 'Plata' },
];

export const DYES = [
  { id: '#1a1520', name: 'Negro' },
  { id: '#f4efe6', name: 'Marfil' },
  { id: '#e8a0b4', name: 'Blush' },
  { id: '#7a1f3d', name: 'Vino' },
  { id: '#d4a054', name: 'Oro' },
  { id: '#1e3a5f', name: 'Navy' },
  { id: '#2c6d80', name: 'Teal' },
  { id: '#5c6b4a', name: 'Olivo' },
  { id: '#3d5a80', name: 'Denim' },
  { id: '#c23b4c', name: 'Rojo' },
  { id: '#b8a0c8', name: 'Lila' },
  { id: '#c4a574', name: 'Camel' },
];

export const HAIRS = [
  { id: 'bob', name: 'Bob' },
  { id: 'long', name: 'Melena' },
  { id: 'bun', name: 'Moño' },
  { id: 'pixie', name: 'Pixie' },
  { id: 'waves', name: 'Ondas' },
  { id: 'ponytail', name: 'Coleta' },
  { id: 'braids', name: 'Trenzas' },
  { id: 'afro', name: 'Afro' },
];

export const TOPS = [
  { id: 'tee', name: 'Polera' },
  { id: 'blouse', name: 'Blusa' },
  { id: 'crop', name: 'Crop' },
  { id: 'turtleneck', name: 'Beatle' },
  { id: 'bustier', name: 'Bustier' },
  { id: 'tank', name: 'Top tirantes' },
  { id: 'corset', name: 'Corsé' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'oversized', name: 'Oversize' },
];

export const BOTTOMS = [
  { id: 'jeans', name: 'Jeans' },
  { id: 'skirt', name: 'Falda' },
  { id: 'trousers', name: 'Pantalón' },
  { id: 'shorts', name: 'Short' },
  { id: 'slit', name: 'Falda tajo' },
  { id: 'mini', name: 'Mini' },
  { id: 'pleated', name: 'Falda plisada' },
  { id: 'maxi', name: 'Falda larga' },
  { id: 'cargo', name: 'Cargo' },
  { id: 'wideleg', name: 'Palazzo' },
  { id: 'jogger', name: 'Jogger' },
];

export const DRESSES = [
  { id: 'none', name: 'Sin vestido' },
  { id: 'slip', name: 'Slip' },
  { id: 'cocktail', name: 'Cocktail' },
  { id: 'shirt', name: 'Camisero' },
  { id: 'mini', name: 'Mini dress' },
  { id: 'gala', name: 'Gala' },
  { id: 'bodycon', name: 'Entallado' },
  { id: 'pinafore', name: 'Pichi' },
];

export const OUTERS = [
  { id: 'none', name: 'Sin abrigo' },
  { id: 'blazer', name: 'Blazer' },
  { id: 'coat', name: 'Abrigo' },
  { id: 'cardigan', name: 'Cárdigan' },
  { id: 'denim', name: 'Chaqueta denim' },
  { id: 'leather', name: 'Biker' },
];

export const SHOES = [
  { id: 'pumps', name: 'Stilettos' },
  { id: 'boots', name: 'Botas' },
  { id: 'sneakers', name: 'Zapatillas' },
  { id: 'sandals', name: 'Sandalias' },
  { id: 'platforms', name: 'Plataformas' },
  { id: 'loafers', name: 'Mocasines' },
];

export const ACCS = [
  { id: 'none', name: 'Nada' },
  { id: 'necklace', name: 'Collar' },
  { id: 'glasses', name: 'Lentes' },
  { id: 'bag', name: 'Cartera' },
  { id: 'belt', name: 'Cinturón' },
  { id: 'earrings', name: 'Aros' },
  { id: 'hat', name: 'Sombrero' },
  { id: 'backpack', name: 'Mochila' },
];

export const FACES = [
  { id: 'soft', name: 'Dulce' },
  { id: 'bold', name: 'Intensa' },
  { id: 'wink', name: 'Guiño' },
  { id: 'freckles', name: 'Pecas' },
];

export const PATTERNS = [
  { id: 'solid', name: 'Liso' },
  { id: 'stripes', name: 'Rayas' },
  { id: 'dots', name: 'Lunares' },
  { id: 'check', name: 'Cuadros' },
];

export const MATERIALS: { id: FabricMaterial; name: string }[] = [
  { id: 'cotton', name: 'Algodón' },
  { id: 'denim', name: 'Denim' },
  { id: 'satin', name: 'Satén' },
  { id: 'leather', name: 'Cuero' },
  { id: 'knit', name: 'Tejido' },
  { id: 'lace', name: 'Encaje' },
];

export const FITS = [
  { id: 'fitted', name: 'Entallado' },
  { id: 'classic', name: 'Clásico' },
  { id: 'oversized', name: 'Oversize' },
];
export const SLEEVES = [
  { id: 'sleeveless', name: 'Sin mangas' },
  { id: 'short', name: 'Manga corta' },
  { id: 'long', name: 'Manga larga' },
];
export const NECKLINES = [
  { id: 'round', name: 'Cuello redondo' },
  { id: 'v', name: 'Escote V' },
  { id: 'square', name: 'Escote cuadrado' },
];
export const LENGTHS = [
  { id: 'mini', name: 'Mini' },
  { id: 'midi', name: 'Midi' },
  { id: 'maxi', name: 'Maxi' },
];

const OCCASIONS = ['una cita de noche', 'un paseo bajo la lluvia', 'un concierto íntimo', 'un brunch de domingo', 'una gala junto al mar', 'un viaje sorpresa'];
const STYLES = ['editorial y elegante', 'romántico contemporáneo', 'atrevido y sofisticado', 'relajado con intención', 'retro moderno', 'minimalista con carácter'];
const REQUIREMENTS = ['incluye una falda', 'usa una tercera pieza', 'destaca los zapatos', 'añade un detalle dibujado', 'combina dos texturas', 'incluye un accesorio protagonista'];
const PALETTES = ['vino y dorado', 'marfil y negro', 'azul y camel', 'rosa y borgoña', 'olivo y crema', 'lila y plata'];

export function fashionChallenge(seed: number): FashionChallenge {
  const value = Math.abs(Math.trunc(Number.isFinite(seed) ? seed : 0));
  const pick = (items: string[], shift: number) => items[Math.floor(value / shift) % items.length];
  const occasion = pick(OCCASIONS, 1);
  const style = pick(STYLES, 7);
  const requirement = pick(REQUIREMENTS, 43);
  const palette = pick(PALETTES, 257);
  return {
    seed: value,
    occasion,
    style,
    requirement,
    palette,
    brief: `Diseña para ${occasion}: un look ${style}, en ${palette}, que ${requirement}.`,
  };
}

const RATING_PREFIX = '[[atelier:';

export function formatRatingNote(reaction: FashionReaction, note: string): string {
  const clean = note.trim().replace(/\s+/g, ' ');
  if (!reaction) return clean.slice(0, 200);
  const prefix = `${RATING_PREFIX}${reaction}]]`;
  return `${prefix}${clean}`.slice(0, 200);
}

export function parseRatingNote(value: string): { reaction: FashionReaction; note: string } {
  const match = value.match(/^\[\[atelier:(wow|love|wear|bold)\]\]/);
  return match
    ? { reaction: match[1] as FashionReaction, note: value.slice(match[0].length) }
    : { reaction: '', note: value };
}

export function defaultOutfit(): Outfit {
  return {
    version: OUTFIT_VERSION,
    skin: '#e8b89a',
    face: 'soft',
    hair: 'long',
    hairColor: '#4a2c14',
    top: 'blouse',
    topColor: '#e8a0b4',
    topPattern: 'solid',
    topMaterial: 'cotton',
    topFit: 'classic',
    sleeve: 'short',
    neckline: 'round',
    bottom: 'skirt',
    bottomColor: '#1a1520',
    bottomPattern: 'solid',
    bottomMaterial: 'denim',
    bottomLength: 'midi',
    dress: 'none',
    dressColor: '#d4a054',
    dressPattern: 'solid',
    dressMaterial: 'satin',
    dressLength: 'midi',
    outer: 'none',
    outerColor: '#1e3a5f',
    outerMaterial: 'cotton',
    shoes: 'pumps',
    shoesColor: '#1a1520',
    acc: 'necklace',
    challengeSeed: null,
    art: [],
  };
}

const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)) * 10) / 10;

export function addFashionPoint(stroke: FashionStroke, point: FashionPoint): FashionStroke {
  if (stroke.points.length >= MAX_FASHION_POINTS) return stroke;
  const next = { x: clamp(point.x), y: clamp(point.y) };
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(last.x - next.x, last.y - next.y) < 0.8) return stroke;
  return { ...stroke, points: [...stroke.points, next] };
}

export function normalizeOutfit(value: unknown): Outfit {
  const base = defaultOutfit();
  if (!value || typeof value !== 'object') return base;
  const raw = value as Record<string, unknown>;
  const text = (key: keyof Outfit, fallback: string) =>
    typeof raw[key] === 'string' ? String(raw[key]).slice(0, 32) : fallback;
  const material = (key: keyof Outfit, fallback: FabricMaterial): FabricMaterial => {
    const candidate = raw[key];
    return MATERIALS.some((item) => item.id === candidate) ? candidate as FabricMaterial : fallback;
  };
  const option = <T extends string>(key: keyof Outfit, options: readonly T[], fallback: T): T =>
    typeof raw[key] === 'string' && options.includes(raw[key] as T) ? raw[key] as T : fallback;
  const listed = (key: keyof Outfit, items: { id: string }[], fallback: string) =>
    option(key, items.map((item) => item.id), fallback);
  const rawArt = Array.isArray(raw.art) ? raw.art : [];
  let pointBudget = MAX_FASHION_TOTAL_POINTS;
  const art: FashionStroke[] = rawArt.slice(0, MAX_FASHION_STROKES).flatMap((item, index) => {
    if (pointBudget <= 0) return [];
    if (!item || typeof item !== 'object') return [];
    const stroke = item as Record<string, unknown>;
    const target: GarmentLayer =
      stroke.target === 'bottom' || stroke.target === 'dress' ? stroke.target : 'top';
    const points = Array.isArray(stroke.points)
      ? stroke.points.slice(0, Math.min(MAX_FASHION_POINTS, pointBudget)).flatMap((point) => {
          if (!point || typeof point !== 'object') return [];
          const p = point as Record<string, unknown>;
          if (typeof p.x !== 'number' || typeof p.y !== 'number') return [];
          return [{ x: clamp(p.x), y: clamp(p.y) }];
        })
      : [];
    if (!points.length) return [];
    pointBudget -= points.length;
    return [{
      id: typeof stroke.id === 'string' ? stroke.id.slice(0, 64) : `legacy-${index}`,
      target,
      color: typeof stroke.color === 'string' ? stroke.color.slice(0, 24) : '#ffffff',
      width: Math.max(1, Math.min(12, typeof stroke.width === 'number' ? stroke.width : 4)),
      points,
    }];
  });

  return {
    version: OUTFIT_VERSION,
    skin: listed('skin', SKINS, base.skin),
    face: listed('face', FACES, base.face),
    hair: listed('hair', HAIRS, base.hair),
    hairColor: listed('hairColor', HAIR_COLORS, base.hairColor),
    top: listed('top', TOPS, base.top),
    topColor: text('topColor', base.topColor),
    topPattern: listed('topPattern', PATTERNS, base.topPattern),
    topMaterial: material('topMaterial', base.topMaterial),
    topFit: option('topFit', ['fitted', 'classic', 'oversized'], base.topFit),
    sleeve: option('sleeve', ['sleeveless', 'short', 'long'], base.sleeve),
    neckline: option('neckline', ['round', 'v', 'square'], base.neckline),
    bottom: listed('bottom', BOTTOMS, base.bottom),
    bottomColor: text('bottomColor', base.bottomColor),
    bottomPattern: listed('bottomPattern', PATTERNS, base.bottomPattern),
    bottomMaterial: material('bottomMaterial', base.bottomMaterial),
    bottomLength: option('bottomLength', ['mini', 'midi', 'maxi'], base.bottomLength),
    dress: listed('dress', DRESSES, base.dress),
    dressColor: text('dressColor', base.dressColor),
    dressPattern: listed('dressPattern', PATTERNS, base.dressPattern),
    dressMaterial: material('dressMaterial', base.dressMaterial),
    dressLength: option('dressLength', ['mini', 'midi', 'maxi'], base.dressLength),
    outer: listed('outer', OUTERS, base.outer),
    outerColor: text('outerColor', base.outerColor),
    outerMaterial: material('outerMaterial', base.outerMaterial),
    shoes: listed('shoes', SHOES, base.shoes),
    shoesColor: text('shoesColor', base.shoesColor),
    acc: listed('acc', ACCS, base.acc),
    challengeSeed: typeof raw.challengeSeed === 'number' && Number.isFinite(raw.challengeSeed)
      ? Math.abs(Math.trunc(raw.challengeSeed))
      : null,
    art,
  };
}
