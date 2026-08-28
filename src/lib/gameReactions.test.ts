import { describe, expect, it } from 'vitest';
import { acceptGameReaction, isGameReactionEvent, reactionExpiresAt, type GameReactionEvent } from './gameReactions';

const event: GameReactionEvent = {
  id: 'reaction-1',
  gameId: 'game-1',
  gameType: 'parchis',
  from: 'member-1',
  emoji: '🔥',
  at: 1_000,
};

describe('live game reactions', () => {
  it('validates the bounded event shape', () => {
    expect(isGameReactionEvent(event)).toBe(true);
    expect(isGameReactionEvent({ ...event, emoji: '<script>' })).toBe(false);
    expect(isGameReactionEvent({ ...event, id: '' })).toBe(false);
  });

  it('filters reactions by game and deduplicates ids', () => {
    const seen = new Set<string>();
    expect(acceptGameReaction(event, 'game-1', seen)).toBe(true);
    seen.add(event.id);
    expect(acceptGameReaction(event, 'game-1', seen)).toBe(false);
    expect(acceptGameReaction({ ...event, id: 'reaction-2' }, 'another-game', seen)).toBe(false);
  });

  it('expires visual reactions after a short fixed lifetime', () => {
    expect(reactionExpiresAt(event)).toBe(4_200);
  });
});
