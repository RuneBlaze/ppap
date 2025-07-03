
/**
 * Manages keyboard navigation state for a list of elements.
 * It does not handle any visuals, but emits events that UI components can listen to.
 * Events:
 * - 'changed' (newIndex: number, oldIndex: number)
 * - 'activated' (index: number)
 * - 'cancelled'
 */
export class NavigationController extends Phaser.Events.EventEmitter {
  private currentIndex = 0;
  private maxIndex = 0;
  private keydownListener: (event: KeyboardEvent) => void;
  private active = true;

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    super();
    this.scene = scene;
    this.keydownListener = this.handleKeyDown.bind(this);
    this.scene.input.keyboard?.on('keydown', this.keydownListener);
  }

  setActive(isActive: boolean) {
    this.active = isActive;
  }

  setItems(numberOfItems: number) {
    this.maxIndex = numberOfItems - 1;
    this.currentIndex = 0;
    this.emit('changed', this.currentIndex, -1);
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.maxIndex < 0 || !this.active) return;

    switch (event.key) {
      case 'ArrowUp':
        this.movePrevious();
        break;
      case 'ArrowDown':
        this.moveNext();
        break;
      case 'Enter':
        this.emit('activated', this.currentIndex);
        break;
      case 'Escape':
        this.emit('cancelled');
        break;
    }
  }

  private moveNext() {
    const oldIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) > this.maxIndex ? 0 : this.currentIndex + 1;
    if (oldIndex !== this.currentIndex) {
      this.emit('changed', this.currentIndex, oldIndex);
    }
  }

  private movePrevious() {
    const oldIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex - 1) < 0 ? this.maxIndex : this.currentIndex - 1;
    if (oldIndex !== this.currentIndex) {
      this.emit('changed', this.currentIndex, oldIndex);
    }
  }

  destroy() {
    this.scene.input.keyboard?.off('keydown', this.keydownListener);
    this.removeAllListeners();
  }
} 