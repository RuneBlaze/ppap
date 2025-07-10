
export interface Region {
  id: string;
  cells: Set<string>; // "x,y" format
  bounds: { minX: number, maxX: number, minY: number, maxY: number };
}

export class Grid {
  private activeCells: Set<string> = new Set();
  private regions: Region[] = [];

  constructor(private gridSize: number) {}

  public addCell(x: number, y: number): void {
    this.activeCells.add(`${x},${y}`);
  }

  public removeCell(x: number, y: number): void {
    this.activeCells.delete(`${x},${y}`);
  }
  
  public getGridSize(): number {
    return this.gridSize;
  }

  public getActiveCells(): ReadonlySet<string> {
    return this.activeCells;
  }

  public getRegions(): readonly Region[] {
    return this.regions;
  }

  public updateRegions(): void {
    this.regions = [];
    const visited = new Set<string>();

    for (const cellKey of this.activeCells) {
      if (visited.has(cellKey)) continue;

      const region = this.floodFillRegion(cellKey, visited);
      if (region.cells.size > 0) {
        this.regions.push(region);
      }
    }
  }

  private floodFillRegion(startCell: string, visited: Set<string>): Region {
    const [startX, startY] = startCell.split(',').map(Number);
    const cells = new Set<string>();
    const stack = [startCell];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;

      visited.add(current);
      cells.add(current);

      const [x, y] = current.split(',').map(Number);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [
        `${x - this.gridSize},${y}`,
        `${x + this.gridSize},${y}`,
        `${x},${y - this.gridSize}`,
        `${x},${y + this.gridSize}`
      ];

      for (const neighbor of neighbors) {
        if (this.activeCells.has(neighbor) && !visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    return {
      id: `region_${minX}_${minY}`,
      cells,
      bounds: { minX, maxX, minY, maxY }
    };
  }
}
