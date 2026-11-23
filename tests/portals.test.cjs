'use strict';

// Run from any directory: node /path/to/SAINT_SEVEN_v05/tests/portals.test.cjs
// No dependencies or browser are required. Movement, NPC collision, go(), and
// story gates below are extracted from the actual game.js; only presentation,
// audio and sprite animation calls are stubbed. Browser rendering is tested separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'js', name), 'utf8');
const source = read('game.js');
function betweenFunctions(first, next) {
  const begin = source.indexOf('  function ' + first + '(');
  const end = source.indexOf('  function ' + next + '(', begin + 1);
  assert.ok(begin >= 0 && end > begin, `Cannot locate game.js ${first} → ${next}`);
  return source.slice(begin, end);
}

function harness() {
  let now = 1000;
  const context = vm.createContext({window: {}, performance: {now: () => now}});
  vm.runInContext(read('data.js'), context, {filename: 'data.js'});
  vm.runInContext(read('portals.js'), context, {filename: 'portals.js'});
  vm.runInContext(`
    const D=window.SAINT_DATA;
    let world='church',game={phase:'investigation'},player={...D.player};
    let crowdVisible=false,leaving=null,nearest=null,villagerCast=D.villagerVariants;
    const map=()=>D.maps[world],portals=window.SAINT_PORTALS.create(),keys=new Set(),walk={};
    let hints=[];
    const toast=s=>hints.push(s),updateHUD=()=>{},render=()=>{};
    const bgm={footsteps(){},resetFootsteps(){},door(){}};
    window.SAINT_SURFACES={at:()=> 'default',exitCue:()=> 'transition'};
    window.SAINT_SPRITES={updateMotion(){},resetMotion(){}};
    ${betweenFunctions('actors', 'lineClear')}
    ${betweenFunctions('go', 'start')}
    ${betweenFunctions('tryExit', 'requestRitual')}
    globalThis.testAPI={
      setup(m,p,phase='investigation'){
        world=m;player={...D.player,...p};game.phase=phase;
        portals.reset();hints=[];keys.clear();
      },
      move,go,canWalk,portals,
      state:()=>({world,player:{...player},hints:[...hints],lock:portals.snapshot()}),
      definitions:window.SAINT_PORTALS.definitions,
      maps:D.maps,
      create:window.SAINT_PORTALS.create
    };
  `, context, {filename: 'game-movement-under-test.js'});
  return {...context.testAPI, tick(ms = 16) {now += ms;}};
}

// Baseline destination links/spawns from the unmodified v0.4 map data. Keeping
// these independent of portal definitions catches accidental route changes.
const originalRoutes = [
  ['church', 'stairs_down', 'basement', 1101, 240],
  ['church', 'church_out', 'entrance', 627, 285],
  ['church', 'church_garden', 'garden', 1110, 625],
  ['basement', 'stairs_up', 'church', 1043, 299],
  ['entrance', 'church_in', 'church', 625, 1000],
  ['entrance', 'square_out', 'square', 625, 155],
  ['square', 'entrance_out', 'entrance', 625, 1160],
  ['square', 'house_out', 'house', 625, 990],
  ['square', 'square_garden', 'garden', 625, 1090],
  ['house', 'house_exit', 'square', 1100, 610],
  ['garden', 'garden_exit', 'square', 150, 610],
  ['garden', 'garden_church', 'church', 185, 625]
];

function walkToward(h, mapId, def, count = 100) {
  for (let i = 0; i < count && h.state().world === mapId; i++) {
    h.tick();
    h.move(def.inward[0] * 4, def.inward[1] * 4);
  }
}

test('all 12 real thresholds are reachable and retain original routes/spawns', () => {
  const h = harness();
  assert.equal(Object.values(h.definitions).flat().length, originalRoutes.length);
  assert.equal(Object.values(h.maps).flatMap(m => m.interactions.filter(i => i.type === 'exit')).length, originalRoutes.length);
  for (const [mapId, id, target, x, y] of originalRoutes) {
    const label = `${mapId}/${id}`;
    const def = h.definitions[mapId].find(d => d.id === id);
    const exit = h.maps[mapId].interactions.find(i => i.id === id);
    assert.ok(def && exit, label);
    assert.equal(exit.target, target, label + ' target');
    assert.equal(exit.spawn.x, x, label + ' spawn.x');
    assert.equal(exit.spawn.y, y, label + ' spawn.y');
    h.setup(mapId, def.approach);
    assert.ok(h.canWalk(def.approach.x, def.approach.y), label + ' reachable approach');
    walkToward(h, mapId, def);
    const state = h.state();
    assert.equal(state.world, target, label + ' automatic entry');
    assert.equal(state.player.x, x, label + ' actual arrival.x');
    assert.equal(state.player.y, y, label + ' actual arrival.y');
    assert.ok(h.canWalk(x, y), label + ' walkable arrival');
  }
});

test('36 story gates match original phases; denied doors show one hint per approach', () => {
  const h = harness();
  for (const [mapId, id, target] of originalRoutes) {
    const def = h.definitions[mapId].find(d => d.id === id);
    for (const phase of ['seven', 'gossip', 'elder']) {
      const denied = phase === 'seven'
        ? !['entrance', 'church'].includes(target)
        : ['house', 'garden', 'basement'].includes(target);
      h.setup(mapId, def.approach, phase);
      walkToward(h, mapId, def);
      const state = h.state();
      assert.equal(state.world, denied ? mapId : target, `${phase}/${mapId}/${id}`);
      if (denied) assert.equal(state.hints.length, 1, `${phase}/${id}: repeated blocked input`);
    }
  }
});

test('24 adjacent doorway edges do not trigger; idle and outward movement do not trigger', () => {
  const h = harness();
  for (const [mapId, defs] of Object.entries(h.definitions)) for (const def of defs) {
    const [x, y, w, height] = def.rect;
    const center = {x: x + w / 2, y: y + height / 2};
    const movement = {x: def.inward[0] * 4, y: def.inward[1] * 4};
    const sides = def.inward[0]
      ? [{x: center.x, y: y - 1}, {x: center.x, y: y + height + 1}]
      : [{x: x - 1, y: center.y}, {x: x + w + 1, y: center.y}];
    const p = h.create();
    for (const position of sides) {
      assert.equal(p.probe(mapId, position, position, movement, 1000), null, `${mapId}/${def.id}: adjacent wall`);
    }
    assert.equal(p.probe(mapId, center, center, {x: 0, y: 0}, 1000), null, def.id + ' idle');
    assert.equal(p.probe(mapId, center, center, {x: -movement.x, y: -movement.y}, 1000), null, def.id + ' moving away');
  }
});

test('actual movement into nearby solid walls never changes maps', () => {
  const h = harness();
  // The two stair jambs and the two sides of the church south doorway use
  // the actual unmodified wall colliders, not synthetic geometry.
  for (const [x, y, dy] of [[1001, 365, -4], [1100, 365, -4], [560, 945, 4], [702, 945, 4]]) {
    h.setup('church', {x, y});
    assert.ok(h.canWalk(x, y), `wall approach ${x},${y}`);
    for (let i = 0; i < 100; i++) {h.tick(); h.move(0, dy);}
    assert.equal(h.state().world, 'church', `wall ${x},${y}`);
    assert.ok(!h.canWalk(h.state().player.x, h.state().player.y + dy), 'wall actually blocks movement');
    assert.equal(h.state().hints.length, 0, 'ordinary wall is not an exit');
  }
});

test('1,200 stationary arrival samples cannot bounce, including after cooldown', () => {
  const h = harness();
  for (const [, , target, x, y] of originalRoutes) {
    const p = h.create(), position = {x, y};
    p.arrive(target, position, 0);
    for (let i = 0; i < 100; i++) {
      const [dx, dy] = [[0, -4], [0, 4], [-4, 0], [4, 0]][i % 4];
      assert.equal(p.probe(target, position, position, {x: dx, y: dy}, i * 20), null, `${target} arrival sample ${i}`);
    }
  }
});

test('holding north on both stairs never bounces; leaving the threshold re-arms return', () => {
  const h = harness();
  const def = h.definitions.church.find(d => d.id === 'stairs_down');
  h.setup('church', def.approach);
  walkToward(h, 'church', def);
  assert.equal(h.state().world, 'basement');
  for (let i = 0; i < 100; i++) {h.tick(); h.move(0, -4);}
  assert.equal(h.state().world, 'basement', 'holding direction after arrival');
  for (let i = 0; i < 30; i++) {h.tick(); h.move(0, 4);}
  assert.equal(h.state().lock.blocked.length, 0, 'leaving stair clears arrival latch');
  walkToward(h, 'basement', h.definitions.basement[0]);
  assert.equal(h.state().world, 'church', 'intentional return works');
  for (let i = 0; i < 100; i++) {h.tick(); h.move(0, -4);}
  assert.equal(h.state().world, 'church', 'return stair also resists bounce');
});

test('failed destination collision preserves source map; reset clears portal state', () => {
  const h = harness();
  h.setup('church', {x: 625, y: 580});
  assert.equal(h.go('basement', {x: 0, y: 0}), false);
  assert.equal(h.state().world, 'church');
  assert.equal(h.state().player.x, 625);
  assert.equal(h.state().player.y, 580);
  h.portals.arrive('basement', {x: 1101, y: 240});
  assert.ok(h.state().lock.blocked.length > 0);
  h.portals.reset();
  assert.equal(h.state().lock.arrival, null);
  assert.equal(h.state().lock.blocked.length, 0);
});
