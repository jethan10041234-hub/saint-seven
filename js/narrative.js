'use strict';
/* v0.6: focused wording revisions. Map, character and ending-rule data stay separate. */
window.SAINT_NARRATIVE = (() => {
  const p=(character,text)=>({character,text});
  // Index patches preserve scene keys, speakers, page counts and villager slots.
  const storyPatches={
    opening:{
      0:'마을이 위험에 빠졌습니다.\n성경에 전해진 대로, 성녀의 희생으로 우리를 구해야 합니다.',
      1:'사제님이 그렇게 말씀하시니…\n(머뭇거리는 이들 사이로 동의가 번진다.)'
    },
    private:{
      2:'성경에 적힌 흰 머리의 조건이…\n그 아이의 모습과 닮았단다.',
      3:'…우선 세븐이 무슨 생각인지 들어볼게요.'
    },
    seven:{
      1:'…엘리 사제가 너에게 전해 달래.',
      3:'내가 죽으면 마을이 산다던데.\n직접 본 사람은 있대?',
      4:'너에게도 의식이 무엇인지 설명했는지 궁금해서.',
      6:'너는… 정말 그 의식에 가고 싶은 거야?',
      7:'상관없어.\n날마다 같은 일보단 낫겠지.',
      8:'돌아오지 못하는 일인데도…?',
      10:'나는 네가 없어지는 게 싫어.\n네 말이 무슨 뜻인지 더 알고 싶어.'
    },
    alone:{1:'상관없다는 말이…\n정말 원한다는 뜻일까.'},
    gossip:{
      0:'사제님은 성녀가 희생하면 마을이 산다고 하셨어.',
      1:'모두 죽는다는 말이 무서워.\n달리 어쩌겠어.',
      2:'그 말이 정말인지…\n누구에게 물어야 하지?',
      3:'조건이 흰 머리라면 그 애를 말하는 거잖아.',
      4:'러브뤼셀의 후손이라는 소문도 있잖아.\n저주받은 핏줄이라는데.',
      5:'그래도 그 애한테는 물어봤을까?\n…쉿, 누가 듣겠어.'
    },
    elder:{
      0:'너는 그 아이와 늘 함께였지.\n이 의식을 어떻게 생각하니?',
      7:'믿고 있어요.\n그래도 세븐이 죽어야 한다는 말은…'
    },
    yes:{
      4:'사제의 말 말고, 네가 확인한 것도 있니?',
      6:'성당에 기록이 남아 있을 테지.',
      8:'네가 들은 위기는 사제의 말이었니, 네가 본 일이었니?'
    },
    elderAgain:{
      1:'제가 대신한다면…\n세븐은 제단에서 내려올 수 있을까요?',
      2:'누군가는 해야 할 일이지.\n네가 하겠다는 말이냐?',
      3:'(내가 대신한다면…\n세븐은 살아남을 수 있을까.)'
    }
  };
  const clueTexts={
    parchment:'가장자리가 해져 있고 여러 조각으로 찢어져 있다. 지금은 문장을 읽을 수 없다. 정원의 풀과 복원 도구가 필요하다.',
    diary:'“오늘과 내일이 다르지 않다. 남들이 붙여 주는 이름이라도, 잠깐은 새로울까. 죽고 싶은 건지, 다른 삶을 바라는 건지 나도 모르겠다.”\n이 글만으로 의식에 대한 세븐의 뜻을 확정할 수는 없다.',
    restored:'풀과 복원 도구로 조각을 맞추었다. “…러브뤼셀의 마지막 핏줄… 흰 머리의 아이를… 성녀라는 이름 아래…”\n엘리의 이름과 특정 가문을 지목한 흔적이 드러났다. 끊긴 문장만으로 계획의 전부를 알 수는 없다.',
    bible:'“희고 긴 머리의 성녀가 자신을 바칠 때, 마을은 재앙을 벗어날 것이다.”\n책에 적힌 조건은 세븐의 모습과 닮았다. 이 구절이 있다는 것과, 의식이 실제로 마을을 구한다는 것은 아직 같은 사실이 아니다.',
    cover:'미사 때 쓰던 성경책과 커버의 문양이 다르다. 성녀의 외모를 설명하는 부분은 종이와 잉크도 다르다. 누가, 왜 바꾸었을까?',
    elder:'동떨어진 주민은 세븐 대신 희생하라고 재촉했다. 호르마셋은 그 말을 받아들여 대신 나서겠다고 약속했다. 아직 의식에서 대리자로 받아들여진 것은 아니다.',
    contradiction:'성경책에는 흰 머리가 조건으로 적혀 있었다. 그러나 엘리는 의식 중 “러브뤼셀의 핏줄이 이어졌다면 흰 머리인지 아닌지는 중요하지 않다”고 말했다. 제시하던 조건이 달라졌다.'
  };
  const sources={
    parchment:{kind:'물건 · 직접 관찰',source:'성당 지하실의 찢어진 양피지',observed:'글을 읽으려면 먼저 조각을 복원해야 한다.',limits:'읽지 못한 내용은 아직 판단할 수 없다.'},
    diary:{kind:'당사자의 기록',source:'세븐의 집에 있는 일기장',observed:'세븐은 자신의 공허함과 바람을 확정하지 못한 채 적었다.',limits:'이 글은 의식에 대한 충분한 설명이나 최종 동의를 대신하지 않는다.'},
    restored:{kind:'편지 일부 · 직접 관찰',source:'복원된 양피지의 문장과 엘리의 이름',observed:'러브뤼셀의 핏줄, 흰 머리의 아이, 성녀라는 이름이 함께 적혀 있다.',limits:'문장이 끊겨 있어 구체적인 계획과 목적의 전부는 알 수 없다.'},
    bible:{kind:'문헌에 실린 주장',source:'성당의 성경책',observed:'흰 머리의 성녀가 희생하면 재앙을 벗어난다는 구절이 있다.',limits:'글의 존재만으로 예언의 진위나 희생의 효력이 입증되지는 않는다.'},
    cover:{kind:'물건의 차이 · 직접 관찰',source:'성경책의 커버와 해당 구절의 종이·잉크',observed:'미사 때의 문양과 다르고, 일부 지면의 재료도 다르다.',limits:'차이가 있다는 관찰만으로 바꾼 사람과 이유까지 확정할 수는 없다.'},
    elder:{kind:'주민의 권유와 나의 약속',source:'마을 광장의 재대화',observed:'주민이 대리 희생을 재촉했고, 호르마셋이 나서겠다고 말했다.',limits:'주민의 권유는 의식의 효력을 입증하거나 집행자의 수락을 대신하지 않는다.'},
    contradiction:{kind:'서로 다른 조건의 대조',source:'성경책의 구절과 제단 앞 엘리의 발언',observed:'흰 머리를 제시하던 조건이 러브뤼셀의 혈통을 지목하는 말로 바뀌었다.',limits:'조건의 모순을 확인했지만 마을 위기의 원인까지 밝혀진 것은 아니다.'},
    eliFaith:{kind:'사제의 설명을 받아들임',source:'엘리에게 위기와 의식의 근거를 물은 대화',observed:'엘리는 성경의 가르침을 근거로 답했다.',limits:'설명을 믿겠다는 판단이며 독립된 확인을 추가한 것은 아니다.'},
    eliRitual:{kind:'의식의 필요성에 대한 판단',source:'엘리에게 다른 방법을 물은 대화',observed:'엘리는 전해진 의식을 따라야 한다고 답했다.',limits:'다른 방법이 실제로 없다는 사실까지 확인한 것은 아니다.'}
  };
  const dialogues={
    eliGreeting:[p('eli','돌아왔구나. 무엇을 이야기하고 싶니?')],
    eliFaith:[p('hormasset','성녀가 희생하면 모두 산다는 말은 무엇에 근거한 건가요?'),p('eli','성경에 전해진 말이란다.\n지금 우리를 지탱할 것은 믿음이지.')],
    eliRitual:[p('hormasset','다른 방법은 정말 없는 건가요?'),p('eli','달리 확신할 길이 없는 지금, 전해진 의식을 저버릴 수는 없단다.')],
    villagersRepeat:[p('villagers','의식이 우리를 구할 거라고 믿고 싶어.\n사실은 나도 두려운 거야.')],
    elderAfterCommit:[p('elder','네가 대신 나서겠다고 했지.\n그 뜻을 사제에게도 전하거라.')],
    elderCommitted:[p('hormasset','…제가 대신 나서겠어요.\n세븐은 살아 있기를 바라요.')],
    ritualNormal:[p('eli','성녀의 희생으로 이 마을을 구할 시간입니다.'),p('seven','…알겠어.'),p('hormasset','…세븐.')],
    ritualNormalOffered:[p('eli','성녀의 희생으로 이 마을을 구할 시간입니다.'),p('hormasset','…세븐 대신 나서겠다고 했는데.'),p('eli','네 뜻은 들었다.\n하지만 오늘 제단에 설 이는 세븐이란다.'),p('seven','…알겠어.'),p('hormasset','…세븐.')],
    ritualBad:[p('eli','성녀의 희생으로 이 마을을 구할 시간입니다.'),p('hormasset','세븐 대신… 제가 희생하겠습니다.'),p('eli','네가 대신 나서겠다는 뜻을 받겠다.'),p('seven','…호르마셋?'),p('hormasset','너는 살아.\n이 의식이 필요하다면, 내가 대신할게.')],
    ritualTrue:[p('eli','이제 의식을 시작하겠습니다.\n성녀의 희생이 우리 모두를 구할 것입니다.'),p('eli','러브뤼셀의 핏줄이 이어졌다면…\n흰 머리인지 아닌지는 중요하지 않습니다.'),p('hormasset','…흰 머리가 성녀의 조건이라고 하셨잖아요.\n왜 지금은 혈통만을 이야기하시는 거죠?')],
    stopRitual:[p('hormasset','편지에는 러브뤼셀을 지목하셨죠.\n그런데 사람들에게는 다른 조건을 말씀하셨어요.'),p('eli','…'),p('hormasset','이 설명만으로 세븐을 제단에 세울 수는 없어요.\n세븐, 여기서 나가자.'),p('seven','…응. 이제 이건 재미없어.')]
  };
  const labels={
    villageYes:'네, 부당하다고 생각해요',villageSilence:'대답하지 않는다',
    askFaith:'위기와 의식의 근거를 묻는다',acceptFaith:'성경을 근거로 한 설명을 믿는다',deferFaith:'다른 흔적도 확인한다',
    askRitual:'다른 방법이 없는지 묻는다',acceptRitual:'의식이 필요하다는 판단을 받아들인다',deferRitual:'아직 판단을 보류한다',
    requestRitual:'의식에 관한 판단을 전한다',continueInvestigation:'계속 조사한다',
    confirmRitual:'제단으로 간다',cancelRitual:'계속 조사하기',
    elderCommit:'세븐 대신 나서겠다고 말한다',deferDialogue:'Esc · 지금은 대답하지 않기',
    keepParchment:'양피지를 챙긴다',reflectEvidence:'이 내용을 판단에 반영한다',
    challenge:'서로 다른 조건을 지적한다'
  };
  const endings={
    normal:{type:'NORMAL END',title:'세븐이 성녀가 된다',captions:[
      '엘리의 설명을 받아들인 호르마셋은 의식을 요청했다. 제단에 오른 이는 세븐이었다.',
      '짧은 대답 뒤에 검이 내려왔다. 세븐은 희생되고, 호르마셋은 남겨졌다.',
      '마을은 그날을 구원의 날이라 불렀다. 그러나 의식이 재앙을 막았는지는 확인되지 않았다.',
      '성녀라는 이름은 남았다. 그 이름으로 불리던 세븐은 돌아오지 않았다.'
    ],reflectionQuestions:[
      '세븐의 “상관없다”는 말을 어떤 뜻으로 받아들였나요?',
      '의식을 믿게 한 말이나 흔적은 무엇이었나요?'
    ]},
    bad:{type:'BAD END',title:'뒤바뀐 성녀',captions:[
      '세븐을 살리고 싶었던 호르마셋은, 한 사람의 희생이 필요하다는 설명을 받아들였다.',
      '마을에서 했던 약속은 제단 앞에서 행동이 되었다. 호르마셋이 세븐 대신 의식에 섰다.',
      '검이 내려온 뒤, 세븐은 살아남았다. 호르마셋은 더는 곁에 없었다.',
      '희생의 자리는 다른 사람으로 채워졌다. 그 자리가 왜 필요했는지는 끝내 확인되지 않았다.'
    ],reflectionQuestions:[
      '세븐을 구하려는 마음과 의식을 믿는 마음은 어떻게 연결되어 있었나요?',
      '대신 나서기 전, 누구에게 무엇을 더 물어보고 싶었나요?'
    ]},
    true:{type:'TRUE END',title:'희생을 멈춘 자리',captions:[
      '끊긴 편지와 바뀐 책에 남은 의문이, 엘리의 연설과 맞부딪쳤다.',
      '흰 머리가 조건이라던 엘리는 이제 러브뤼셀의 핏줄을 말했다. 호르마셋은 그 모순을 지적했다.',
      '검은 내려오지 않았다. 세븐은 호르마셋과 함께 제단을 떠났다.',
      '위기의 원인도, 희생의 효력도 아직 확인되지 않았다. 다만 오늘은 누구도 제단에서 죽지 않았다.'
    ],reflectionQuestions:[
      '어떤 말이나 흔적이 당신의 판단을 바꾸었나요?',
      '의식이 멈춘 뒤에도, 마을과 세븐에게 남은 질문은 무엇일까요?'
    ]}
  };
  endings.normal.offeredCaptions=[
    '호르마셋은 주민에게 대신 나서겠다고 말했다. 그러나 엘리가 제단에 부른 이는 세븐이었다.',
    ...endings.normal.captions.slice(1)
  ];
  for(const value of Object.values(endings))value.text=value.captions.join('\n\n');
  const ui={
    investigation:'마을에서 들은 말과 성당의 기록을 살펴보세요.\n문서를 읽는 것과 그 내용을 판단에 반영하는 것은 별개입니다.\n\n지하실의 찢어진 양피지를 먼저 찾으세요.\nQ에서 살펴본 자료와 반영한 판단을 다시 볼 수 있습니다.',
    evidenceHint:'내용을 읽은 뒤 판단에 반영하거나, Esc로 닫고 보류할 수 있습니다.',
    ritualTitle:'제단으로 가시겠습니까?',
    ritualConfirm:'조사를 마치고 제단으로 갑니다.\n이후에는 조사로 돌아올 수 없습니다.\n받아들인 설명과 남겨 둔 의문이 행동으로 이어집니다.',
    notEnough:'호르마셋은 아직 의식에 대한 입장을 정하지 못했다.\n문서를 살펴보거나 사람들의 말을 더 들어보자.',
    reflectionTitle:'남겨진 질문',reflectionNote:'답을 고르거나 적을 필요는 없습니다. 잠시 생각하거나 이 화면을 건너뛸 수 있습니다.',
    judgmentNote:'들은 말과 확인한 흔적이\n판단에 남습니다.'
  };
  function apply(data,story){
    for(const [key,patch] of Object.entries(storyPatches))for(const [index,text] of Object.entries(patch)){
      if(!story[key]?.[index])throw Error('Unknown original dialogue '+key+'['+index+']');
      story[key][index].text=text;
    }
    for(const [key,text] of Object.entries(clueTexts)){
      if(!data.clues[key])throw Error('Unknown original clue '+key);
      data.clues[key].text=text;
    }
  }
  function endingFor(id,game){
    const original=endings[id];if(!original)throw Error('Unknown ending '+id);
    const captions=id==='normal'&&game?.found?.includes('elder')?original.offeredCaptions:original.captions;
    return {...original,captions:[...captions],text:captions.join('\n\n'),reflectionQuestions:[...original.reflectionQuestions]};
  }
  return Object.freeze({apply,storyPatches,clueTexts,sources,dialogues,labels,endings,endingFor,ui});
})();
