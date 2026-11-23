'use strict';
/* Presentation-only sizing and pagination. Story, choices and state stay in game.js. */
window.SAINT_LAYOUT = (() => {
  const root=document.documentElement,$=id=>document.getElementById(id);
  const modalStates=new Map();
  let scheduled=0,refreshing=false;
  const px=v=>Number.parseFloat(v)||0;
  const observers=[];
  function viewport(){
    const vv=window.visualViewport;
    return {width:Math.max(1,Math.floor(vv?.width||innerWidth)),height:Math.max(1,Math.floor(vv?.height||innerHeight))};
  }
  function setVar(el,name,value){if(el.style.getPropertyValue(name)!==value)el.style.setProperty(name,value);}
  function syncViewport(){const v=viewport();setVar(root,'--app-width',v.width+'px');setVar(root,'--app-height',v.height+'px');}
  function outerHeight(el){const s=getComputedStyle(el);return el.getBoundingClientRect().height+px(s.marginTop)+px(s.marginBottom);}
  function positionFigure(){
    const stage=$('stage'),dialogue=$('dialogue'),figure=$('fullFigure');
    if(!stage||!dialogue||!figure||dialogue.hidden)return;
    const style=getComputedStyle(dialogue),bottom=px(style.bottom),gap=10;
    const dialogueHeight=dialogue.getBoundingClientRect().height;
    const available=Math.max(0,stage.clientHeight-dialogueHeight-bottom-gap-8);
    const h=Math.min(420,available),ph=Math.min(142,available);
    setVar(stage,'--figure-bottom',Math.ceil(dialogueHeight+bottom+gap)+'px');
    setVar(stage,'--figure-height',Math.floor(h)+'px');
    setVar(stage,'--figure-width',Math.floor(Math.min(240,h*.63))+'px');
    setVar(stage,'--pixel-figure-height',Math.floor(ph)+'px');
    setVar(stage,'--pixel-figure-width',Math.floor(Math.min(122,ph*.84))+'px');
  }
  function setupPagination(modal,container){
    let state=modalStates.get(container);
    if(state)return state;
    const nav=document.createElement('nav');nav.className='layout-page-navigation';nav.setAttribute('aria-label','내용 페이지');nav.dataset.for=container.id;nav.hidden=true;
    const previous=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span');
    previous.type=next.type='button';previous.textContent='이전';next.textContent='다음';count.className='layout-page-count';count.setAttribute('aria-live','polite');
    nav.append(previous,count,next);container.after(nav);
    state={modal,container,nav,previous,next,count,pages:[],nodes:[],index:0,budget:0,width:0};modalStates.set(container,state);
    previous.onclick=()=>showPage(state,state.index-1,true);next.onclick=()=>showPage(state,state.index+1,true);
    return state;
  }
  function showPage(state,index,fromClick=false){
    if(!state.pages.length)return;
    state.index=Math.max(0,Math.min(index,state.pages.length-1));
    for(const [i,page] of state.pages.entries())page.hidden=i!==state.index;
    state.nav.hidden=state.pages.length<2;
    state.count.textContent=(state.index+1)+' / '+state.pages.length;
    state.previous.disabled=state.index===0;state.next.disabled=state.index===state.pages.length-1;
    if(fromClick){const focus=state.next.disabled?state.previous:state.next;if(!focus.disabled)focus.focus({preventScroll:true});}
  }
  function paginate(modal,container){
    if(!modal.open)return;
    const state=setupPagination(modal,container),children=[...container.childNodes];
    const owns=children.length===state.pages.length&&children.every((n,i)=>n===state.pages[i]);
    if(!owns){state.nodes=children;state.index=0;}
    const ms=getComputedStyle(modal),maxHeight=Math.min(viewport().height-20,px(ms.maxHeight)||Infinity);
    const other=[...modal.children].filter(e=>e!==container&&e!==state.nav&&!e.hidden).reduce((sum,e)=>sum+outerHeight(e),0);
    const budget=Math.max(48,Math.floor(maxHeight-px(ms.paddingTop)-px(ms.paddingBottom)-px(ms.borderTopWidth)-px(ms.borderBottomWidth)-other-46));
    const width=Math.floor(container.getBoundingClientRect().width);
    if(owns&&budget===state.budget&&width===state.width){showPage(state,state.index);return;}
    state.budget=budget;state.width=width;container.replaceChildren();state.pages=[];
    let page;
    function newPage(){page=document.createElement('div');page.className='layout-page';state.pages.push(page);container.append(page);return page;}
    function overflow(){return page.getBoundingClientRect().height>budget+1;}
    function paragraph(node){
      let part=node.cloneNode(false),value='';part.removeAttribute('id');page.append(part);
      const tokens=node.textContent.match(/\S+\s*|\s+/gu)||[''];
      for(const token of tokens){
        const before=value;value+=token;part.textContent=value;
        if(overflow()&&before){
          part.textContent=before;newPage();part=node.cloneNode(false);part.removeAttribute('id');value=token;part.textContent=value;page.append(part);
        }else if(overflow()&&page.children.length>1){part.remove();newPage();page.append(part);}
      }
    }
    function cloneJournalBlock(source){
      // The article retained in state.nodes must remain a complete source for
      // the next resize. Proxy button activation to the original element so
      // both onclick and addEventListener handlers stay attached and execute.
      const copy=source.cloneNode(false);
      for(const child of source.childNodes)copy.append(cloneJournalBlock(child));
      if(source.nodeType===Node.ELEMENT_NODE&&source.matches('button[data-clue-id]')){
        copy.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(!source.disabled)source.click();});
      }
      return copy;
    }
    function append(node){
      if(node.nodeType===Node.TEXT_NODE&&!node.textContent.trim())return;
      page.append(node);
      if(!overflow())return;
      node.remove();
      if(page.childNodes.length)newPage();
      page.append(node);
      if(!overflow())return;
      node.remove();
      if(node.nodeType===Node.ELEMENT_NODE&&node.tagName==='P'){paragraph(node);return;}
      // Journal actions have a stable original target, unlike grouped choices.
      // Split an oversized article without moving or cloning away its handlers.
      if(container.id==='journalEntries'&&node.nodeType===Node.ELEMENT_NODE&&node.matches('article.note-entry')){
        for(const child of node.childNodes)append(cloneJournalBlock(child));
        return;
      }
      // Source notes and other noninteractive blocks split at their existing
      // child boundaries. Interactive choice groups retain their parent.
      if(node.nodeType===Node.ELEMENT_NODE&&node.children.length&&!node.querySelector('button,a,input,select,textarea')){
        for(const child of [...node.childNodes])append(child.cloneNode(true));
      }else page.append(node);
    }
    newPage();for(const node of state.nodes)append(node);
    // A moved paragraph may have left an empty tail page; never show a blank page.
    if(state.pages.length>1&&!state.pages.at(-1).childNodes.length){state.pages.pop().remove();}
    showPage(state,Math.min(state.index,state.pages.length-1));
  }
  function observe(){
    for(const {observer,target,options} of observers)observer.observe(target,options);
  }
  function refreshNow(){
    scheduled=0;if(refreshing)return;refreshing=true;
    for(const {observer} of observers)observer.disconnect();
    try{
      syncViewport();
      positionFigure();
      for(const [modalId,containerId] of [['journalModal','journalEntries'],['infoModal','infoContent']]){
        const modal=$(modalId),container=$(containerId);if(modal&&container)paginate(modal,container);
      }
    }finally{refreshing=false;observe();}
  }
  function refresh(){syncViewport();if(!scheduled)scheduled=requestAnimationFrame(refreshNow);}
  function watch(target,options){if(!target)return;const observer=new MutationObserver(refresh);observers.push({observer,target,options});observer.observe(target,options);}
  watch($('dialogue'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});
  watch($('fullFigure'),{attributes:true,attributeFilter:['hidden','class']});
  for(const id of ['journalModal','infoModal'])watch($(id),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['open']});
  const resizeObserver=new ResizeObserver(refresh);for(const el of [$('stage'),$('dialogue')])if(el)resizeObserver.observe(el);
  addEventListener('resize',refresh);window.visualViewport?.addEventListener('resize',refresh);window.visualViewport?.addEventListener('scroll',refresh);
  document.fonts?.ready.then(refresh);refreshNow();
  return {
    refresh,
    snapshot(){return {viewport:viewport(),page:{width:document.body.scrollWidth,height:document.body.scrollHeight},modals:[...modalStates.values()].map(s=>({id:s.container.id,pages:s.pages.length,current:s.index+1,budget:s.budget}))};}
  };
})();
