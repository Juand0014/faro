import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { initialParchisState } from '../lib/parchis';
import { ParchisBoard } from './Parchis';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../lib/useGame', () => ({ useGame: vi.fn() }));

describe('ParchisBoard', () => {
  it('renders the classic 68-square board, four homes and two arrival lanes', () => {
    const html = renderToStaticMarkup(
      <ParchisBoard state={initialParchisState('a')} mySeat="a"
        movable={new Set()} destinations={new Map()} disabled onPiece={() => {}} />,
    );

    expect(html.match(/class="parchis-cell-number"/g)).toHaveLength(68);
    expect(html.match(/class="parchis-home /g)).toHaveLength(4);
    expect(html.match(/class="parchis-cell lane /g)).toHaveLength(14);
    expect(html.match(/class="parchis-rosette"/g)).toHaveLength(4);
  });

  it('places the first arrival position immediately after square 68', () => {
    const state = initialParchisState('a', 2);
    state.pieces.a = [63, 64];
    const html = renderToStaticMarkup(
      <ParchisBoard state={state} mySeat="a" movable={new Set()}
        destinations={new Map()} disabled onPiece={() => {}} />,
    );

    expect(html).toContain('Tu ficha 1, en casilla 68, seguro');
    expect(html).toContain('Tu ficha 2, en el pasillo, casilla 1');
  });
});
