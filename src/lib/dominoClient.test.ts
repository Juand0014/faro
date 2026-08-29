import { describe, expect, it } from 'vitest';
import { dominoConfig } from './domino';
import { initialDominoLobby, isDominoPublicState } from './dominoClient';

describe('domino client contract', () => {
  it('creates a compact lobby without private tiles', () => {
    const lobby = initialDominoLobby('member-a', dominoConfig({ mode: 'partners', target: 200 }));
    expect(lobby.phase).toBe('lobby');
    expect(lobby.first).toBe('member-a');
    expect(lobby.confirmations).toEqual([]);
    expect(lobby.config.mode).toBe('partners');
    expect(JSON.stringify(lobby)).not.toMatch(/hands|boneyard"/);
    expect(isDominoPublicState(lobby)).toBe(true);
  });

  it('accepts a sanitized active table and rejects leaked or malformed state', () => {
    const lobby = initialDominoLobby('member-a');
    const active = {
      ...lobby,
      phase: 'play',
      seats: [
        { seat: 0, memberId: 'member-a', label: 'Ana', bot: false },
        { seat: 1, memberId: 'member-b', label: 'Luis', bot: false },
      ],
      confirmations: ['member-a', 'member-b'],
      roundNo: 1,
      turnSeat: 0,
      board: [27],
      ends: [6, 6],
      handCounts: [6, 7],
      boneyardCount: 14,
      seq: 2,
      lastEvents: [{ seq: 2, kind: 'play', seat: 0, tile: 27, end: 'right' }],
    };
    expect(isDominoPublicState(active)).toBe(true);
    expect(isDominoPublicState({ ...active, hands: [[1], [2]] })).toBe(false);
    expect(isDominoPublicState({ ...active, handCounts: [6] })).toBe(false);
    expect(isDominoPublicState({ ...active, turnSeat: 4 })).toBe(false);
    expect(isDominoPublicState({
      ...active,
      lastEvents: [{ seq: 2, kind: 'play', seat: 0, tile: 99, end: 'right' }],
    })).toBe(false);
    expect(isDominoPublicState({
      ...active,
      lastEvents: [{ seq: 2, kind: 'pass', seat: 7 }],
    })).toBe(false);
  });

  it('accepts normalized config keys returned in jsonb order', () => {
    const lobby = initialDominoLobby('member-a');
    const jsonbConfig = {
      target: lobby.config.target,
      mode: lobby.config.mode,
      handSize: lobby.config.handSize,
      blockedRule: lobby.config.blockedRule,
      capicuaBonus: lobby.config.capicuaBonus,
      drawFromBoneyard: lobby.config.drawFromBoneyard,
    };
    expect(isDominoPublicState({ ...lobby, config: jsonbConfig })).toBe(true);
  });
});
