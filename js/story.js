/* 사용자 대본. 단서 본문과 엔딩 연결 대사는 data.js/game.js에 있습니다. */
window.SAINT_STORY = (() => {
  const p=(character,text)=>({character,text});
  return {
    opening:[p('eli','마을이 위험에 빠졌습니다. 고귀한 성녀의 희생은 모두를 살릴 것입니다.'),p('villagers','그렇구나.\n(마을 사람들이 고개를 끄덕인다.)')],
    private:[p('eli','…세븐에게 전해줄 수 있겠니?'),p('eli','그 아이는 성당을 싫어해서 이번 미사에도 안 왔잖아.'),p('eli','사실은 그 아이가… 성녀의 조건에 가장 부합하기도 한단다.'),p('hormasset','그럴 수가… 알겠습니다.')],
    seven:[
      p('seven','…미사가 끝났구나.'),p('hormasset','…저기…'),p('seven','네가 할 말을 알고 있어.'),
      p('seven','마을 사람들이 떠드는 것도 알고.\n내가 성녀가 되어서 마을을 구해야 한다는 거지?'),
      p('hormasset','꼭 그렇다기보다는…'),p('seven','내가 성녀라니 어울리지도 않네.\n귀신 같은 하얀 머리로 놀릴 때는 언제고.'),
      p('hormasset','너는… 네가 희생해야 한다고 생각해?'),p('seven','상관없어.\n못 할 것도 없지.'),
      p('hormasset','뭐? 살고 싶지 않아…?'),p('seven','살아서 뭘 하는데?'),p('hormasset','무슨 그런 말을…! 넌 내가 소중하지도 않—')
    ],
    alone:[p('hormasset','…'),p('hormasset','삶을 저렇게 쉽게 포기하다니.\n신앙이 있는 애도 아니면서.'),p('hormasset','뭔가 이상해…')],
    gossip:[
      {character:'villagers',villagerSlot:0,text:'성녀라니 무슨 일이래.'},{character:'villagers',villagerSlot:1,text:'하지만 성녀가 죽지 않으면 우리 마을 사람들이 모두 죽는 거잖아.'},
      {character:'villagers',villagerSlot:2,text:'조건이 하얀 머리라니…\n왠지 그 아이 같은데.'},{character:'villagers',villagerSlot:0,text:'하얀 머리가 그 애 말고 더 있어?'},
      {character:'villagers',villagerSlot:1,text:'잘됐네, 저주받아 몰락한 러브뤼셀 왕가의 후손이라는 소문이 있던데 치워버리는 게 낫지.'},
      {character:'villagers',villagerSlot:2,text:'쉿! 누가 들으면 어쩌려고 그러나.'}
    ],
    elder:[
      p('elder','성녀로 지목된 건 네 가장 친한 친구인데 넌 아무런 동요도 없구나.'),
      p('hormasset','그럴 리가요, 오히려 이상하게 침착한 건 그 애인걸요.'),
      p('elder','그 애가 없어지면 넌 꽤나 슬프겠는걸.\n매일 붙어 다녔잖아.'),
      p('hormasset','…이건 옳지 않다고 생각해요.'),p('elder','무엇이?'),p('hormasset','…그건…'),
      p('elder','너는 엘리 사제와 하나님을 믿지 않나?'),p('hormasset','당연히 에르텐 제국의 이름으로 믿고 있습니다! 하지만…'),
      p('elder','옳지 않다고 생각하는 건 네 친구의 희생이 부당하다고 생각한다는 거겠지?')
    ],
    yes:[p('elder','정의의 여신 납셨구만…'),p('hormasset','…'),p('elder','희생을 막고 싶은가?'),p('hormasset','할 수 있다면요.'),
      p('elder','스스로 생각하는 힘은 중요하지.'),p('hormasset','무슨 뜻이신지…?'),p('elder','내 생각보단 똑똑한 아이인 줄 알았는데… 쯔쯔…'),
      p('hormasset','알려 주세요…'),p('elder','이 마을에 갑자기 왜 위기가 닥치는 걸까? 선하신 하나님께서 이 일을 계획한 걸까?'),
      p('hormasset','선하신 하나님께서는 늘…!\n(멈칫)'),p('elder','그렇게 좋아하는 선하신 하나님의 집으로 가봐.')],
    silence:[p('hormasset','…\n(눈동자가 흔들린다.)'),p('elder','누군가는 해야 할 일이야… 꽤 명예로운 일이지…'),
      p('hormasset','하지만 너무 잔인해요, 그 애가 무슨 잘못이 있다고…'),p('elder','그럼 네가 대신 성녀가 되려무나.'),
      p('hormasset','…네?'),p('elder','말 그대로야.\n그 아이 대신 희생할 수 있겠니?'),p('hormasset','…')],
    elderAgain:[p('elder','아직도 망설이고 있니? 그 아이를 살리고 싶다면 네가 대신 성녀가 되면 될 일이다.'),
      p('hormasset','제가 대신한다면… 세븐은 살 수 있는 거죠?'),p('elder','누군가는 해야 할 일이지. 이제 네가 답할 차례다.'),
      p('hormasset','…제가 할게요. 세븐 대신, 제가 성녀가 되겠습니다.')]
  };
})();
