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

export type Outfit = {
  skin: string;
  face: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  topPattern: string;
  bottom: string;
  bottomColor: string;
  bottomPattern: string;
  dress: string;
  dressColor: string;
  dressPattern: string;
  outer: string;
  outerColor: string;
  shoes: string;
  shoesColor: string;
  acc: string;
  art: FashionStroke[];
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

export function defaultOutfit(): Outfit {
  return {
    skin: '#e8b89a',
    face: 'soft',
    hair: 'long',
    hairColor: '#4a2c14',
    top: 'blouse',
    topColor: '#e8a0b4',
    topPattern: 'solid',
    bottom: 'skirt',
    bottomColor: '#1a1520',
    bottomPattern: 'solid',
    dress: 'none',
    dressColor: '#d4a054',
    dressPattern: 'solid',
    outer: 'none',
    outerColor: '#1e3a5f',
    shoes: 'pumps',
    shoesColor: '#1a1520',
    acc: 'necklace',
    art: [],
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

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
    skin: text('skin', base.skin),
    face: text('face', base.face),
    hair: text('hair', base.hair),
    hairColor: text('hairColor', base.hairColor),
    top: text('top', base.top),
    topColor: text('topColor', base.topColor),
    topPattern: text('topPattern', base.topPattern),
    bottom: text('bottom', base.bottom),
    bottomColor: text('bottomColor', base.bottomColor),
    bottomPattern: text('bottomPattern', base.bottomPattern),
    dress: text('dress', base.dress),
    dressColor: text('dressColor', base.dressColor),
    dressPattern: text('dressPattern', base.dressPattern),
    outer: text('outer', base.outer),
    outerColor: text('outerColor', base.outerColor),
    shoes: text('shoes', base.shoes),
    shoesColor: text('shoesColor', base.shoesColor),
    acc: text('acc', base.acc),
    art,
  };
}
