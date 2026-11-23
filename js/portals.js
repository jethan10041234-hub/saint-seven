'use strict';
// v0.5: the 12 existing map links, fitted to the painted doorway/path thresholds.
// Coordinates use the unchanged 1254 × 1254 map space. No extra exit is created.
(() => {
  const definitions={
    church:[
      {id:'stairs_down',rect:[1002,260,96,28],inward:[0,-1],approach:{x:1043,y:365}},
      {id:'church_out',rect:[574,1035,108,30],inward:[0,1],approach:{x:628,y:950}},
      {id:'church_garden',rect:[132,590,26,68],inward:[-1,0],approach:{x:240,y:625}}
    ],
    basement:[
      {id:'stairs_up',rect:[1047,198,140,28],inward:[0,-1],approach:{x:1101,y:315}}
    ],
    entrance:[
      {id:'church_in',rect:[554,140,144,24],inward:[0,-1],approach:{x:625,y:250}},
      {id:'square_out',rect:[550,1192,176,32],inward:[0,1],approach:{x:628,y:1100}}
    ],
    square:[
      {id:'entrance_out',rect:[546,48,162,32],inward:[0,-1],approach:{x:625,y:145}},
      {id:'house_out',rect:[1164,570,23,80],inward:[1,0],approach:{x:1100,y:610}},
      {id:'square_garden',rect:[70,568,32,86],inward:[-1,0],approach:{x:190,y:610}}
    ],
    house:[
      {id:'house_exit',rect:[550,1032,150,38],inward:[0,1],approach:{x:625,y:975}}
    ],
    garden:[
      {id:'garden_exit',rect:[560,1104,136,38],inward:[0,1],approach:{x:625,y:1020}},
      {id:'garden_church',rect:[1148,588,32,84],inward:[1,0],approach:{x:1060,y:625}}
    ]
  };
  const entries=mapId=>definitions[mapId]||[];
  const foot=p=>[p.x-12,p.y-11,24,14];
  const intersects=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
  const expanded=(r,pad)=>[r[0]-pad,r[1]-pad,r[2]+pad*2,r[3]+pad*2];
  function onThreshold(p,def){
    // Keep the player's foot centre inside the actual door width. Expanding this
    // sideways would let an adjacent wall count as a doorway.
    const r=def.rect,horizontal=def.inward[0]!==0;
    const inLane=horizontal?p.y>=r[1]&&p.y<=r[1]+r[3]:p.x>=r[0]&&p.x<=r[0]+r[2];
    return inLane&&intersects(foot(p),r);
  }
  function touches(previous,current,def){
    // Swept foot samples also catch a threshold crossed during a larger update.
    const count=Math.max(1,Math.ceil(Math.hypot(current.x-previous.x,current.y-previous.y)/4));
    for(let i=0;i<=count;i++)if(onThreshold({x:previous.x+(current.x-previous.x)*i/count,y:previous.y+(current.y-previous.y)*i/count},def))return true;
    return false;
  }
  function create(){
    let arrival=null,blocked=new Map();
    const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
    function release(mapId,position,now){
      for(const [key,value] of blocked){
        if(value.map!==mapId||(!intersects(foot(position),expanded(value.rect,32))&&now>=value.until))blocked.delete(key);
      }
      if(arrival&&arrival.map!==mapId)arrival=null;
    }
    return {
      // Call after a successful transition, before the next movement update.
      arrive(mapId,position,now=clock()){
        blocked.clear();arrival={map:mapId,until:now+350};
        for(const def of entries(mapId))if(intersects(foot(position),expanded(def.rect,48)))blocked.set(mapId+':'+def.id,{map:mapId,rect:def.rect,until:now+350});
      },
      // Attempted direction is separate from actual displacement, so contact at
      // a solid stair/door edge can still open that doorway without opening walls.
      probe(mapId,previous,current,motion,now=clock()){
        release(mapId,current,now);
        if(arrival&&arrival.map===mapId&&now<arrival.until)return null;
        if(!motion||Math.abs(motion.x)+Math.abs(motion.y)<.0001)return null;
        for(const def of entries(mapId)){
          if(blocked.has(mapId+':'+def.id))continue;
          if(motion.x*def.inward[0]+motion.y*def.inward[1]<=.0001)continue;
          if(touches(previous,current,def))return def.id;
        }
        return null;
      },
      // A story-locked door produces one hint per approach, not one per frame.
      deny(mapId,id,now=clock()){
        const def=entries(mapId).find(p=>p.id===id);if(def)blocked.set(mapId+':'+id,{map:mapId,rect:def.rect,until:now});
      },
      reset(){arrival=null;blocked.clear();},
      snapshot(){return {arrival:arrival?{...arrival}:null,blocked:[...blocked.keys()]};}
    };
  }
  const api={definitions,entries,create};
  if(typeof window!=='undefined')window.SAINT_PORTALS=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
