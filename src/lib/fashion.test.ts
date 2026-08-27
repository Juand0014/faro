import { describe, expect, it } from 'vitest';
import {
  MAX_FASHION_POINTS,
  MAX_FASHION_STROKES,
  MAX_FASHION_TOTAL_POINTS,
  addFashionPoint,
  defaultOutfit,
  fashionChallenge,
  formatRatingNote,
  normalizeOutfit,
  parseRatingNote,
  type FashionStroke,
} from './fashion';

describe('normalizeOutfit', () => {
  it('upgrades an old saved look without losing its choices', () => {
    const oldLook = {
      skin: '#8d5524',
      hair: 'bob',
      hairColor: '#1a120d',
      top: 'bustier',
      topColor: '#7a1f3d',
      bottom: 'slit',
      bottomColor: '#1a1520',
      dress: 'none',
      dressColor: '#d4a054',
      outer: 'blazer',
      outerColor: '#1e3a5f',
      shoes: 'boots',
      shoesColor: '#1a1520',
      acc: 'bag',
    };

    const result = normalizeOutfit(oldLook);

    expect(result.top).toBe('bustier');
    expect(result.bottom).toBe('slit');
    expect(result.face).toBe(defaultOutfit().face);
    expect(result.art).toEqual([]);
    expect(result.version).toBe(3);
    expect(result.topMaterial).toBe('cotton');
  });

  it('drops malformed and excessive drawing data', () => {
    const strokes = Array.from({ length: MAX_FASHION_STROKES + 8 }, (_, i) => ({
      id: `line-${i}`,
      color: '#ffffff',
      width: 4,
      points: Array.from({ length: MAX_FASHION_POINTS + 20 }, () => ({ x: 400, y: -40 })),
    }));

    const result = normalizeOutfit({ ...defaultOutfit(), art: strokes });

    expect(result.art.length).toBeLessThanOrEqual(MAX_FASHION_STROKES);
    expect(result.art[0].points).toHaveLength(MAX_FASHION_POINTS);
    expect(result.art[0].points[0]).toEqual({ x: 100, y: 0 });
    expect(result.art.reduce((sum, stroke) => sum + stroke.points.length, 0))
      .toBeLessThanOrEqual(MAX_FASHION_TOTAL_POINTS);
  });

  it('rounds drawing coordinates and rejects unknown material values', () => {
    const result = normalizeOutfit({
      ...defaultOutfit(),
      topMaterial: 'unknown',
      art: [{
        id: 'line',
        target: 'top',
        color: '#fff',
        width: 4,
        points: [{ x: 31.234, y: 58.777 }],
      }],
    });

    expect(result.topMaterial).toBe('cotton');
    expect(result.art[0].points[0]).toEqual({ x: 31.2, y: 58.8 });
  });

  it('keeps a maximum-size drawing well below the database guard', () => {
    const art = Array.from({ length: MAX_FASHION_STROKES }, (_, stroke) => ({
      id: `s${stroke}`,
      target: 'top' as const,
      color: '#f4efe6',
      width: 4,
      points: Array.from({ length: 25 }, (_, point) => ({
        x: point * 3.14159,
        y: stroke * 6.1712,
      })),
    }));

    const encoded = JSON.stringify(normalizeOutfit({ ...defaultOutfit(), art }));
    expect(new TextEncoder().encode(encoded).byteLength).toBeLessThan(12_000);
  });
});

describe('addFashionPoint', () => {
  it('clamps coordinates and ignores almost identical points', () => {
    const stroke: FashionStroke = {
      id: 'stroke',
      target: 'top',
      color: '#fff',
      width: 4,
      points: [{ x: 20, y: 20 }],
    };

    expect(addFashionPoint(stroke, { x: 20.2, y: 20.1 })).toBe(stroke);
    const result = addFashionPoint(stroke, { x: 140, y: -8 });
    expect(result.points[result.points.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('caps the number of points in a stroke', () => {
    let stroke: FashionStroke = { id: 'stroke', target: 'top', color: '#fff', width: 4, points: [] };
    for (let i = 0; i < MAX_FASHION_POINTS + 30; i += 1) {
      stroke = addFashionPoint(stroke, { x: i % 101, y: Math.floor(i / 101) * 3 });
    }
    expect(stroke.points.length).toBeLessThanOrEqual(MAX_FASHION_POINTS);
  });
});

describe('fashionChallenge', () => {
  it('rebuilds the same compact challenge from its seed', () => {
    expect(fashionChallenge(1247)).toEqual(fashionChallenge(1247));
    expect(fashionChallenge(1247).seed).toBe(1247);
    expect(fashionChallenge(1247).brief.length).toBeGreaterThan(20);
  });

  it('varies the brief when the seed changes', () => {
    expect(fashionChallenge(1247).brief).not.toBe(fashionChallenge(1248).brief);
  });
});

describe('rating notes', () => {
  it('stores and restores a reaction without a new database column', () => {
    const packed = formatRatingNote('wow', 'Los colores quedaron hermosos');
    expect(parseRatingNote(packed)).toEqual({
      reaction: 'wow',
      note: 'Los colores quedaron hermosos',
    });
  });

  it('keeps old plain notes backward compatible', () => {
    expect(parseRatingNote('Me gustó mucho')).toEqual({
      reaction: '',
      note: 'Me gustó mucho',
    });
  });
});
