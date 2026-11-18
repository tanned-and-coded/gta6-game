// Pedestrians: Port Azura's walkers. They stroll the sidewalks and the
// promenade between random waypoints, chat in pairs, flee from gunfire,
// reckless cars and flying fists, and drop a little cash when knocked
// down. Running one over is very much a crime.

import { PEDS, WANTED } from './config.js';
import { ROAD_V, ROAD_H, HARBOR_Y } from './world.js';
import { clamp, distance, pick } from './random.js';

const SHIRTS = ['#ff6b81', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#c8d6e5', '#10ac84'];

export function spawnPeds(world, rng) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const ped = {
      x: 0, y: 0, angle: rng() * Math.PI * 2,
      tx: 0, ty: 0, speed: PEDS.speed * (0.7 + rng() * 0.6),
      shirt: pick(rng, SHIRTS), health: 60, state: 'walk',
      fleeTimer: 0, downTimer: 0, waitTimer: rng() * 2,
    };
    placePed(world, rng, ped);
    ped.tx = ped.x;
    ped.ty = ped.y;
    peds.push(ped);
  }
  return peds;
}

function placePed(world, rng, ped) {
  for (let tries = 0; tries < 30; tries += 1) {
    let x;
    let y;
    if (rng() < 0.3) {
      x = 80 + rng() * (world.width - 160);
      y = HARBOR_Y + 8 + rng() * 40; // the promenade
    } else if (rng() < 0.5) {
      x = pick(rng, ROAD_V) - 14 + rng() * 8;
      y = 80 + rng() * 2000;
    } else {
      x = 80 + rng() * (world.width - 160);
      y = pick(rng, ROAD_H) - 14 + rng() * 8;
    }
    if (!world.circleHitsBuilding(x, y, 14) && !world.isWater(x, y)) {
      ped.x = x;
      ped.y = y;
      return;
    }
  }
  ped.x = 1240;
  ped.y = 1060;
}

function newTarget(world, rng, ped) {
  const nx = clamp(ped.x + (rng() - 0.5) * 700, 50, world.width - 50);
  const ny = clamp(ped.y + (rng() - 0.5) * 700, 50, HARBOR_Y + 46);
  if (!world.circleHitsBuilding(nx, ny, 14)) {
    ped.tx = nx;
    ped.ty = ny;
  }
}

export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.state !== 'down' && distance(x, y, ped.x, ped.y) < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 2.4;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

export function updatePeds(game, dt) {
  const playerCar = game.player.inCar;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.health = 60;
        placePed(game.world, game.rng, ped);
      }
      continue;
    }
    // A fast car nearby is reason enough to run.
    if (playerCar && Math.abs(playerCar.speed) > 200
      && distance(ped.x, ped.y, playerCar.x, playerCar.y) < 90) {
      ped.state = 'flee';
      ped.fleeTimer = 1.2;
      ped.angle = Math.atan2(ped.y - playerCar.y, ped.x - playerCar.x);
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      movePed(game, ped, dt, PEDS.speed * 2.3);
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      continue;
    }
    if (ped.waitTimer > 0) {
      ped.waitTimer -= dt;
      continue;
    }
    if (distance(ped.x, ped.y, ped.tx, ped.ty) < 16) {
      if (game.rng() < 0.3) ped.waitTimer = 1 + game.rng() * 3;
      newTarget(game.world, game.rng, ped);
    }
    ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    movePed(game, ped, dt, ped.speed);
    // Stepped in front of the player's car? That's a hit-and-run.
    if (playerCar && Math.abs(playerCar.speed) > 60
      && distance(ped.x, ped.y, playerCar.x, playerCar.y) < 30) {
      knockDown(game, ped, true);
    }
  }
}

function movePed(game, ped, dt, speed) {
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (game.world.isWater(nx, ny)) {
    ped.angle += Math.PI;
    return;
  }
  const fixed = game.world.resolveCollision(nx, ny, 11);
  ped.x = clamp(fixed.x, 16, game.world.width - 16);
  ped.y = clamp(fixed.y, 16, game.world.height - 16);
  if (fixed.hit) newTarget(game.world, game.rng, ped);
}

export function knockDown(game, ped, byCar) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 9;
  if (byCar) {
    game.addWanted(WANTED.hitPed, 'Hit and run');
    game.audio.crash();
    game.shake = Math.max(game.shake, 5);
  }
  game.player.cash += 6;
  game.floaters.push({ x: ped.x, y: ped.y - 20, text: '+$6', life: 1, color: '#8be26b' });
  scarePeds(game, ped.x, ped.y, 190);
}
