import { useEffect, useRef, useState } from 'react';
import { broadcastGameReaction, subscribeGameReaction } from '../lib/coupleLive';
import {
  acceptGameReaction,
  createGameReaction,
  GAME_REACTION_EMOJIS,
  GAME_REACTION_TTL_MS,
  type GameReactionEmoji,
  type GameReactionEvent,
} from '../lib/gameReactions';

export default function GameReactions({
  gameId,
  gameType,
  memberId,
  celebration = false,
}: {
  gameId: string;
  gameType: string;
  memberId: string;
  celebration?: boolean;
}) {
  const [bursts, setBursts] = useState<GameReactionEvent[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const seen = useRef(new Set<string>());
  const timers = useRef(new Map<string, number>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const remove = (id: string) => {
      setBursts((current) => current.filter((item) => item.id !== id));
      timers.current.delete(id);
    };
    const show = (event: GameReactionEvent) => {
      if (!acceptGameReaction(event, gameId, seen.current)) return;
      seen.current.add(event.id);
      setBursts((current) => [...current.slice(-7), event]);
      setAnnouncement(`${event.from === memberId ? 'Enviaste' : 'Tu pareja envió'} ${event.emoji}`);
      timers.current.set(event.id, window.setTimeout(() => remove(event.id), GAME_REACTION_TTL_MS));
    };
    const unsubscribe = subscribeGameReaction(show);
    const activeTimers = timers.current;
    return () => {
      mounted.current = false;
      unsubscribe();
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
      seen.current.clear();
    };
  }, [gameId, memberId]);

  function send(emoji: GameReactionEmoji) {
    const event = createGameReaction(gameId, gameType, memberId, emoji);
    if (!seen.current.has(event.id)) {
      seen.current.add(event.id);
      setBursts((current) => [...current.slice(-7), event]);
      setAnnouncement(`Enviaste ${emoji}`);
      timers.current.set(event.id, window.setTimeout(() => {
        setBursts((current) => current.filter((item) => item.id !== event.id));
        timers.current.delete(event.id);
      }, GAME_REACTION_TTL_MS));
    }
    navigator.vibrate?.(35);
    broadcastGameReaction(event).catch(() => {
      if (mounted.current) setAnnouncement('La reacción no pudo enviarse.');
    });
  }

  return (
    <section className={`game-reactions${celebration ? ' celebrating' : ''}`} aria-label="Reacciones">
      <div className="game-reaction-bursts" aria-hidden="true">
        {bursts.map((burst, index) => (
          <span key={burst.id} className={`game-reaction-burst drift-${index % 4}`}>
            {burst.emoji}
          </span>
        ))}
      </div>
      <div className="game-reaction-picker">
        {GAME_REACTION_EMOJIS.map((emoji) => (
          <button key={emoji} type="button" onClick={() => send(emoji)} aria-label={`Enviar ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
    </section>
  );
}
