'use strict';
/* SAINT SEVEN v0.6 — original, locally generated audio. See docs/AUDIO_MANIFEST.md.
   Audio is unlocked only by start()/resume() from the player's input. WAV assets
   and standalone data URLs share the same score as the offline synthesis fallback. */
window.SAINT_AUDIO = (() => {
  const SCORE=window.SAINT_AUDIO_SCORE, MANIFEST=SCORE?.manifest||[];
  const FILES=new Map(MANIFEST.map(item=>[item.id,item]));
  const STORAGE_KEY='saint-seven:audio-v06', STRIDE=48;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const aliases={focus:'choice_focus',confirm:'choice_confirm',dialogue:'dialogue_open',transition:'event_transition',strike:'ritual_strike',release:'ending',stop:'event_transition',item_acquire:'item'};
  const defaults={bgm:.42,ambience:.30,sfx:.52};

  function create({onChange}={}){
    let context=null,master=null,started=false,disposed=false,unavailable=false,enabled=true,volume=.75;
    let scene={map:'church',phase:'title',ending:null},dialogue=false,duckUntil=0,ritualMix=1,ritualSilent=false;
    let startCount=0,ambienceStartCount=0,randomSeed=0x57a17,audioTimer=null,hiddenAt=null;
    let nextBird=0,nextBell=0,masterGain=0,ritualCutoff=6200,bgmFilter=null,doorTimer=null,doorEpoch=0;
    const channels=Object.fromEntries(Object.entries(defaults).map(([name,v])=>[name,{enabled:true,volume:v,node:null,targetGain:0}]));
    const loops={bgm:null,ambience:null},pending={bgm:null,ambience:null},tokens={bgm:0,ambience:0};
    const buffers=new Map(),loads=new Map(),origins={},metrics={},voices=new Set(),retiring=new Set(),history=[],sfxCounts={};
    const foot={distance:0,totalDistance:0,foot:0,count:0,active:false,epoch:0};
    const cooldown=new Map();
    try{
      const raw=window.localStorage?.getItem(STORAGE_KEY),saved=raw?JSON.parse(raw):null;
      if(saved){enabled=saved.enabled!==false;if(Number.isFinite(saved.volume))volume=clamp(saved.volume);
        for(const name of Object.keys(channels)){const c=saved.channels?.[name];if(c){channels[name].enabled=c.enabled!==false;if(Number.isFinite(c.volume))channels[name].volume=clamp(c.volume);}}}
      else enabled=window.localStorage?.getItem('saint-seven:bgm-enabled')!=='off';
    }catch{}
    const random=()=>{randomSeed^=randomSeed<<13;randomSeed^=randomSeed>>>17;randomSeed^=randomSeed<<5;return (randomSeed>>>0)/4294967296;};
    function now(){return context?.currentTime||0;}
    function notify(){try{onChange?.(snapshot());}catch{}}
    function save(){try{window.localStorage?.setItem(STORAGE_KEY,JSON.stringify({enabled,volume,channels:Object.fromEntries(Object.entries(channels).map(([n,c])=>[n,{enabled:c.enabled,volume:c.volume}]))}));}catch{}}
    function ramp(param,value,seconds=.4){if(!param||!context)return;try{const t=now();param.cancelScheduledValues(t);param.setTargetAtTime(value,t,Math.max(.004,seconds/3));}catch{}}
    function classify(){
      const outside=['entrance','square','garden'].includes(scene.map);
      if(scene.phase==='title')return {bgm:null,ambience:null,bgmLevel:0,ambienceLevel:0,outside:false};
      if(scene.phase==='ending'){const kind=['normal','bad','true'].includes(scene.ending)?scene.ending:'normal';return {bgm:'bgm_ending_'+kind,ambience:kind==='true'?'ambience_outdoor':'ambience_interior',bgmLevel:.95,ambienceLevel:.35,outside:kind==='true'};}
      if(scene.phase==='ritual')return {bgm:'bgm_ritual',ambience:'ambience_interior',bgmLevel:ritualMix,ambienceLevel:.45,outside:false};
      return {bgm:outside?'bgm_outdoor':'bgm_church',ambience:outside?'ambience_outdoor':'ambience_interior',bgmLevel:scene.map==='basement'?.72:1,ambienceLevel:scene.map==='basement'?.7:1,outside};
    }
    function applyMix(seconds=.6){
      const settings=classify(),ducked=now()<duckUntil;
      masterGain=enabled&&started&&!disposed?volume:0;ramp(master?.gain,masterGain,seconds);
      ramp(bgmFilter?.frequency,scene.phase==='ritual'?ritualCutoff:6200,seconds);
      for(const [name,c] of Object.entries(channels)){
        const level=name==='bgm'?settings.bgmLevel*(dialogue?.55:1)*(ritualSilent?0:1):name==='ambience'?settings.ambienceLevel*(dialogue?.72:1)*(ritualSilent?.15:1):1;
        c.targetGain=c.enabled&&started&&!disposed?c.volume*level:0;
        ramp(c.node?.gain,c.targetGain*(ducked&&name!=='sfx'?.27:1),seconds);
        if(ducked&&name!=='sfx'&&c.node){try{c.node.gain.setTargetAtTime(c.targetGain,duckUntil,.3);}catch{}}
      }
    }
    function ensureContext(){
      if(context)return context;if(disposed||unavailable)return null;
      try{
        const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor){unavailable=true;notify();return null;}
        context=new Constructor();master=context.createGain();master.gain.value=0;master.connect(context.destination);
        for(const [name,c] of Object.entries(channels)){c.node=context.createGain();c.node.gain.value=0;
          if(name==='bgm'&&context.createBiquadFilter){bgmFilter=context.createBiquadFilter();bgmFilter.type='lowpass';bgmFilter.frequency.value=6200;bgmFilter.Q.value=.35;c.node.connect(bgmFilter);bgmFilter.connect(master);}
          else c.node.connect(master);}
        context.onstatechange=notify;
        return context;
      }catch{unavailable=true;notify();return null;}
    }
    function pcmWav(bytes){
      const v=new DataView(bytes);if(v.byteLength<44||v.getUint32(0,false)!==0x52494646||v.getUint32(8,false)!==0x57415645)throw new Error('Not WAV');
      let format=null,data=null;
      for(let at=12;at+8<=v.byteLength;){const id=v.getUint32(at,false),size=v.getUint32(at+4,true),body=at+8;
        if(body+size>v.byteLength)throw new Error('Truncated WAV');
        if(id===0x666d7420&&size>=16)format={type:v.getUint16(body,true),channels:v.getUint16(body+2,true),rate:v.getUint32(body+4,true),bits:v.getUint16(body+14,true)};
        if(id===0x64617461)data={at:body,size};at=body+size+(size%2);
      }
      if(!format||!data||format.type!==1||format.bits!==16||format.channels<1||format.channels>2)throw new Error('Unsupported PCM');
      const frames=Math.floor(data.size/(format.channels*2)),b=context.createBuffer(format.channels,frames,format.rate);
      for(let ch=0;ch<format.channels;ch++){const out=b.getChannelData(ch);for(let i=0;i<frames;i++)out[i]=v.getInt16(data.at+(i*format.channels+ch)*2,true)/32768;}
      return b;
    }
    function measure(buffer){
      const data=buffer.getChannelData(0);let peak=0,sum=0;for(let i=0;i<data.length;i++){const value=data[i];sum+=value*value;peak=Math.max(peak,Math.abs(value));}
      const n=data.length;return {rms:Math.sqrt(sum/n),peak,seamDelta:Math.abs(data[0]-data[n-1]),seamSlopeChange:Math.abs((data[1]-data[0])-(data[0]-data[n-1]))};
    }
    async function fileBytes(path){
      const embedded=window.SAINT_EMBEDDED?.[path]||window.SAINT_EMBEDDED?.audio?.[path];
      if(embedded){
        if(typeof embedded==='string'&&embedded.startsWith('data:')){const comma=embedded.indexOf(','),binary=/;base64,/i.test(embedded)?window.atob(embedded.slice(comma+1)):decodeURIComponent(embedded.slice(comma+1)),out=new Uint8Array(binary.length);for(let i=0;i<out.length;i++)out[i]=binary.charCodeAt(i);return {bytes:out.buffer,origin:'embedded'};}
        throw new Error('Invalid embedded audio');
      }
      // file:// needs no server; deterministic synthesis is the local fallback.
      if(window.location?.protocol==='file:'||typeof window.fetch!=='function')throw new Error('Use offline score');
      const controller=typeof AbortController==='function'?new AbortController():null;
      const timeout=controller?setTimeout(()=>controller.abort(),2500):null;
      try{const response=await window.fetch(path,controller?{signal:controller.signal}:undefined);if(!response.ok)throw new Error('Missing audio asset');return {bytes:await response.arrayBuffer(),origin:'file'};}
      finally{if(timeout!==null)clearTimeout(timeout);}
    }
    function load(id){
      if(buffers.has(id))return Promise.resolve(buffers.get(id));if(loads.has(id))return loads.get(id);
      const descriptor=FILES.get(id);if(!descriptor||!context||disposed)return Promise.resolve(null);
      const task=(async()=>{
        let b=null;
        try{const result=await fileBytes(descriptor.path);if(disposed)return null;b=pcmWav(result.bytes);origins[id]=result.origin;}
        catch{
          // Yield once so button/UI paints after the synchronous gesture unlock.
          await new Promise(resolve=>setTimeout(resolve,0));if(disposed||!context)return null;
          try{const score=SCORE.render(id);b=context.createBuffer(score.channels.length,score.channels[0].length,score.sampleRate);score.channels.forEach((data,i)=>b.getChannelData(i).set(data));origins[id]='synth';}
          catch{return null;}
        }
        if(disposed)return null;buffers.set(id,b);metrics[id]=measure(b);return b;
      })().catch(()=>null);
      loads.set(id,task);return task;
    }
    function stopLoop(record,fade=1.4){
      if(!record)return;retiring.add(record);ramp(record.gain.gain,0,fade);
      try{record.source.stop(now()+fade+.08);}catch{retiring.delete(record);try{record.source.disconnect();record.gain.disconnect();}catch{}}
    }
    function syncLoop(channel,id){
      if(!context||!started||disposed)return Promise.resolve(false);
      if(loops[channel]?.id===id){if(pending[channel]&&pending[channel].id!==id){tokens[channel]++;pending[channel]=null;}return Promise.resolve(true);}
      if(pending[channel]?.id===id)return pending[channel].task;
      const token=++tokens[channel];
      if(!id){pending[channel]=null;stopLoop(loops[channel],.8);loops[channel]=null;return Promise.resolve(true);}
      const task=load(id).then(buffer=>{
        if(!buffer||disposed||token!==tokens[channel])return false;
        if(classify()[channel]!==id)return false;
        const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;gain.gain.value=0;source.connect(gain);gain.connect(channels[channel].node);
        const record={id,source,gain,startAt:now(),duration:buffer.duration};
        source.onended=()=>{retiring.delete(record);try{source.disconnect();gain.disconnect();}catch{}};
        source.start(record.startAt);stopLoop(loops[channel]);loops[channel]=record;pending[channel]=null;
        if(channel==='bgm')startCount++;else ambienceStartCount++;
        ramp(gain.gain,1,1.6);notify();return true;
      }).catch(()=>false);
      pending[channel]={id,task};return task;
    }
    function syncScene(){const s=classify();return Promise.all([syncLoop('bgm',s.bgm),syncLoop('ambience',s.ambience)]);}
    function start(){
      if(disposed)return Promise.resolve(false);started=true;
      const c=ensureContext();if(!c)return Promise.resolve(false);
      let unlocked;
      // This call must stay before any await: mobile/WebKit gesture policies depend on it.
      try{unlocked=c.state==='suspended'?c.resume():Promise.resolve();}catch{unlocked=Promise.resolve();}
      applyMix(1.3);
      if(!audioTimer){nextBird=now()+11+random()*10;nextBell=now()+25+random()*18;audioTimer=setInterval(ambientTick,750);}
      for(const item of MANIFEST)if(item.channel==='sfx')load(item.id);
      return Promise.all([Promise.resolve(unlocked).catch(()=>{}),syncScene()]).then(()=>{
        if(disposed)return false;applyMix(1.1);if(document.hidden){try{Promise.resolve(c.suspend()).catch(()=>{});}catch{}}notify();return c.state==='running';
      }).catch(()=>false);
    }
    function setEnabled(value){enabled=!!value;save();if(!enabled){cancelDoor();stopAllVoices();}applyMix(.24);if(enabled&&started)start();notify();return enabled;}
    function setChannelEnabled(name,value){const c=channels[name];if(!c)return false;c.enabled=!!value;if(!c.enabled){if(name==='sfx')cancelDoor();for(const voice of [...voices])if(voice.channel===name)endVoice(voice,.015);}save();applyMix(.24);notify();return c.enabled;}
    function setVolume(name,value){if(!Number.isFinite(Number(value)))return false;value=clamp(Number(value));if(name==='master')volume=value;else if(channels[name])channels[name].volume=value;else return false;save();applyMix(.16);notify();return value;}
    function setScene(next){
      const update=typeof next==='string'?{phase:next}:next||{};if(Object.entries(update).every(([key,value])=>scene[key]===value))return;
      const old=scene;scene={...scene,...update};if(old.map!==scene.map||scene.phase==='title')cancelDoor();if(old.map!==scene.map)resetFootsteps();if(old.phase!==scene.phase){ritualMix=1;ritualSilent=false;ritualCutoff=scene.phase==='ritual'?420:6200;}
      applyMix(1.4);if(started)syncScene();notify();
    }
    function setDialogue(value){value=!!value;if(dialogue===value)return;dialogue=value;if(value)stopFootsteps();applyMix(.4);notify();}
    function duck(milliseconds=900){if(!context)return;duckUntil=Math.max(duckUntil,now()+clamp(Number(milliseconds)||900,80,5000)/1000);applyMix(.08);notify();}
    function endVoice(voice,fade=.015){if(voice.ending)return;voice.ending=true;ramp(voice.gain.gain,0,fade);try{voice.source.stop(now()+fade+.01);}catch{}voices.delete(voice);}
    function stopAllVoices(){foot.epoch++;for(const voice of [...voices])endVoice(voice);}
    function record(entry){history.push(entry);if(history.length>100)history.shift();sfxCounts[entry.name]=(sfxCounts[entry.name]||0)+1;}
    function sfx(name,options={}){
      name=aliases[name]||name;const surface=options.surface||'default';
      const id=name==='step'?'step_'+(['dirt','grass','stone','church','wood'].includes(surface)?surface:'dirt'):name;
      const descriptor=FILES.get(id),channel=options.channel==='ambience'?'ambience':'sfx';
      if(!descriptor||!context||!started||disposed||!enabled||!channels[channel].enabled||channels[channel].volume<=0||volume<=0||context.state!=='running'||document.hidden)return Promise.resolve(false);
      const time=now(),spacing={choice_focus:.07,choice_confirm:.10,dialogue_tick:.075,dialogue_open:.11,bird:2,bell:2}[name]||0;
      if(time-(cooldown.get(name)??-Infinity)<spacing)return Promise.resolve(false);cooldown.set(name,time);
      const epoch=foot.epoch,requestMap=scene.map;
      const pitch=clamp(Number(options.pitch)||(['step','dialogue_tick'].includes(name)?.96+random()*.08:1),.65,1.4);
      const level=clamp(Number.isFinite(options.volume)?options.volume:(name==='step'?.88+random()*.12:1));
      return load(id).then(buffer=>{
        if(!buffer||disposed||!enabled||!channels[channel].enabled||channels[channel].volume<=0||volume<=0||document.hidden||context.state!=='running')return false;
        if(options.doorEpoch!==undefined&&options.doorEpoch!==doorEpoch)return false;
        if(name==='step'&&(epoch!==foot.epoch||!foot.active||requestMap!==scene.map))return false;
        // Bound rapid UI input; replace only the oldest of an already dense group.
        const same=[...voices].filter(v=>v.name===name);if(same.length>= (name==='step'?2:4))endVoice(same[0]);
        try{
          const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.playbackRate.value=pitch;gain.gain.value=level*(surface==='default'&&name==='step'?.72:1);source.connect(gain);gain.connect(channels[channel].node);
          const voice={name,source,gain,channel,ending:false};voices.add(voice);source.onended=()=>{voices.delete(voice);try{source.disconnect();gain.disconnect();}catch{}};
          source.start();record({name,asset:id,surface:name==='step'?surface:undefined,foot:options.foot,pitch,volume:gain.gain.value,time:now(),channel});notify();return true;
        }catch{return false;}
      }).catch(()=>false);
    }
    function stopFootsteps(){foot.active=false;foot.epoch++;for(const voice of [...voices])if(voice.name==='step')endVoice(voice,.008);}
    function resetFootsteps(){stopFootsteps();foot.distance=0;foot.foot=0;}
    function footsteps(actualDistance,map,surface='default',active=true){
      const delta=Number(actualDistance);if(!active||!Number.isFinite(delta)||delta<=.001){stopFootsteps();return 0;}
      // Door teleports and discontinuities are never counted as walking.
      if(delta>=128||map&&map!==scene.map){resetFootsteps();return 0;}
      foot.active=true;foot.distance+=delta;foot.totalDistance+=delta;let count=0;
      while(foot.distance+1e-7>=STRIDE){foot.distance=Math.max(0,foot.distance-STRIDE);const side=foot.foot%2===0?'left':'right';foot.foot++;foot.count++;count++;sfx('step',{surface,foot:side});}
      return count;
    }
    function cancelDoor(){
      doorEpoch++;if(doorTimer!==null){clearTimeout(doorTimer);doorTimer=null;}
      for(const voice of [...voices])if(voice.name==='door_close'||voice.name==='door_open')endVoice(voice,.035);
    }
    function door(cue='door'){
      cancelDoor();resetFootsteps();
      if(['churchDoor','door','gate'].includes(cue)){
        const epoch=doorEpoch,arrivalMap=scene.map,pitch=cue==='churchDoor'?.78:cue==='gate'?.9:1;
        sfx('door_open',{pitch,volume:.8,doorEpoch:epoch});
        // The player has crossed the threshold; let the latch settle after the
        // opening transient, using the same mixer. New travel invalidates it.
        doorTimer=setTimeout(()=>{
          doorTimer=null;
          if(disposed||epoch!==doorEpoch||scene.phase==='title'||scene.map!==arrivalMap||document.hidden)return;
          sfx('door_close',{pitch,volume:.48,doorEpoch:epoch});
        },340);
        return 'door_open';
      }
      sfx('event_transition',{volume:cue==='stairs'?.4:.22});return 'event_transition';
    }
    function dialogueTick(text){if(!text||/^[\s.,!?…·—\-]+$/u.test(String(text)))return Promise.resolve(false);return sfx('dialogue_tick',{volume:.28});}
    function ritualTick(seconds,kind='normal'){
      if(scene.phase!=='ritual'||!Number.isFinite(seconds))return;const t=Math.max(0,seconds),silent=kind==='true'?t>=3.65&&t<4.55:t>=3.45&&t<4.4;
      const mix=t<3.45?.68+Math.min(t/3.45,1)*.48:t<4.4?.7:kind==='true'?.58:.8;
      // Open the spectral veil as the blade rises: the existing dissonant strings
      // and upper harmonics join the low drone without restarting its loop.
      const cutoff=t<3.45?420+1880*Math.min(t/3.45,1):kind==='true'?1500:1100;
      if(silent!==ritualSilent||Math.abs(mix-ritualMix)>.035||Math.abs(cutoff-ritualCutoff)>70){ritualSilent=silent;ritualMix=mix;ritualCutoff=cutoff;applyMix(silent?.055:.25);}
    }
    function ambientTick(){
      if(!context||context.state!=='running'||document.hidden||!enabled||!channels.ambience.enabled||!started||scene.phase==='title'||scene.phase==='ritual')return;
      const t=now(),s=classify();
      if(t>=nextBird){nextBird=t+23+random()*22;if(s.outside)sfx('bird',{channel:'ambience',volume:.23+random()*.12,pitch:.91+random()*.18});}
      if(t>=nextBell){nextBell=t+47+random()*28;if(['entrance','church'].includes(scene.map)&&scene.phase!=='ending')sfx('bell',{channel:'ambience',volume:scene.map==='entrance'?.24:.16});}
    }
    function visibility(){
      if(!context||!started||disposed)return;
      if(document.hidden){hiddenAt=now();cancelDoor();stopAllVoices();stopFootsteps();try{Promise.resolve(context.suspend()).catch(()=>{});}catch{}}
      else{hiddenAt=null;try{master.gain.cancelScheduledValues(now());master.gain.setValueAtTime(0,now());Promise.resolve(context.resume()).then(()=>applyMix(.8)).catch(()=>{});}catch{}}
      notify();
    }
    function snapshot(){
      const bgm=loops.bgm,t=now(),m=metrics[bgm?.id]||{};
      return {enabled,volume,masterGain,started,state:context?.state||'uninitialized',contextState:context?.state||'uninitialized',available:!unavailable,
        loop:!!bgm?.source.loop,starts:startCount,sourceStartCount:startCount,ambienceStartCount,playhead:bgm?(t-bgm.startAt)%bgm.duration:0,duration:bgm?.duration||24,loopSeconds:bgm?.duration||24,
        bufferReady:!!bgm,hasSignal:!!bgm&&(m.rms||0)>.001,rms:m.rms||0,peak:m.peak||0,seamDelta:m.seamDelta||0,seamSlopeChange:m.seamSlopeChange||0,
        dialogue,ducked:t<duckUntil,scene:{...scene},targetGain:masterGain*channels.bgm.targetGain*(t<duckUntil?.27:1),disposed,
        currentTrack:bgm?.id||null,ambienceTrack:loops.ambience?.id||null,pendingTracks:Object.fromEntries(Object.entries(pending).map(([k,v])=>[k,v?.id||null])),crossfading:retiring.size,origins:{...origins},hidden:hiddenAt!==null,
        channels:Object.fromEntries(Object.entries(channels).map(([name,c])=>[name,{enabled:c.enabled,volume:c.volume,targetGain:c.targetGain,effectiveGain:masterGain*c.targetGain*(t<duckUntil&&name!=='sfx'?.27:1)}])),
        ritual:{mix:ritualMix,silent:ritualSilent,cutoff:ritualCutoff},footsteps:{distance:foot.distance,totalDistance:foot.totalDistance,foot:foot.foot%2===0?'left':'right',count:foot.count,active:foot.active,activeVoices:[...voices].filter(v=>v.name==='step').length,stride:STRIDE},
        activeVoices:voices.size,doorClosePending:doorTimer!==null,history:history.map(item=>({...item})),sfxCounts:{...sfxCounts}};
    }
    function dispose(){
      if(disposed)return;disposed=true;cancelDoor();document.removeEventListener('visibilitychange',visibility);if(audioTimer)clearInterval(audioTimer);audioTimer=null;tokens.bgm++;tokens.ambience++;stopAllVoices();
      for(const record of [...Object.values(loops),...retiring])if(record){try{record.source.stop();record.source.disconnect();record.gain.disconnect();}catch{}}loops.bgm=null;loops.ambience=null;retiring.clear();pending.bgm=null;pending.ambience=null;
      for(const c of Object.values(channels)){c.targetGain=0;try{c.node?.disconnect();}catch{}}masterGain=0;try{bgmFilter?.disconnect();master?.disconnect();Promise.resolve(context?.close()).catch(()=>{});}catch{}buffers.clear();loads.clear();notify();
    }
    document.addEventListener('visibilitychange',visibility);
    return {start,resume:start,setEnabled,toggle:()=>setEnabled(!enabled),setChannelEnabled,setVolume,setScene,setDialogue,duck,sfx,footsteps,stopFootsteps,resetFootsteps,door,dialogueTick,ritualTick,snapshot,dispose};
  }
  return {create,title:'SAINT SEVEN — Original Sound Collection',duration:24,assetPaths:MANIFEST.map(item=>item.path),manifest:MANIFEST.map(item=>({...item})),stride:STRIDE};
})();
