// Harborline — every tuning number and colour in one place.
// Port Azura is a fixed-size world measured in pixels; the camera shows a
// window of it and the renderer scales that window to the screen, so no
// rule below depends on the display size.

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 800 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 215,
  runSpeed: 320,
  maxHealth: 100,
  startCash: 40,
  startX: 1240,
  startY: 1080,
};

export const CAR = {
  length: 54,
  width: 27,
  maxSpeed: 430,
  reverseSpeed: 150,
  accel: 340,
  brake: 520,
  drag: 0.9,
  turnRate: 2.6,
  enterRange: 62,
};

export const TRAFFIC = { count: 16, speed: 150, parkedCount: 14 };
export const PEDS = { count: 26, speed: 62 };

export const POLICE = {
  maxCars: 4,
  speed: 372,
  ramDamage: 9,
  spawnDistance: 620,
  decaySeconds: 16,
};

export const WANTED = {
  theft: 1,
  hitPed: 1,
  shoot: 1,
  ramPolice: 1,
  max: 5,
};

export const COMBAT = {
  bulletSpeed: 780,
  bulletLife: 0.55,
  fireCooldown: 0.22,
  meleeRange: 44,
  meleeDamage: 45,
  pedHealth: 60,
};

export const SAVE_KEY = 'harborline.save.v1';

export const PALETTE = {
  water: '#2e8fb8',
  waterDeep: '#22749c',
  sand: '#e8cf9a',
  grass: '#8fbf6f',
  blockGround: '#d9c08d',
  sidewalk: '#e6ddc8',
  road: '#4a4a52',
  roadEdge: '#f4ead2',
  lane: '#f7d774',
  crosswalk: '#f2eee2',
  palmTrunk: '#8a6844',
  palmLeaf: '#3f9e4d',
  lampPost: '#5b5348',
  lampGlow: '#ffe9a8',
  player: '#ff7847',
  playerDark: '#c24e24',
  police: '#2b4d9b',
  policeLightA: '#ff5252',
  policeLightB: '#4da3ff',
  marker: '#ffd23e',
  markerAlt: '#39d98a',
  hudPanel: 'rgba(20, 24, 38, 0.72)',
  hudText: '#ffffff',
  hudMuted: '#cfd6e4',
  health: '#57d977',
  healthLow: '#ff5252',
  cash: '#8be26b',
  star: '#ffd23e',
  starEmpty: 'rgba(255,255,255,0.28)',
};

export const BUILDING_COLORS = [
  '#f2b880', '#ee9ca7', '#a8d8ea', '#f6e6ad', '#c3aed6', '#ffb7a5',
  '#95e1d3', '#f7d794', '#e8a2bf', '#a3c9a8', '#f4a261', '#90caf9',
];

export const CAR_COLORS = [
  '#e74c3c', '#f39c12', '#ecf0f1', '#3498db', '#9b59b6', '#1abc9c',
  '#fd79a8', '#fdcb6e', '#74b9ff', '#55efc4', '#dfe6e9', '#e17055',
];

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
