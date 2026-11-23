'use strict';
(() => {
  const D=window.SAINT_DATA, M=window.SAINT_MODEL, S=window.SAINT_STORY, N=window.SAINT_NARRATIVE;
  N.apply(D,S);
  const $=id=>document.getElementById(id), canvas=$('gameCanvas'), ctx=canvas.getContext('2d');
  const asset=p=>window.SAINT_EMBEDDED?.[p]||p, images=new Map(), keys=new Set();
  const walk={moving:false,distance:0,frame:0};
  const portals=window.SAINT_PORTALS.create();
  const bgm=window.SAINT_AUDIO.create({onChange:state=>{const on=state.enabled;$('bgmButton').textContent=on?'AUDIO ON':'AUDIO OFF';$('bgmButton').setAttribute('aria-pressed',String(on));$('bgmButton').setAttribute('aria-label',on?'전체 소리 켜짐':'전체 소리 꺼짐');}});
  const audioPanel=window.SAINT_AUDIO_PANEL.create(bgm,{onOpen:()=>{keys.clear();bgm.stopFootsteps();},onClose:()=>{canvas.focus({preventScroll:true});}});
  let villagerCast=[...D.villagerVariants];
  const cinematic=window.SAINT_CINEMATIC.create({canvas,ctx,images,data:D,caption:$('cinematicCaption'),heading:$('cinematicHeading'),line:$('cinematicLine'),sound:ritualSound});
  function castVillagers(){
    villagerCast=[...D.villagerVariants];
    for(let i=villagerCast.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[villagerCast[i],villagerCast[j]]=[villagerCast[j],villagerCast[i]];}
  }
  let game=M.create(), world='church', player={...D.player}, ready=false, dialogue=null, busy=false, debug=false, nearest=null, lastTime=0, toastUntil=0, resetPending=false, leaving=null, crowdVisible=true;
  const camera={x:0,y:0}, view={width:960,height:640};
  const map=()=>D.maps[world], has=id=>game.found.includes(id);
  const directions={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
  const opposite={up:'down',down:'up',left:'right',right:'left'};
  const modalOpen=()=>['journalModal','pauseModal','infoModal','audioModal'].some(id=>$(id).open);
  const paused=()=>!ready||!!dialogue||busy||modalOpen()||['title','ending','opening','ritual'].includes(game.phase)||document.hidden;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const p=(character,text)=>({character,text});
  const phaseNames={title:'PROLOGUE',opening:'미사',seven:'성당 앞',gossip:'마을의 소문',elder:'낯선 질문',investigation:'성당 조사',ritual:'의식 집행',ending:'EPILOGUE'};
  const testErrors=[];
  if(new URLSearchParams(location.search).get('__test')==='1'){window.addEventListener('error',e=>testErrors.push(String(e.message)));window.addEventListener('unhandledrejection',e=>testErrors.push(String(e.reason)));}
  const markers={parchment:'parchment',diary:'diary',restore:'restored',bible:'cover'};
  for(const type of ['suspicion','trust'])for(let i=0;i<5;i++)$(type+'Bar').append(document.createElement('i'));
  function loadImage(path){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images.set(path,im);resolve();};im.onerror=()=>reject(Error('이미지를 불러오지 못했습니다: '+path));im.src=asset(path);});}
  function actors(){
    let list=map().npcs.filter(n=>n.id!=='seven'||game.phase==='seven'||!!leaving).map(n=>({...n,character:n.character==='villagers'?villagerCast[0]:n.character}));
    if(world==='entrance'&&leaving){const seven=list.find(n=>n.id==='seven');if(seven)Object.assign(seven,{x:leaving.x,y:leaving.y,crouching:false,facing:'right'});}
    if(world==='church'&&crowdVisible){for(const [i,x,y] of [[0,460,510],[1,790,510],[2,470,640],[3,780,640],[4,460,760],[5,790,760]])list.push({id:'crowd'+i,character:villagerCast[i],x,y,height:75,facing:'up',scenery:true});}
    if(world==='square'){list.push({id:'neighbor1',character:villagerCast[1],x:400,y:485,height:74,facing:'down',scenery:true},{id:'neighbor2',character:villagerCast[2],x:505,y:500,height:77,facing:'down',scenery:true});}
    if(world==='church'&&game.phase==='ritual')list.push({id:'ritual_seven',character:'seven',x:697,y:337,height:84});
    return list;
  }
  function footBox(x,y){return {x:x-12,y:y-11,w:24,h:14};}
  function overlaps(a,r){return a.x<r[0]+r[2]&&a.x+a.w>r[0]&&a.y<r[1]+r[3]&&a.y+a.h>r[1];}
  function canWalk(x,y){const b=footBox(x,y);return b.x>=0&&b.y>=0&&b.x+b.w<=D.worldSize&&b.y+b.h<=D.worldSize&&!map().colliders.some(r=>overlaps(b,r))&&!actors().some(n=>overlaps(b,n.crouching?[n.x-18,n.y-10,36,14]:[n.x-14,n.y-11,28,16]));}
  function move(dx,dy){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4)),sx=dx/steps,sy=dy/steps;
    let distance=0;
    for(let i=0;i<steps;i++){
      const previous={x:player.x,y:player.y};
      if(canWalk(player.x+sx,player.y))player.x+=sx;
      if(canWalk(player.x,player.y+sy))player.y+=sy;
      distance+=Math.hypot(player.x-previous.x,player.y-previous.y);
      const exitId=portals.probe(world,previous,player,{x:sx,y:sy});
      if(exitId){const exit=map().interactions.find(t=>t.type==='exit'&&t.id===exitId);if(exit&&tryExit(exit))return;}
    }
    window.SAINT_SPRITES.updateMotion(walk,distance);
    bgm.footsteps(distance,world,window.SAINT_SURFACES.at(world,player.x,player.y),distance>0);
  }
  function lineClear(x,y){const dx=x-player.x,dy=y-player.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6));for(let i=1;i<steps;i++){const px=player.x+dx*i/steps,py=player.y+dy*i/steps;if(map().colliders.some(r=>px>r[0]&&px<r[0]+r[2]&&py>r[1]&&py<r[1]+r[3]))return false;}return true;}
  function nearestTarget(){const list=[...actors().filter(n=>!n.scenery).map(n=>({...n,type:'npc',radius:100,label:D.characters[n.character].name+'에게 말 걸기'})),...map().interactions];return list.map(t=>({...t,distance:Math.hypot(t.x-player.x,t.y-player.y)})).filter(t=>t.distance<=t.radius&&lineClear(t.x,t.y)).sort((a,b)=>a.distance-b.distance)[0]||null;}
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;toastUntil=performance.now()+3200;}
  function objective(){
    if(game.phase==='title')return '이야기를 시작하세요.';
    if(game.phase==='opening')return '엘리의 이야기를 들어보세요.';
    if(game.phase==='seven')return '남쪽 출입구로 나가 계단 왼쪽의 세븐에게 말을 걸어보세요.';
    if(game.phase==='gossip')return '남쪽 길로 마을 광장에 가서 주민들의 이야기를 들어보세요.';
    if(game.phase==='elder')return '광장 오른쪽 아래, 혼자 서 있는 주민에게 말을 걸어보세요.';
    if(game.phase==='investigation')return !has('parchment')?'성당 오른쪽 위 계단으로 내려가 찢어진 양피지를 먼저 찾으세요.':M.ending(game)?'조사를 계속하거나 제단 앞 엘리에게 의식 진행을 요청할 수 있습니다.':'성당과 세븐의 집, 정원을 조사하고 주민과 엘리에게 다시 말을 걸어보세요.';
    if(game.phase==='ritual')return '엘리의 말을 끝까지 들어보세요.';
    return '이번에 믿었던 말과 선택을 돌아보세요.';
  }
  function updateHUD(){
    bgm.setScene({map:world,phase:game.phase,ending:game.ending});
    $('locationName').textContent=map().name;$('chapterName').textContent=phaseNames[game.phase];$('objective').textContent=objective();
    const count=game.found.filter(id=>D.clues[id]&&id!=='contradiction').length;$('clueCount').textContent='단서 '+count+' / 6';
    for(const type of ['suspicion','trust']){const bar=$(type+'Bar');bar.setAttribute('aria-valuenow',game[type]);[...bar.children].forEach((s,i)=>s.classList.toggle('filled',i<game[type]));$(type+'Value').textContent=game[type]+' / 5';}
    $('meterNote').textContent=['investigation','ritual','ending'].includes(game.phase)?N.ui.judgmentNote:'조사가 시작되면\n판단이 기록됩니다.';
  }
  function closeModal(el){el.close();keys.clear();canvas.focus({preventScroll:true});}
  function info(title,text,actions){
    walk.moving=false;bgm.stopFootsteps();keys.clear();$('infoTitle').textContent=title;$('infoContent').replaceChildren();
    const el=document.createElement('p');el.textContent=text;$('infoContent').append(el);$('infoActions').replaceChildren();
    for(const a of actions||[{label:'확인',action:()=>{}}]){const b=document.createElement('button');b.className='button'+(a.secondary?' secondary':'');b.textContent=a.label;b.onclick=()=>{bgm.sfx('choice_confirm');closeModal($('infoModal'));a.action();};$('infoActions').append(b);}
    if(!$('infoModal').open)$('infoModal').showModal();
  }
  function hideDialogue(){bgm.setDialogue(false);bgm.stopFootsteps();walk.moving=false;dialogue=null;$('dialogue').hidden=true;$('fullFigure').hidden=true;keys.clear();}
  function openDialogue(pages,options={}){hideDialogue();dialogue={pages,index:0,choices:options.choices||[],onDone:options.onDone||(()=>{}),finalLabel:options.finalLabel,defer:!!options.defer};$('interactionHint').hidden=true;bgm.setDialogue(true);bgm.sfx('dialogue_open');showPage();}
  function showPage(){
    const d=dialogue;if(!d)return;const page=d.pages[d.index],character=page.character==='villagers'?villagerCast[page.villagerSlot||0]:page.character,c=D.characters[character];
    $('dialogue').hidden=false;$('speaker').textContent=page.speaker||(page.character==='villagers'?'마을 사람들':c?.name)||'기록';$('dialogueText').textContent=page.text;$('dialogueCounter').textContent=(d.index+1)+' / '+d.pages.length;
    const illustration=!!c?.full;$('portraitWrap').hidden=!illustration;$('dialogue').classList.toggle('has-portrait',illustration);$('dialogue').classList.toggle('no-portrait',!illustration);
    // 주인공 세 명은 한 원본을 전신과 어깨 초상화 양쪽에서 공유합니다.
    if(illustration){$('portraitSVG').setAttribute('viewBox',c.portraitCrop.join(' '));$('portraitImage').setAttribute('href',asset(c.full));$('portraitAlt').textContent=c.name+'의 어깨 초상화';}
    $('fullFigure').hidden=!c;$('fullFigure').classList.toggle('pixel-only',!!c?.pixelOnly);
    if(c){const full=c.full||c.sprite;const size=c.imageSize||[1789,2048];$('fullImage').setAttribute('width',size[0]);$('fullImage').setAttribute('height',size[1]);$('fullImage').setAttribute('href',asset(full));$('fullSVG').setAttribute('viewBox',(c.fullCrop||c.crop).join(' '));}
    bgm.dialogueTick(page.text);
    const last=d.index===d.pages.length-1;$('dialogueActions').replaceChildren();
    $('dialogueDefer').hidden=!(last&&d.defer);$('dialogueDefer').textContent=N.labels.deferDialogue;
    const choices=last&&d.choices.length?d.choices:[{label:last?(d.finalLabel||'계속 · E'):'다음 · E',action:advance}];
    choices.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.textContent=a.label;b.disabled=!!a.disabled;b.onclick=()=>{bgm.sfx('choice_confirm');a.action();};$('dialogueActions').append(b);});
    if(last&&d.choices.length)$('dialogueActions').querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    else canvas.focus({preventScroll:true});
    requestAnimationFrame(positionFigure);
  }
  function positionFigure(){if(window.SAINT_LAYOUT){window.SAINT_LAYOUT.refresh();return;}if(!dialogue)return;const h=$('dialogue').offsetHeight;const figure=$('fullFigure');figure.style.bottom=(h+(innerWidth<=560?16:28))+'px';figure.style.maxHeight=Math.max(60,$('stage').clientHeight-h-50)+'px';}
  function advance(){if(!dialogue||modalOpen()||busy)return;if(dialogue.index<dialogue.pages.length-1){dialogue.index++;showPage();}else if(!dialogue.choices.length){const cb=dialogue.onDone;hideDialogue();cb();updateHUD();canvas.focus({preventScroll:true});}}
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  async function transition(text,callback,noise=false,endingFade=false){busy=true;hideDialogue();keys.clear();$('transition').className='transition-layer'+(endingFade?' ending-fade':'');bgm.stopFootsteps();$('transitionText').textContent=text;$('transition').hidden=false;await delay(900);callback();render();if(noise){$('transitionText').textContent='';$('transition').classList.add('noise');$('stage').classList.add('signal');playNoise();await delay(550);}$('transition').hidden=true;$('stage').classList.remove('signal');busy=false;}
  function prepareAudio(){bgm.start();}
  function playNoise(){bgm.sfx('event_transition');}
  function ritualSound(cue){bgm.sfx(({bell:'bell',strike:'ritual_strike',stop:'event_transition',release:'ending'})[cue]||'event_transition');}
  function go(id,spawn){const previous=world;world=id;if(!canWalk(spawn.x,spawn.y)){world=previous;toast('출입구를 지나갈 수 없습니다.');return false;}player.x=spawn.x;player.y=spawn.y;portals.arrive(world,player);window.SAINT_SPRITES.resetMotion(walk);bgm.resetFootsteps();nearest=null;keys.clear();updateHUD();render();return true;}
  function start(){portals.reset();window.SAINT_ENDINGS.reset();bgm.resetFootsteps();prepareAudio();walk.moving=false;walk.distance=0;walk.frame=0;castVillagers();cinematic.reset();game=M.create();game.phase='opening';crowdVisible=true;world='church';player={...D.player,x:625,y:580,facing:'up'};$('titleScreen').hidden=true;$('endingScreen').hidden=true;updateHUD();openDialogue(S.opening,{onDone:async()=>{await transition('',()=>{crowdVisible=false;player.y=420;},true);openDialogue(S.private,{onDone:()=>{game.phase='seven';updateHUD();info('성당 앞의 세븐','WASD / 방향키로 이동\n가까이에서 E로 대화·조사\n\n성당 남쪽 문으로 나가 세븐에게 말을 전하세요.');}});}});}
  async function sevenLeaves(){hideDialogue();busy=true;leaving={x:501,y:222,started:performance.now(),motion:{moving:false,distance:0,frame:0}};await delay(1800);leaving=null;game.phase='gossip';busy=false;openDialogue(S.alone,{onDone:()=>{updateHUD();info('무언가 이상하다','세븐이 떠났다.\n희생에 관한 이야기를 더 들어보자.\n\n성당 앞 남쪽 길 → 마을 광장');}});}
  function beginInvestigation(){game.phase='investigation';game.suspicion=0;game.trust=0;updateHUD();info('성당 조사를 시작합니다',N.ui.investigation);}
  function notYet(){openDialogue([p('hormasset',game.phase==='investigation'?'먼저 성당 지하실에서 찢어진 양피지를 찾아보자.':'지금은 사람들의 이야기를 먼저 들어봐야겠어.')]);}
  function award(id){const r=M.award(game,id);if(r.ok){if(D.clues[id])markObserved(id);bgm.sfx('item');updateHUD();const name=D.clues[id]?.title||({eliFaith:'엘리의 설명을 믿음',eliRitual:'의식의 필요성을 받아들임'}[id]);toast(name+(r.suspicion?' · 의심 +1':r.trust?' · 신뢰 +1':''));}return r;}
  function markObserved(id){if(!game.observed.includes(id))game.observed.push(id);}
  function inspectClue(key){
    const clue=D.clues[key];if(!clue)return;markObserved(key);
    const committed=has(key),canCommit=!committed&&game.phase==='investigation',source=N.sources[key];
    info(clue.title,clue.text,!canCommit?[{label:'돌아가기',action:()=>{}}]:[{label:key==='parchment'?N.labels.keepParchment:N.labels.reflectEvidence,action:()=>award(key)}]);
    if(source){const meta=document.createElement('div');meta.className='source-note';for(const [label,value] of [['출처',source.kind+' · '+source.source],['확인한 내용',source.observed],['아직 알 수 없는 것',source.limits]]){const row=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label+' · ';row.append(strong,document.createTextNode(value));meta.append(row);}$('infoContent').append(meta);}
    const note=document.createElement('p');note.className='evidence-status';note.textContent=committed?'판단에 반영한 내용입니다. 상태는 다시 오르지 않습니다.':!canCommit?'열람한 자료입니다. 당시에는 판단을 보류했습니다.':N.ui.evidenceHint+'\n반영할 경우: '+clue.effect;$('infoContent').append(note);
  }
  function collect(id){
    if(game.phase!=='investigation')return notYet();
    if(!has('parchment')&&id!=='parchment'){if(id==='restore')return openDialogue([p('hormasset','풀과 복원 도구가 놓여 있다. 아직 복원할 양피지가 없다. 성당 지하실부터 살펴보자.')]);return notYet();}
    const key=id==='restore'?'restored':id==='bible'?((has('bible')||game.observed.includes('bible'))?'cover':'bible'):id;
    inspectClue(key);
  }
  function eliTalk(){
    if(game.phase!=='investigation')return openDialogue([p('eli','세븐에게 이야기해 주겠니?')]);
    if(!has('parchment'))return notYet();
    const choices=[];
    if(!has('eliFaith'))choices.push({label:N.labels.askFaith,action:()=>openDialogue(N.dialogues.eliFaith,{choices:[{label:N.labels.acceptFaith+' · 신뢰 +1',action:()=>{award('eliFaith');hideDialogue();}},{label:N.labels.deferFaith,action:hideDialogue}]})});
    else if(!has('eliRitual'))choices.push({label:N.labels.askRitual,action:()=>openDialogue(N.dialogues.eliRitual,{choices:[{label:N.labels.acceptRitual+' · 신뢰 +1',action:()=>{award('eliRitual');hideDialogue();}},{label:N.labels.deferRitual,action:hideDialogue}]})});
    choices.push({label:N.labels.requestRitual,action:requestRitual},{label:N.labels.continueInvestigation,action:hideDialogue});
    openDialogue(N.dialogues.eliGreeting,{choices});
  }
  function talk(id){
    if(id==='eli')return eliTalk();
    if(id==='seven'&&game.phase==='seven')return openDialogue(S.seven,{onDone:sevenLeaves});
    if(id==='villagers'){
      if(game.phase==='gossip')return openDialogue(S.gossip,{onDone:()=>{game.phase='elder';updateHUD();}});
      return openDialogue(N.dialogues.villagersRepeat);
    }
    if(id==='elder'){
      if(game.phase==='gossip')return openDialogue([p('elder','주민들이 무슨 말을 하는지 먼저 들어보거라.')]);
      if(game.phase==='elder')return openDialogue(S.elder,{choices:[{label:N.labels.villageYes,action:()=>{game.villageChoice='네';openDialogue(S.yes,{onDone:beginInvestigation});}},{label:N.labels.villageSilence,action:()=>{game.villageChoice='침묵';openDialogue(S.silence,{onDone:beginInvestigation});}}]});
      if(game.phase==='investigation'){
        if(!has('parchment'))return notYet();
        if(has('elder'))return openDialogue(N.dialogues.elderAfterCommit);
        return openDialogue(S.elderAgain,{finalLabel:N.labels.elderCommit,defer:true,onDone:()=>award('elder')});
      }
    }
  }
  function interact(){if(paused())return;const t=nearestTarget();if(!t)return toast('말을 걸거나 조사할 대상 가까이에서 E를 눌러 주세요.');
    if(t.type==='npc'){const dx=t.x-player.x,dy=t.y-player.y;player.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');const n=map().npcs.find(n=>n.id===t.id);if(n)n.facing=opposite[player.facing];talk(t.id);}
    else if(t.type==='clue')collect(t.id);
    else if(t.type==='exit')tryExit(t);
  }
  function tryExit(t){
    let reason='';
    if(game.phase==='seven'&&t.target!=='entrance'&&t.target!=='church')reason='먼저 성당 앞 계단의 세븐에게 말을 걸어보세요.';
    if(['gossip','elder'].includes(game.phase)&&['house','garden','basement'].includes(t.target))reason='먼저 마을 광장에서 이야기를 들어보세요.';
    if(reason){portals.deny(world,t.id);toast(reason);return false;}
    const cue=window.SAINT_SURFACES.exitCue(world,t);
    if(go(t.target,t.spawn)){bgm.door(cue);toast(map().name);return true;}
    portals.deny(world,t.id);return false;
  }
  function requestRitual(){hideDialogue();const end=M.ending(game);if(!end)return info('아직 남은 질문',N.ui.notEnough);
    info(N.ui.ritualTitle,N.ui.ritualConfirm,[{label:N.labels.confirmRitual,action:()=>ritual(end)},{label:N.labels.cancelRitual,secondary:true,action:()=>{}}]);
  }
  function ritual(end){game.phase='ritual';world='church';player.x=588;player.y=424;player.facing='up';crowdVisible=false;bgm.resetFootsteps();window.SAINT_SPRITES.resetMotion(walk);updateHUD();
    if(end==='true')openDialogue(N.dialogues.ritualTrue,{onDone:()=>{award('contradiction');info('새로운 단서 · 연설의 모순',D.clues.contradiction.text,[{label:N.labels.challenge,action:()=>openDialogue(N.dialogues.stopRitual,{onDone:()=>runCinematic('true')})}]);}});
    else if(end==='bad')openDialogue(N.dialogues.ritualBad,{onDone:()=>runCinematic('bad')});
    else openDialogue(has('elder')?N.dialogues.ritualNormalOffered:N.dialogues.ritualNormal,{onDone:()=>runCinematic('normal')});
  }
  function runCinematic(end){hideDialogue();busy=true;keys.clear();nearest=null;$('toast').hidden=true;$('interactionHint').hidden=true;cinematic.start(end,villagerCast,()=>{busy=false;finish(end);});}
  const endingImages={normal:'assets/endings/normal.png',bad:'assets/endings/bad.png',true:'assets/endings/true.png'};
  async function finish(id){await transition('',()=>{game.phase='ending';game.ending=id;updateHUD();},false,true);window.SAINT_ENDINGS.show(id,{...N.endingFor(id,game),image:asset(endingImages[id]),onReflection:reflection,onTitle:reset});bgm.sfx('ending');}
  function journal(){
    if(!ready||$('pauseModal').open||$('infoModal').open||$('audioModal').open||busy)return;keys.clear();bgm.stopFootsteps();const out=$('journalEntries');out.replaceChildren();const ids=[...new Set([...game.observed,...game.found])].filter(id=>D.clues[id]);
    if(!ids.length){const el=document.createElement('p');el.textContent='아직 살펴본 자료가 없습니다.';out.append(el);}
    for(const id of ids){const c=D.clues[id],a=document.createElement('article');a.className='note-entry';const h=document.createElement('h3');h.textContent=c.title;const t=document.createElement('p');t.textContent=c.text;const status=document.createElement('p');status.className='small';status.textContent=c.location+' · '+(has(id)?'판단 반영 · '+c.effect:'열람 · 판단 보류');const b=document.createElement('button');b.type='button';b.className='button secondary';b.dataset.clueId=id;b.textContent=has(id)?'자료 다시 보기':'다시 읽고 판단하기';b.onclick=()=>{closeModal($('journalModal'));inspectClue(id);};a.append(h,t,status,b);out.append(a);}
    $('journalModal').showModal();
  }
  function help(){info('조작 안내','WASD / 방향키 : 이동\n문·출입구 : 닿으면 자동 이동\nE / Enter : 대화·조사, 다음 대사\n선택지 : 클릭 또는 Tab → Enter\nQ : 탐색 기록\nEsc : 메뉴 / 창 닫기\n\n자료를 읽고 판단에 반영할 때만 상태가 변합니다.\n메뉴의 소리 설정에서 세 채널을 조절할 수 있습니다.\n대화·기록·메뉴를 보는 동안 이동은 멈춥니다.\n새로고침하면 처음부터 시작합니다.');}
  function locationGuide(){if(busy)return;info('장소 안내','성당 남문 ↔ 성당 앞 ↔ 마을 광장\n성당 오른쪽 위 계단 ↔ 지하실\n성당 서쪽 옆문 ↔ 정원 동쪽 문\n정원 남쪽 길 ↔ 마을 광장 서쪽 길\n마을 광장 동쪽 길 ↔ 세븐의 집\n\n금색 표식이 있는 문이나 길을 향해 걸으면 자동으로 이동합니다.');}
  function openPause(){if(!ready||busy)return;keys.clear();resetPending=false;$('resetNotice').hidden=true;$('resetButton').textContent='처음부터 다시 시작';$('pauseModal').showModal();}
  function reset(){portals.reset();bgm.resetFootsteps();window.SAINT_ENDINGS.reset();walk.moving=false;walk.distance=0;walk.frame=0;cinematic.reset();for(const id of ['pauseModal','infoModal','journalModal','audioModal'])if($(id).open)$(id).close();hideDialogue();game=M.create();world='church';player={...D.player};crowdVisible=true;leaving=null;busy=false;keys.clear();$('endingScreen').hidden=true;$('titleScreen').hidden=false;$('transition').hidden=true;updateHUD();render();}
  function reflection(){
    info(N.ui.reflectionTitle,N.ui.reflectionNote);const out=$('infoContent');
    const ch=document.createElement('p');ch.className='hint';ch.textContent='주민에게 한 대답: '+(game.villageChoice||'—')+'\n엘리 의심도 '+game.suspicion+' / 5 · 신뢰도 '+game.trust+' / 5';out.append(ch);
    for(const h of game.history){const row=document.createElement('div');row.className='history-item';row.textContent=D.clues[h.id]?.title||N.sources[h.id]?.kind||h.id;out.append(row);}
    for(const question of N.endingFor(game.ending,game).reflectionQuestions){const q=document.createElement('p');q.textContent=question;out.append(q);}
  }
  function drawActor(a,isPlayer=false){
    const c=D.characters[a.character];let sp=c.sprites?.[a.facing||'down'];
    if(a.crouching&&c.crouch)sp=c.crouch;
    const src=sp?.src||c.sprite,im=images.get(src);if(!im)return;
    const seated=a.crouching&&a.character==='seven'?window.SAINT_SPRITES.SEVEN_CROUCH:null;
    const crop=seated?.crop||sp?.crop||c.crop||D.spriteCrops[a.character];
    const [sx,sy,sw,sh]=crop,anchor=seated?.anchor||sp?.anchor||[sw/2,sh];
    const h=seated?.height||a.height||84,scale=h/sh;
    const motion=isPlayer?walk:(a.id==='seven'&&leaving?leaving.motion:null);
    const pose=window.SAINT_SPRITES.resolve(im,{character:a.character,facing:a.facing||'down',crop,anchor,height:h,moving:!!motion?.moving,distance:motion?.distance||0,crouching:a.crouching});
    const x=a.x-camera.x,y=a.y-camera.y;
    ctx.fillStyle=isPlayer?'#c9aa6038':'#0005';ctx.beginPath();ctx.ellipse(x,y-1,seated?22:18,6,0,0,Math.PI*2);ctx.fill();
    if(isPlayer){ctx.strokeStyle='#c9aa60aa';ctx.stroke();}
    ctx.drawImage(pose.image,...pose.crop,Math.round(x-pose.anchor[0]*scale),Math.round(y-pose.anchor[1]*scale+(pose.bobY||0)),Math.round(sw*scale),h);
    if(nearest?.id===a.id&&!dialogue)labelBox(c.name,x,y-h-19);
  }
  function labelBox(text,x,y){ctx.font='16px Galmuri11,monospace';const w=ctx.measureText(text).width+22;ctx.fillStyle='#2b321c';ctx.fillRect(x-w/2,y-13,w,26);ctx.strokeStyle='#c9aa60';ctx.strokeRect(x-w/2+.5,y-12.5,w-1,25);ctx.fillStyle='#f4eedc';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);}
  function render(){if(!ready)return;if(cinematic.active){cinematic.draw();return;}camera.x=clamp(player.x-view.width/2,0,D.worldSize-view.width);camera.y=clamp(player.y-view.height/2,0,D.worldSize-view.height);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#10140c';ctx.fillRect(0,0,view.width,view.height);const im=images.get(map().image);if(im)ctx.drawImage(im,-Math.round(camera.x),-Math.round(camera.y),D.worldSize,D.worldSize);
    for(const t of map().interactions){const x=t.x-camera.x,y=t.y-camera.y;if(t.type==='exit'){ctx.strokeStyle='#e7cf91bb';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-8,y-6);ctx.lineTo(x,y-14);ctx.lineTo(x+8,y-6);ctx.stroke();}else if(game.phase==='investigation'&&!has(markers[t.id])){ctx.save();ctx.translate(x,y-15);ctx.rotate(Math.PI/4);ctx.fillStyle='#e7cf91';ctx.fillRect(-3,-3,6,6);ctx.restore();}}
    for(const a of [...actors(),{...player,id:'player'}].sort((a,b)=>a.y-b.y))drawActor(a,a.id==='player');
    if(debug){ctx.save();ctx.translate(-camera.x,-camera.y);for(const r of map().colliders){ctx.fillStyle='#e46b5d44';ctx.fillRect(...r);}ctx.restore();}
  }
  function frame(now){const elapsed=Math.max(0,(now-lastTime)/1000||0),dt=Math.min(elapsed,.05);lastTime=now;cinematic.tick(elapsed);const ritualFrame=cinematic.snapshot();if(ritualFrame)bgm.ritualTick(ritualFrame.time,ritualFrame.kind);
    walk.moving=false;walk.frame=0;
    if(leaving){const before={x:leaving.x,y:leaving.y},t=clamp((now-leaving.started)/1800,0,1);leaving.x=501+450*t;leaving.y=222+80*t;window.SAINT_SPRITES.updateMotion(leaving.motion,Math.hypot(leaving.x-before.x,leaving.y-before.y));}
    if(!paused()){let dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),dy=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));const len=Math.hypot(dx,dy);if(len){const valid=new Set([dx>0?'right':dx<0?'left':null,dy>0?'down':dy<0?'up':null]);player.facing=[...keys].reverse().map(k=>directions[k]).find(d=>valid.has(d))||player.facing;move(dx/len*player.speed*dt,dy/len*player.speed*dt);}nearest=nearestTarget();}
    if(!walk.moving)bgm.stopFootsteps();
    if(ready){render();const show=!paused()&&nearest;$('interactionHint').hidden=!show;if(show)$('interactionHint').textContent=nearest.type==='exit'?'걸어서 이동 · '+nearest.label:'E · '+nearest.label;$('sceneStatus').textContent=debug?'x '+Math.round(player.x)+' · y '+Math.round(player.y):dialogue?'대화 중':busy?'…':phaseNames[game.phase];}
    if(now>toastUntil)$('toast').hidden=true;requestAnimationFrame(frame);
  }
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const code=e.code;
    if(code==='Enter'&&e.target.tagName==='BUTTON')return;
    if(!directions[code]&&!['KeyE','KeyQ','KeyB','Escape','Enter'].includes(code))return;e.preventDefault();if(!ready)return;if(cinematic.active){if(code==='Enter'&&!e.repeat)cinematic.skip();return;}
    if(modalOpen()){
      if(e.repeat)return;
      if(code==='Escape'){const top=['audioModal','infoModal','journalModal','pauseModal'].find(id=>$(id).open);if(top)closeModal($(top));}
      else if(code==='KeyQ'&&$('journalModal').open&&!$('infoModal').open)closeModal($('journalModal'));
      return;
    }
    if(directions[code]){if(!paused()&&!e.repeat){keys.delete(code);keys.add(code);}return;}if(e.repeat)return;
    if(code==='Escape'&&dialogue?.defer&&dialogue.index===dialogue.pages.length-1){hideDialogue();return;}
    if(game.phase==='ending'&&(code==='KeyE'||code==='Enter')){window.SAINT_ENDINGS.advance();return;}
    if(code==='KeyB'){debug=!debug;return;}if(code==='KeyQ'){journal();return;}if(code==='Escape'){openPause();return;}
    if(code==='KeyE'||code==='Enter'){if(dialogue)advance();else interact();}
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();lastTime=performance.now();});window.addEventListener('resize',positionFigure);
  canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));
  $('audioSettingsButton').onclick=()=>audioPanel.open();$('bgmButton').onclick=()=>bgm.toggle();$('skipCinematic').onclick=()=>cinematic.skip();$('startButton').onclick=start;$('helpButton').onclick=help;$('pauseHelp').onclick=help;$('journalButton').onclick=journal;$('closeJournal').onclick=()=>closeModal($('journalModal'));$('mapButton').onclick=locationGuide;$('menuButton').onclick=openPause;$('resumeButton').onclick=()=>closeModal($('pauseModal'));
  $('resetButton').onclick=()=>{if(resetPending)return reset();resetPending=true;$('resetNotice').hidden=false;$('resetButton').textContent='진행을 지우고 처음부터';};
  document.addEventListener('focusin',e=>{if(e.target.matches('button')&&!e.target.disabled)bgm.sfx('choice_focus');});
  document.addEventListener('pointerover',e=>{if(e.target.matches('button')&&!e.target.disabled)bgm.sfx('choice_focus');});
  for(const id of ['pauseModal','journalModal','infoModal','audioModal'])$(id).addEventListener('cancel',()=>keys.clear());
  // __test=1일 때만 개발 검증용 API를 노출합니다. 일반 플레이에는 나타나지 않습니다.
  if(new URLSearchParams(location.search).get('__test')==='1')window.SAINT_TEST={snapshot:()=>({game:JSON.parse(JSON.stringify(game)),world,player:{...player},dialogue:dialogue?{index:dialogue.index,total:dialogue.pages.length,choices:dialogue.choices.map(c=>c.label)}:null,ready,busy,cast:[...villagerCast],actors:actors(),cinematic:cinematic.snapshot(),keys:[...keys],paused:paused(),lastTime,nearest:nearestTarget()?.id,walk:{...walk},audio:bgm.snapshot(),endingPresentation:window.SAINT_ENDINGS.snapshot(),portals:portals.snapshot(),errors:[...testErrors]}),openDialogue,testMove:(dx,dy)=>{if(paused())return;player.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');move(dx,dy);render();},go,interact,advance,canWalk,start,collect,talk,reset,requestRitual,choose:i=>dialogue?.choices[i]?.action()};
  const sources=new Set([...Object.values(endingImages),D.cinematic.atlas,...Object.values(D.maps).map(m=>m.image),...Object.values(D.characters).flatMap(c=>[c.sprite,c.full,c.crouch?.src,...Object.values(c.sprites||{}).map(s=>s.src)].filter(Boolean))]);
  Promise.all([...sources].map(loadImage)).then(()=>{ready=true;$('loading').hidden=true;updateHUD();render();}).catch(e=>{$('loadingText').textContent=e.message+'\n폴더 전체를 압축 해제해 주세요.';console.error(e);});
  requestAnimationFrame(frame);
})();
