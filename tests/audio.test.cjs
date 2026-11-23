'use strict';
/* Regression checks use the actual exported WAVs and browser-facing audio module.
   Fake AudioContext supplies a deterministic clock; this does not replace listening QA. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),score=require(path.join(root,'js/audio-score.js'));
const source=fs.readFileSync(path.join(root,'js/audio.js'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
const flush=()=>new Promise(resolve=>setTimeout(resolve,8));
function environment({mode='file-assets',noAudio=false,storageDenied=false,stored}={}){
  const instances=[],listeners=new Map(),intervals=new Map(),storage=new Map(stored||[]);let intervalId=0,fetchCount=0;
  class Param{constructor(value=1){this.value=value;this.events=[];}cancelScheduledValues(t){this.events.push(['cancel',t]);}setTargetAtTime(v,t,d){this.value=v;this.events.push(['target',v,t,d]);}setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);}}
  class Gain{constructor(){this.gain=new Param();}connect(){}disconnect(){this.disconnected=true;}}
  class BufferSource{constructor(ctx){this.ctx=ctx;this.playbackRate=new Param();this.loop=false;}connect(){}disconnect(){this.disconnected=true;}start(t=0){this.started=true;this.startAt=t;this.ctx.sources.push(this);if(!this.loop)this.stopAt=Math.max(t,this.ctx.currentTime)+this.buffer.duration/this.playbackRate.value;}stop(t=this.ctx.currentTime){this.stopAt=t;if(t<=this.ctx.currentTime)this.finish();}finish(){if(this.ended)return;this.ended=true;this.onended?.();}}
  class Context{
    constructor(){this.state='suspended';this.currentTime=0;this.sources=[];this.destination={};this.resumes=0;instances.push(this);}
    createGain(){return new Gain();}createBiquadFilter(){const g=new Gain();g.frequency=new Param(6200);g.Q=new Param(.35);return g;}createBufferSource(){return new BufferSource(this);}
    createBuffer(n,length,sampleRate){const data=Array.from({length:n},()=>new Float32Array(length));return {length,sampleRate,numberOfChannels:n,duration:length/sampleRate,getChannelData:i=>data[i]};}
    resume(){this.resumes++;this.state='running';this.onstatechange?.();return Promise.resolve();}
    suspend(){this.state='suspended';this.onstatechange?.();return Promise.resolve();}
    close(){this.state='closed';this.onstatechange?.();return Promise.resolve();}
    advance(seconds){if(this.state!=='running')return;this.currentTime+=seconds;for(const s of this.sources)if(s.stopAt<=this.currentTime)s.finish();}
  }
  const document={hidden:false,addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
  const window={SAINT_AUDIO_SCORE:score,location:{protocol:mode==='offline'?'file:':'http:'},localStorage:{getItem:k=>{if(storageDenied)throw new Error('Storage denied');return storage.get(k)||null;},setItem:(k,v)=>{if(storageDenied)throw new Error('Storage denied');storage.set(k,v);}},atob:s=>Buffer.from(s,'base64').toString('binary')};
  if(!noAudio)window.AudioContext=Context;
  if(mode==='embedded')window.SAINT_EMBEDDED=Object.fromEntries(score.manifest.map(item=>[item.path,'data:audio/wav;base64,'+fs.readFileSync(path.join(root,item.path)).toString('base64')]));
  window.fetch=async file=>{fetchCount++;if(mode==='missing')return {ok:false};const bytes=fs.readFileSync(path.join(root,file));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
  vm.runInNewContext(source,{window,document,console,setTimeout,clearTimeout,setInterval:fn=>{intervals.set(++intervalId,fn);return intervalId;},clearInterval:id=>intervals.delete(id),AbortController,Float32Array,Uint8Array,DataView,ArrayBuffer,Promise,Map,Set});
  return {api:window.SAINT_AUDIO,instances,document,storage,intervals,get fetchCount(){return fetchCount;},visibility:hidden=>{document.hidden=hidden;listeners.get('visibilitychange')?.();},ambientTick:()=>{for(const fn of intervals.values())fn();}};
}
(async()=>{
  const env=environment(),audio=env.api.create();
  check('25 real WAV files exposed, six music pieces and two ambience loops',()=>{assert.equal(env.api.assetPaths.length,25);assert.equal(score.manifest.filter(x=>x.channel==='bgm').length,6);assert.equal(score.manifest.filter(x=>x.channel==='ambience').length,2);});
  check('no autoplay or context allocation before input',()=>{assert.equal(env.instances.length,0);assert.equal(audio.snapshot().started,false);assert.equal(audio.snapshot().state,'uninitialized');});
  audio.setScene({map:'church',phase:'opening'});
  const opening=audio.start(),secondStart=audio.start();
  check('gesture synchronously resumes a single context',()=>{assert.equal(env.instances.length,1);assert.equal(env.instances[0].resumes,1);});
  await Promise.all([opening,secondStart]);await flush();const ctx=env.instances[0];
  check('real WAV-backed church music and room ambience start exactly once',()=>{const s=audio.snapshot();assert.equal(s.currentTrack,'bgm_church');assert.equal(s.ambienceTrack,'ambience_interior');assert.equal(s.sourceStartCount,1);assert.equal(s.ambienceStartCount,1);assert.equal(s.loopSeconds,24);assert.equal(s.origins.bgm_church,'file');assert(s.hasSignal&&s.rms>.01&&s.peak<1);});
  ctx.advance(5);audio.setScene({phase:'investigation',map:'house'});await flush();
  check('same music category preserves source and playhead',()=>{assert.equal(audio.snapshot().sourceStartCount,1);assert.equal(audio.snapshot().playhead,5);});
  audio.setScene({map:'entrance'});await flush();ctx.advance(2);const outside=audio.snapshot();audio.setScene({map:'garden'});audio.setScene({map:'square'});await flush();
  check('outdoor scene crossfades once and shared maps do not restart',()=>{const s=audio.snapshot();assert.equal(s.currentTrack,'bgm_outdoor');assert.equal(s.sourceStartCount,2);assert.equal(s.ambienceTrack,'ambience_outdoor');assert.equal(s.playhead,outside.playhead);});
  audio.resetFootsteps();const count=audio.snapshot().footsteps.count;audio.footsteps(47,'square','stone',true);await flush();
  check('47 actual pixels do not prematurely trigger a footfall',()=>assert.equal(audio.snapshot().footsteps.count,count));
  audio.footsteps(1,'square','stone',true);await flush();ctx.advance(.25);audio.footsteps(48,'square','stone',true);await flush();
  check('48px cadence alternates feet with small natural variation',()=>{const s=audio.snapshot(),steps=s.history.filter(h=>h.name==='step');assert.equal(s.footsteps.count,count+2);assert.equal(steps.length,2);assert.equal(steps[0].foot,'left');assert.equal(steps[1].foot,'right');assert.notEqual(steps[0].pitch,steps[1].pitch);assert(steps.every(x=>x.pitch>=.96&&x.pitch<=1.04));assert.equal(s.footsteps.distance,0);});
  audio.footsteps(0,'square','stone',true);ctx.advance(.03);
  check('standing, turning, and blocked movement stop tails without new steps',()=>{const s=audio.snapshot();assert.equal(s.footsteps.count,count+2);assert.equal(s.footsteps.activeVoices,0);assert.equal(s.footsteps.active,false);});
  audio.footsteps(47,'square','stone');audio.footsteps(0,'square','stone');audio.footsteps(1,'square','stone');await flush();
  check('pause/resume retains gait phase for sprite synchronization',()=>assert.equal(audio.snapshot().footsteps.count,count+3));
  audio.footsteps(500,'square','stone');audio.footsteps(48,'church','church');await flush();
  check('teleport distances and map mismatches never create steps',()=>{assert.equal(audio.snapshot().footsteps.count,count+3);assert.equal(audio.snapshot().footsteps.distance,0);});
  audio.footsteps(48,'square','grass');audio.stopFootsteps();await flush();
  check('stopping cancels asynchronous footfall loads and active tails',()=>assert.equal(audio.snapshot().footsteps.activeVoices,0));
  for(const surface of ['dirt','grass','stone','church','wood','default']){audio.resetFootsteps();audio.footsteps(48,'square',surface);await flush();ctx.advance(.8);}
  check('five distinct material assets and neutral fallback play',()=>{const h=audio.snapshot().history.filter(x=>x.name==='step');for(const surface of ['dirt','grass','stone','church','wood','default'])assert(h.some(x=>x.surface===surface));});
  for(const name of ['door_open','door_close','choice_focus','choice_confirm','dialogue_open','item','event_transition','ending','ritual_strike']){await audio.sfx(name);ctx.advance(.2);}
  await audio.dialogueTick('가');await audio.dialogueTick('나');await audio.dialogueTick('…');
  check('interaction cues play and syllables are rate limited',()=>{const s=audio.snapshot();for(const name of ['door_open','door_close','choice_focus','choice_confirm','dialogue_open','item','event_transition','ending','ritual_strike'])assert(s.sfxCounts[name]>=1);assert.equal(s.sfxCounts.dialogue_tick,1);});
  const waitDoor=()=>new Promise(resolve=>setTimeout(resolve,380));
  let closes=audio.snapshot().sfxCounts.door_close||0;
  audio.door('churchDoor');assert.equal(audio.snapshot().doorClosePending,true);await waitDoor();
  check('real church door settles once after 340ms through SFX channel',()=>{const s=audio.snapshot();assert.equal(s.sfxCounts.door_close,closes+1);assert.equal(s.doorClosePending,false);const close=s.history.filter(x=>x.name==='door_close').at(-1);assert.equal(close.channel,'sfx');assert.equal(close.volume,.48);});
  closes=audio.snapshot().sfxCounts.door_close;audio.door('door');audio.door('gate');await waitDoor();
  check('rapid door replacement cancels previous close',()=>assert.equal(audio.snapshot().sfxCounts.door_close,closes+1));
  closes=audio.snapshot().sfxCounts.door_close;audio.door('door');audio.setScene({map:'garden'});await waitDoor();
  check('arriving in another map cancels stale close',()=>assert.equal(audio.snapshot().sfxCounts.door_close,closes));
  audio.door('path');await waitDoor();
  check('ordinary paths never invent a closing door',()=>assert.equal(audio.snapshot().sfxCounts.door_close,closes));
  audio.door('gate');audio.setScene({phase:'title'});await waitDoor();
  check('returning to title cancels closing-door timer',()=>{assert.equal(audio.snapshot().sfxCounts.door_close,closes);assert.equal(audio.snapshot().doorClosePending,false);});
  audio.setScene({map:'square',phase:'investigation'});await flush();audio.door('door');audio.setChannelEnabled('sfx',false);audio.setChannelEnabled('sfx',true);await waitDoor();
  check('muting effects cancels a pending close even if reenabled quickly',()=>assert.equal(audio.snapshot().sfxCounts.door_close,closes));
  const gainBefore=audio.snapshot().channels.bgm.targetGain;audio.setDialogue(true);
  check('dialogue lowers music and ambient gain',()=>{assert(audio.snapshot().channels.bgm.targetGain<gainBefore);assert(audio.snapshot().channels.ambience.targetGain<.3);});
  audio.duck(800);check('event duck has a scheduled recovery',()=>assert(audio.snapshot().ducked));ctx.advance(.9);check('duck expires by audio clock',()=>assert.equal(audio.snapshot().ducked,false));audio.setDialogue(false);
  const previousStarts=audio.snapshot().sourceStartCount;audio.setEnabled(false);
  check('master mute is independent of channel choices and persistent',()=>{assert.equal(audio.snapshot().masterGain,0);assert.equal(audio.snapshot().channels.bgm.enabled,true);assert.equal(JSON.parse(env.storage.get('saint-seven:audio-v06')).enabled,false);});
  audio.setEnabled(true);await flush();check('unmute keeps existing music source',()=>assert.equal(audio.snapshot().sourceStartCount,previousStarts));
  audio.setChannelEnabled('bgm',false);audio.setVolume('ambience',.11);audio.setVolume('sfx',.23);audio.setVolume('master',.61);
  check('independent channel controls alter actual gain targets',()=>{const s=audio.snapshot();assert.equal(s.channels.bgm.targetGain,0);assert.equal(s.channels.ambience.targetGain,.11);assert.equal(s.channels.sfx.targetGain,.23);assert.equal(s.masterGain,.61);});
  audio.setChannelEnabled('bgm',true);audio.setScene({phase:'ritual'});await flush();audio.ritualTick(0,'normal');const cutoff=audio.snapshot().ritual.cutoff;audio.ritualTick(3,'normal');check('ritual progressively reveals upper dissonant strings',()=>assert(audio.snapshot().ritual.cutoff>cutoff));audio.ritualTick(3.6,'normal');
  check('ritual buildup has deliberate near-strike musical silence',()=>{assert.equal(audio.snapshot().currentTrack,'bgm_ritual');assert.equal(audio.snapshot().ritual.silent,true);assert.equal(audio.snapshot().channels.bgm.targetGain,0);});audio.ritualTick(4.6,'normal');assert(audio.snapshot().channels.bgm.targetGain>0);
  for(const ending of ['normal','bad','true']){audio.setScene({phase:'ending',ending});await flush();check('distinct '+ending+' ending score',()=>assert.equal(audio.snapshot().currentTrack,'bgm_ending_'+ending));}
  const heads=audio.snapshot().playhead;env.visibility(true);ctx.advance(80);check('hidden tab suspends without advancing loop clock',()=>{assert.equal(audio.snapshot().contextState,'suspended');assert.equal(audio.snapshot().playhead,heads);assert.equal(audio.snapshot().activeVoices,0);});env.visibility(false);await flush();assert.equal(audio.snapshot().contextState,'running');
  audio.setScene({map:'entrance',phase:'investigation'});await flush();ctx.advance(120);env.ambientTick();await flush();const h=audio.snapshot().history;env.ambientTick();await flush();
  check('rare ambient cues schedule once, without accumulated backlog',()=>assert.equal(audio.snapshot().history.length,h.length));
  audio.setScene({phase:'title'});await flush();audio.setEnabled(false);audio.setEnabled(true);await flush();
  check('master control on title does not restart gameplay music',()=>{assert.equal(audio.snapshot().scene.phase,'title');assert.equal(audio.snapshot().currentTrack,null);assert.equal(audio.snapshot().targetGain,0);});
  audio.door('door');audio.dispose();await waitDoor();check('dispose tears down audio, pending doors, and ambience timer',()=>{assert.equal(env.intervals.size,0);assert.equal(audio.snapshot().doorClosePending,false);assert.equal(audio.snapshot().contextState,'closed');assert.equal(audio.snapshot().disposed,true);});
  for(const mode of ['embedded','offline','missing']){const e=environment({mode}),a=e.api.create();a.setScene({phase:'opening',map:'church'});await a.start();await flush();check(mode+' playback has audible data and correct provenance',()=>{assert(a.snapshot().hasSignal);assert.equal(a.snapshot().origins.bgm_church,mode==='embedded'?'embedded':'synth');if(mode==='embedded'||mode==='offline')assert.equal(e.fetchCount,0);});a.dispose();}
  const disabled=environment({noAudio:true,storageDenied:true}),safe=disabled.api.create();await safe.start();safe.setVolume('master',.3);safe.toggle();safe.setScene({map:'garden'});safe.footsteps(48,'garden','grass');safe.dispose();
  check('missing AudioContext and denied storage never interrupt game',()=>assert.equal(safe.snapshot().available,false));
  console.log('\n'+passed+' audio regression checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
