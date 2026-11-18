// Cars: parked cars waiting to be stolen, traffic that drives the road
// grid on its own, and the driving physics for whichever car the player
// is in. Traffic follows intersection-to-intersection waypoints and
// slows for the car ahead, so the city feels alive without a pathfinder.

import { CAR, CAR_COLORS, TRAFFIC, WANTED } from './config.js';
import { ROAD_V, ROAD_H, roadCenterV, roadCenterH } from './world.js';
import { clamp, distance, pick, angleLerp } from './random.js';

let nextCarId = 1;

export function createCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++, x, y, angle, speed: 0, color,
    kind, // 'traffic' | 'parked' | 'police'
    waypoint: null, health: 100, driver: null, honk: 0,
  };
}

/** Intersections of the road grid, the nodes traffic drives between. */
export function intersections() {
  const points = [];
  for (let i = 0; i < ROAD_V.length; i += 1) {
    for (let j = 0; j < ROAD_H.length; j += 1) {
      points.push({ x: roadCenterV(i), y: roadCenterH(j), i, j });
    }
  }
  points.push({ x: roadCenterV(1), y: 2270, i: 1, j: 3 });
  points.push({ x: roadCenterV(2), y: 2270, i: 2, j: 3 });
  return points;
}

function randomWaypoint(rng, nodes, from) {
  // Prefer a neighbour intersection so cars travel along one road at a time.
  const neighbours = nodes.filter((n) => n !== from
    && ((n.i === from.i) !== (n.j === from.j)));
  return neighbours.length ? pick(rng, neighbours) : pick(rng, nodes);
}

export function spawnCars(world, rng) {
  const cars = [];
  const nodes = intersections();
  for (let k = 0; k < TRAFFIC.count; k += 1) {
    const node = pick(rng, nodes);
    const car = createCar(node.x, node.y, rng() * Math.PI * 2, pick(rng, CAR_COLORS), 'traffic');
    car.waypoint = randomWaypoint(rng, nodes, node);
    car.node = node;
    cars.push(car);
  }
  // Parked cars hug the kerbs beside the roads — free rides for a thief.
  for (let k = 0; k < TRAFFIC.parkedCount; k += 1) {
    let x = 0;
    let y = 0;
    let angle = 0;
    for (let tries = 0; tries < 20; tries += 1) {
      if (rng() > 0.5) {
        const road = pick(rng, ROAD_V);
        x = road + (rng() > 0.5 ? 18 : 142);
        y = 120 + rng() * 1900;
        angle = Math.PI / 2;
      } else {
        const road = pick(rng, ROAD_H);
        y = road + (rng() > 0.5 ? 18 : 142);
        x = 120 + rng() * 2900;
        angle = 0;
      }
      if (!world.circleHitsBuilding(x, y, 30)) break;
    }
    cars.push(createCar(x, y, angle, pick(rng, CAR_COLORS), 'parked'));
  }
  return cars;
}

export function nearestCar(game, range) {
  let best = null;
  let bestD = range;
  for (const car of game.cars) {
    if (car.driver === 'player') continue;
    const d = distance(game.player.x, game.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  for (const car of game.policeCars) {
    const d = distance(game.player.x, game.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Steal or borrow the nearest car. Theft is a crime: it raises wanted. */
export function enterCar(game, car) {
  car.driver = 'player';
  if (car.kind === 'traffic') {
    car.kind = 'stolen';
    game.addWanted(WANTED.theft, 'Car theft reported');
  } else if (car.kind === 'police') {
    car.kind = 'stolen';
    game.addWanted(2, 'Police car stolen');
  } else if (car.kind === 'parked') {
    car.kind = 'stolen';
    if (game.rng() < 0.55) game.addWanted(WANTED.theft, 'Car theft reported');
  }
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.audio.door();
}

export function exitCar(game) {
  const car = game.player.inCar;
  if (!car) return;
  car.driver = null;
  if (car.kind === 'stolen') car.kind = 'parked';
  game.player.inCar = null;
  game.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  game.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  const fixed = game.world.resolveCollision(game.player.x, game.player.y, 13);
  game.player.x = clamp(fixed.x, 20, game.world.width - 20);
  game.player.y = clamp(fixed.y, 20, game.world.height - 20);
  game.audio.door();
}

/** Arcade driving for the player's car: throttle, brake, steering. */
export function drivePlayerCar(game, dt, axes) {
  const car = game.player.inCar;
  if (!car) return;
  const forward = -axes.y;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
  }
  car.speed = clamp(car.speed, -CAR.reverseSpeed, CAR.maxSpeed);
  car.speed *= Math.pow(CAR.drag, dt * 60 * 0.16);
  if (Math.abs(car.speed) < 2 && forward === 0) car.speed = 0;
  const steer = axes.x * CAR.turnRate * (car.speed / CAR.maxSpeed);
  car.angle += steer * dt * (car.speed < 0 ? -1 : 1);
  moveCar(game, car, dt, true);
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = car.angle;
}

/** Shared car motion with building collision and car-to-car bumps. */
export function moveCar(game, car, dt, isPlayer) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = game.world.circleHitsBuilding(nx, ny, 24);
  if (hit) {
    if (Math.abs(car.speed) > 160) {
      game.audio.crash();
      if (isPlayer) game.hurtPlayer(4);
      car.health -= 12;
      game.shake = Math.min(10, Math.abs(car.speed) / 40);
    }
    car.speed *= -0.25;
    return;
  }
  car.x = clamp(nx, 30, game.world.width - 30);
  car.y = clamp(ny, 30, game.world.height - 30);
  // Bumping another car: both slow, metal crunches, police notice rams.
  const others = isPlayer ? [...game.cars, ...game.policeCars] : game.cars;
  for (const other of others) {
    if (other === car) continue;
    if (distance(car.x, car.y, other.x, other.y) < 44) {
      if (Math.abs(car.speed) > 120) {
        game.audio.crash();
        other.health -= 8;
        car.speed *= 0.45;
        if (isPlayer && other.kind === 'police') game.addWanted(WANTED.ramPolice, 'Police car rammed');
        if (isPlayer) game.shake = 6;
      } else {
        car.speed *= 0.8;
      }
      const push = Math.atan2(car.y - other.y, car.x - other.x);
      car.x += Math.cos(push) * 3;
      car.y += Math.sin(push) * 3;
    }
  }
}

/** Traffic cars cruise between intersections and queue behind each other. */
export function updateTraffic(game, dt) {
  const nodes = game.nodes;
  for (const car of game.cars) {
    if (car.kind !== 'traffic' || car.driver) continue;
    if (!car.waypoint) {
      car.node = nearestNode(nodes, car);
      car.waypoint = randomWaypoint(game.rng, nodes, car.node);
    }
    const target = car.waypoint;
    const dist = distance(car.x, car.y, target.x, target.y);
    if (dist < 46) {
      car.node = target;
      car.waypoint = randomWaypoint(game.rng, nodes, target);
      continue;
    }
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    car.angle = angleLerp(car.angle, want, clamp(dt * 3.2, 0, 1));
    let speed = TRAFFIC.speed * (0.8 + (car.id % 5) * 0.08);
    // Slow down if another car or the player is right ahead, and never
    // drive into a car that is close in any direction (junction queues).
    const aheadX = car.x + Math.cos(car.angle) * 58;
    const aheadY = car.y + Math.sin(car.angle) * 58;
    for (const other of game.cars) {
      if (other === car) continue;
      if (distance(aheadX, aheadY, other.x, other.y) < 40) speed = 30;
      if (distance(car.x, car.y, other.x, other.y) < 50) speed = Math.min(speed, 12);
    }
    if (!game.player.inCar && distance(aheadX, aheadY, game.player.x, game.player.y) < 34) speed = 0;
    if (game.player.inCar && distance(aheadX, aheadY, game.player.inCar.x, game.player.inCar.y) < 44) speed = 40;
    car.speed += clamp(speed - car.speed, -260 * dt, 200 * dt);
    moveCar(game, car, dt, false);
  }
}

function nearestNode(nodes, car) {
  let best = nodes[0];
  let bestD = Infinity;
  for (const n of nodes) {
    const d = distance(car.x, car.y, n.x, n.y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
