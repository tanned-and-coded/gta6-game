// The story: "Harborline". Jett Marlowe, a harbour courier who owes money
// in all the wrong places, takes one smuggling job too many. Four linked
// missions carry him from a first nervous package run to a final escape
// across Port Azura. Each mission is a chain of stages — go somewhere,
// pick something up, deliver it against the clock, shake the police —
// with cash payouts and a save written at every completion.

import { distance } from './random.js';
import { writeSave } from './save.js';

export const STORY = [
  {
    title: 'First Run',
    start: { x: 1525, y: 2270 },
    intro: 'Mara at the pier has a package. No questions, quick money.',
    payout: 120,
    outro: 'Clean run. Mara slips you a pistol: "Harbour work gets loud."',
    stages: [
      { kind: 'pickup', x: 2840, y: 1240, text: 'Pick up the package at Coral Market' },
      { kind: 'deliver', x: 1240, y: 1240, text: 'Deliver it to the cafe in Downtown Azura', time: 80 },
    ],
  },
  {
    title: 'Borrowed Wheels',
    start: { x: 1240, y: 1240 },
    intro: 'A collector in the North Yards wants a car he does not own.',
    payout: 180,
    outro: 'The collector pays in folded bills and asks no names.',
    stages: [
      { kind: 'steal', text: 'Steal any car (walk up and press E)' },
      { kind: 'deliverCar', x: 2840, y: 440, text: 'Bring the stolen car to the North Yards', time: 100 },
    ],
  },
  {
    title: 'Dockside Drop',
    start: { x: 2040, y: 2270 },
    intro: 'Crates off a night boat. The harbour patrol will not like it.',
    payout: 260,
    outro: 'Mara is impressed. One last job, she says. The big one.',
    stages: [
      { kind: 'pickup', x: 440, y: 2270, text: 'Load the crates at the Old Harbour', wanted: 2 },
      { kind: 'deliver', x: 440, y: 440, text: 'Drop them at Palm Heights — lose the heat first if you can', time: 130 },
    ],
  },
  {
    title: 'The Final Tide',
    start: { x: 2840, y: 440 },
    intro: 'Every debt in Port Azura comes due tonight. Run the last tide.',
    payout: 400,
    outro: 'Debts paid, name cleared. Port Azura is yours to roam.',
    stages: [
      { kind: 'pickup', x: 2040, y: 1240, text: 'Grab the ledger downtown', wanted: 3 },
      { kind: 'escape', text: 'Lose the police (get the stars to zero)' },
      { kind: 'deliver', x: 1525, y: 2270, text: 'Reach the pier at Old Harbour' },
    ],
  },
];

export function createMissionState() {
  return { index: 0, stage: 0, active: false, done: false, timer: 0, failed: '' };
}

function currentMission(game) {
  return STORY[game.missions.index] || null;
}

function currentStage(game) {
  const m = currentMission(game);
  if (!m || !game.missions.active) return null;
  return m.stages[game.missions.stage] || null;
}

/** The world marker the HUD and minimap point at, if any. */
export function missionMarker(game) {
  const m = currentMission(game);
  if (!m) return null;
  if (!game.missions.active) return { x: m.start.x, y: m.start.y, kind: 'start' };
  const s = currentStage(game);
  if (!s || s.x === undefined) return null;
  return { x: s.x, y: s.y, kind: s.kind };
}

export function missionObjective(game) {
  const m = currentMission(game);
  if (!m) return game.missions.done ? 'Free roam — Port Azura is yours' : '';
  if (!game.missions.active) return `Meet your contact: ${m.title}`;
  const s = currentStage(game);
  return s ? s.text : m.title;
}

export function missionTitle(game) {
  const m = currentMission(game);
  return m ? m.title : 'Harborline';
}

function beginStage(game) {
  const s = currentStage(game);
  if (!s) return;
  game.missions.timer = s.time || 0;
  if (s.wanted) game.addWanted(s.wanted, 'Police alerted');
}

function completeMission(game) {
  const m = currentMission(game);
  game.player.cash += m.payout;
  game.floaters.push({
    x: game.player.x, y: game.player.y - 30,
    text: `+$${m.payout}`, life: 1.6, color: '#8be26b',
  });
  game.notice = m.outro;
  game.noticeTimer = 5;
  game.audio.cash();
  game.audio.missionDone();
  if (game.missions.index === 0) game.player.hasPistol = true;
  game.missions.index += 1;
  game.missions.active = false;
  game.missions.stage = 0;
  if (game.missions.index >= STORY.length) game.missions.done = true;
  writeSave(game);
}

function failMission(game, why) {
  game.missions.active = false;
  game.missions.stage = 0;
  game.missions.failed = why;
  game.notice = `${why} — the job is off. Go back to the contact to retry.`;
  game.noticeTimer = 5;
  game.wanted = Math.max(0, game.wanted - 1);
}

export function updateMissions(game, dt) {
  const ms = game.missions;
  const m = currentMission(game);
  if (!m) return;
  const p = game.player;

  if (!ms.active) {
    if (distance(p.x, p.y, m.start.x, m.start.y) < 54) {
      ms.active = true;
      ms.stage = 0;
      ms.failed = '';
      game.notice = `${m.title}: ${m.intro}`;
      game.noticeTimer = 5;
      game.audio.pickup();
      beginStage(game);
    }
    return;
  }

  const s = currentStage(game);
  if (!s) {
    completeMission(game);
    return;
  }

  if (s.time) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      failMission(game, 'Out of time');
      return;
    }
  }

  let done = false;
  if (s.kind === 'pickup' || s.kind === 'deliver') {
    done = distance(p.x, p.y, s.x, s.y) < 58;
    if (done && s.kind === 'pickup') game.audio.pickup();
  } else if (s.kind === 'deliverCar') {
    done = Boolean(p.inCar) && distance(p.x, p.y, s.x, s.y) < 66;
  } else if (s.kind === 'steal') {
    done = Boolean(p.inCar) && p.inCar.kind === 'stolen';
  } else if (s.kind === 'escape') {
    done = game.wanted === 0;
  }

  if (done) {
    ms.stage += 1;
    if (ms.stage >= m.stages.length) completeMission(game);
    else {
      game.audio.pickup();
      beginStage(game);
    }
  }
}
