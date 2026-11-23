'use strict';
// 의식 장면의 시간표와 화면 연출. 이미지 원본은 변경하지 않습니다.
window.SAINT_CINEMATIC = (() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*clamp(t,0,1);
  const durations={normal:9.2,bad:9.2,true:7.8};
  function create({canvas,ctx,images,data:D,caption,heading,line,sound}){
    let scene=null;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function setCaption(title,text){if(heading.textContent!==title)heading.textContent=title;if(line.textContent!==text)line.textContent=text;}
    function cue(name){if(!scene.cues.has(name)){scene.cues.add(name);sound?.(name);}}
    function cell(name,x,y,size,rotation=0,opacity=1){
      const im=images.get(D.cinematic.atlas);if(!im)return;
      ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(rotation);ctx.globalAlpha=opacity;
      ctx.drawImage(im,...D.cinematic.cells[name],-size/2,-size,size,size);ctx.restore();
    }
    function person(id,x,y,h,facing='down',opacity=1){
      const c=D.characters[id],sp=c.sprites?.[facing],im=images.get(sp?.src||c.sprite);if(!im)return;
      const crop=sp?.crop||c.crop||D.spriteCrops[id],scale=h/crop[3],anchor=sp?.anchor||[crop[2]/2,crop[3]];
      // A scene owns its own motion records. Measure only actual position
      // changes; repeated renders at the same scene time retain the same pose.
      let record=scene.motions.get(id);
      if(!record){record={x,y,time:scene.time,motion:{moving:false,distance:0,frame:0}};scene.motions.set(id,record);}
      else if(record.time!==scene.time){
        window.SAINT_SPRITES.updateMotion(record.motion,Math.hypot(x-record.x,y-record.y));
        record.x=x;record.y=y;record.time=scene.time;
      }
      const pose=window.SAINT_SPRITES.resolve(im,{character:id,facing,crop,anchor,height:h,moving:record.motion.moving,distance:record.motion.distance});
      ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(pose.image,...pose.crop,Math.round(x-pose.anchor[0]*scale),Math.round(y-pose.anchor[1]*scale+(pose.bobY||0)),Math.round(crop[2]*scale),h);ctx.restore();
    }
    function complete(){if(!scene)return;const done=scene.done;scene.motions.clear();scene=null;caption.hidden=true;done();}
    function draw(){
      if(!scene)return;const {kind,time:t,victim,cast}=scene,isTrue=kind==='true';
      ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle='#0c100a';ctx.fillRect(0,0,960,640);
      const bg=images.get(D.maps.church.image);if(bg)ctx.drawImage(bg,240,0,780,700,0,0,960,640);
      ctx.fillStyle='#080d1166';ctx.fillRect(0,0,960,640);
      // The same cast watches the ritual; their identities persist across maps.
      for(let i=0;i<cast.length;i++)person(cast[i],130+i*140,580,74,'up',.65);
      person('eli',310,300,116);
      cell('dais',475,468,300);
      const strike=!isTrue&&t>=3.9;
      const pose=strike?'executionerStrike':t>=2&&(!isTrue||t<4.1)?'executionerRaised':'executionerIdle';
      let offset=0;if(strike&&t<4.2&&!reduced)offset=Math.sin((t-3.9)*60)*3*(1-(t-3.9)/.3);
      ctx.translate(offset,0);
      cell(pose,597,356,243);
      if(isTrue){
        // Interruption occurs before the strike; both protagonists leave standing.
        if(t<4.6)cell('sevenKneeling',450,340,185);
        else person('seven',mix(450,380,(t-4.6)/2),mix(340,430,(t-4.6)/2),144,'down');
        const approach=clamp((t-2.1)/1.15,0,1),leave=clamp((t-4.6)/2,0,1);
        person('hormasset',mix(mix(260,510,approach),285,leave),mix(mix(450,370,approach),442,leave),148,leave>0?'down':'right');
        if(t<2.1)setCaption('의식 집행','세븐이 제단 앞에 무릎을 꿇었다.');
        else if(t<4.1){setCaption('멈춰요!','호르마셋이 세븐과 집행자 사이를 가로막았다.');cue('stop');}
        else{setCaption('중단된 의식','검이 내려갔다. 두 사람은 함께 제단을 벗어났다.');cue('release');}
      }else{
        const fallen=clamp((t-3.98)/.65,0,1);
        cell(victim+'Kneeling',450-fallen*16,340+fallen*31,185,-fallen*Math.PI*.48,1-fallen*.15);
        const witness=victim==='seven'?'hormasset':'seven';
        person(witness,260+(t>4?clamp((t-4)/.6,0,1)*37:0),450,148,'right');
        if(t<2)setCaption('의식 집행',D.characters[victim].name+'이 제단 앞에 무릎을 꿇었다.');
        else if(t<3.9){setCaption('들어 올려진 검','성당 안에서 모든 소리가 멎었다.');cue('raise');}
        else if(t<4.9){setCaption('처형','검이 내려오고, '+D.characters[victim].name+'이 쓰러졌다.');cue('strike');}
        else setCaption('남겨진 사람',D.characters[victim].name+'은 더 이상 움직이지 않았다.');
        // One muted impact veil, followed by a still aftermath.
        if(strike&&t<4.12){ctx.fillStyle='rgba(18,4,5,'+(.7*(1-(t-3.9)/.22))+')';ctx.fillRect(-8,0,976,640);}
      }
      ctx.restore();
      const edge=ctx.createRadialGradient(480,300,180,480,300,560);edge.addColorStop(0,'#0000');edge.addColorStop(1,'#020502ce');ctx.fillStyle=edge;ctx.fillRect(0,0,960,640);
      ctx.fillStyle='#070a07';ctx.fillRect(0,0,960,34);ctx.fillRect(0,606,960,34);
      const fadeIn=1-clamp(t/.75,0,1),fadeOut=clamp((t-(durations[kind]-1.1))/1.1,0,1);
      ctx.fillStyle='rgba(3,4,2,'+Math.max(fadeIn,fadeOut)+')';ctx.fillRect(0,0,960,640);
    }
    return {
      get active(){return !!scene;},
      start(kind,cast,done){scene={kind,time:0,victim:kind==='bad'?'hormasset':'seven',cast:[...cast],done,cues:new Set(),motions:new Map()};caption.hidden=false;cue('bell');draw();},
      tick(dt){if(!scene)return;if(!document.hidden)scene.time+=dt;if(scene.time>=durations[scene.kind])complete();},
      draw,
      skip:complete,
      reset(){scene?.motions.clear();scene=null;caption.hidden=true;},
      snapshot(){return scene?{kind:scene.kind,time:scene.time,victim:scene.victim,struck:scene.cues.has('strike'),duration:durations[scene.kind]}:null;}
    };
  }
  return {create};
})();
