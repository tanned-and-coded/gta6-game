// Wanted level and the Port Azura police. Crimes raise the stars; patrol
// cars spawn off-screen and hunt the player, steering for an intercept
// point and ramming on contact. Stay out of their sight — no police car
// close by — and the heat cools one star at a time until it is gone.

import { POLICE, WANTED } from './config.js';
import { createCar, moveCar } from './vehicles.js';
import { clamp, distance, angleLerp } from './random.js';

export function addWanted(game, amount, reason) {
  const before = game.wanted;
  game.wanted = clamp(game.wanted + amount, 0, WANTED.max);
  if (game.wanted > before) {
    game.heatTimer = 0;
    game.notice = reason;
    game.noticeTimer = 3;
    game.audio.siren(0);
  }
}

export function updatePolice(game, dt) {
  game.heatTimer += dt;
  const targetCount = game.wanted === 0 ? 0 : Math.min(POLICE.maxCars, game.wanted);
  const px = game.player.x;
  const py = game.player.y;

  // Spawn patrol cars just out of view until the wanted level is matched.
  game.spawnTimer -= dt;
  if (game.policeCars.length < targetCount && game.spawnTimer <= 0) {
    game.spawnTimer = 1.6;
    const angle = game.rng() * Math.PI * 2;
    let x = clamp(px + Math.cos(angle) * POLICE.spawnDistance, 60, game.world.width - 60);
    let y = clamp(py + Math.sin(angle) * POLICE.spawnDistance, 60, game.world.height - 60);
    if (game.world.circleHitsBuilding(x, y, 26)) {
      x = px + (px > 1600 ? -560 : 560);
      y = py;
    }
    const car = createCar(x, y, Math.atan2(py - y, px - x), '#ffffff', 'police');
    car.flash = game.rng() * Math.PI;
    game.policeCars.push(car);
  }

  let nearest = Infinity;
  for (const car of game.policeCars) {
    const d = distance(car.x, car.y, px, py);
    nearest = Math.min(nearest, d);
    // Aim a little ahead of a moving target so pursuits cut corners.
    const lead = game.player.inCar ? clamp(d / 300, 0, 0.5) : 0;
    const tx = px + Math.cos(game.player.angle) * (game.player.inCar ? game.player.inCar.speed * lead : 0);
    const ty = py + Math.sin(game.player.angle) * (game.player.inCar ? game.player.inCar.speed * lead : 0);
    const want = Math.atan2(ty - car.y, tx - car.x);
    car.angle = angleLerp(car.angle, want, clamp(dt * 2.6, 0, 1));
    const topSpeed = POLICE.speed * (0.82 + game.wanted * 0.05);
    car.speed += clamp(topSpeed - car.speed, -300 * dt, 240 * dt);
    const beforeX = car.x;
    const beforeY = car.y;
    moveCar(game, car, dt, false);
    // Ram: contact at speed hurts whoever is being chased.
    if (d < 46 && Math.abs(car.speed) > 120) {
      game.hurtPlayer(game.player.inCar ? POLICE.ramDamage * 0.55 : POLICE.ramDamage);
      game.audio.crash();
      game.shake = Math.max(game.shake, 7);
      car.speed *= 0.4;
      if (game.player.inCar) game.player.inCar.speed *= 0.55;
    }
    // A stuck patrol car teleports back into the hunt rather than idling.
    if (Math.abs(car.x - beforeX) + Math.abs(car.y - beforeY) < 0.2 && d > 200) {
      car.stuck = (car.stuck || 0) + dt;
      if (car.stuck > 2.2) {
        car.x = clamp(px + (game.rng() - 0.5) * 700, 60, game.world.width - 60);
        car.y = clamp(py + (game.rng() - 0.5) * 700, 60, game.world.height - 60);
        car.stuck = 0;
      }
    } else {
      car.stuck = 0;
    }
    car.flash += dt * 9;
  }

  // Out of sight, out of mind: heat cools while no patrol is close.
  if (game.wanted > 0 && nearest > 380) {
    game.coolTimer += dt;
    if (game.coolTimer > POLICE.decaySeconds) {
      game.coolTimer = 0;
      game.wanted -= 1;
      game.notice = game.wanted === 0 ? 'You lost the police' : 'Heat is cooling';
      game.noticeTimer = 2.5;
      if (game.wanted === 0) game.policeCars.length = 0;
    }
  } else {
    game.coolTimer = Math.max(0, game.coolTimer - dt * 2);
  }

  if (game.wanted === 0) game.policeCars.length = 0;
  if (game.wanted > 0) game.audio.siren(dt);
}
