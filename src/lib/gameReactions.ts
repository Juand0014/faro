export const GAME_REACTION_EMOJIS = ['😍', '😘', '😂', '😭', '🔥', '🏆', '🫶', '🎉', '💃', '😏'] as const;
export const GAME_REACTION_TTL_MS = 3_200;

export type GameReactionEmoji = typeof GAME_REACTION_EMOJIS[number];
export type GameReactionEvent = {
  id: string;
  gameId: string;
  gameType: string;
  from: string;
  emoji: GameReactionEmoji;
  at: number;
};

export function isGameReactionEvent(value: unknown): value is GameReactionEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<GameReactionEvent>;
  return typeof event.id === 'string' && event.id.length > 0 && event.id.length <= 100
    && typeof event.gameId === 'string' && event.gameId.length > 0 && event.gameId.length <= 100
    && typeof event.gameType === 'string' && event.gameType.length > 0 && event.gameType.length <= 40
    && typeof event.from === 'string' && event.from.length > 0 && event.from.length <= 100
    && typeof event.at === 'number' && Number.isFinite(event.at)
    && GAME_REACTION_EMOJIS.includes(event.emoji as GameReactionEmoji);
}

export function acceptGameReaction(event: GameReactionEvent, gameId: string, seen: ReadonlySet<string>): boolean {
  return event.gameId === gameId && !seen.has(event.id);
}

export function reactionExpiresAt(event: GameReactionEvent): number {
  return event.at + GAME_REACTION_TTL_MS;
}

export function createGameReaction(
  gameId: string,
  gameType: string,
  from: string,
  emoji: GameReactionEmoji,
): GameReactionEvent {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${from}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    gameId,
    gameType,
    from,
    emoji,
    at: Date.now(),
  };
}
