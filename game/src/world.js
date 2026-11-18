// Port Azura: the city itself. A seeded generator lays a road grid over a
// sun-soaked peninsula — harbour water along the south edge, a beach, then
// city blocks of varied buildings with palms, lamps and props between the
// roads. It also answers the questions every other system asks: is this a
// road, does a circle hit a building, which district is this?

import { WORLD, BUILDING_COLORS } from './config.js';
import { pick, randRange } from './random.js';

/** Road bands: vertical roads run north–south, horizontal east–west. */
export const ROAD_V = [360, 1160, 1960, 2760];
export const ROAD_H = [360, 1160, 1960];
export const ROAD_W = 160;
export const HARBOR_Y = 2240;

export const DISTRICTS = [
  { name: 'Old Harbour', x: 300, y: 2050 },
  { name: 'Marina Walk', x: 1500, y: 2050 },
  { name: 'Downtown Azura', x: 1500, y: 900 },
  { name: 'Palm Heights', x: 500, y: 500 },
  { name: 'Coral Market', x: 2400, y: 900 },
  { name: 'North Yards', x: 2400, y: 300 },
];

export function roadCenterV(i) {
  return ROAD_V[i] + ROAD_W / 2;
}
export function roadCenterH(i) {
  return ROAD_H[i] + ROAD_W / 2;
}

export function createWorld(rng) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const props = [];

  // Blocks sit between the roads; each block holds 2–4 buildings with a
  // little plaza or parking gap, so no two blocks look alike.
  const edgesX = [40, ...ROAD_V.flatMap((r) => [r, r + ROAD_W]), WORLD.width - 40];
  const edgesY = [40, ...ROAD_H.flatMap((r) => [r, r + ROAD_W]), HARBOR_Y];
  for (let bx = 0; bx < edgesX.length - 1; bx += 2) {
    for (let by = 0; by < edgesY.length - 1; by += 2) {
      const x0 = edgesX[bx] + 26;
      const x1 = edgesX[bx + 1] - 26;
      const y0 = edgesY[by] + 26;
      const y1 = edgesY[by + 1] - 26;
      if (x1 - x0 < 150 || y1 - y0 < 150) continue;
      const cols = rng() > 0.5 ? 2 : 1;
      const rows = rng() > 0.45 ? 2 : 1;
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (rng() < 0.14) continue; // an empty lot keeps the city airy
          const pad = randRange(rng, 10, 26);
          buildings.push({
            x: x0 + cx * cw + pad,
            y: y0 + cy * ch + pad,
            w: cw - pad * 2,
            h: ch - pad * 2,
            color: pick(rng, BUILDING_COLORS),
            roof: pick(rng, BUILDING_COLORS),
            floors: 2 + Math.floor(rng() * 6),
            name: '',
          });
        }
      }
      // Palms and lamps dress the block corners.
      palms.push({ x: x0 + 6, y: y0 + 6, s: randRange(rng, 0.8, 1.25) });
      palms.push({ x: x1 - 6, y: y1 - 6, s: randRange(rng, 0.8, 1.25) });
      if (rng() > 0.4) lamps.push({ x: x1 - 4, y: y0 + 4 });
      if (rng() > 0.5) props.push({ x: (x0 + x1) / 2, y: y1 - 8, kind: 'bench' });
    }
  }

  // A palm-lined promenade along the harbour and a pier into the water.
  for (let x = 90; x < WORLD.width - 60; x += 130) {
    palms.push({ x, y: HARBOR_Y + 26, s: randRange(rng, 0.9, 1.3) });
    if (x % 390 === 90) lamps.push({ x, y: HARBOR_Y + 44 });
  }
  const pier = { x: 1480, y: HARBOR_Y, w: 90, h: 150 };

  function isRoad(x, y) {
    if (y >= HARBOR_Y && y < HARBOR_Y + 60) return true; // promenade
    for (const r of ROAD_V) if (x >= r && x <= r + ROAD_W) return true;
    for (const r of ROAD_H) if (y >= r && y <= r + ROAD_W) return true;
    return false;
  }

  function isWater(x, y) {
    if (y < HARBOR_Y + 60) return false;
    if (x >= pier.x && x <= pier.x + pier.w && y <= pier.y + pier.h) return false;
    return y > HARBOR_Y + 40;
  }

  function circleHitsBuilding(x, y, radius) {
    for (const b of buildings) {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < radius * radius) return b;
    }
    return null;
  }

  /** Push a circle out of any building it overlaps; returns the new spot. */
  function resolveCollision(x, y, radius) {
    const b = circleHitsBuilding(x, y, radius);
    if (!b) return { x, y, hit: false };
    const left = Math.abs(x - b.x);
    const right = Math.abs(x - (b.x + b.w));
    const top = Math.abs(y - b.y);
    const bottom = Math.abs(y - (b.y + b.h));
    const min = Math.min(left, right, top, bottom);
    if (min === left) x = b.x - radius;
    else if (min === right) x = b.x + b.w + radius;
    else if (min === top) y = b.y - radius;
    else y = b.y + b.h + radius;
    return { x, y, hit: true };
  }

  function districtAt(x, y) {
    let best = DISTRICTS[0];
    let bestD = Infinity;
    for (const d of DISTRICTS) {
      const dist = (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best.name;
  }

  return {
    buildings, palms, lamps, props, pier,
    isRoad, isWater, circleHitsBuilding, resolveCollision, districtAt,
    width: WORLD.width, height: WORLD.height,
  };
}
