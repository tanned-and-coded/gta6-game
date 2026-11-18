// Screenshot staging behind ?shot=<name>&seed=<n>. Each scene arranges
// the real game state — player, cars, pedestrians, police, mission — and
// main.js then runs the ordinary simulation for a moment and paints the
// ordinary frame, so a screenshot is exactly what playing looks like.

import { createCar } from './vehicles.js';

/** Put a knot of pedestrians and traffic around a spot for a busy frame. */
function crowdAround(game, x, y) {
  game.peds.forEach((ped, i) => {
    if (i < 7) {
      ped.x = x + ((i % 4) - 1.5) * 55;
      ped.y = y + (i < 4 ? -46 : 52);
      ped.tx = ped.x + 120;
      ped.ty = ped.y;
      ped.state = 'walk';
    }
  });
  const traffic = game.cars.filter((c) => c.kind === 'traffic');
  traffic.forEach((car, i) => {
    if (i < 4) {
      car.x = x + (i - 1.5) * 190;
      car.y = 1240;
      car.angle = i % 2 === 0 ? 0 : Math.PI;
      car.waypoint = null;
    }
  });
}

function putPlayerInCar(game, x, y, angle, speed) {
  const car = createCar(x, y, angle, '#e74c3c', 'stolen');
  car.driver = 'player';
  car.speed = speed;
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
}

export function stageScene(game, name) {
  const p = game.player;
  if (name === 'cover') {
    // The title screen floats over a live downtown corner.
    p.x = 1150;
    p.y = 1090;
    p.angle = 0.6;
    crowdAround(game, 1240, 1150);
    game.missions.active = false;
    return 'title';
  }
  if (name === 'city') {
    // On foot downtown: peds, traffic, the first job on the HUD.
    p.x = 1150;
    p.y = 1096;
    p.angle = 0.4;
    p.hasPistol = true;
    crowdAround(game, 1240, 1150);
    game.missions.active = true;
    game.missions.stage = 0;
    return 'play';
  }
  if (name === 'drive') {
    // Cruising east through downtown: one car ahead in the same lane, one
    // oncoming, one behind — spaced so the frame reads as flowing traffic.
    putPlayerInCar(game, 980, 1272, 0, 300);
    p.hasPistol = true;
    const traffic = game.cars.filter((c) => c.kind === 'traffic');
    const spots = [
      { x: 1330, y: 1272, angle: 0 },
      { x: 1560, y: 1208, angle: Math.PI },
      { x: 700, y: 1272, angle: 0 },
      { x: 1150, y: 440, angle: Math.PI / 2 },
    ];
    traffic.forEach((car, i) => {
      if (spots[i]) {
        car.x = spots[i].x;
        car.y = spots[i].y;
        car.angle = spots[i].angle;
        car.speed = 120;
        car.waypoint = null;
        car.node = null;
      }
    });
    game.peds.forEach((ped, i) => {
      if (i < 5) {
        ped.x = 1180 + i * 46;
        ped.y = 1130;
        ped.tx = ped.x + 90;
        ped.ty = ped.y;
        ped.state = 'walk';
      }
    });
    game.missions.index = 0;
    game.missions.active = true;
    game.missions.stage = 1;
    game.missions.timer = 64;
    return 'play';
  }
  if (name === 'chase') {
    // The Final Tide gone wrong: three stars, patrol cars on the bumper.
    putPlayerInCar(game, 1500, 1272, 0, 330);
    p.hasPistol = true;
    p.cash = 640;
    game.wanted = 3;
    game.missions.index = 3;
    game.missions.active = true;
    game.missions.stage = 1;
    const spots = [
      { x: 1330, y: 1210 }, { x: 1300, y: 1330 }, { x: 1620, y: 1180 },
    ];
    for (const s of spots) {
      const cop = createCar(s.x, s.y, 0, '#ffffff', 'police');
      cop.speed = 300;
      cop.flash = s.x;
      game.policeCars.push(cop);
    }
    crowdAround(game, 1900, 1150);
    game.notice = 'Police pursuit — lose them!';
    game.noticeTimer = 999;
    return 'play';
  }
  return 'play';
}
