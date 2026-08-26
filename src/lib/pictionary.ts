export type DrawPoint = [number, number];
export type DrawStroke = {
  id: string;
  points: DrawPoint[];
  color: string;
  width: number;
};

export type PictionaryState = {
  first: string;
  drawer: string;
  guesser: string | null;
  word: string;
  phase: 'choose' | 'draw';
  strokes: DrawStroke[];
};

export const PICTIONARY_WORDS = [
  'avión', 'ballena', 'bicicleta', 'castillo', 'corazón', 'dinosaurio',
  'elefante', 'estrella', 'fantasma', 'girasol', 'guitarra', 'helado',
  'jirafa', 'mariposa', 'montaña', 'paraguas', 'pingüino', 'pirata',
  'planeta', 'robot', 'sirena', 'tiburón', 'volcán', 'zapato',
];

export const MAX_DRAW_STROKES = 80;
export const MAX_STROKE_POINTS = 300;

export function initialPictionaryState(first: string, prev?: PictionaryState): PictionaryState {
  const drawer = prev?.guesser && prev?.drawer ? prev.guesser : first;
  const guesser = prev?.guesser && prev?.drawer ? prev.drawer : null;
  return { first, drawer, guesser, word: '', phase: 'choose', strokes: [] };
}

export function normalizeGuess(value: string) {
  return value.trim().toLocaleLowerCase('es')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isCorrectGuess(word: string, guess: string) {
  return normalizeGuess(word) === normalizeGuess(guess);
}

export function wordChoices(count = 3) {
  return [...PICTIONARY_WORDS].sort(() => Math.random() - 0.5).slice(0, count);
}
