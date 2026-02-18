interface Controllable {
  moveLeft(): void;
  moveUp(): void;
  moveRight(): void;
  moveDown(): void;
  rotateCounterClockwise(): void;
  rotateClockwise(): void;
}

export function triggerKeyboardOn(target: Controllable): void {
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    switch (event.keyCode) {
      case 37: // Left
        target.moveLeft();
        break;
      case 38: // Up
        target.moveUp();
        break;
      case 39: // Right
        target.moveRight();
        break;
      case 40: // Down
        target.moveDown();
        break;
      case 65: // a
        target.rotateCounterClockwise();
        break;
      case 68: // d
        target.rotateClockwise();
        break;
    }
  }, false);
}
