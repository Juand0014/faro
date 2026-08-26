export const HARD_LETTERS = ['W', 'X', 'Ñ', 'Z'] as const;

export const DEFAULT_CATEGORIES: { id: string; label: string }[] = [
  { id: 'nombre', label: 'Nombre' },
  { id: 'apellido', label: 'Apellido' },
  { id: 'animal', label: 'Animal' },
  { id: 'lugar', label: 'País/Ciudad' },
  { id: 'objeto', label: 'Objeto' },
  { id: 'comida', label: 'Fruta/Verdura' },
  { id: 'color', label: 'Color' },
];

export type StopCategory = { id: string; label: string };

export type StopConfig = {
  categories: StopCategory[];
  roundSeconds: number | null;
  advancedLetters: boolean;
};

export type StopRound = {
  n: number;
  letter: string;
  startedAt: string;
  endsAt: string | null;
  stoppedBy: string | null;
  sheets: Record<string, Record<string, string>>;
  votes: Record<string, Record<string, boolean>>;
  voteReady: Record<string, boolean>;
  falseStop: string | null;
  roundScores: Record<string, number>;
};

export type StopState = {
  first: string;
  config: StopConfig;
  usedLetters: string[];
  scores: Record<string, number>;
  phase: 'setup' | 'play' | 'vote' | 'reveal' | 'match';
  round: StopRound | null;
};

export function defaultConfig(): StopConfig {
  return { categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), roundSeconds: 60, advancedLetters: false };
}

export function initialStopState(first: string, config?: StopConfig): StopState {
  return {
    first,
    config: config ? { ...config, categories: config.categories.map((c) => ({ ...c })) } : defaultConfig(),
    usedLetters: [],
    scores: {},
    phase: 'setup',
    round: null,
  };
}

export function alphabet(advanced: boolean): string[] {
  const all = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
  if (advanced) return all;
  return all.filter((l) => !(HARD_LETTERS as readonly string[]).includes(l));
}

export function drawLetter(used: string[], advanced: boolean): string | null {
  const pool = alphabet(advanced).filter((l) => !used.includes(l));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function normalize(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ü/g, 'u');
}

export function startsWithLetter(word: string, letter: string): boolean {
  const n = normalize(word);
  if (!n) return false;
  const L = letter.toUpperCase();
  if (L === 'Ñ') return n[0] === 'ñ';
  return n[0].toUpperCase() === L;
}

export function voteKey(playerId: string, categoryId: string) {
  return `${playerId}::${categoryId}`;
}

export function needsVote(word: string, letter: string) {
  return startsWithLetter(word, letter);
}

export function detectFalseStop(round: StopRound, categories: StopCategory[]): string | null {
  if (!round.stoppedBy) return null;
  const sheet = round.sheets[round.stoppedBy] || {};
  for (const cat of categories) {
    if (!startsWithLetter(sheet[cat.id] || '', round.letter)) return round.stoppedBy;
  }
  return null;
}

export function isApproved(
  round: StopRound,
  playerId: string,
  categoryId: string,
  voters: string[],
): boolean {
  const key = voteKey(playerId, categoryId);
  for (const voter of voters) {
    if (voter === playerId) continue;
    if (round.votes[voter]?.[key] === false) return false;
  }
  return true;
}

export function scoreRound(state: StopState, playerIds: string[]): StopState {
  const round = state.round;
  if (!round) return state;
  const cats = state.config.categories;
  const letter = round.letter;
  const roundScores: Record<string, number> = {};
  for (const id of playerIds) roundScores[id] = 0;

  for (const cat of cats) {
    const valid: Record<string, string> = {};
    for (const id of playerIds) {
      const raw = round.sheets[id]?.[cat.id] || '';
      if (startsWithLetter(raw, letter) && isApproved(round, id, cat.id, playerIds)) {
        valid[id] = normalize(raw);
      }
    }
    const ids = Object.keys(valid);
    for (const id of ids) {
      const shared = ids.some((other) => other !== id && valid[other] === valid[id]);
      roundScores[id] += shared ? 5 : 10;
    }
  }

  const falseStop = detectFalseStop(round, cats);
  if (falseStop) roundScores[falseStop] = (roundScores[falseStop] || 0) - 10;

  const scores = { ...state.scores };
  for (const id of playerIds) scores[id] = (scores[id] || 0) + (roundScores[id] || 0);

  return {
    ...state,
    phase: 'reveal',
    scores,
    round: { ...round, falseStop, roundScores },
  };
}

export function bothReady(round: StopRound, playerIds: string[]) {
  return playerIds.length > 0 && playerIds.every((id) => round.voteReady?.[id]);
}

export function startRound(state: StopState): StopState {
  const letter = drawLetter(state.usedLetters, state.config.advancedLetters);
  if (!letter) {
    return { ...state, phase: 'match', round: state.round };
  }
  const now = Date.now();
  const secs = state.config.roundSeconds;
  return {
    ...state,
    phase: 'play',
    usedLetters: [...state.usedLetters, letter],
    round: {
      n: (state.round?.n || 0) + 1,
      letter,
      startedAt: new Date(now).toISOString(),
      endsAt: secs ? new Date(now + secs * 1000).toISOString() : null,
      stoppedBy: null,
      sheets: {},
      votes: {},
      voteReady: {},
      falseStop: null,
      roundScores: {},
    },
  };
}

export function matchWinner(scores: Record<string, number>, playerIds: string[]): string | null {
  if (playerIds.length < 2) return playerIds[0] || null;
  const a = scores[playerIds[0]] || 0;
  const b = scores[playerIds[1]] || 0;
  if (a === b) return null;
  return a > b ? playerIds[0] : playerIds[1];
}

export function remainingSeconds(endsAt: string | null, now = Date.now()) {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

export function categoryIdFromLabel(label: string, existing: StopCategory[]) {
  const base = normalize(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'cat';
  let id = base;
  let n = 2;
  const used = new Set(existing.map((c) => c.id));
  while (used.has(id)) { id = `${base}-${n}`; n += 1; }
  return id;
}
