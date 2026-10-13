'use strict';
const SUITS=['♠','♥','♦','♣'],RANKS=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const $=id=>document.getElementById(id),board=$('board');
const isRed=c=>c.s===1||c.s===2;
let S,hist=[],stats=JSON.parse(localStorage.getItem('zs-stats')||'null')||{played:0,won:0,best:0,streak:0,bestStreak:0};
let settings=JSON.parse(localStorage.getItem('zs-settings')||'null')||{draw:1};
const PILES=['stock','waste','f0','f1','f2','f3','t0','t1','t2','t3','t4','t5','t6'];
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function deal(seed){
  if(seed==null)seed=Math.floor(Math.random()*1e9);
  const r=rng(seed),d=[];for(let s=0;s<4;s++)for(let k=1;k<=13;k++)d.push({id:s*13+k-1,s,r:k,up:false});
  for(let i=d.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[d[i],d[j]]=[d[j],d[i]]}
  const p={};PILES.forEach(k=>p[k]=[]);
  for(let i=0;i<7;i++)for(let j=i;j<7;j++){const c=d.pop();c.up=i===j;p['t'+j].push(c)}
  p.stock=d;return{p,seed,moves:0,time:0,started:false,won:false,draw:settings.draw,counted:false};
}
function save(){localStorage.setItem('zs-game',JSON.stringify(S));localStorage.setItem('zs-hist',JSON.stringify(hist.slice(-300)))}
function saveStats(){localStorage.setItem('zs-stats',JSON.stringify(stats))}
function snap(){hist.push(JSON.stringify(S))}
function begin(){if(!S.started){S.started=true;if(!S.counted){S.counted=true;stats.played++;saveStats()}}}
function newGame(seed){if(S&&S.started&&!S.won){stats.streak=0;saveStats()}S=deal(seed);hist=[];hideWin();render();save()}
function topOf(k){const a=S.p[k];return a[a.length-1]}
function canF(c,fi){const t=topOf('f'+fi);return t?t.s===c.s&&t.r+1===c.r:c.r===1}
function canT(c,ti){const t=topOf('t'+ti);return t?t.up&&isRed(t)!==isRed(c)&&t.r===c.r+1:c.r===13}
function legal(from,idx,to){
  const a=S.p[from],c=a[idx];if(!c||!c.up||from===to)return false;
  if(from==='stock')return false;
  if((from==='waste'||from[0]==='f')&&idx!==a.length-1)return false;
  if(to[0]==='f')return idx===a.length-1&&canF(c,+to[1]);
  if(to[0]==='t')return canT(c,+to[1]);return false;
}
function doMove(from,idx,to,rec=true){
  if(rec)snap();begin();
  const cards=S.p[from].splice(idx);S.p[to].push(...cards);
  const t=topOf(from);if(from[0]==='t'&&t&&!t.up)t.up=true;
  S.moves++;after();
}
function draw(){
  if(!S.p.stock.length&&!S.p.waste.length)return;
  snap();begin();
  if(!S.p.stock.length){S.p.stock=S.p.waste.reverse().map(c=>(c.up=false,c));S.p.waste=[]}
  else{const n=Math.min(S.draw,S.p.stock.length);for(let i=0;i<n;i++){const c=S.p.stock.pop();c.up=true;S.p.waste.push(c)}}
  S.moves++;after();
}
function after(){clearHint();render();save();checkWin();maybeAuto()}
function undo(){if(!hist.length||autoRunning)return toast('Nothing to undo');S=JSON.parse(hist.pop());hideWin();render();save()}
// best target for a tap
function bestTarget(from,idx,foundOnly){
  const a=S.p[from];
  if(idx===a.length-1&&from[0]!=='f')for(let f=0;f<4;f++)if(legal(from,idx,'f'+f))return 'f'+f;
  if(foundOnly)return null;
  let empty=null;
  for(let t=0;t<7;t++){const k='t'+t;if(!legal(from,idx,k))continue;if(S.p[k].length)return k;if(empty==null)empty=k}
  if(empty&&!(from[0]==='t'&&idx===0))return empty;
  return null;
}
let lastTap={id:-1,t:0};
function tap(from,idx){
  if(autoRunning)return;
  if(from==='stock')return draw();
  const c=S.p[from][idx];if(!c||!c.up)return;
  const now=Date.now(),dbl=lastTap.id===c.id&&now-lastTap.t<350;lastTap={id:c.id,t:now};
  if(from==='waste'&&idx!==S.p.waste.length-1)return;
  if(from[0]==='f'&&idx!==S.p[from].length-1)return;
  const to=bestTarget(from,idx,dbl&&idx===S.p[from].length-1);
  if(to)doMove(from,idx,to);else shake(c.id);
}
// hints
function allMoves(){
  const m=[];
  const srcs=['waste',...[0,1,2,3,4,5,6].map(i=>'t'+i)];
  for(const k of srcs){const a=S.p[k];if(!a.length)continue;
    for(let f=0;f<4;f++)if(legal(k,a.length-1,'f'+f)){m.push({from:k,idx:a.length-1,to:'f'+f,score:a.length>1&&k[0]==='t'&&!a[a.length-2].up?100:90});break}}
  for(let t=0;t<7;t++){const k='t'+t,a=S.p[k];const i=a.findIndex(c=>c.up);if(i<0)continue;
    for(let u=0;u<7;u++){if(u===t||!legal(k,i,'t'+u))continue;
      if(!S.p['t'+u].length&&i===0)continue;
      m.push({from:k,idx:i,to:'t'+u,score:i>0?80:40});break}}
  if(S.p.waste.length){const i=S.p.waste.length-1;for(let u=0;u<7;u++)if(legal('waste',i,'t'+u)){m.push({from:'waste',idx:i,to:'t'+u,score:60});break}}
  return m.sort((a,b)=>b.score-a.score);
}
function stockUseful(){
  const cards=[...S.p.stock,...S.p.waste];
  return cards.some(c=>{for(let f=0;f<4;f++)if(canF(c,f))return true;for(let t=0;t<7;t++)if(canT(c,t))return true;return false});
}
function hint(){
  clearHint();if(S.won)return;
  const m=allMoves()[0];
  if(m){const c=S.p[m.from][m.idx];el[c.id].classList.add('hint');
    const t=topOf(m.to);if(t)el[t.id].classList.add('hint');else slots[m.to].classList.add('hint');
    toast(m.to[0]==='f'?'Move to foundation':'Try this move');return}
  if((S.p.stock.length||S.p.waste.length)&&stockUseful()){slots.stock.classList.add('hint');const t=topOf('stock');if(t)el[t.id].classList.add('hint');toast(S.p.stock.length?'Draw from the stock':'Flip the waste back over');return}
  toast('No moves remain — try New or Undo');
}
function clearHint(){document.querySelectorAll('.hint').forEach(e=>e.classList.remove('hint'))}
// win / auto
function isWon(){return [0,1,2,3].every(f=>S.p['f'+f].length===13)}
function checkWin(){if(S.won||!isWon())return;S.won=true;stats.won++;stats.streak++;stats.bestStreak=Math.max(stats.bestStreak,stats.streak);
  const newBest=!stats.best||S.time<stats.best;if(newBest)stats.best=S.time;saveStats();save();
  setTimeout(()=>showWin(newBest),400)}
function canAuto(){return !S.won&&!isWon()&&!S.p.stock.length&&!S.p.waste.length&&[0,1,2,3,4,5,6].every(t=>S.p['t'+t].every(c=>c.up))}
let autoRunning=false;
function maybeAuto(){$('bAuto').hidden=!canAuto();if(canAuto()&&!autoRunning)setTimeout(autoComplete,250)}
function autoComplete(){
  if(autoRunning||!canAuto())return;autoRunning=true;snap();
  const step=()=>{
    let best=null;
    for(let t=0;t<7;t++){const a=S.p['t'+t],c=a[a.length-1];if(!c)continue;
      for(let f=0;f<4;f++)if(canF(c,f)&&(!best||c.r<best.c.r))best={c,k:'t'+t,f:'f'+f}}
    if(!best){autoRunning=false;$('bAuto').hidden=true;render();save();checkWin();return}
    S.p[best.f].push(S.p[best.k].pop());S.moves++;render();setTimeout(step,70);
  };step();
}
function showWin(nb){$('winTxt').textContent=`${S.moves} moves in ${fmt(S.time)}${nb?' — new best time':''}. Win streak: ${stats.streak}.`;$('win').hidden=false;confetti()}
function hideWin(){$('win').hidden=true}
function confetti(){const cols=['#f6c343','#e86aa0','#5ec2ff','#fff','#7be07b'];
  for(let i=0;i<70;i++){const d=document.createElement('div');d.className='confetti';d.style.left=Math.random()*100+'vw';d.style.background=cols[i%5];
    d.style.animationDuration=1.8+Math.random()*1.8+'s';d.style.animationDelay=Math.random()*.6+'s';document.body.appendChild(d);setTimeout(()=>d.remove(),4500)}}
// rendering
const el=[],slots={};let L={};
function build(){
  PILES.forEach(k=>{const d=document.createElement('div');d.className='slot'+(k[0]==='f'?' f':'')+(k==='stock'?' stock':'');if(k[0]==='f')d.dataset.s='A';
    d.dataset.pile=k;board.appendChild(d);slots[k]=d;d.addEventListener('click',()=>{if(k==='stock')draw()})});
  for(let i=0;i<52;i++){const d=document.createElement('div');d.className='card';d.dataset.id=i;board.appendChild(d);el[i]=d}
}
function layout(){
  const W=board.clientWidth,H=board.clientHeight,g=Math.max(3,W*.012);
  const cw=Math.min((W-6*g)/7,(H*0.9)/1.4/3.2+40),ch=cw*1.4;
  const off=(W-7*cw-6*g)/2,x=i=>off+i*(cw+g);
  L={W,H,g,cw,ch,x,tabY:ch+g*3};
  const f=Math.round(cw*.36);board.style.setProperty('--f',f+'px');
  const pos={stock:[x(0),0],waste:[x(1),0],f0:[x(3),0],f1:[x(4),0],f2:[x(5),0],f3:[x(6),0]};
  for(let t=0;t<7;t++)pos['t'+t]=[x(t),L.tabY];
  for(const k of PILES){const s=slots[k];s.style.cssText=`left:${pos[k][0]}px;top:${pos[k][1]}px;width:${cw}px;height:${ch}px`}
  L.pos=pos;
}
function cardHTML(c){const sym=SUITS[c.s];const cls=isRed(c)?'red':'blk',cw=L.cw;
  return `<div class="${cls}"><span class="r" style="font-size:${cw*.4}px">${RANKS[c.r]}</span><span class="s1" style="font-size:${cw*.3}px">${sym}</span><span class="s2" style="font-size:${cw*.62}px">${sym}</span></div>`}
function render(){
  layout();const {cw,ch,pos}=L;let z=1;
  const place=(c,x,y)=>{const d=el[c.id];const key=(c.up?'u':'b')+cw.toFixed(1);
    if(d.dataset.k!==key){d.dataset.k=key;d.className='card '+(c.up?'up':'back');d.innerHTML=c.up?cardHTML(c):'';d.setAttribute('aria-label',c.up?RANKS[c.r]+SUITS[c.s]:'face-down card')}
    d.style.width=cw+'px';d.style.height=ch+'px';d.style.transform=`translate(${x}px,${y}px)`;d.style.zIndex=z++;c._x=x;c._y=y};
  S.p.stock.forEach((c,i)=>place(c,pos.stock[0],0));
  const w=S.p.waste,fanN=S.draw===3?3:1,fan=cw*.42;
  w.forEach((c,i)=>{const j=Math.max(0,i-(w.length-fanN));place(c,pos.waste[0]+j*fan,0)});
  for(let f=0;f<4;f++){S.p['f'+f].forEach(c=>place(c,pos['f'+f][0],0));const t=topOf('f'+f);slots['f'+f].dataset.s=t?'':'A'}
  for(let t=0;t<7;t++){const a=S.p['t'+t];const nd=a.filter(c=>!c.up).length,nu=a.length-nd;
    let fd=ch*.2,fu=ch*.3;const avail=L.H-L.tabY-ch-4;const need=nd*fd+Math.max(0,nu-1)*fu;
    if(need>avail&&need>0){const k=avail/need;fd*=k;fu*=k}
    let y=L.tabY;a.forEach(c=>{place(c,pos['t'+t][0],y);y+=c.up?fu:fd})}
  $('moves').textContent=S.moves+(S.moves===1?' move':' moves');$('time').textContent=fmt(S.time);
  $('bAuto').hidden=!canAuto()||S.won;
}
const fmt=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
// find card location
function locate(id){for(const k of PILES){const i=S.p[k].findIndex(c=>c.id===id);if(i>=0)return[k,i]}}
// pointer / drag
let drag=null;
board.addEventListener('pointerdown',e=>{
  if(autoRunning||S.won)return;const d=e.target.closest('.card');if(!d)return;
  e.preventDefault();const[k,i]=locate(+d.dataset.id);
  drag={k,i,x0:e.clientX,y0:e.clientY,moved:false,pid:e.pointerId};
});
window.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pid)return;e.preventDefault();
  const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
  if(!drag.moved){if(Math.hypot(dx,dy)<7)return;
    const a=S.p[drag.k],c=a[drag.i];
    if(drag.k==='stock'||!c.up||((drag.k==='waste'||drag.k[0]==='f')&&drag.i!==a.length-1)){drag=null;return}
    drag.moved=true;drag.cards=a.slice(drag.i);drag.cards.forEach(c=>el[c.id].classList.add('drag'));clearHint()}
  drag.cards.forEach((c,j)=>{el[c.id].style.transform=`translate(${c._x+dx}px,${c._y+dy}px)`;el[c.id].style.zIndex=1000+j});
},{passive:false});
function endDrag(e){
  if(!drag||e.pointerId!==drag.pid)return;const d=drag;drag=null;
  if(!d.moved){tap(d.k,d.i);return}
  d.cards.forEach(c=>el[c.id].classList.remove('drag'));
  const c=d.cards[0],dx=e.clientX-d.x0,dy=e.clientY-d.y0,cx=c._x+dx+L.cw/2,cy=c._y+dy+L.ch/2;
  let best=null,bd=1e9;
  for(const k of PILES){if(k==='stock'||k==='waste')continue;const p=L.pos[k];
    const t=topOf(k),ty=k[0]==='t'&&t?t._y:p[1];const dist=Math.hypot(cx-(p[0]+L.cw/2),cy-(ty+L.ch/2));
    if(dist<bd&&Math.abs(cx-(p[0]+L.cw/2))<L.cw*.9&&legal(d.k,d.i,k)){bd=dist;best=k}}
  if(best&&bd<L.ch*1.6)doMove(d.k,d.i,best);else{render();if(dx*dx+dy*dy>400)toast("Can't go there")}
}
window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',e=>{if(drag&&drag.pid===e.pointerId){drag=null;render()}});
document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());
function shake(id){const d=el[id];d.animate([{marginLeft:'0'},{marginLeft:'-5px'},{marginLeft:'5px'},{marginLeft:'0'}],{duration:220})}
let tt;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
// UI
function showStats(){$('stats').innerHTML=`<span>Games played</span><b>${stats.played}</b><span>Games won</span><b>${stats.won}${stats.played?` (${Math.round(stats.won/stats.played*100)}%)`:''}</b><span>Best time</span><b>${stats.best?fmt(stats.best):'—'}</b><span>Current win streak</span><b>${stats.streak}</b><span>Best win streak</span><b>${stats.bestStreak}</b>`}
$('bNew').onclick=()=>newGame();
$('bUndo').onclick=undo;$('bHint').onclick=hint;$('bAuto').onclick=autoComplete;
$('bMenu').onclick=()=>{$('drawSel').value=settings.draw;showStats();$('menu').hidden=false};
$('bClose').onclick=()=>$('menu').hidden=true;
$('menu').onclick=e=>{if(e.target.id==='menu')$('menu').hidden=true};
$('drawSel').onchange=e=>{settings.draw=+e.target.value;localStorage.setItem('zs-settings',JSON.stringify(settings));$('menu').hidden=true;
  if(S.moves===0){S.draw=settings.draw;render();save();toast('Draw '+settings.draw+' on')}else{newGame();toast('New game: draw '+settings.draw)}};
$('bRestart').onclick=()=>{const sd=S.seed;$('menu').hidden=true;if(S.started&&!S.won){stats.streak=0;saveStats()}S=deal(sd);S.counted=true;hist=[];render();save();toast('Deal restarted')};
$('bReset').onclick=()=>{if(confirm('Reset all stats?')){stats={played:0,won:0,best:0,streak:0,bestStreak:0};saveStats();showStats()}};
$('bWinNew').onclick=()=>newGame();
setInterval(()=>{if(S.started&&!S.won&&!document.hidden){S.time++;$('time').textContent=fmt(S.time);if(S.time%5===0)save()}},1000);
window.addEventListener('resize',()=>render());
// boot
build();
try{S=JSON.parse(localStorage.getItem('zs-game'));hist=JSON.parse(localStorage.getItem('zs-hist')||'[]')}catch(e){S=null}
const qs=new URLSearchParams(location.search);
if(qs.has('seed'))newGame(+qs.get('seed'));else if(!S||!S.p)newGame();else{render();if(S.won)hideWin();maybeAuto()}
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
// test hook
window.KT={get S(){return S},legal,doMove:(a,b,c)=>{if(!legal(a,b,c))return false;doMove(a,b,c);return true},draw,undo,hint,tap,newGame,
  nearWin(){S=deal(1);hist=[];const by=[[],[],[],[]];for(let s=0;s<4;s++)for(let r=1;r<=13;r++)by[s].push({id:s*13+r-1,s,r,up:true});
    PILES.forEach(k=>S.p[k]=[]);for(let s=0;s<4;s++)S.p['f'+s]=by[s].slice(0,10);
    S.p.t0=[by[0][12],by[1][11],by[0][10]];S.p.t1=[by[1][12],by[0][11],by[1][10]];S.p.t2=[by[2][12],by[3][11],by[2][10]];S.p.t3=[by[3][12],by[2][11]];S.p.t4=[by[3][10]];
    S.started=true;S.counted=true;render();save();maybeAuto()}};
