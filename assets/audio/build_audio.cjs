#!/usr/bin/env node
'use strict';
/* Reproducible PCM16 export of the original browser/offline synthesizer. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const score=require('../../js/audio-score.js');
const project=path.resolve(__dirname,'../..');
function wav(sound){
  const channels=sound.channels.length,bytes=sound.frames*channels*2,out=Buffer.alloc(44+bytes);
  out.write('RIFF',0);out.writeUInt32LE(36+bytes,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);
  out.writeUInt16LE(1,20);out.writeUInt16LE(channels,22);out.writeUInt32LE(sound.sampleRate,24);
  out.writeUInt32LE(sound.sampleRate*channels*2,28);out.writeUInt16LE(channels*2,32);out.writeUInt16LE(16,34);
  out.write('data',36);out.writeUInt32LE(bytes,40);
  for(let i=0;i<sound.frames;i++)for(let c=0;c<channels;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sound.channels[c][i]))*32767),44+(i*channels+c)*2);
  return out;
}
const assets=[];
for(const entry of score.manifest){
  const started=performance.now(),sound=score.render(entry.id),bytes=wav(sound),destination=path.join(project,entry.path);
  if(!Number.isFinite(sound.rms)||sound.rms<=0||sound.peak>.601)throw new Error('Invalid signal: '+entry.id);
  if(entry.loop&&sound.seamSlopeChange>.12)throw new Error('Unsafe loop edge: '+entry.id);
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
  const asset={...entry,sampleRate:sound.sampleRate,channels:sound.channels.length,encoding:'PCM signed 16-bit little-endian',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),rms:sound.rms,peak:sound.peak,seamDelta:sound.seamDelta,seamSlopeChange:sound.seamSlopeChange};
  assets.push(asset);console.log(entry.id+' '+bytes.length+' bytes; RMS '+sound.rms.toFixed(5)+'; '+Math.round(performance.now()-started)+' ms');
}
const manifest={title:score.title,version:score.version,origin:'Original procedural composition and mathematical sound synthesis created for SAINT SEVEN; no external music, samples, recordings or third-party melody.',license:'These project-original compositions, sound-design definitions and rendered audio are supplied for unrestricted use and modification within SAINT SEVEN and its demonstrations; no external attribution or audio licence dependency.',buildCommand:'node assets/audio/build_audio.cjs',totalBytes:assets.reduce((n,x)=>n+x.bytes,0),assets};
fs.mkdirSync(path.join(project,'docs'),{recursive:true});
fs.writeFileSync(path.join(project,'docs/audio-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Total: '+manifest.totalBytes+' bytes');
