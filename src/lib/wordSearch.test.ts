import { describe, expect, it } from 'vitest';
import {
  buildWordSearch,
  initialWordSearchState,
  isWordSearchState,
  normalizeWord,
  selectedWord,
  scoresFromClaims,
} from './wordSearch';
import { WORD_CATEGORIES, WORD_COUNT } from './wordSearchWords';

describe('word-search dictionary', () => {
  it('removes accents without losing the Spanish letter ñ', () => {
    expect(normalizeWord('piña')).toBe('PIÑA');
    expect(normalizeWord('océano')).toBe('OCEANO');
  });

  it('offers a large categorized Spanish vocabulary', () => {
    expect(WORD_CATEGORIES.length).toBeGreaterThanOrEqual(40);
    expect(WORD_COUNT).toBeGreaterThanOrEqual(1000);
    expect(WORD_CATEGORIES.find((category) => category.id === 'aeropuertos')).toBeTruthy();
    expect(WORD_CATEGORIES.find((category) => category.id === 'casa')).toBeTruthy();
    expect(WORD_CATEGORIES.find((category) => category.id === 'trabajo')).toBeTruthy();
    expect(WORD_CATEGORIES.find((category) => category.id === 'paises')).toBeTruthy();
    expect(WORD_CATEGORIES.find((category) => category.id === 'oceanos')).toBeTruthy();
  });

  it('contains only unique, board-safe words inside each category', () => {
    for (const category of WORD_CATEGORIES) {
      const normalized = category.words.map(normalizeWord);
      expect(new Set(normalized).size).toBe(normalized.length);
      const invalid = normalized.filter((word) => !/^[A-ZÑ]{4,14}$/.test(word));
      expect(invalid, `${category.id}: ${invalid.join(', ')}`).toEqual([]);
    }
  });
});

describe('word-search generator', () => {
  it('builds the same board from the same category and seed', () => {
    expect(buildWordSearch('casa', 4182)).toEqual(buildWordSearch('casa', 4182));
  });

  it('places every target word in the generated board', () => {
    const puzzle = buildWordSearch('oceanos', 91827);
    expect(puzzle.words).toHaveLength(14);
    for (const placement of puzzle.placements) {
      expect(selectedWord(puzzle.board, placement.start, placement.end)).toBe(placement.word);
    }
  });

  it('can generate every category across varied seeds', () => {
    for (const category of WORD_CATEGORIES) {
      for (const seed of [1, 17, 999, 4182, 93821]) {
        expect(buildWordSearch(category.id, seed).words).toHaveLength(14);
      }
    }
  });

  it('accepts a straight reverse selection and rejects crooked lines', () => {
    const puzzle = buildWordSearch('trabajo', 72);
    const placement = puzzle.placements[0];
    expect(selectedWord(puzzle.board, placement.end, placement.start))
      .toBe([...placement.word].reverse().join(''));
    expect(selectedWord(puzzle.board, { row: 0, col: 0 }, { row: 2, col: 1 })).toBe('');
  });

  it('creates compact multiplayer state and counts claims by player', () => {
    const state = initialWordSearchState('player-a', 'paises', 1234);
    expect(state.words).toHaveLength(14);
    expect(JSON.stringify(state).length).toBeLessThan(1000);
    expect(scoresFromClaims({ PERU: 'player-a', CHILE: 'player-b', BRASIL: 'player-a' }))
      .toEqual({ 'player-a': 2, 'player-b': 1 });
  });

  it('rejects corrupted claims loaded from realtime', () => {
    const state = initialWordSearchState('player-a', 'paises', 1234);
    expect(isWordSearchState({ ...state, found: { INVENTADA: 'player-b' } })).toBe(false);
    expect(isWordSearchState({ ...state, found: { [state.words[0]]: 42 } })).toBe(false);
  });
});
