(function (root) {
  'use strict';
  const effects = {
    parchment: [0, 0], diary: [1, 0], restored: [1, 0],
    bible: [0, 1], cover: [1, 0], elder: [0, 1],
    eliFaith: [0, 1], eliRitual: [0, 1], contradiction: [0, 0]
  };
  function create() { return {phase:'title', suspicion:0, trust:0, found:[], observed:[], history:[], villageChoice:null, ending:null}; }
  function award(s, id) {
    if (s.phase !== 'investigation' && !(s.phase === 'ritual' && id === 'contradiction')) return {ok:false,reason:'phase'};
    if (!effects[id]) return {ok:false,reason:'unknown'};
    if (s.found.includes(id)) return {ok:false,reason:'duplicate'};
    if (id !== 'parchment' && !s.found.includes('parchment')) return {ok:false,reason:'parchment'};
    if (id === 'cover' && !s.found.includes('bible') && !s.observed?.includes('bible')) return {ok:false,reason:'bible'};
    if (id === 'eliRitual' && !s.found.includes('eliFaith')) return {ok:false,reason:'eliFaith'};
    s.found.push(id);
    s.suspicion = Math.min(5, s.suspicion + effects[id][0]);
    s.trust = Math.min(5, s.trust + effects[id][1]);
    s.history.push({id,suspicion:s.suspicion,trust:s.trust});
    return {ok:true,suspicion:effects[id][0],trust:effects[id][1]};
  }
  // 조건이 겹치면 모순 발견 > 호르마셋 희생 > 세븐 희생 순서입니다.
  function ending(s) {
    if (s.suspicion >= 3) return 'true';
    if (s.trust >= 4) return 'bad';
    if (s.trust >= 3) return 'normal';
    return null;
  }
  const api = {create,award,ending,effects};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SAINT_MODEL = api;
})(typeof window === 'undefined' ? globalThis : window);
