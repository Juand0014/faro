export const SEA_SIZE = 5;
export const FLEET = [3, 2, 2];

export type FleetRole = 'first' | 'second';
export type SeaBoard = { ships: number[][]; ready: boolean };
export type BattleshipState = {
  first: string;
  setupTurn: FleetRole;
  boards: Record<FleetRole, SeaBoard>;
  shots: Record<FleetRole, number[]>;
};

export function initialBattleshipState(first: string): BattleshipState {
  return {
    first,
    setupTurn: 'first',
    boards: {
      first: { ships: [], ready: false },
      second: { ships: [], ready: false },
    },
    shots: { first: [], second: [] },
  };
}

export function roleFor(firstId: string, meId: string): FleetRole {
  return firstId === meId ? 'first' : 'second';
}

export function otherRole(role: FleetRole): FleetRole {
  return role === 'first' ? 'second' : 'first';
}

export function shipCells(start: number, length: number, vertical: boolean): number[] | null {
  const row = Math.floor(start / SEA_SIZE);
  const col = start % SEA_SIZE;
  if (vertical && row + length > SEA_SIZE) return null;
  if (!vertical && col + length > SEA_SIZE) return null;
  return Array.from({ length }, (_, i) => start + (vertical ? i * SEA_SIZE : i));
}

export function canPlace(ships: number[][], cells: number[] | null) {
  if (!cells) return false;
  const occupied = new Set(ships.flat());
  return cells.every((cell) => !occupied.has(cell));
}

export function allSunk(ships: number[][], shots: number[]) {
  const fired = new Set(shots);
  return ships.flat().every((cell) => fired.has(cell));
}
