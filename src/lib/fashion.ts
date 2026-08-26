export type Outfit = {
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  dress: string;
  dressColor: string;
  outer: string;
  outerColor: string;
  shoes: string;
  shoesColor: string;
  acc: string;
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
];

export const TOPS = [
  { id: 'tee', name: 'Polera' },
  { id: 'blouse', name: 'Blusa' },
  { id: 'crop', name: 'Crop' },
  { id: 'turtleneck', name: 'Beatle' },
  { id: 'bustier', name: 'Bustier' },
];

export const BOTTOMS = [
  { id: 'jeans', name: 'Jeans' },
  { id: 'skirt', name: 'Falda' },
  { id: 'trousers', name: 'Pantalón' },
  { id: 'shorts', name: 'Short' },
  { id: 'slit', name: 'Falda tajo' },
];

export const DRESSES = [
  { id: 'none', name: 'Sin vestido' },
  { id: 'slip', name: 'Slip' },
  { id: 'cocktail', name: 'Cocktail' },
  { id: 'shirt', name: 'Camisero' },
];

export const OUTERS = [
  { id: 'none', name: 'Sin abrigo' },
  { id: 'blazer', name: 'Blazer' },
  { id: 'coat', name: 'Abrigo' },
  { id: 'cardigan', name: 'Cárdigan' },
];

export const SHOES = [
  { id: 'pumps', name: 'Stilettos' },
  { id: 'boots', name: 'Botas' },
  { id: 'sneakers', name: 'Zapatillas' },
  { id: 'sandals', name: 'Sandalias' },
];

export const ACCS = [
  { id: 'none', name: 'Nada' },
  { id: 'necklace', name: 'Collar' },
  { id: 'glasses', name: 'Lentes' },
  { id: 'bag', name: 'Cartera' },
  { id: 'belt', name: 'Cinturón' },
];

export function defaultOutfit(): Outfit {
  return {
    skin: '#e8b89a',
    hair: 'long',
    hairColor: '#4a2c14',
    top: 'blouse',
    topColor: '#e8a0b4',
    bottom: 'skirt',
    bottomColor: '#1a1520',
    dress: 'none',
    dressColor: '#d4a054',
    outer: 'none',
    outerColor: '#1e3a5f',
    shoes: 'pumps',
    shoesColor: '#1a1520',
    acc: 'necklace',
  };
}
