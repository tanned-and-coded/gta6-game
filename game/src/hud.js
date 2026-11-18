// The HUD: health, cash, wanted stars, the mission objective with its
// timer, context prompts and notices — and the minimap in the corner,
// which draws the road grid, the harbour, police blips, the mission
// marker and the player arrow. Everything is canvas-drawn, no DOM.

import { FONT, PALETTE, VIEW, WORLD } from './config.js';
import { ROAD_V, ROAD_H, ROAD_W, HARBOR_Y } from './world.js';
import { missionMarker, missionObjective, missionTitle } from './missions.js';

const MAP = { x: VIEW.width - 216, y: 16, w: 200, h: 150 };

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function drawStars(ctx, wanted) {
  // The stars sit in their own pill just left of the minimap, always visible.
  const x0 = MAP.x - 186;
  panel(ctx, x0 - 10, 10, 176, 44);
  ctx.font = '26px ' + FONT;
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText('★', x0 + i * 32, 42);
  }
}

function drawHealthAndCash(ctx, game) {
  panel(ctx, 14, 14, 252, 64);
  const p = game.player;
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = 'bold 12px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(game.world.districtAt(p.x, p.y).toUpperCase(), 26, 34);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(26, 44, 150, 14);
  const frac = Math.max(0, p.health / 100);
  ctx.fillStyle = frac > 0.3 ? PALETTE.health : PALETTE.healthLow;
  ctx.fillRect(26, 44, 150 * frac, 14);
  ctx.fillStyle = PALETTE.cash;
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText('$' + Math.floor(p.cash), 188, 60);
  if (p.hasPistol) {
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '13px ' + FONT;
    ctx.fillText('PISTOL', 188, 36);
  }
}

function drawMinimap(ctx, game) {
  panel(ctx, MAP.x - 6, MAP.y - 6, MAP.w + 12, MAP.h + 12);
  const sx = MAP.w / WORLD.width;
  const sy = MAP.h / WORLD.height;
  const px = (wx) => MAP.x + wx * sx;
  const py = (wy) => MAP.y + wy * sy;
  ctx.fillStyle = '#cbb27f';
  ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(MAP.x, py(HARBOR_Y), MAP.w, MAP.y + MAP.h - py(HARBOR_Y));
  ctx.fillStyle = '#565661';
  for (const r of ROAD_V) ctx.fillRect(px(r), MAP.y, ROAD_W * sx, MAP.h);
  for (const r of ROAD_H) ctx.fillRect(MAP.x, py(r), MAP.w, ROAD_W * sy);
  // Police blips blink red and blue.
  const blink = Math.floor(game.time * 3) % 2 === 0;
  for (const car of game.policeCars) {
    ctx.fillStyle = blink ? '#ff5252' : '#4da3ff';
    ctx.fillRect(px(car.x) - 2, py(car.y) - 2, 5, 5);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const car of game.cars) {
    if (car.kind === 'traffic') ctx.fillRect(px(car.x) - 1, py(car.y) - 1, 3, 3);
  }
  const marker = missionMarker(game);
  if (marker) {
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(px(marker.x), py(marker.y), 5 + Math.sin(game.time * 5) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5b00';
    ctx.stroke();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(px(game.player.x), py(game.player.y));
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMission(ctx, game) {
  const objective = missionObjective(game);
  if (!objective) return;
  panel(ctx, 14, 90, 430, game.missions.active && game.missions.timer > 0 ? 66 : 48);
  ctx.fillStyle = PALETTE.marker;
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(missionTitle(game).toUpperCase(), 26, 112);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '15px ' + FONT;
  ctx.fillText(objective, 26, 134);
  if (game.missions.active && game.missions.timer > 0) {
    const t = Math.max(0, game.missions.timer);
    ctx.fillStyle = t < 15 ? '#ff8080' : PALETTE.hudText;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText(`Time: ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, 26, 154);
  }
}

export function drawHUD(ctx, game) {
  drawHealthAndCash(ctx, game);
  drawMinimap(ctx, game);
  drawStars(ctx, game.wanted);
  drawMission(ctx, game);

  if (game.noticeTimer > 0 && game.notice) {
    ctx.font = '17px ' + FONT;
    const w = Math.min(760, ctx.measureText(game.notice).width + 36);
    panel(ctx, (VIEW.width - w) / 2, VIEW.height - 108, w, 40);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(game.notice, VIEW.width / 2, VIEW.height - 82);
  }

  if (game.prompt) {
    ctx.font = 'bold 16px ' + FONT;
    const w = ctx.measureText(game.prompt).width + 32;
    panel(ctx, (VIEW.width - w) / 2, VIEW.height - 62, w, 36);
    ctx.fillStyle = PALETTE.marker;
    ctx.textAlign = 'center';
    ctx.fillText(game.prompt, VIEW.width / 2, VIEW.height - 38);
  }

  if (game.player.inCar) {
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '14px ' + FONT;
    ctx.textAlign = 'right';
    const speed = Math.round(Math.abs(game.player.inCar.speed) * 0.36);
    ctx.fillText(`${speed} km/h`, VIEW.width - 18, VIEW.height - 18);
  }
}
