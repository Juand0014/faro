import { describe, expect, it } from 'vitest';
import { defaultOutfit } from './fashion';
import {
  deleteFashionDraft, draftKey, isDraftExpired, loadFashionDraft, saveFashionDraft,
} from './fashionDrafts';

describe('fashion drafts', () => {
  it('isolates drafts by couple and designer', () => {
    expect(draftKey('couple-a', 'designer-a')).toBe('couple-a:designer-a');
    expect(draftKey('couple-a', 'designer-a')).not.toBe(draftKey('couple-a', 'designer-b'));
  });

  it('expires a draft seven days after its last edit', () => {
    const now = Date.UTC(2026, 7, 27);
    expect(isDraftExpired({ expiresAt: now + 1 }, now)).toBe(false);
    expect(isDraftExpired({ expiresAt: now }, now)).toBe(true);
  });

  it('falls back to memory when IndexedDB is unavailable', async () => {
    await saveFashionDraft({
      coupleId: 'couple-memory',
      designerId: 'designer-memory',
      title: 'Boceto',
      outfit: defaultOutfit(),
      mode: 'free',
    });

    expect((await loadFashionDraft('couple-memory', 'designer-memory'))?.title).toBe('Boceto');
    await deleteFashionDraft('couple-memory', 'designer-memory');
    expect(await loadFashionDraft('couple-memory', 'designer-memory')).toBeNull();
  });
});
