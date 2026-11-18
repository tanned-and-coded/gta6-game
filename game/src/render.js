// Drawing: the world through a camera that follows the player, then the
// screens on top of it. Port Azura is drawn in flat sun-soaked shapes —
// sand, water with a pier, asphalt with lane dashes and crosswalks,
// pastel buildings with shaded roofs, palm trees, and little rounded
// cars and walkers — so a single frame reads as a living city.

import { FONT, PALETTE, VIEW } from './config.js';
import { ROAD_V, ROAD_H, ROAD_W, HARBOR_Y } from './world.js';
import { missionMarker } from './missions.js';
import { drawHUD } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createCamera(game) {
  const focus = game.player.inCar || game.player;
  const x = Math.max(0, Math.min(game.world.width - VIEW.width, focus.x - VIEW.width / 2 + (game.shakeOffset?.x || 0)));
  const y = Math.max(0, Math.min(game.world.height - VIEW.height, focus.y - VIEW.height / 2 + (game.shakeOffset?.y || 0)));
  return { x, y };
}

function drawGround(ctx, world, cam) {
  ctx.fillStyle = PALETTE.blockGround;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Water south of the harbour line, with a lighter shoreline.
  const wy = HARBOR_Y + 60 - cam.y;
  if (wy < VIEW.height) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, Math.max(0, wy), VIEW.width, VIEW.height - Math.max(0, wy));
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 6; i += 1) {
      const yy = wy + 30 + i * 42 + Math.sin(i * 7) * 6;
      if (yy > 0 && yy < VIEW.height) ctx.fillRect(0, yy, VIEW.width, 5);
    }
  }
  if (wy > 0) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, Math.max(0, HARBOR_Y - cam.y), VIEW.width, Math.min(60, wy));
  }
  // The pier.
  ctx.fillStyle = '#a9805a';
  ctx.fillRect(world.pier.x - cam.x, world.pier.y - cam.y, world.pier.w, world.pier.h);
  ctx.fillStyle = '#8a6844';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(world.pier.x - cam.x, world.pier.y - cam.y + i * 32, world.pier.w, 4);
  }
}

function drawRoads(ctx, world, cam) {
  ctx.fillStyle = PALETTE.road;
  for (const r of ROAD_V) ctx.fillRect(r - cam.x, -cam.y, ROAD_W, world.height);
  for (const r of ROAD_H) ctx.fillRect(-cam.x, r - cam.y, world.width, ROAD_W);
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(-cam.x, HARBOR_Y - cam.y, world.width, 60); // promenade road
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const r of ROAD_V) {
    for (let y = 20; y < world.height; y += 56) {
      if (y - cam.y > -40 && y - cam.y < VIEW.height) ctx.fillRect(r + ROAD_W / 2 - 3 - cam.x, y - cam.y, 6, 30);
    }
  }
  for (const r of ROAD_H) {
    for (let x = 20; x < world.width; x += 56) {
      if (x - cam.x > -40 && x - cam.x < VIEW.width) ctx.fillRect(x - cam.x, r + ROAD_W / 2 - 3 - cam.y, 30, 6);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const rv of ROAD_V) {
    for (const rh of ROAD_H) {
      for (let i = 0; i < 5; i += 1) {
        ctx.fillRect(rv + 8 + i * 30 - cam.x, rh + 6 - cam.y, 16, 10);
        ctx.fillRect(rv + 8 + i * 30 - cam.x, rh + ROAD_W - 16 - cam.y, 16, 10);
      }
    }
  }
  // Sidewalk rims around blocks read as pale borders along the roads.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 7;
  for (const r of ROAD_V) {
    ctx.strokeRect(r - 4 - cam.x, -cam.y - 4, ROAD_W + 8, world.height + 8);
  }
  for (const r of ROAD_H) {
    ctx.strokeRect(-cam.x - 4, r - 4 - cam.y, world.width + 8, ROAD_W + 8);
  }
}

function drawBuildings(ctx, world, cam) {
  for (const b of world.buildings) {
    const x = b.x - cam.x;
    const y = b.y - cam.y;
    if (x + b.w < -30 || y + b.h < -30 || x > VIEW.width + 30 || y > VIEW.height + 30) continue;
    ctx.fillStyle = 'rgba(90, 60, 30, 0.25)'; // sun shadow
    ctx.fillRect(x + 9, y + 11, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(x + 7, y + 7, b.w - 14, b.h - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const vents = 1 + (b.floors % 3);
    for (let i = 0; i < vents; i += 1) {
      ctx.fillRect(x + 16 + i * 34, y + 16, 18, 12);
    }
    ctx.fillStyle = 'rgba(40,30,20,0.55)';
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'center';
    if (b.w > 90 && b.h > 60) ctx.fillText('AZURA', x + b.w / 2, y + b.h / 2 + 4);
  }
}

function drawNature(ctx, world, cam) {
  for (const lamp of world.lamps) {
    const x = lamp.x - cam.x;
    const y = lamp.y - cam.y;
    if (x < -20 || y < -20 || x > VIEW.width + 20 || y > VIEW.height + 20) continue;
    ctx.fillStyle = PALETTE.lampGlow;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.lampPost;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  for (const prop of world.props) {
    const x = prop.x - cam.x;
    const y = prop.y - cam.y;
    if (x < -20 || y < -20 || x > VIEW.width + 20 || y > VIEW.height + 20) continue;
    ctx.fillStyle = '#9c6b46';
    ctx.fillRect(x - 12, y - 4, 24, 7);
  }
  for (const palm of world.palms) {
    const x = palm.x - cam.x;
    const y = palm.y - cam.y;
    if (x < -40 || y < -40 || x > VIEW.width + 40 || y > VIEW.height + 40) continue;
    ctx.fillStyle = 'rgba(90,60,30,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 6, 15 * palm.s, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4, y - 12 * palm.s, x + 8, y - 20 * palm.s);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palmLeaf;
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x + 8, y - 20 * palm.s);
      ctx.quadraticCurveTo(
        x + 8 + Math.cos(a) * 14 * palm.s, y - 20 * palm.s + Math.sin(a) * 8 - 5,
        x + 8 + Math.cos(a) * 22 * palm.s, y - 20 * palm.s + Math.sin(a) * 13,
      );
      ctx.stroke();
    }
  }
}

export function drawCarShape(ctx, car, cam, time) {
  const x = car.x - cam.x;
  const y = car.y - cam.y;
  if (x < -70 || y < -70 || x > VIEW.width + 70 || y > VIEW.height + 70) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(40,30,20,0.3)';
  ctx.beginPath();
  ctx.roundRect(-24, -10, 54, 27, 8);
  ctx.fill();
  ctx.fillStyle = car.kind === 'police' ? '#f4f6f8' : car.color;
  ctx.beginPath();
  ctx.roundRect(-27, -13, 54, 27, 8);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = PALETTE.police;
    ctx.fillRect(-8, -13, 18, 27);
  }
  ctx.fillStyle = '#bfe6f2'; // windshield and rear window
  ctx.fillRect(6, -10, 9, 20);
  ctx.fillRect(-16, -10, 7, 20);
  ctx.fillStyle = '#2c3440'; // cabin
  ctx.fillRect(-7, -11, 13, 22);
  ctx.fillStyle = '#ffe9a8'; // headlights
  ctx.fillRect(24, -11, 4, 6);
  ctx.fillRect(24, 5, 4, 6);
  ctx.fillStyle = '#ff6b6b'; // tail lights
  ctx.fillRect(-28, -11, 3, 6);
  ctx.fillRect(-28, 5, 3, 6);
  if (car.kind === 'police') {
    const flash = Math.sin((car.flash || 0)) > 0;
    ctx.fillStyle = flash ? PALETTE.policeLightA : PALETTE.policeLightB;
    ctx.beginPath();
    ctx.arc(0, -6, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? PALETTE.policeLightB : PALETTE.policeLightA;
    ctx.beginPath();
    ctx.arc(0, 6, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(12, 0, 8 + Math.sin(time * 7 + car.id) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPeds(ctx, game, cam) {
  for (const ped of game.peds) {
    const x = ped.x - cam.x;
    const y = ped.y - cam.y;
    if (x < -30 || y < -30 || x > VIEW.width + 30 || y > VIEW.height + 30) continue;
    if (ped.state === 'down') {
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(x, y, 15, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(90,60,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 5, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath();
    ctx.arc(x + Math.cos(ped.angle) * 3, y + Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, game, cam) {
  const p = game.player;
  if (p.inCar) return;
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  ctx.fillStyle = 'rgba(90,60,30,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 6, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(x + Math.cos(p.angle) * 4, y + Math.sin(p.angle) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  if (p.hasPistol || game.muzzle > 0) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(p.angle) * 8, y + Math.sin(p.angle) * 8);
    ctx.lineTo(x + Math.cos(p.angle) * 19, y + Math.sin(p.angle) * 19);
    ctx.stroke();
  }
  if (game.muzzle > 0) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x + Math.cos(p.angle) * 26, y + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarker(ctx, game, cam) {
  const marker = missionMarker(game);
  if (!marker) return;
  const x = marker.x - cam.x;
  const y = marker.y - cam.y;
  const bob = Math.sin(game.time * 4) * 6;
  // Off-screen markers clamp to the edge with an arrow feel (a ring).
  const cx = Math.max(30, Math.min(VIEW.width - 30, x));
  const cy = Math.max(30, Math.min(VIEW.height - 30, y));
  ctx.fillStyle = 'rgba(255, 210, 62, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, 30 + bob, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5c4300';
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(marker.kind === 'start' ? '!' : '◆', cx, cy + 5);
  if (x === cx && y === cy) {
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 16);
    ctx.lineTo(cx, cy + 34 + bob);
    ctx.stroke();
  }
}

function drawEffects(ctx, game, cam) {
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 2;
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - cam.x, b.y - cam.y);
    ctx.lineTo(b.x - b.vx * 0.02 - cam.x, b.y - b.vy * 0.02 - cam.y);
    ctx.stroke();
  }
  for (const fx of game.particles) {
    ctx.globalAlpha = Math.max(0, fx.life * 2);
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x - cam.x - fx.size / 2, fx.y - cam.y - fx.size / 2, fx.size, fx.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
  }
  ctx.globalAlpha = 1;
}

export function drawWorld(ctx, game) {
  const cam = createCamera(game);
  game.camera = cam;
  drawGround(ctx, game.world, cam);
  drawRoads(ctx, game.world, cam);
  drawBuildings(ctx, game.world, cam);
  drawNature(ctx, game.world, cam);
  for (const car of game.cars) {
    if (car.driver !== 'player') drawCarShape(ctx, car, cam, game.time);
  }
  for (const car of game.policeCars) drawCarShape(ctx, car, cam, game.time);
  if (game.player.inCar) drawCarShape(ctx, game.player.inCar, cam, game.time);
  drawPeds(ctx, game, cam);
  drawPlayer(ctx, game, cam);
  drawMarker(ctx, game, cam);
  drawEffects(ctx, game, cam);
  return cam;
}

function dimScreen(ctx, alpha) {
  ctx.fillStyle = `rgba(12, 16, 28, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

export function drawTitleScreen(ctx, game, hasSave) {
  drawWorld(ctx, game);
  dimScreen(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 92px ' + FONT;
  ctx.fillText('HARBORLINE', VIEW.width / 2, 240);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px ' + FONT;
  ctx.fillText('Port Azura • Jett Marlowe • one harbour, every debt', VIEW.width / 2, 290);
  ctx.font = '20px ' + FONT;
  ctx.fillText('WASD / arrows — move & drive      E — enter / steal car      Shift — run', VIEW.width / 2, 400);
  ctx.fillText('Mouse — aim • Click — shoot (once armed)      F — punch      P — pause', VIEW.width / 2, 434);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillText('Press ENTER — New Game', VIEW.width / 2, 520);
  if (hasSave) {
    ctx.fillStyle = '#8be26b';
    ctx.fillText('Press C — Continue', VIEW.width / 2, 566);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '16px ' + FONT;
  ctx.fillText('Run story jobs, steal rides, dodge the Port Azura police. Progress saves automatically.', VIEW.width / 2, 640);
}

export function drawPausedScreen(ctx, game) {
  drawWorld(ctx, game);
  drawHUD(ctx, game);
  dimScreen(ctx, 0.5);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px ' + FONT;
  ctx.fillText('PAUSED', VIEW.width / 2, 360);
  ctx.font = '22px ' + FONT;
  ctx.fillText('Press P or ENTER to keep playing', VIEW.width / 2, 410);
}

export function drawOverScreen(ctx, game) {
  drawWorld(ctx, game);
  dimScreen(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 72px ' + FONT;
  ctx.fillText('WASTED', VIEW.width / 2, 330);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px ' + FONT;
  ctx.fillText(`Jett wakes up at the clinic, lighter by $60. Cash kept: $${Math.floor(game.player.cash)}`, VIEW.width / 2, 390);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 28px ' + FONT;
  ctx.fillText('Press ENTER to get back up', VIEW.width / 2, 470);
}
