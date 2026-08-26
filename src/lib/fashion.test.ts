import { describe, expect, it } from 'vitest';
import {
  MAX_FASHION_POINTS,
  MAX_FASHION_STROKES,
  MAX_FASHION_TOTAL_POINTS,
  addFashionPoint,
  defaultOutfit,
  normalizeOutfit,
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
