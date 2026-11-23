'use strict';

// node tests/narrative.test.cjs — no browser or third-party packages required.
// Raw data/story are loaded before the narrative patch. The frozen hashes below
// were recorded from v0.5 after removing only the fields v0.6 may rewrite.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const M = require('../js/model.js');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'js', name), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline = {
  data: '1f5b002f48c78f22c51ae67791f3597e310a9f7a9ce4938f9ff8afbcf6c38a07',
  story: '267224bb4e8a2efce3ce8e8e6195018dbf02d40bee2e95153f83679dea21d824'
};
function dataStructure(data) {
  const result = copy(data);
  for (const clue of Object.values(result.clues)) delete clue.text;
  return result;
}
function storyStructure(story) {
  const result = copy(story);
  for (const pages of Object.values(result)) for (const page of pages) delete page.text;
  return result;
}
function load() {
  const context = vm.createContext({window: {}});
  for (const file of ['data.js', 'story.js', 'narrative.js', 'model.js']) {
    vm.runInContext(read(file), context, {filename: file});
  }
  return {context, D: context.window.SAINT_DATA, S: context.window.SAINT_STORY, N: context.window.SAINT_NARRATIVE};
}
function state() {const s = M.create(); s.phase = 'investigation'; return s;}

test('raw world, map, character and scene structure still matches original v0.5', () => {
  const {D, S} = load();
  assert.equal(digest(dataStructure(D)), baseline.data);
  assert.equal(digest(storyStructure(S)), baseline.story);
  assert.deepEqual(Object.fromEntries(Object.entries(S).map(([key, pages]) => [key, pages.length])), {
    opening: 2, private: 4, seven: 11, alone: 3, gossip: 6,
    elder: 9, yes: 11, silence: 7, elderAgain: 4
  });
});

test('apply changes only authorized prose; all maps, characters, speakers and villager slots survive', () => {
  const {D, S, N} = load();
  const beforeData = copy(D), beforeStory = copy(S);
  N.apply(D, S);
  assert.deepEqual(dataStructure(D), dataStructure(beforeData), 'all non-prose data');
  assert.deepEqual(storyStructure(S), storyStructure(beforeStory), 'scene/page/speaker/slot structure');
  assert.deepEqual(copy(D.maps), beforeData.maps, 'all six maps including colliders, exits and NPCs');
  assert.deepEqual(copy(D.characters), beforeData.characters, 'all character definitions and assets');
  for (const [scene, pages] of Object.entries(beforeStory)) pages.forEach((page, index) => {
    const expected = N.storyPatches[scene]?.[index] ?? page.text;
    assert.equal(S[scene][index].text, expected, `${scene}[${index}] selected wording`);
  });
  for (const [id, clue] of Object.entries(beforeData.clues)) {
    assert.equal(D.clues[id].text, N.clueTexts[id] ?? clue.text, id + ' selected wording');
  }
});

test('all 36 ending thresholds and every existing score effect are unchanged', () => {
  for (let suspicion = 0; suspicion <= 5; suspicion++) for (let trust = 0; trust <= 5; trust++) {
    const expected = suspicion >= 3 ? 'true' : trust >= 4 ? 'bad' : trust >= 3 ? 'normal' : null;
    assert.equal(M.ending({suspicion, trust}), expected, `${suspicion}/${trust}`);
  }
  assert.deepEqual(M.effects, {
    parchment: [0, 0], diary: [1, 0], restored: [1, 0], bible: [0, 1],
    cover: [1, 0], elder: [0, 1], eliFaith: [0, 1], eliRitual: [0, 1], contradiction: [0, 0]
  });
});

test('an observed but unaccepted Bible permits cover judgment without adding trust', () => {
  const s = state();
  assert.equal(M.award(s, 'cover').reason, 'parchment');
  assert.ok(M.award(s, 'parchment').ok);
  assert.equal(M.award(s, 'cover').reason, 'bible');
  s.observed.push('bible');
  assert.ok(M.award(s, 'cover').ok);
  assert.equal(s.trust, 0);
  assert.equal(s.suspicion, 1);
  assert.equal(s.found.includes('bible'), false, 'reading did not silently accept the text');
  const previous = copy(s);
  assert.equal(M.award(s, 'cover').reason, 'duplicate');
  assert.deepEqual(s, previous, 'duplicate judgment has no side effect');
});

function inspectionHarness() {
  const {context, D, S, N} = load();
  N.apply(D, S);
  const gameSource = read('game.js');
  function between(first, next) {
    const begin = gameSource.indexOf('  function ' + first + '(');
    const end = gameSource.indexOf('  function ' + next + '(', begin + 1);
    assert.ok(begin >= 0 && end > begin, `Cannot locate ${first} → ${next}`);
    return gameSource.slice(begin, end);
  }
  // Minimal DOM/output stubs: real collect/inspect/award and ritual selection
  // execute unchanged. Buttons are captured so tests can read without clicking,
  // defer judgment, and later deliberately accept the same document.
  vm.runInContext(`
    const D=window.SAINT_DATA,M=window.SAINT_MODEL,N=window.SAINT_NARRATIVE;
    let game=M.create();game.phase='investigation';
    const has=id=>game.found.includes(id);
    let lastInfo=null,lastDialogue=null,world='church',player={},crowdVisible=false,walk={};
    const element=()=>({append(){},className:'',textContent:''});
    const document={createElement:element,createTextNode:text=>({textContent:text})},$=element;
    const info=(title,text,actions)=>{lastInfo={title,text,actions};};
    const openDialogue=pages=>{lastDialogue=pages;};
    const notYet=()=>{throw Error('Unexpected prerequisite warning');};
    const bgm={sfx(){},resetFootsteps(){}},updateHUD=()=>{},toast=()=>{};
    window.SAINT_SPRITES={resetMotion(){}};
    ${between('award', 'eliTalk')}
    ${between('ritual', 'runCinematic')}
    globalThis.inspection={
      collect,inspectClue,award,ritual,
      commit:()=>lastInfo.actions[0].action(),
      state:()=>game,
      dialogue:()=>lastDialogue
    };
  `, context, {filename: 'actual-game-inspection-under-test.js'});
  return {h: context.inspection, N};
}

test('actual document reading is score-free and unaccepted materials remain available to judge later', () => {
  const {h} = inspectionHarness();
  h.collect('parchment');
  assert.deepEqual(copy(h.state().observed), ['parchment']);
  assert.equal(h.state().found.length, 0, 'looking does not take the object');
  h.commit(); // The original zero-point parchment possession prerequisite.
  for (const id of ['diary', 'restore', 'bible', 'bible']) h.collect(id);
  assert.deepEqual(copy(h.state().observed), ['parchment', 'diary', 'restored', 'bible', 'cover']);
  assert.deepEqual(copy(h.state().found), ['parchment']);
  assert.equal(h.state().suspicion, 0);
  assert.equal(h.state().trust, 0);
  assert.equal(M.ending(h.state()), null, 'seeing every counterargument does not choose an ending');
  h.commit(); // Choose the cover judgment, with Bible still only observed.
  assert.equal(h.state().suspicion, 1);
  assert.equal(h.state().trust, 0);
  h.inspectClue('bible'); // The journal can reopen an earlier deferred passage.
  h.commit();
  assert.equal(h.state().trust, 1);
  const before = copy(h.state());
  assert.equal(h.award('bible').reason, 'duplicate');
  assert.deepEqual(copy(h.state()), before);
});

test('normal ending acknowledges an accepted elder pledge, but never invents one from observation', () => {
  const {h, N} = inspectionHarness();
  h.award('parchment'); h.award('bible'); h.award('eliFaith'); h.award('elder');
  assert.equal(M.ending(h.state()), 'normal', 'the original 3-trust outcome is preserved');
  h.ritual('normal');
  assert.deepEqual(copy(h.dialogue()), copy(N.dialogues.ritualNormalOffered));
  const offered = N.endingFor('normal', h.state());
  assert.equal(offered.captions[0], N.endings.normal.offeredCaptions[0]);
  const unaccepted = N.endingFor('normal', {found: [], observed: ['elder']});
  assert.equal(unaccepted.captions[0], N.endings.normal.captions[0]);
  assert.notEqual(offered.captions[0], unaccepted.captions[0]);
  assert.deepEqual(copy(offered.captions.slice(1)), copy(unaccepted.captions.slice(1)), 'same sacrifice and aftermath');
  const other = inspectionHarness();
  other.h.ritual('normal');
  assert.deepEqual(copy(other.h.dialogue()), copy(other.N.dialogues.ritualNormal));
});

test('all endings retain independent captions and one or two non-graded reflection questions', () => {
  const {N} = load();
  assert.deepEqual(Object.keys(N.endings), ['normal', 'bad', 'true']);
  for (const id of ['normal', 'bad', 'true']) {
    const e = N.endingFor(id, {found: []});
    assert.ok(e.captions.length >= 3 && e.captions.length <= 5, id + ' caption count');
    assert.ok(e.reflectionQuestions.length >= 1 && e.reflectionQuestions.length <= 2, id + ' questions');
    assert.ok(e.captions.every(text => typeof text === 'string' && text.trim()));
    assert.ok(e.reflectionQuestions.every(text => typeof text === 'string' && text.trim()));
    e.captions[0] = 'test mutation';
    e.reflectionQuestions[0] = 'test mutation';
    assert.notEqual(N.endingFor(id, {found: []}).captions[0], 'test mutation');
    assert.notEqual(N.endingFor(id, {found: []}).reflectionQuestions[0], 'test mutation');
  }
});
