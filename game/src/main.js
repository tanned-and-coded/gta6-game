// Harborline — boot and the one game loop.
// The world advances in fixed 1/60 s steps whatever the display rate;
// input is read every frame; the renderer paints what is there. Screens:
// title (New Game / Continue), play, paused, and game over.
//
// ?seed=N fixes the city layout. ?shot=cover|city|drive|chase (with
// &seed=N) stages a frozen scene instead of running the loop, paints it
// and sets window.__shotReady for a screenshot.

import { PLAYER, STEP, VIEW } from './config.js';
import { createRandom, clamp, distance } from './random.js';
import { createWorld } from './world.js';
import { spawnCars, intersections, nearestCar, enterCar, exitCar, drivePlayerCar, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { addWanted, updatePolice } from './police.js';
import { tryMelee, tryShoot, updateCombat } from './combat.js';
import { createMissionState, updateMissions } from './missions.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { drawHUD } from './hud.js';
import { drawWorld, drawTitleScreen, drawPausedScreen, drawOverScreen, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_MELEE, createInput } from './input.js';
import { stageScene } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(
    (canvas.width / VIEW.width), 0, 0, (canvas.height / VIEW.height), 0, 0,
  );
}
window.addEventListener('resize', resize);
resize();

function createGame(saved) {
  const rng = createRandom(seed);
  const world = createWorld(rng);
  const game = {
    rng, world, time: 0,
    player: {
      x: PLAYER.startX, y: PLAYER.startY, angle: -Math.PI / 2,
      health: PLAYER.maxHealth, cash: PLAYER.startCash,
      inCar: null, hasPistol: false,
    },
    cars: [], policeCars: [], peds: [],
    bullets: [], particles: [], floaters: [],
    wanted: 0, heatTimer: 0, coolTimer: 0, spawnTimer: 0,
    notice: '', noticeTimer: 0, prompt: '',
    missions: createMissionState(),
    fireCooldown: 0, meleeCooldown: 0, muzzle: 0,
    shake: 0, shakeOffset: { x: 0, y: 0 }, camera: { x: 0, y: 0 },
    audio: createAudio(), nodes: intersections(),
  };
  game.cars = spawnCars(world, rng);
  game.peds = spawnPeds(world, rng);
  game.addWanted = (amount, reason) => addWanted(game, amount, reason);
  game.hurtPlayer = (amount) => {
    if (game.player.health <= 0) return;
    game.player.health -= amount;
    game.audio.hurt();
    game.shake = Math.max(game.shake, 4);
  };
  if (saved) {
    game.player.cash = saved.cash;
    game.player.health = clamp(saved.health || 100, 20, 100);
    game.player.hasPistol = Boolean(saved.hasPistol);
    game.player.x = saved.x || PLAYER.startX;
    game.player.y = saved.y || PLAYER.startY;
    game.missions.index = clamp(saved.missionIndex || 0, 0, 4);
    game.missions.done = Boolean(saved.storyDone);
  }
  return game;
}

let game = createGame(null);
let screen = SCREEN_TITLE;
const input = createInput(canvas);

function announce(message) {
  if (status) status.textContent = message;
}

function startNewGame() {
  clearSave();
  game = createGame(null);
  screen = SCREEN_PLAY;
  game.notice = 'Jett Marlowe, courier. Follow the gold marker to your first job.';
  game.noticeTimer = 5;
  game.audio.click();
  announce('Harborline. New game started.');
}

function continueGame() {
  const saved = loadSave();
  if (!saved) return;
  game = createGame(saved);
  screen = SCREEN_PLAY;
  game.notice = 'Welcome back to Port Azura.';
  game.noticeTimer = 3;
  game.audio.click();
  announce('Harborline. Saved game loaded.');
}

function gameOver() {
  screen = SCREEN_OVER;
  game.wanted = 0;
  game.policeCars.length = 0;
  announce('Wasted. Press Enter to get back up.');
}

function revive() {
  game.player.health = 100;
  game.player.cash = Math.max(0, game.player.cash - 60);
  game.player.inCar = null;
  game.player.x = PLAYER.startX;
  game.player.y = PLAYER.startY;
  screen = SCREEN_PLAY;
  writeSave(game);
}

function updatePrompt() {
  const p = game.player;
  if (p.inCar) {
    game.prompt = Math.abs(p.inCar.speed) < 120 ? 'E — Get out' : '';
    return;
  }
  const car = nearestCar(game, 62);
  game.prompt = car ? 'E — Enter car' : '';
}

function stepPlay(dt) {
  const p = game.player;
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    screen = SCREEN_PAUSED;
    announce('Paused.');
    writeSave(game);
    return;
  }
  if (actions & ACTION_INTERACT) {
    if (p.inCar) {
      if (Math.abs(p.inCar.speed) < 120) exitCar(game);
    } else {
      const car = nearestCar(game, 62);
      if (car) enterCar(game, car);
    }
  }
  if (actions & ACTION_MELEE) tryMelee(game);

  const axes = input.moveAxes();
  if (p.inCar) {
    drivePlayerCar(game, dt, axes);
  } else {
    const speed = input.running() ? 320 : 215;
    if (axes.x !== 0 || axes.y !== 0) {
      const len = Math.hypot(axes.x, axes.y) || 1;
      const nx = p.x + (axes.x / len) * speed * dt;
      const ny = p.y + (axes.y / len) * speed * dt;
      if (!game.world.isWater(nx, ny)) {
        const fixed = game.world.resolveCollision(nx, ny, 13);
        p.x = clamp(fixed.x, 16, game.world.width - 16);
        p.y = clamp(fixed.y, 16, game.world.height - 16);
      }
      p.angle = Math.atan2(axes.y, axes.x);
    }
    if (p.hasPistol) {
      const aimX = game.camera.x + input.mouse.x;
      const aimY = game.camera.y + input.mouse.y;
      if (input.mouse.down) tryShoot(game, aimX, aimY);
      else if (axes.x === 0 && axes.y === 0) p.angle = Math.atan2(aimY - p.y, aimX - p.x);
    }
  }

  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateCombat(game, dt);
  updateMissions(game, dt);
  updatePrompt();

  if (game.noticeTimer > 0) game.noticeTimer -= dt;
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 26);
  game.shakeOffset.x = (game.rng() - 0.5) * game.shake;
  game.shakeOffset.y = (game.rng() - 0.5) * game.shake;
  if (p.health <= 0) gameOver();
  // Slow recovery once the heat is off.
  if (game.wanted === 0 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + dt * 1.6);
  }
}

function draw() {
  window.__harborline = game; // a handle for automated play-tests
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (screen === SCREEN_TITLE) drawTitleScreen(ctx, game, Boolean(loadSaveCached()));
  else if (screen === SCREEN_PAUSED) drawPausedScreen(ctx, game);
  else if (screen === SCREEN_OVER) drawOverScreen(ctx, game);
  else {
    drawWorld(ctx, game);
    drawHUD(ctx, game);
  }
}

let saveCache = undefined;
function loadSaveCached() {
  if (saveCache === undefined) saveCache = loadSave();
  return saveCache;
}
window.addEventListener('keydown', (event) => {
  if (screen === SCREEN_TITLE && event.code === 'KeyC' && loadSaveCached()) continueGame();
});

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actionsPeek = screen !== SCREEN_PLAY;
    if (actionsPeek) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        game.audio.unlock();
        if (screen === SCREEN_TITLE) startNewGame();
        else if (screen === SCREEN_OVER) revive();
        else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
      }
    }
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepPlay(STEP);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
      game.time += 1 / 60;
      if (screen === SCREEN_TITLE) updateTraffic(game, STEP);
    }
    draw();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave(game);
    }
  });
  announce('Harborline. Press Enter for a new game.');
  requestAnimationFrame(frame);
}

function runShot(name) {
  screen = stageScene(game, name) === 'title' ? SCREEN_TITLE : SCREEN_PLAY;
  const steps = name === 'drive' ? 50 : 100;
  for (let i = 0; i < steps; i += 1) {
    game.time += STEP;
    if (game.player.inCar && screen === SCREEN_PLAY) {
      // Keep the staged drive rolling straight down the avenue.
      const car = game.player.inCar;
      car.speed = name === 'chase' ? 330 : 300;
      car.x += Math.cos(car.angle) * car.speed * STEP;
      car.y += Math.sin(car.angle) * car.speed * STEP;
      game.player.x = car.x;
      game.player.y = car.y;
    }
    updateTraffic(game, STEP);
    updatePeds(game, STEP);
    if (name === 'chase') {
      for (const cop of game.policeCars) {
        const want = Math.atan2(game.player.y - cop.y, game.player.x - cop.x);
        cop.angle = want;
        cop.x += Math.cos(cop.angle) * 300 * STEP;
        cop.y += Math.sin(cop.angle) * 300 * STEP;
        cop.flash = (cop.flash || 0) + STEP * 9;
      }
    }
    updateCombat(game, STEP);
  }
  let painted = 0;
  function paint() {
    draw();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
