'use strict';
// Acoustic hints, not gameplay tiles. The original data has flattened 1254×1254
// PNGs, colliders, NPCs and exits, but NO material/tile layer. These conservative
// masks were traced by inspecting the six existing map images listed below.
// They never alter collision, paths, exit coordinates or story state. Uncertain
// mixed ground and rugs deliberately use the neutral default footstep.
(() => {
  const WORLD_SIZE = 1254;
  const sources = {
    church: 'assets/maps/01_church_interior.png',
    basement: 'assets/maps/02_church_basement.png',
    garden: 'assets/maps/03_memory_garden.png',
    entrance: 'assets/maps/04_church_entrance_clean.png',
    house: 'assets/maps/05_sevens_house.png',
    square: 'assets/maps/06_village_square.png'
  };
  const defaults = {
    // These defaults describe visible accessible floors. The caller supplies
    // actual walking positions; wall/roof pixels are not walkable surface data.
    church: 'church', // stone nave, with a larger room response
    basement: 'stone',
    square: 'stone',
    house: 'wood',
    // Outdoor edges contain mixed earth, paving, plants and shadows. We avoid
    // guessing a material outside the clearly identified regions below.
    entrance: 'default',
    garden: 'default'
  };
  // Rectangles are [x, y, width, height] in the unchanged original image space.
  // First matching region wins. These are deliberately smaller than decorative
  // boundaries; visually ambiguous borders retain the neutral fallback.
  const regions = {
    church: [
      {surface: 'default', rect: [590, 302, 73, 748], note: 'Central fabric runner over stone'},
      {surface: 'default', rect: [190, 218, 92, 65], note: 'Small study rug'},
      {surface: 'stone', rect: [566, 1060, 132, 35], note: 'Exposed southern stone doorstep'}
    ],
    house: [
      {surface: 'default', rect: [480, 640, 294, 215], note: 'Large central blue rug'},
      {surface: 'default', rect: [218, 620, 121, 73], note: 'Blue kitchen rug'},
      {surface: 'default', rect: [365, 237, 70, 104], note: 'Bedside rug'},
      {surface: 'default', rect: [940, 280, 78, 60], note: 'Small wardrobe rug'},
      {surface: 'stone', rect: [151, 556, 202, 58], note: 'Stone apron beside the hearth'},
      {surface: 'stone', rect: [566, 1040, 126, 57], note: 'Southern stone doorstep'}
    ],
    entrance: [
      {surface: 'stone', rect: [170, 145, 940, 780], note: 'Paved church forecourt and stairs'},
      {surface: 'stone', rect: [545, 925, 165, 329], note: 'Central paved approach toward the square'},
      {surface: 'grass', rect: [200, 1037, 235, 48], note: 'Visible lawn southwest of the forecourt'},
      {surface: 'grass', rect: [805, 1038, 150, 50], note: 'Visible lawn southeast of the forecourt'}
    ],
    garden: [
      // Much of the circular path mixes loose soil and broken cobbles; only
      // compact, visibly paved portions are assigned a stone footstep.
      {surface: 'stone', rect: [596, 94, 38, 145], note: 'Narrow northern paving'},
      {surface: 'stone', rect: [244, 431, 36, 88], note: 'Western ring paving'},
      {surface: 'stone', rect: [917, 438, 30, 82], note: 'Eastern ring paving'},
      {surface: 'stone', rect: [940, 595, 220, 43], note: 'Paved approach to the east gate'},
      {surface: 'stone', rect: [85, 597, 135, 39], note: 'Short western paved approach'},
      {surface: 'stone', rect: [598, 987, 42, 67], note: 'Southern ring paving'},
      {surface: 'stone', rect: [574, 1160, 106, 94], note: 'Paving outside the south gate'},
      {surface: 'grass', rect: [410, 389, 300, 79], note: 'Northern central lawn'},
      {surface: 'grass', rect: [363, 493, 430, 157], note: 'Central lawn, away from the mixed ring path'},
      {surface: 'grass', rect: [415, 770, 290, 50], note: 'Southern central lawn'},
      {surface: 'dirt', rect: [344, 220, 72, 25], note: 'Bare earth immediately below the wooden bench'}
    ]
  };
  const exitCues = {
    church: {stairs_down: 'stairs', church_out: 'churchDoor', church_garden: 'churchDoor'},
    basement: {stairs_up: 'stairs'},
    entrance: {church_in: 'churchDoor', square_out: 'path'},
    // These existing square exits are roads at the image boundary, not the
    // decorative house doors painted in the corners of the square.
    square: {entrance_out: 'path', house_out: 'path', square_garden: 'path'},
    house: {house_exit: 'door'},
    garden: {garden_exit: 'gate', garden_church: 'gate'}
  };
  function at(mapId, x, y) {
    if (!Object.hasOwn(sources, mapId) || !Number.isFinite(x) || !Number.isFinite(y) ||
        x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return 'default';
    const match = (regions[mapId] || []).find(({rect: [left, top, width, height]}) =>
      x >= left && x < left + width && y >= top && y < top + height);
    return match ? match.surface : defaults[mapId];
  }
  function exitCue(source, exit) {
    const id = typeof exit === 'string' ? exit : exit?.id;
    return Object.hasOwn(exitCues, source) && Object.hasOwn(exitCues[source], id)
      ? exitCues[source][id] : 'transition';
  }
  const api = {at, exitCue, sources, defaults, regions, exitCues};
  if (typeof window !== 'undefined') window.SAINT_SURFACES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
