// Keyboard and mouse input for Harborline.
// Held keys drive movement and driving; one-shot presses (interact, pause,
// confirm) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The mouse
// position is tracked in view coordinates for aiming the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MELEE = 8;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const MELEE = new Set(['KeyF']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    if (!event.repeat) {
      if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
      else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
      else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
      else if (MELEE.has(event.code)) actions |= ACTION_MELEE;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 800;
  }
  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    /** Movement axes from WASD or the arrow keys: x and y in -1..1. */
    moveAxes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0)
        - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0)
        - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
