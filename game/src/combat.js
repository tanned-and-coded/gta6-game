// Combat: fists and a pistol. On foot, F throws a punch at whatever is in
// reach; once Jett earns a pistol, holding the mouse button fires toward
// the cursor. Gunfire and violence are loud — pedestrians run and the
// police take an interest. Bullets stop at buildings and cars.

import { COMBAT, WANTED } from './config.js';
import { distance } from './random.js';
import { scarePeds, knockDown } from './pedestrians.js';

export function tryMelee(game) {
  const p = game.player;
  if (p.inCar || game.meleeCooldown > 0) return;
  game.meleeCooldown = 0.34;
  game.muzzle = 0.08;
  game.audio.punch();
  const reachX = p.x + Math.cos(p.angle) * 22;
  const reachY = p.y + Math.sin(p.angle) * 22;
  for (const ped of game.peds) {
    if (ped.state !== 'down' && distance(reachX, reachY, ped.x, ped.y) < COMBAT.meleeRange) {
      ped.health -= COMBAT.meleeDamage;
      scarePeds(game, p.x, p.y, 170);
      if (ped.health <= 0) {
        knockDown(game, ped, false);
        game.addWanted(1, 'Assault reported');
      }
      return;
    }
  }
}

export function tryShoot(game, aimX, aimY) {
  const p = game.player;
  if (p.inCar || !p.hasPistol || game.fireCooldown > 0) return;
  game.fireCooldown = COMBAT.fireCooldown;
  const angle = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = angle;
  game.bullets.push({
    x: p.x + Math.cos(angle) * 18,
    y: p.y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * COMBAT.bulletSpeed,
    vy: Math.sin(angle) * COMBAT.bulletSpeed,
    life: COMBAT.bulletLife,
  });
  game.muzzle = 0.06;
  game.audio.shot();
  scarePeds(game, p.x, p.y, 260);
  game.addWanted(WANTED.shoot, 'Shots fired');
}

export function updateCombat(game, dt) {
  game.fireCooldown = Math.max(0, game.fireCooldown - dt);
  game.meleeCooldown = Math.max(0, game.meleeCooldown - dt);
  game.muzzle = Math.max(0, game.muzzle - dt);
  const kept = [];
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || game.world.circleHitsBuilding(b.x, b.y, 3);
    if (!dead) {
      for (const ped of game.peds) {
        if (ped.state !== 'down' && distance(b.x, b.y, ped.x, ped.y) < 13) {
          ped.health -= 40;
          if (ped.health <= 0) knockDown(game, ped, false);
          else scarePeds(game, ped.x, ped.y, 200);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of [...game.cars, ...game.policeCars]) {
        if (car.driver !== 'player' && distance(b.x, b.y, car.x, car.y) < 26) {
          car.health -= 15;
          if (car.kind === 'police') game.addWanted(1, 'Police under fire');
          dead = true;
          break;
        }
      }
    }
    if (!dead) kept.push(b);
  }
  game.bullets = kept;

  // Dust and sparks: tiny particles that make hits and drifts readable.
  for (const fx of game.particles) {
    fx.x += fx.vx * dt;
    fx.y += fx.vy * dt;
    fx.life -= dt;
  }
  game.particles = game.particles.filter((fx) => fx.life > 0);
  for (const f of game.floaters) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  game.floaters = game.floaters.filter((f) => f.life > 0);
}

export function burst(game, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = game.rng() * Math.PI * 2;
    const s = speed * (0.3 + game.rng() * 0.7);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.3 + game.rng() * 0.3, color, size: 2 + game.rng() * 3,
    });
  }
}
