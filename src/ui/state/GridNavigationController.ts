export interface GridLayout {
  rows: number;
  cols: number;
  wraparound?: boolean;
}

/**
 * Manages keyboard navigation state for a grid of elements.
 * Events:
 * - 'changed' (newIndex: number, oldIndex: number, row: number, col: number)
 * - 'activated' (index: number, row: number, col: number)
 * - 'cancelled'
 */
export class GridNavigationController extends Phaser.Events.EventEmitter {
  private currentIndex = 0;
  private maxIndex = 0;
  private keydownListener: (event: KeyboardEvent) => void;
  private active = true;
  private gridLayout: GridLayout;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, gridLayout: GridLayout) {
    super();
    this.scene = scene;
    this.gridLayout = gridLayout;
    this.keydownListener = this.handleKeyDown.bind(this);
    this.scene.input.keyboard?.on('keydown', this.keydownListener);
  }

  setActive(isActive: boolean) {
    this.active = isActive;
  }

  setItems(numberOfItems: number) {
    this.maxIndex = numberOfItems - 1;
    this.currentIndex = 0;
    const { row, col } = this.indexToRowCol(this.currentIndex);
    this.emit('changed', this.currentIndex, -1, row, col);
  }

  setGridLayout(layout: GridLayout) {
    this.gridLayout = layout;
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.maxIndex < 0 || !this.active) return;

    switch (event.key) {
      case 'ArrowUp':
        this.moveUp();
        break;
      case 'ArrowDown':
        this.moveDown();
        break;
      case 'ArrowLeft':
        this.moveLeft();
        break;
      case 'ArrowRight':
        this.moveRight();
        break;
      case 'Enter':
        const { row, col } = this.indexToRowCol(this.currentIndex);
        this.emit('activated', this.currentIndex, row, col);
        break;
      case 'Escape':
        this.emit('cancelled');
        break;
    }
  }

  private indexToRowCol(index: number): { row: number; col: number } {
    const row = Math.floor(index / this.gridLayout.cols);
    const col = index % this.gridLayout.cols;
    return { row, col };
  }

  private rowColToIndex(row: number, col: number): number {
    return row * this.gridLayout.cols + col;
  }

  private moveUp() {
    const { row, col } = this.indexToRowCol(this.currentIndex);
    let newRow = row - 1;
    
    if (newRow < 0) {
      if (this.gridLayout.wraparound) {
        newRow = this.gridLayout.rows - 1;
      } else {
        return; // Don't move
      }
    }
    
    const newIndex = this.rowColToIndex(newRow, col);
    if (newIndex <= this.maxIndex) {
      this.updateIndex(newIndex);
    }
  }

  private moveDown() {
    const { row, col } = this.indexToRowCol(this.currentIndex);
    let newRow = row + 1;
    
    if (newRow >= this.gridLayout.rows) {
      if (this.gridLayout.wraparound) {
        newRow = 0;
      } else {
        return; // Don't move
      }
    }
    
    const newIndex = this.rowColToIndex(newRow, col);
    if (newIndex <= this.maxIndex) {
      this.updateIndex(newIndex);
    }
  }

  private moveLeft() {
    const { row, col } = this.indexToRowCol(this.currentIndex);
    let newCol = col - 1;
    let newRow = row;
    
    if (newCol < 0) {
      if (this.gridLayout.wraparound) {
        newCol = this.gridLayout.cols - 1;
        newRow = row - 1;
        if (newRow < 0) {
          newRow = this.gridLayout.rows - 1;
        }
      } else {
        return; // Don't move
      }
    }
    
    const newIndex = this.rowColToIndex(newRow, newCol);
    if (newIndex <= this.maxIndex) {
      this.updateIndex(newIndex);
    }
  }

  private moveRight() {
    const { row, col } = this.indexToRowCol(this.currentIndex);
    let newCol = col + 1;
    let newRow = row;
    
    if (newCol >= this.gridLayout.cols) {
      if (this.gridLayout.wraparound) {
        newCol = 0;
        newRow = row + 1;
        if (newRow >= this.gridLayout.rows) {
          newRow = 0;
        }
      } else {
        return; // Don't move
      }
    }
    
    const newIndex = this.rowColToIndex(newRow, newCol);
    if (newIndex <= this.maxIndex) {
      this.updateIndex(newIndex);
    }
  }

  private updateIndex(newIndex: number) {
    const oldIndex = this.currentIndex;
    this.currentIndex = newIndex;
    if (oldIndex !== this.currentIndex) {
      const { row, col } = this.indexToRowCol(this.currentIndex);
      this.emit('changed', this.currentIndex, oldIndex, row, col);
    }
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getCurrentPosition(): { row: number; col: number } {
    return this.indexToRowCol(this.currentIndex);
  }

  destroy() {
    this.scene.input.keyboard?.off('keydown', this.keydownListener);
    this.removeAllListeners();
  }
}