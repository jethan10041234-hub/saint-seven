'use strict';
/* Original SAINT SEVEN v0.6 composition and sound-design source.
 * Every waveform is mathematical synthesis; no external recording/sample is used.
 * This same source renders the shipped PCM WAV assets and the offline fallback. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SAINT_AUDIO_SCORE=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:this,function(){
  const RATE=16000,TAU=Math.PI*2;
  const definitions=[
    ['bgm_outdoor','bgm',24,true,'The Village Holds Its Breath'],
    ['bgm_church','bgm',24,true,'Beneath the Unanswered Vault'],
    ['bgm_ritual','bgm',24,true,'The Weight of the Seventh Bell'],
    ['bgm_ending_normal','bgm',24,true,'A Door Left Unclosed'],
    ['bgm_ending_bad','bgm',24,true,'Ash Beneath the Altar'],
    ['bgm_ending_true','bgm',24,true,'A Name Beyond the Prayer'],
    ['ambience_outdoor','ambience',32,true,'Wind through the Courtyard'],
    ['ambience_interior','ambience',32,true,'Air beneath Stone'],
    ['step_dirt','sfx',.22,false,'Soft Earth'],
    ['step_grass','sfx',.28,false,'Grass and Leaves'],
    ['step_stone','sfx',.24,false,'Stone Sole'],
    ['step_church','sfx',.68,false,'Stone Vault Footfall'],
    ['step_wood','sfx',.28,false,'Dry Timber'],
    ['door_open','sfx',.86,false,'Latch and Hinge'],
    ['door_close','sfx',.72,false,'Wooden Door Settles'],
    ['choice_focus','sfx',.10,false,'Choice Breath'],
    ['choice_confirm','sfx',.26,false,'Choice Seal'],
    ['dialogue_open','sfx',.35,false,'A Page Opens'],
    ['dialogue_tick','sfx',.055,false,'Quiet Syllable'],
    ['item','sfx',.88,false,'A Small Discovery'],
    ['event_transition','sfx',.95,false,'Passing the Threshold'],
    ['ending','sfx',.96,false,'The Last Line'],
    ['bird','sfx',.68,false,'Distant Courtyard Bird'],
    ['bell','sfx',4,false,'Distant Bronze Bell'],
    ['ritual_strike','sfx',3.6,false,'The Ritual Stroke']
  ];
  const manifest=definitions.map(([id,channel,seconds,loop,title])=>Object.freeze({id,path:'assets/audio/'+id+'.wav',channel,seconds,loop,title}));
  const byId=Object.fromEntries(manifest.map(x=>[x.id,x]));
  const midi=n=>440*Math.pow(2,(n-69)/12);
  function hash(text){let n=2166136261;for(let i=0;i<text.length;i++){n^=text.charCodeAt(i);n=Math.imul(n,16777619);}return n>>>0;}
  function random(seed){let n=seed||1;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296*2-1;};}
  function render(id){
    const def=byId[id];if(!def)throw new RangeError('Unknown original sound: '+id);
    const frames=Math.round(def.seconds*RATE),samples=new Float32Array(frames),rng=random(hash(id));
    function add(at,value){if(def.loop)samples[((at%frames)+frames)%frames]+=value;else if(at>=0&&at<frames)samples[at]+=value;}
    function note(start,duration,pitch,amplitude,voice='organ',detune=0){
      const origin=Math.round(start*RATE),length=Math.round(duration*RATE),frequency=midi(pitch)*Math.pow(2,detune/1200);
      const angle=TAU*frequency/RATE,ss=Math.sin(angle),cc=Math.cos(angle);
      let s=0,c=1,decay=1;
      const isPluck=voice==='lute'||voice==='bell',attack=(isPluck?.006:voice==='flute'?.2:.7)*RATE;
      const release=(isPluck?.09:voice==='flute'?.55:1.5)*RATE;
      const decayStep=Math.exp(-1/(RATE*(voice==='bell'?1.1:voice==='lute'?.6:4)));
      for(let i=0;i<length;i++){
        const a=Math.min(1,i/attack),r=Math.min(1,(length-1-i)/release);
        let envelope=a*a*(3-2*a)*r*r*(3-2*r);
        const second=2*s*c,third=3*s-4*s*s*s,fourth=2*second*(c*c-s*s);
        let tone=s;
        if(voice==='organ')tone+=.21*second+.08*third+.025*fourth;
        else if(voice==='choir')tone+=.10*third+.04*fourth;
        else if(voice==='strings')tone+=.16*second+.07*third;
        else if(voice==='flute')tone+=.035*second;
        else if(voice==='lute')tone+=.36*second*decay+.11*third*decay;
        else if(voice==='bell')tone+=.19*third*decay;
        if(isPluck){envelope*=decay;decay*=decayStep;}
        add(origin+i,tone*amplitude*envelope);
        const ns=s*cc+c*ss;c=c*cc-s*ss;s=ns;
      }
    }
    function soft(start,duration,pitch,amplitude,voice='organ',reverb=.2){
      note(start,duration,pitch,amplitude,voice);
      if(reverb){note(start+.19,duration,pitch,amplitude*reverb,voice,-3);note(start+.47,duration,pitch,amplitude*reverb*.58,voice,3);}
    }
    function drone(pitch,amplitude,cycles=1){
      const frequency=Math.round(midi(pitch)*def.seconds)/def.seconds;
      const angle=TAU*frequency/RATE,ss=Math.sin(angle),cc=Math.cos(angle),ms=Math.sin(TAU*cycles/frames),mc=Math.cos(TAU*cycles/frames);
      let s=0,c=1,m=0,n=1;
      for(let i=0;i<frames;i++){
        samples[i]+=s*amplitude*(.72+.28*m);
        const ns=s*cc+c*ss;c=c*cc-s*ss;s=ns;const nm=m*mc+n*ms;n=n*mc-m*ms;m=nm;
      }
    }
    function noise(start,duration,amplitude,cutoff=800,attack=.01,decay=.1){
      const begin=Math.round(start*RATE),length=Math.round(duration*RATE),alpha=1-Math.exp(-TAU*cutoff/RATE);
      let low=0;
      for(let i=0;i<length;i++){
        low+=alpha*(rng()-low);const env=Math.min(1,i/(attack*RATE))*Math.exp(-i/(decay*RATE))*Math.min(1,(length-1-i)/(.01*RATE));
        add(begin+i,low*amplitude*env);
      }
    }
    function impact(start,pitch,amplitude,kind='stone'){
      const wood=kind==='wood',dirt=kind==='dirt',grass=kind==='grass';
      note(start,wood?.18:.14,pitch,amplitude*(dirt?.65:.8),'lute');
      noise(start,grass?.24:.14,amplitude*(grass?1.7:dirt?1.15:.7),grass?2100:dirt?550:wood?900:1800,.002,grass?.075:.028);
      if(wood)note(start+.006,.13,pitch+17,amplitude*.20,'lute');
      if(kind==='stone')note(start,.09,pitch+25,amplitude*.10,'lute');
    }
    if(def.channel==='bgm'){
      const outdoor=id==='bgm_outdoor',church=id==='bgm_church',ritual=id==='bgm_ritual',normal=id==='bgm_ending_normal',bad=id==='bgm_ending_bad';
      let chords;
      if(outdoor)chords=[[50,57,65],[43,50,62],[46,53,62],[50,57,64]];
      else if(church)chords=[[38,50,57,65],[41,53,60,65],[43,50,58,62],[45,52,55,62]];
      else if(ritual)chords=[[38,45,51],[38,46,53],[37,44,50],[38,45,51]];
      else if(normal)chords=[[50,57,60],[46,53,62],[43,50,60],[45,52,62]];
      else if(bad)chords=[[33,40,46],[34,41,45],[32,39,44],[33,40,46]];
      else chords=[[50,57,62],[46,53,62],[48,55,64],[50,57,65]];
      chords.forEach((chord,bar)=>chord.forEach((pitch,i)=>{
        const duration=bad?4.8:8.4,voice=outdoor?'strings':ritual?'strings':church?'organ':normal?'choir':bad?'organ':'choir';
        soft(bar*6,duration,pitch,(i===0?.048:.030)*(bad?.85:1),voice,church?.38:.23);
        if(church&&i>0)soft(bar*6+.55,7.4,pitch+12,.009,'choir',.3);
      }));
      if(outdoor){
        [62,65,69,67,65,62,60,62].forEach((p,i)=>soft(1+i*3,2.8,p,.035,'flute',.22));
        [50,57,62,57,46,53,62,53].forEach((p,i)=>soft(i*3,2.5,p,.055,'lute',.12));
        drone(38,.008,2);
      }else if(church){
        [69,65,62,64].forEach((p,i)=>soft(2+i*6,5.6,p,.020,'flute',.4));drone(26,.014);
      }else if(ritual){
        drone(26,.027,3);drone(38,.019,2);
        for(let i=0;i<16;i++){note(i*1.5,.9,38+(i%4===3?1:0),.032,'lute');noise(i*1.5,.35,.014,260,.015,.12);}
        [63,62,61,63].forEach((p,i)=>soft(i*6+1.8,6,p,.019,'strings',.32));
      }else if(normal){
        [65,62,60,62,64,62].forEach((p,i)=>soft(2+i*3.5,4.7,p,.029,'lute',.35));drone(38,.010);
      }else if(bad){
        for(let i=0;i<4;i++){soft(i*6+1,2.5,69-i,.018,'bell',.4);noise(i*6,.95,.018,190,.09,.35);}drone(21,.012,4);
      }else{
        [62,65,69,67,65,64,62,65].forEach((p,i)=>soft(.9+i*3,4,p,.027,'flute',.33));
        [62,69,65,62].forEach((p,i)=>soft(i*6+1.5,5.2,p,.026,'lute',.30));drone(38,.008);
      }
    }else if(def.channel==='ambience'){
      const outside=id==='ambience_outdoor',raw=new Float32Array(frames);
      for(let i=0;i<frames;i++)raw[i]=rng();
      let low=0,mid=0;
      const slow=1-Math.exp(-TAU*(outside?170:85)/RATE),fast=1-Math.exp(-TAU*(outside?1450:350)/RATE);
      // A full warm-up pass makes each filtered noise stream periodic at its boundary.
      for(let pass=0;pass<2;pass++){
        let s1=0,c1=1,s2=0,c2=1;const a=TAU*3/frames,b=TAU*7/frames,sa=Math.sin(a),ca=Math.cos(a),sb=Math.sin(b),cb=Math.cos(b);
        for(let i=0;i<frames;i++){
          low+=slow*(raw[i]-low);mid+=fast*(raw[i]-mid);
          if(pass){const gust=.48+.24*s1+.14*s2;const leaves=outside?(mid-low)*(.08+.12*Math.max(0,s1)):0;samples[i]=(low*gust*.48+leaves*.24)*(outside?1:.60);}
          const n1=s1*ca+c1*sa;c1=c1*ca-s1*sa;s1=n1;const n2=s2*cb+c2*sb;c2=c2*cb-s2*sb;s2=n2;
        }
      }
      if(!outside)drone(26,.0015,2);
    }else if(id.startsWith('step_')){
      const material=id.slice(5),base=material==='wood'?39:material==='dirt'?32:material==='grass'?33:45;
      impact(0,base,.36,material==='church'?'stone':material);
      if(material==='church'){impact(.075,base,.12,'stone');impact(.17,base,.055,'stone');impact(.30,base,.022,'stone');}
    }else if(id==='door_open'){
      impact(.015,48,.26,'wood');noise(.10,.55,.16,700,.09,.23);
      soft(.13,.55,54,.050,'strings',0);note(.36,.37,48,.043,'lute');
    }else if(id==='door_close'){
      noise(0,.2,.08,650,.01,.05);impact(.14,32,.38,'wood');impact(.32,44,.075,'wood');
    }else if(id==='choice_focus'){
      note(0,.09,69,.035,'lute');noise(0,.07,.045,1400,.004,.014);
    }else if(id==='choice_confirm'){
      note(0,.22,62,.065,'lute');note(.045,.20,69,.040,'lute');noise(0,.07,.026,800,.004,.02);
    }else if(id==='dialogue_open'){
      noise(0,.24,.13,1800,.03,.065);note(.08,.22,57,.022,'lute');
    }else if(id==='dialogue_tick'){
      noise(0,.05,.070,1050,.002,.009);note(0,.04,67,.012,'lute');
    }else if(id==='item'){
      soft(0,.74,74,.078,'bell',.16);soft(.14,.68,81,.040,'bell',.15);
    }else if(id==='event_transition'){
      noise(0,.90,.24,480,.16,.30);soft(.04,.80,45,.14,'choir',.12);soft(.13,.75,52,.065,'choir',0);
    }else if(id==='ending'){
      soft(0,.95,62,.085,'choir',.15);soft(.07,.83,69,.045,'bell',.12);noise(0,.8,.025,340,.2,.3);
    }else if(id==='bird'){
      // Three quiet breathy chirps, deliberately reserved for sparse runtime scheduling.
      [[0,93],[.17,96],[.38,94]].forEach(([t,p])=>{
        const length=Math.round(.16*RATE),origin=Math.round(t*RATE);let phase=0;
        for(let i=0;i<length;i++){
          const progress=i/length,frequency=midi(p)*(1+.10*Math.sin(progress*Math.PI));
          phase+=TAU*frequency/RATE;
          const envelope=Math.min(1,i/(.008*RATE))*Math.min(1,(length-1-i)/(.065*RATE));
          add(origin+i,Math.sin(phase)*.032*envelope);
        }
        noise(t,.1,.018,2300,.008,.035);
      });
    }else if(id==='bell'){
      note(0,3.98,50,.16,'bell');note(.002,3.4,62,.040,'bell');note(.002,2.7,69.15,.016,'bell');
      note(.17,3.6,50,.045,'bell');note(.36,3.5,50,.022,'bell');
    }else if(id==='ritual_strike'){
      impact(0,26,.23,'wood');noise(0,1.5,.23,420,.002,.25);
      note(.01,3.45,38,.17,'bell');note(.03,2.8,45.15,.07,'bell');note(.16,3.2,38,.045,'bell');
    }
    // Echo tails on a finite SFX must settle to zero even when their source extends
    // past the asset boundary. This avoids clicks when a one-shot is released.
    if(!def.loop){
      const fade=Math.min(Math.round(.045*RATE),Math.floor(frames*.2));
      for(let i=0;i<fade;i++){const t=i/(fade-1);samples[frames-fade+i]*=1-t*t*(3-2*t);}
    }
    // Preserve dynamic differences between SFX; only protect the output ceiling.
    let peak=0,sum=0;
    for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(samples[i]));
    const scale=peak>.60?.60/peak:1;
    for(let i=0;i<frames;i++){samples[i]*=scale;sum+=samples[i]*samples[i];}
    const seamDelta=Math.abs(samples[0]-samples[frames-1]);
    const seamSlopeChange=Math.abs((samples[1]-samples[0])-(samples[0]-samples[frames-1]));
    return {id,sampleRate:RATE,channels:[samples],frames,seconds:def.seconds,loop:def.loop,rms:Math.sqrt(sum/frames),peak:peak*scale,seamDelta,seamSlopeChange};
  }
  return Object.freeze({title:'SAINT SEVEN — Original Soundscape',version:1,sampleRate:RATE,manifest:Object.freeze(manifest),assetPaths:Object.freeze(manifest.map(x=>x.path)),render});
});
