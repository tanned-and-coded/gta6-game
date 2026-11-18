// Save and continue, kept in this browser's localStorage only.
// A save holds cash, health, the story progress and the player's spot, so
// Continue on the title screen picks the story up where it stopped.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (!Number.isFinite(data.cash) || !Number.isFinite(data.missionIndex)) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      cash: Math.round(game.player.cash),
      health: Math.round(game.player.health),
      missionIndex: game.missions.index,
      storyDone: game.missions.done,
      hasPistol: game.player.hasPistol,
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): the game still plays.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
