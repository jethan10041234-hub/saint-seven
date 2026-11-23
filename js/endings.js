'use strict';
/* Ending presentation only: the existing model still chooses the ending. */
window.SAINT_ENDINGS = (() => {
  const $=id=>document.getElementById(id);
  let dom=null,state=null,resizeFrame=0;
  function element(tag,className,id){const el=document.createElement(tag);if(className)el.className=className;if(id)el.id=id;return el;}
  function button(id,label,className='button secondary'){const el=element('button',className,id);el.type='button';el.textContent=label;return el;}
  function ensure(){
    if(dom)return dom;
    const root=$('endingScreen');if(!root)return null;
    const type=$('endingType'),title=$('endingTitle'),text=$('endingText'),reflection=$('reflectionButton'),restart=$('endingRestart');
    const previousReflection=reflection.onclick,previousRestart=restart.onclick;
    const art=element('div','ending-art'),image=element('img','','endingIllustration'),fallback=element('p','ending-art-fallback');
    image.decoding='async';image.draggable=false;fallback.textContent='엔딩 그림을 불러오는 중입니다.';art.append(image,fallback);
    const copy=element('div','ending-copy'),heading=element('header','ending-heading'),reading=element('div','ending-reading'),questions=element('div','ending-questions','endingQuestions');
    heading.append(type,title);reading.append(text,questions);text.setAttribute('aria-live','polite');questions.hidden=true;
    const nav=element('nav','ending-navigation');nav.setAttribute('aria-label','엔딩 문구');
    const previous=button('endingPrevious','이전'),next=button('endingNext','다음'),all=button('endingShowAll','전체 문구'),counter=element('span','ending-counter','endingCounter');
    counter.setAttribute('aria-live','polite');nav.append(previous,counter,next,all);
    const final=element('div','ending-final-actions'),skip=button('endingSkipReflection','건너뛰고 타이틀','text-button');
    restart.textContent='타이틀로';reflection.textContent='내 선택 돌아보기';final.append(reflection,restart,skip);copy.append(heading,reading,nav,final);
    root.replaceChildren(art,copy);root.classList.add('ending-illustrated');root.setAttribute('aria-label','엔딩');
    dom={root,art,image,fallback,copy,type,title,text,questions,reading,nav,previous,next,all,counter,final,reflection,restart,skip,previousReflection,previousRestart};
    previous.onclick=()=>{if(!state)return;if(state.mode==='reflection'){state.mode='captions';state.index=state.captions.length-1;}else if(state.mode==='all')state.allIndex=Math.max(0,state.allIndex-1);else state.index=Math.max(0,state.index-1);render();};
    next.onclick=advance;all.onclick=revealAll;
    reflection.onclick=event=>{if(!state)return;(state.config.onReflection||dom.previousReflection)?.(event);};
    const returnToTitle=event=>{if(!state)return;const callback=state.config.onTitle||dom.previousRestart;callback?.(event);};
    restart.onclick=returnToTitle;skip.onclick=returnToTitle;
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(state?.mode==='all')renderAll();});});observer.observe(root);
    return dom;
  }
  function animateText(){if(!dom)return;dom.reading.classList.remove('ending-caption-enter');void dom.reading.offsetWidth;dom.reading.classList.add('ending-caption-enter');}
  function show(id,config={}){
    if(!ensure())return;
    const captions=(config.captions?.length?config.captions:String(config.text||dom.text.textContent||'').split(/\n\s*\n/)).map(String).filter(Boolean);
    state={id:String(id),config,captions:captions.length?captions:[''],questions:(config.reflectionQuestions||[]).map(String).slice(0,2),index:0,allIndex:0,allPages:[],mode:'captions',complete:false,imageReady:false};
    dom.type.textContent=config.type||dom.type.textContent;dom.title.textContent=config.title||dom.title.textContent;
    dom.image.alt=config.alt||`${dom.title.textContent} — 엔딩 일러스트`;dom.image.hidden=false;dom.fallback.hidden=false;dom.fallback.textContent='엔딩 그림을 불러오는 중입니다.';
    const current=state;
    dom.image.onload=()=>{if(state!==current)return;state.imageReady=true;dom.fallback.hidden=true;dom.root.classList.add('ending-image-ready');};
    dom.image.onerror=()=>{if(state!==current)return;state.imageReady=false;dom.image.hidden=true;dom.fallback.textContent='엔딩 그림을 불러올 수 없습니다.';};
    dom.root.classList.remove('ending-image-ready','ending-visible');dom.image.src=config.image||`assets/endings/${id}.png`;
    if(dom.image.complete&&dom.image.naturalWidth){state.imageReady=true;dom.fallback.hidden=true;dom.root.classList.add('ending-image-ready');}
    dom.root.hidden=false;render();requestAnimationFrame(()=>{if(state===current)dom.root.classList.add('ending-visible');});
  }
  function renderAll(){
    if(!state||state.mode!=='all')return;
    dom.text.replaceChildren();dom.text.classList.add('ending-all-text');
    // Use complete paragraphs on each page; the image and controls retain space.
    const available=Math.max(48,dom.reading.clientHeight),pages=[[]];let paragraph;
    for(const caption of state.captions){
      paragraph=element('span','ending-all-paragraph');paragraph.textContent=caption;dom.text.append(paragraph);
      if(dom.text.scrollHeight>available+1&&pages.at(-1).length){pages.push([]);dom.text.replaceChildren(paragraph);}
      pages.at(-1).push(caption);
    }
    state.allPages=pages;state.allIndex=Math.max(0,Math.min(state.allIndex,pages.length-1));dom.text.replaceChildren();
    for(const caption of pages[state.allIndex]){paragraph=element('span','ending-all-paragraph');paragraph.textContent=caption;dom.text.append(paragraph);}
    dom.previous.disabled=state.allIndex===0;dom.counter.textContent=`전체 ${state.allIndex+1} / ${pages.length}`;dom.next.textContent=state.allIndex===pages.length-1?'여운 돌아보기':'다음 쪽';
  }
  function render(){
    if(!state)return;
    const reflecting=state.mode==='reflection';dom.root.dataset.endingMode=state.mode;dom.questions.hidden=!reflecting;dom.text.hidden=reflecting;dom.all.hidden=reflecting;dom.nav.hidden=reflecting;dom.final.hidden=!reflecting;
    dom.text.classList.remove('ending-all-text');dom.text.replaceChildren();dom.questions.replaceChildren();
    if(reflecting){
      state.complete=true;dom.questions.setAttribute('aria-live','polite');
      const note=element('p','ending-reflection-note');note.textContent='이야기를 떠나기 전에';dom.questions.append(note);
      for(const question of state.questions){const p=element('p');p.textContent=question;dom.questions.append(p);}
      dom.skip.hidden=state.questions.length===0;
    }else if(state.mode==='all')renderAll();
    else{dom.text.textContent=state.captions[state.index];dom.counter.textContent=`${state.index+1} / ${state.captions.length}`;dom.previous.disabled=state.index===0;dom.next.textContent=state.index===state.captions.length-1?'여운 돌아보기':'다음';}
    animateText();
  }
  function advance(){
    if(!state)return false;
    if(state.mode==='reflection')return false;
    if(state.mode==='all'){if(state.allIndex<state.allPages.length-1)state.allIndex++;else state.mode='reflection';}
    else if(state.index<state.captions.length-1)state.index++;
    else state.mode='reflection';
    render();return true;
  }
  function revealAll(){if(!state)return false;state.mode='all';state.allIndex=0;state.complete=true;render();return true;}
  function reset(){state=null;cancelAnimationFrame(resizeFrame);if(dom){dom.root.hidden=true;dom.root.classList.remove('ending-visible','ending-image-ready');dom.image.onload=dom.image.onerror=null;}}
  function snapshot(){return state?{id:state.id,index:state.index,total:state.captions.length,complete:state.complete,mode:state.mode,imageReady:state.imageReady,imageSrc:dom.image.getAttribute('src'),reflection:state.mode==='reflection',questions:[...state.questions],allPage:state.allIndex+1,allPages:state.allPages.length}:null;}
  return {show,advance,revealAll,reset,snapshot};
})();
