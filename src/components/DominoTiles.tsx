import { orientedDominoBoard, type DominoTile } from '../lib/domino';

const PIP_CELLS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function PipHalf({ value }: { value: number }) {
  return (
    <span className={`domino-half pips-${value}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} className={PIP_CELLS[value].includes(index) ? 'pip visible' : 'pip'} />
      ))}
    </span>
  );
}

export function DominoTileFace({
  tile,
  hidden = false,
  decorative = false,
  className = '',
}: {
  tile: DominoTile;
  hidden?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const [first, second] = tile;
  return (
    <span
      className={`domino-tile${first === second ? ' double' : ''}${hidden ? ' hidden' : ''}${
        className ? ` ${className}` : ''
      }`}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : hidden ? 'Ficha oculta' : `Ficha ${first}-${second}`}
    >
      {hidden ? <span className="domino-back" aria-hidden="true" /> : (
        <>
          <PipHalf value={first} />
          <span className="domino-divider" aria-hidden="true" />
          <PipHalf value={second} />
        </>
      )}
    </span>
  );
}

export function DominoBoard({
  played,
  ends,
}: {
  played: number[];
  ends: [number, number] | null;
}) {
  const chain = orientedDominoBoard(played, ends);
  return (
    <section className="domino-board" aria-label="Mesa de dominó">
      <div className="domino-chain" role="list" tabIndex={0}
        aria-label={`${chain.length} fichas jugadas. Usa las flechas para desplazar la cadena.`}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          event.currentTarget.scrollBy({
            left: event.key === 'ArrowLeft' ? -120 : 120,
            behavior: 'auto',
          });
        }}>
        {chain.length ? chain.map((tile, index) => (
          <span role="listitem" key={`${tile[0]}-${tile[1]}-${index}`} className="domino-board-tile">
            <DominoTileFace tile={tile} />
          </span>
        )) : <p className="domino-empty-board">La mesa está lista para la salida.</p>}
      </div>
      {ends && <p className="domino-open-ends">Puntas abiertas: {ends[0]} y {ends[1]}</p>}
    </section>
  );
}
