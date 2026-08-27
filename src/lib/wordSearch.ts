import { wordCategory } from './wordSearchWords';

export const WORD_SEARCH_SIZE = 14;
export const WORDS_PER_ROUND = 14;

export type WordCell = { row: number; col: number };
export type WordPlacement = { word: string; start: WordCell; end: WordCell };
export type WordSearchPuzzle = {
  board: string[][];
  words: string[];
  placements: WordPlacement[];
};
export type WordSearchState = {
  version: 1;
  first: string;
  category: string;
  seed: number;
  size: number;
  words: string[];
  found: Record<string, string>;
  nextCategory?: string;
};

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
] as const;
const LETTERS = 'AAAAABCDEEEEEFGHIIIIJKLMNÑOOOOOPQRSTUUUUVWXYZ';

export function normalizeWord(value: string) {
  return value.trim().toUpperCase().replace(/Ñ/g, '\u0000').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\u0000/g, 'Ñ').replace(/[^A-ZÑ]/g, '');
}

function randomFrom(seed: number) {
  let value = Math.abs(Math.trunc(seed)) || 1;
  return () => {
    value |= 0;
    value = value + 0x6D2B79F5 | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result;
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function buildWordSearch(categoryId: string, seed: number): WordSearchPuzzle {
  const random = randomFrom(seed);
  const source = [...new Set(wordCategory(categoryId).words.map(normalizeWord))]
    .filter((word) => word.length >= 4 && word.length <= WORD_SEARCH_SIZE);
  const candidates = shuffled(source, random)
    .slice(0, Math.min(WORDS_PER_ROUND + 8, source.length))
    .sort((a, b) => b.length - a.length);
  const board = Array.from({ length: WORD_SEARCH_SIZE }, () =>
    Array<string>(WORD_SEARCH_SIZE).fill(''));
  const placements: WordPlacement[] = [];

  for (const word of candidates) {
    if (placements.length >= WORDS_PER_ROUND) break;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const [dr, dc] = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
      const row = Math.floor(random() * WORD_SEARCH_SIZE);
      const col = Math.floor(random() * WORD_SEARCH_SIZE);
      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endRow >= WORD_SEARCH_SIZE || endCol < 0 || endCol >= WORD_SEARCH_SIZE) continue;
      let fits = true;
      for (let index = 0; index < word.length; index += 1) {
        const present = board[row + dr * index][col + dc * index];
        if (present && present !== word[index]) { fits = false; break; }
      }
      if (!fits) continue;
      for (let index = 0; index < word.length; index += 1) {
        board[row + dr * index][col + dc * index] = word[index];
      }
      placements.push({
        word,
        start: { row, col },
        end: { row: endRow, col: endCol },
      });
      break;
    }
  }

  if (placements.length < WORDS_PER_ROUND) {
    // Respaldo determinista: garantiza una sopa válida aun con una combinación
    // extremadamente adversa de cruces aleatorios.
    for (const row of board) row.fill('');
    placements.length = 0;
    for (let row = 0; row < WORDS_PER_ROUND; row += 1) {
      const word = candidates[row];
      const backwards = random() > .5;
      const col = Math.floor(random() * (WORD_SEARCH_SIZE - word.length + 1));
      for (let index = 0; index < word.length; index += 1) {
        board[row][backwards ? col + word.length - 1 - index : col + index] = word[index];
      }
      placements.push({
        word,
        start: { row, col: backwards ? col + word.length - 1 : col },
        end: { row, col: backwards ? col : col + word.length - 1 },
      });
    }
  }
  for (const row of board) {
    for (let col = 0; col < row.length; col += 1) {
      if (!row[col]) row[col] = LETTERS[Math.floor(random() * LETTERS.length)];
    }
  }
  return { board, words: placements.map((placement) => placement.word), placements };
}

export function selectedWord(board: string[][], start: WordCell, end: WordCell) {
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta)) + 1;
  if (length < 2) return '';
  if (rowDelta !== 0 && colDelta !== 0 && Math.abs(rowDelta) !== Math.abs(colDelta)) return '';
  const dr = Math.sign(rowDelta);
  const dc = Math.sign(colDelta);
  let value = '';
  for (let index = 0; index < length; index += 1) {
    const row = start.row + dr * index;
    const col = start.col + dc * index;
    if (!board[row]?.[col]) return '';
    value += board[row][col];
  }
  return value;
}

export function selectionCells(start: WordCell, end: WordCell) {
  const value = selectedWord(
    Array.from({ length: WORD_SEARCH_SIZE }, () => Array(WORD_SEARCH_SIZE).fill('X')),
    start,
    end,
  );
  if (!value) return [];
  const dr = Math.sign(end.row - start.row);
  const dc = Math.sign(end.col - start.col);
  return Array.from({ length: value.length }, (_, index) => ({
    row: start.row + dr * index,
    col: start.col + dc * index,
  }));
}

export function scoresFromClaims(found: Record<string, string>) {
  return Object.values(found).reduce<Record<string, number>>((scores, player) => {
    scores[player] = (scores[player] ?? 0) + 1;
    return scores;
  }, {});
}

export function initialWordSearchState(first: string, category = 'aeropuertos', seed = Date.now() % 2_147_483_647): WordSearchState {
  const puzzle = buildWordSearch(category, seed);
  return {
    version: 1,
    first,
    category: wordCategory(category).id,
    seed: Math.abs(Math.trunc(seed)),
    size: WORD_SEARCH_SIZE,
    words: puzzle.words,
    found: {},
  };
}

export function isWordSearchState(value: unknown): value is WordSearchState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  const validShape = state.version === 1 && typeof state.first === 'string'
    && typeof state.category === 'string' && typeof state.seed === 'number'
    && state.size === WORD_SEARCH_SIZE && Array.isArray(state.words)
    && state.words.length === WORDS_PER_ROUND
    && state.words.every((word) => typeof word === 'string' && /^[A-ZÑ]{4,14}$/.test(word))
    && Boolean(state.found) && typeof state.found === 'object'
    && (state.nextCategory === undefined || typeof state.nextCategory === 'string');
  if (!validShape) return false;
  const targets = state.words as string[];
  return Object.entries(state.found as Record<string, unknown>)
    .every(([word, owner]) => targets.includes(word) && typeof owner === 'string');
}
