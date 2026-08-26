export const HANG_LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
export const MAX_WRONG = 6;

export type HangState = {
  first: string;
  setter: string;
  guesser: string | null;
  secret: string;
  guessed: string[];
  wrong: number;
  maxWrong: number;
  phase: 'word' | 'guess';
};

export function initialHangState(first: string, prev?: HangState): HangState {
  const setter = prev?.guesser && prev?.setter ? prev.guesser : first;
  const guesser = prev?.guesser && prev?.setter ? prev.setter : null;
  return {
    first,
    setter,
    guesser,
    secret: '',
    guessed: [],
    wrong: 0,
    maxWrong: MAX_WRONG,
    phase: 'word',
  };
}

export function hangNorm(ch: string): string {
  const n = ch.toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');
  return n;
}

export function isLetter(ch: string): boolean {
  const n = hangNorm(ch);
  return n.length === 1 && /[a-zñ]/.test(n);
}

export function letterCount(secret: string): number {
  return [...secret].filter(isLetter).length;
}

export function maskSecret(secret: string, guessed: string[]): string {
  const g = new Set(guessed.map(hangNorm));
  return [...secret].map((ch) => {
    if (!isLetter(ch)) return ch === ' ' ? '  ' : ch;
    return g.has(hangNorm(ch)) ? ch : '·';
  }).join(' ');
}

export function letterHits(secret: string, letter: string): boolean {
  const L = hangNorm(letter);
  return [...secret].some((ch) => isLetter(ch) && hangNorm(ch) === L);
}

export function allRevealed(secret: string, guessed: string[]): boolean {
  const g = new Set(guessed.map(hangNorm));
  return [...secret].filter(isLetter).every((ch) => g.has(hangNorm(ch)));
}

export function applyGuess(state: HangState, letter: string): HangState {
  const key = hangNorm(letter);
  if (state.guessed.some((x) => hangNorm(x) === key)) return state;
  const hit = letterHits(state.secret, letter);
  return {
    ...state,
    guessed: [...state.guessed, key === 'ñ' ? 'Ñ' : key.toUpperCase()],
    wrong: hit ? state.wrong : state.wrong + 1,
  };
}
