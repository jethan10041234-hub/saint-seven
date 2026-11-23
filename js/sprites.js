/*
 * SAINT SEVEN — distance-driven walking made from the existing sprite pixels.
 * Exposed ankles/shoes and localized forearm/hand regions are articulated.
 * Faces, upper hair and the character design retain the source PNG pixels.
 * Hands use a boundary-fixed pixel warp, avoiding holes behind overlapping
 * arms. The staff hand slides gently along the stationary staff.
 * No source asset is modified and stationary actors use the original image.
 */
(function (root) {
  'use strict';

  const STRIDE_LENGTH = 96; // World pixels travelled per complete left/right step.
  const FRAME_COUNT = 12;
  const cache = new WeakMap();

  // Coordinates are relative to the existing, measured directional crops.
  // The rectangles begin below each garment hem, in the exposed ankle/boot.
  const articulation = {
    hormasset: {
      down:  { crop: [292, 176, 672, 975], legs: [[212, 877, 98, 98], [340, 877, 84, 74]] },
      up:    { crop: [284, 173, 642, 982], legs: [[216, 888, 92, 94], [338, 898, 88, 68]] },
      left:  { crop: [339, 173, 612, 973], legs: [[14, 895, 138, 78], [288, 897, 124, 76]] },
      right: { crop: [254, 174, 705, 967], legs: [[164, 898, 114, 69], [456, 898, 132, 69]] }
    },
    seven: {
      down:  { crop: [283, 103, 704, 1080], legs: [[224, 983, 90, 97], [356, 983, 84, 75]] },
      up:    { crop: [294, 101, 648, 1080], legs: [[214, 980, 76, 68], [324, 993, 88, 87]] },
      left:  { crop: [351, 134, 631, 1018], legs: [[18, 946, 124, 72], [312, 943, 105, 75]] },
      right: { crop: [220, 131, 662, 1031], legs: [[204, 966, 115, 65], [470, 966, 144, 65]] }
    }
  };

  // Measured crop-local hand/forearm regions. core coordinates are relative
  // to each region. X warps swing an arm; Y warps preserve the staff grip.
  // Each region's outside edges stay fixed to the unmodified surrounding art.
  const arms = {
    hormasset: {
      down: [
        {rect:[128,553,110,135],axis:'x',core:[22,80],strength:1.5},
        {rect:[483,478,81,104],axis:'y',core:[24,69],strength:.75}
      ],
      up: [
        {rect:[60,471,100,99],axis:'y',core:[20,64],strength:.75},
        {rect:[458,601,103,115],axis:'x',core:[22,78],strength:1.5}
      ],
      left: [
        {rect:[20,550,142,130],axis:'x',core:[30,90],strength:1.8},
        {rect:[220,508,94,100],axis:'y',core:[28,69],strength:.75}
      ],
      right: [
        {rect:[214,614,112,106],axis:'x',core:[22,84],strength:1.8},
        {rect:[508,487,103,101],axis:'y',core:[24,66],strength:.75}
      ]
    },
    seven: {
      down: [
        {rect:[172,610,128,150],axis:'x',core:[22,83],strength:1.65},
        {rect:[405,629,131,152],axis:'x',core:[35,101],strength:1.65}
      ],
      up: [
        {rect:[84,618,139,155],axis:'x',core:[28,96],strength:1.65},
        {rect:[434,615,116,147],axis:'x',core:[24,90],strength:1.65}
      ],
      left: [
        {rect:[20,570,166,130],axis:'x',core:[30,107],strength:1.8},
        {rect:[230,602,132,140],axis:'x',core:[40,108],strength:1.8}
      ],
      right: [
        {rect:[294,601,125,146],axis:'x',core:[28,93],strength:1.8},
        {rect:[472,566,137,142],axis:'x',core:[38,113],strength:1.8}
      ]
    }
  };

  // The seated image has a large transparent margin. The physical face/head
  // scale matches Hormasset at 84 / 975; seated height is consequently 76,
  // rather than stretching the seated pose to the standing character height.
  const SEVEN_CROUCH = Object.freeze({
    crop: Object.freeze([272, 238, 709, 877]),
    anchor: Object.freeze([355, 875]),
    height: 76
  });

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  function prepare(image, character, facing, crop) {
    const spec = articulation[character]?.[facing];
    if (!spec) return null;
    let sprites = cache.get(image);
    if (!sprites) cache.set(image, sprites = new Map());
    const key = [character, facing, ...crop].join(':');
    if (sprites.has(key)) return sprites.get(key);

    const [sx, sy, sw, sh] = crop;
    const body = makeCanvas(sw, sh);
    body.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const legs = spec.legs.map(([lx, ly, width, height]) => {
      // Support an adjusted crop without detaching the measured foot regions.
      const x = lx + spec.crop[0] - sx;
      const y = ly + spec.crop[1] - sy;
      const patch = makeCanvas(width, height);
      patch.ctx.drawImage(image, sx + x, sy + y, width, height, 0, 0, width, height);
      body.ctx.clearRect(x, y, width, height);
      return { image: patch.canvas, x, y, width, height };
    });
    const hands = arms[character][facing].map(({rect:[lx,ly,width,height],...options}) => {
      const x=lx+spec.crop[0]-sx,y=ly+spec.crop[1]-sy;
      const patch=makeCanvas(width,height);
      patch.ctx.drawImage(image,sx+x,sy+y,width,height,0,0,width,height);
      return {image:patch.canvas,x,y,width,height,...options};
    });
    const frame = makeCanvas(sw, sh);
    const entry = { body: body.canvas, legs, hands, frame, phase: -1, renderHeight: 0 };
    sprites.set(key, entry);
    return entry;
  }

  function drawHand(ctx,hand,displacement){
    const {image,x,y,width,height,axis,core:[start,end]}=hand;
    // Replace the complete local patch, including any hair behind the hand.
    // Three adjoining source slices cover every destination pixel. No erased
    // hand silhouette is left empty, and no new colours or painted pixels are
    // introduced. This drawImage-only method also works in offline file mode.
    ctx.clearRect(x,y,width,height);
    const across=axis==='x'?width:height,along=axis==='x'?height:width;
    const bands=16;
    for(let band=0;band<bands;band++){
      const a=Math.round(band/bands*along),b=Math.round((band+1)/bands*along);
      const position=(a+b)/2/along;
      const weight=Math.sin(Math.PI*position);
      const shift=Math.max(1-start,Math.min(across-end-1,Math.round(displacement*weight)));
      const slices=[[0,start,0,start+shift],[start,end-start,start+shift,end-start],[end,across-end,end+shift,across-end-shift]];
      for(const [source,length,destination,destinationLength] of slices){
        if(axis==='x')ctx.drawImage(image,source,a,length,b-a,x+destination,y+a,destinationLength,b-a);
        else ctx.drawImage(image,a,source,b-a,length,x+a,y+destination,b-a,destinationLength);
      }
    }
  }

  function renderFrame(entry, phase, height, sourceHeight, facing) {
    if (entry.phase === phase && entry.renderHeight === height) return entry.frame.canvas;
    const { canvas, ctx } = entry.frame;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const angle = phase / FRAME_COUNT * Math.PI * 2;
    const profile = facing === 'left' || facing === 'right';
    const direction = facing === 'left' ? -1 : 1;
    const sourcePerWorldPixel = sourceHeight / height;

    entry.legs.forEach((leg, index) => {
      const swing = Math.sin(angle + index * Math.PI);
      // Opposing feet travel forward/back and lift on their swing phase.
      // The top of each ankle stays joined to its original source position.
      const desiredShift = swing * (profile ? 3.4 * direction : 0.55) * sourcePerWorldPixel;
      // Left-facing originals already extend one shoe close to the crop edge.
      // Keep the entire shoe patch inside the existing canvas (with a pixel
      // of padding) so the outward swing cannot clip the original toe pixels.
      const shift = Math.max(1-leg.x,Math.min(canvas.width-leg.x-leg.width-1,desiredShift));
      const lift = -Math.max(0, swing) * (profile ? 2.1 : 2.6) * sourcePerWorldPixel;
      const bands = 10;
      for (let band = 0; band < bands; band++) {
        const top = Math.round(band / bands * leg.height);
        const bottom = Math.round((band + 1) / bands * leg.height);
        // Movement reaches full amplitude halfway down the boot, preserving
        // the shoe shape while allowing the ankle to bend in small pixel steps.
        const weight = Math.min(1, top / leg.height * 2.4);
        const nextWeight = Math.min(1, bottom / leg.height * 2.4);
        const dx = Math.round(shift * weight);
        const dy = Math.round(lift * weight);
        const nextDy = Math.round(lift * nextWeight);
        const destinationHeight = bottom - top + nextDy - dy;
        if (destinationHeight > 0) {
          ctx.drawImage(leg.image, 0, top, leg.width, bottom - top,
            leg.x + dx, leg.y + top + dy, leg.width, destinationHeight);
        }
      }
    });
    // Original upper pixels protect the skirt, coat and hair from the feet.
    ctx.drawImage(entry.body, 0, 0);
    entry.hands.forEach((hand,index)=>{
      const swing=Math.sin(angle+index*Math.PI+Math.PI);
      drawHand(ctx,hand,swing*hand.strength*sourcePerWorldPixel);
    });
    entry.phase = phase;
    entry.renderHeight = height;
    return canvas;
  }

  /**
   * Resolve a drawImage source. All output anchors are crop-local, matching
   * game.js. Pass actual accumulated world distance, never elapsed key time.
   * Idle, crouching, unsupported characters and failed canvases safely retain
   * the original source. The canvas cache holds one current frame per image.
   */
  function resolve(image, options) {
    const { character, facing = 'down', crop, anchor = [crop[2] / 2, crop[3]],
      height = 84, moving = false, distance = 0, crouching = false } = options;
    const original = { image, crop, anchor, bobY:0 };
    if (!moving || crouching || !Number.isFinite(distance) || !(height > 0)) return original;
    try {
      const entry = prepare(image, character, facing, crop);
      if (!entry) return original;
      const cycle = ((distance % STRIDE_LENGTH) + STRIDE_LENGTH) % STRIDE_LENGTH;
      const phase = Math.floor(cycle / STRIDE_LENGTH * FRAME_COUNT);
      return {
        image: renderFrame(entry, phase, height, crop[3], facing),
        crop: [0, 0, crop[2], crop[3]],
        anchor,
        // Two small upward beats per stride; keep the ground shadow fixed.
        bobY: -Math.round(1.6*Math.abs(Math.sin(phase/FRAME_COUNT*Math.PI*2)))
      };
    } catch (_) {
      // Canvas/art loading issues must never prevent normal game rendering.
      return original;
    }
  }

  // Call once per simulation tick, after collision resolution. A zero distance
  // immediately restores the idle source, including when blocked by a wall.
  function updateMotion(record, actualDistance) {
    const distance = Number(actualDistance);
    record.moving = Number.isFinite(distance) && distance > 0.001 && distance < 128;
    if (record.moving) record.distance = ((record.distance || 0) + distance) % STRIDE_LENGTH;
    record.frame = record.moving ? Math.floor((record.distance || 0) / STRIDE_LENGTH * FRAME_COUNT) : 0;
    return record.moving;
  }

  function resetMotion(record) {
    record.moving = false;
    record.distance = 0;
    record.frame = 0;
  }

  root.SAINT_SPRITES = Object.freeze({ resolve, updateMotion, resetMotion, SEVEN_CROUCH, STRIDE_LENGTH });
})(typeof window !== 'undefined' ? window : globalThis);
