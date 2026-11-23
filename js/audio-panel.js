'use strict';
/* Audio preferences delegate to the mixer; this panel collects no player answers. */
window.SAINT_AUDIO_PANEL=(()=>{
  function create(audio,{onOpen,onClose}={}){
    const modal=document.createElement('dialog');modal.id='audioModal';modal.className='modal audio-modal';modal.setAttribute('aria-labelledby','audioTitle');
    const heading=document.createElement('h2');heading.id='audioTitle';heading.textContent='소리 설정';
    const body=document.createElement('div');body.className='audio-controls';
    const rows={};
    for(const [channel,label] of [['master','전체 음량'],['bgm','배경음악'],['ambience','환경음'],['sfx','효과음']]){
      const suffix=channel[0].toUpperCase()+channel.slice(1),row=document.createElement('div');row.className='audio-control-row';
      const name=document.createElement('label');name.htmlFor=`audio${suffix}Volume`;name.textContent=label;
      const toggle=document.createElement('button');toggle.id=`audio${suffix}Enabled`;toggle.type='button';toggle.className='button secondary audio-toggle';toggle.setAttribute('aria-label',label+' 켜기/끄기');
      const range=document.createElement('input');range.id=`audio${suffix}Volume`;range.type='range';range.min='0';range.max='100';range.step='1';
      const value=document.createElement('output');value.setAttribute('for',range.id);
      row.append(name,toggle,range,value);body.append(row);rows[channel]={toggle,range,value};
      toggle.onclick=()=>{const s=audio?.snapshot?.()||{},enabled=channel==='master'?s.enabled:s.channels?.[channel]?.enabled;channel==='master'?audio?.setEnabled?.(!enabled):audio?.setChannelEnabled?.(channel,!enabled);sync();};
      range.oninput=()=>{audio?.setVolume?.(channel,Number(range.value)/100);sync();};
    }
    const note=document.createElement('p');note.className='audio-setting-note';note.textContent='대화 중에는 음악과 환경음이 부드럽게 낮아집니다.';
    const close=document.createElement('button');close.id='closeAudio';close.type='button';close.className='button';close.textContent='돌아가기';close.onclick=()=>modal.close();
    modal.append(heading,body,note,close);document.body.append(modal);
    function sync(){const s=audio?.snapshot?.()||{};for(const [channel,row] of Object.entries(rows)){const enabled=channel==='master'?s.enabled:s.channels?.[channel]?.enabled,volume=channel==='master'?s.volume:s.channels?.[channel]?.volume,label=enabled===false?'OFF':'ON',pressed=String(enabled!==false);if(row.toggle.textContent!==label)row.toggle.textContent=label;if(row.toggle.getAttribute('aria-pressed')!==pressed)row.toggle.setAttribute('aria-pressed',pressed);const percent=Math.round((Number.isFinite(volume)?volume:1)*100),value=String(percent);if(row.range.value!==value)row.range.value=value;if(row.value.value!==value+'%')row.value.value=value+'%';}}
    modal.addEventListener('close',()=>onClose?.());
    return {open(){sync();if(!modal.open){modal.showModal();onOpen?.();}rows.master.range.focus({preventScroll:true});},close(){if(modal.open)modal.close();},sync,element:modal,snapshot(){return{open:modal.open,channels:Object.fromEntries(Object.entries(rows).map(([key,row])=>[key,{enabled:row.toggle.getAttribute('aria-pressed')==='true',volume:Number(row.range.value)/100}]))};}};
  }
  return {create};
})();
