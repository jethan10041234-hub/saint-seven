const assert=require('node:assert/strict');const M=require('../js/model.js');
function s(){const x=M.create();x.phase='investigation';return x;}
let x=s();assert.equal(M.award(x,'diary').reason,'parchment');assert.equal(M.award(x,'restored').reason,'parchment');assert.equal(M.award(x,'elder').reason,'parchment');
assert(M.award(x,'parchment').ok);assert.equal(x.suspicion,0);assert.equal(x.trust,0);assert.equal(M.award(x,'cover').reason,'bible');
for(const id of ['diary','restored','bible','cover'])assert(M.award(x,id).ok);
assert.equal(x.suspicion,3);assert.equal(x.trust,1);assert.equal(M.ending(x),'true');
assert.equal(M.award(x,'cover').reason,'duplicate');assert.equal(x.suspicion,3);
x=s();for(const id of ['parchment','bible','eliFaith','eliRitual'])assert(M.award(x,id).ok);assert.equal(M.ending(x),'normal');
assert(M.award(x,'elder').ok);assert.equal(M.ending(x),'bad');
for(const id of ['diary','restored','cover'])M.award(x,id);assert.equal(M.ending(x),'true');
for(let suspicion=0;suspicion<=5;suspicion++)for(let trust=0;trust<=5;trust++)assert.equal(M.ending({suspicion,trust}),suspicion>=3?'true':trust>=4?'bad':trust>=3?'normal':null);
x=s();M.award(x,'parchment');x.trust=5;M.award(x,'bible');assert.equal(x.trust,5);x.phase='ending';assert.equal(M.award(x,'diary').reason,'phase');
console.log('PASS: 36 ending boundaries, clue prerequisites, deduplication, three reachable endings, cap and phase guard.');
