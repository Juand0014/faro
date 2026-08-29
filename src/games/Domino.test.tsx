import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DominoBoard, DominoTileFace } from '../components/DominoTiles';
import { tileId } from '../lib/domino';

describe('domino visual primitives', () => {
  it('renders a semantic double-six tile with pip cells', () => {
    const html = renderToStaticMarkup(<DominoTileFace tile={[6, 6]} />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Ficha 6-6"');
    expect(html).toContain('domino-tile double');
    expect(html.match(/pip visible/g)).toHaveLength(12);
  });

  it('renders a board chain without exposing any hand', () => {
    const html = renderToStaticMarkup(<DominoBoard played={[0, 27]} ends={[0, 6]} />);

    expect(html).toContain('aria-label="Mesa de dominó"');
    expect(html).toContain('aria-label="2 fichas jugadas. Usa las flechas para desplazar la cadena."');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('Puntas abiertas: 0 y 6');
    expect(html).not.toContain('hand');
    expect(html).not.toContain('Ficha oculta');
  });

  it('renders the chain in connected board orientation', () => {
    const html = renderToStaticMarkup(
      <DominoBoard
        played={[tileId([3, 4]), tileId([3, 6])]}
        ends={[4, 6]}
      />,
    );

    expect(html.indexOf('aria-label="Ficha 4-3"')).toBeLessThan(
      html.indexOf('aria-label="Ficha 3-6"'),
    );
  });

  it('makes a tile face decorative when its button supplies the name', () => {
    const html = renderToStaticMarkup(<DominoTileFace tile={[2, 5]} decorative />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('aria-label=');
  });
});
