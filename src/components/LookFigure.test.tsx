import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultOutfit } from '../lib/fashion';
import LookFigure from './LookFigure';

describe('LookFigure', () => {
  it('renders an accessible editorial croquis instead of a voxel avatar', () => {
    const html = renderToStaticMarkup(<LookFigure outfit={defaultOutfit()} />);

    expect(html).toContain('aria-label="Croquis editorial con el look diseñado"');
    expect(html).not.toContain('voxel');
    expect(html).toContain('<path');
  });

  it('renders selected fabric material and custom drawing', () => {
    const outfit = defaultOutfit();
    outfit.topMaterial = 'satin';
    outfit.art = [{
      id: 'ink',
      target: 'top',
      color: '#7a1f3d',
      width: 3,
      points: [{ x: 20, y: 30 }, { x: 80, y: 70 }],
    }];

    const html = renderToStaticMarkup(<LookFigure outfit={outfit} />);
    expect(html).toContain('data-material="satin"');
    expect(html).toContain('stroke="#7a1f3d"');
  });
});
