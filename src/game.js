const ROLES = ['Duke','Assassin','Captain','Ambassador','Contessa'];
const CLAIM = {tax:'Duke',assassinate:'Assassin',steal:'Captain',exchange:'Ambassador'};
const TARGET = ['coup','assassinate','steal'];
const rand = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]} return a; };
const alive = p => p.cards.length > 0;
const fail = msg => { throw new Error(msg); };
const player = (g,id) => g.players.find(p=>p.id===id) || fail('Player not found.');
const log = (g,s) => { g.log.unshift(s); g.log = g.log.slice(0,40); };
const opponents = (g,id) => g.players.filter(p=>alive(p)&&p.id!==id).map(p=>p.id);

export function create() { return {phase:'lobby',players:[],log:[]}; }
export function join(g,id,name) {
 if(g.phase!=='lobby') fail('This game has already started.');
 if(g.players.length>=6) fail('This room is full.');
 name=String(name||'').trim().slice(0,20); if(!name) fail('Enter your name.');
 if(g.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) fail('That name is already taken.');
 // Preserve seats in rooms created before avatars were introduced.
 const used=new Set(g.players.filter(p=>Number.isInteger(p.avatar)).map(p=>p.avatar));
 for(const p of g.players){if(!Number.isInteger(p.avatar)){p.avatar=[0,1,2,3,4,5].find(i=>!used.has(i));used.add(p.avatar);}}
 const avatar=[0,1,2,3,4,5].find(i=>!used.has(i));
 g.players.push({id,name,avatar,coins:0,cards:[],revealed:[]}); log(g,`${name} joined the table.`);
}
function start(g,id) {
 if(g.players.find(p=>!p.left)?.id!==id) fail('Only the host can start.');
 if(!['lobby','finished'].includes(g.phase)||g.players.filter(p=>!p.left).length<2) fail('You need 2–6 players.');
 g.players=g.players.filter(p=>!p.left);
 g.deck=shuffle(ROLES.flatMap(r=>[r,r,r]));
 for(const p of g.players){p.coins=2;p.cards=[g.deck.pop(),g.deck.pop()];p.revealed=[];}
 if(g.players.length===2)g.players[0].coins=1;
 g.turn=0;g.phase='turn';g.pending=null;g.log=[];log(g,`${g.players[0].name} starts the game.`);
}
export function leave(g,id) {
 const p=player(g,id);if(p.left) fail('Player has already left.');
 if(g.phase==='lobby'||g.phase==='finished') {
  g.players=g.players.filter(x=>x.id!==id);log(g,`${p.name} left the table.`);return;
 }
 const q=g.pending, wasAlive=alive(p);
 if(g.phase==='exchange'&&q.actor===id) g.deck.push(...q.options.slice(p.cards.length));
 p.revealed.push(...p.cards);p.cards=[];p.left=true;log(g,`${p.name} left the game${wasAlive?' and forfeited':''}.`);
 if(!g.players.some(x=>!x.left)) return;
 if(!wasAlive) return;
 if(g.players.filter(alive).length===1) return next(g);
 if(g.phase==='turn'){if(g.players[g.turn].id===id)next(g);return;}
 if(q.actor===id||q.target===id) return next(g);
 if(q.blocker===id) return resolve(g);
 if(g.phase==='lose'&&q.loser===id) return afterLoss(g);
 if(['action-response','block-response','challenge-block'].includes(g.phase)){
  q.waiting=q.waiting.filter(x=>x!==id);q.passed=q.passed.filter(x=>x!==id);
  if(q.waiting.every(x=>q.passed.includes(x)))advance(g);
 }
}
function next(g) {
 const remaining=g.players.filter(alive);
 if(remaining.length===1){g.phase='finished';g.winner=remaining[0].id;g.pending=null;log(g,`${remaining[0].name} wins!`);return;}
 do {g.turn=(g.turn+1)%g.players.length} while(!alive(g.players[g.turn]));
 g.phase='turn';g.pending=null;log(g,`${g.players[g.turn].name}'s turn.`);
}
function wait(g,phase,ids){g.phase=phase;g.pending.waiting=ids;g.pending.passed=[]; if(!ids.length) advance(g);}
function advance(g) {
 const q=g.pending;
 if(g.phase==='action-response') {
   if(q.action==='aid') return wait(g,'block-response',opponents(g,q.actor));
   if(['steal','assassinate'].includes(q.action)&&alive(player(g,q.target))) return wait(g,'block-response',[q.target]);
   return resolve(g);
 }
 if(g.phase==='block-response') return resolve(g);
 if(g.phase==='challenge-block') {log(g,`${player(g,q.blocker).name}'s block stands.`);return next(g);}
}
function lose(g,id,continuation){g.phase='lose';g.pending.loser=id;g.pending.continuation=continuation;}
function afterLoss(g) {
 const q=g.pending, c=q.continuation;
 if(g.players.filter(alive).length===1) return next(g);
 if(c==='cancel') return next(g);
 if(c==='action') {g.phase='action-response';return advance(g);}
 if(c==='blocked') {log(g,`${player(g,q.blocker).name}'s block stands.`);return next(g);}
 if(c==='resolve') return resolve(g);
 if(c==='done') return next(g);
}
function resolve(g) {
 const q=g.pending, a=player(g,q.actor), t=q.target&&player(g,q.target);
 if(!alive(a)) return next(g);
 if(q.action==='aid'){a.coins+=2;log(g,`${a.name} takes 2 coins.`);return next(g);}
 if(q.action==='tax'){a.coins+=3;log(g,`${a.name} takes 3 coins.`);return next(g);}
 if(q.action==='steal'){if(t&&alive(t)){const n=Math.min(2,t.coins);t.coins-=n;a.coins+=n;log(g,`${a.name} steals ${n} coins from ${t.name}.`);}return next(g);}
 if(q.action==='assassinate'||q.action==='coup'){if(t&&alive(t)){log(g,`${t.name} must lose influence.`);return lose(g,t.id,'done');}return next(g);}
 if(q.action==='exchange'){q.options=[...a.cards,g.deck.pop(),g.deck.pop()];q.keep=a.cards.length;g.phase='exchange';return;}
}
export function command(g,id,msg) {
 const p=player(g,id), type=msg?.type;
 if(type==='start') return start(g,id);
 if(g.phase==='turn'&&type==='action') {
  if(g.players[g.turn].id!==id) fail('It is not your turn.');
  const action=msg.action;if(!['income','aid','coup','tax','assassinate','steal','exchange'].includes(action)) fail('Unknown action.');
  if(p.coins>=10&&action!=='coup') fail('At 10 coins you must launch a coup.');
  let target;if(TARGET.includes(action)){target=player(g,msg.target);if(target.id===id||!alive(target)) fail('Choose a living opponent.');}
  if(action==='coup'&&p.coins<7) fail('A coup costs 7 coins.');
  if(action==='assassinate'&&p.coins<3) fail('Assassination costs 3 coins.');
  if(action==='income'){p.coins++;log(g,`${p.name} takes 1 coin.`);return next(g);}
  if(action==='coup')p.coins-=7;if(action==='assassinate')p.coins-=3;
  g.pending={action,actor:id,target:target?.id}; log(g,`${p.name} declares ${action}${target?' against '+target.name:''}.`);
  if(action==='coup')return resolve(g);
  if(action==='aid')return wait(g,'block-response',opponents(g,id));
  return wait(g,'action-response',opponents(g,id));
 }
 const q=g.pending;
 if(!q) fail('That action is not available.');
 if(['action-response','block-response','challenge-block'].includes(g.phase)) {
  if(!q.waiting.includes(id)||q.passed.includes(id)) fail('You cannot respond now.');
  if(type==='pass'){q.passed.push(id);if(q.waiting.every(x=>q.passed.includes(x)))advance(g);return;}
  if(type==='block'&&g.phase==='block-response'){
   const allowed=q.action==='aid'?['Duke']:q.action==='assassinate'?['Contessa']:['Captain','Ambassador'];
   if(!allowed.includes(msg.role)) fail('That role cannot block this action.');
   q.blocker=id;q.blockRole=msg.role;log(g,`${p.name} claims ${msg.role} and blocks.`);return wait(g,'challenge-block',opponents(g,id));
  }
  if(type==='challenge'&&['action-response','challenge-block'].includes(g.phase)){
   const isBlock=g.phase==='challenge-block', claimant=player(g,isBlock?q.blocker:q.actor), role=isBlock?q.blockRole:CLAIM[q.action];
   if(!role) fail('This cannot be challenged.');
   log(g,`${p.name} challenges ${claimant.name}'s ${role} claim.`);
   if(claimant.cards.includes(role)){
    claimant.cards.splice(claimant.cards.indexOf(role),1);g.deck.push(role);shuffle(g.deck);claimant.cards.push(g.deck.pop());
    log(g,`${claimant.name} reveals ${role}, then draws a replacement. ${p.name} loses the challenge.`);
    return lose(g,id,isBlock?'blocked':'action');
   }
   log(g,`${claimant.name} cannot prove ${role} and loses the challenge.`);
   return lose(g,claimant.id,isBlock?'resolve':'cancel');
  }
 }
 if(g.phase==='lose'&&type==='lose'&&q.loser===id){
  if(!Number.isInteger(msg.index)||msg.index<0||msg.index>=p.cards.length) fail('Choose an influence to reveal.');
  const [card]=p.cards.splice(msg.index,1);p.revealed.push(card);log(g,`${p.name} reveals ${card}${alive(p)?'.':' and is eliminated.'}`);return afterLoss(g);
 }
 if(g.phase==='exchange'&&type==='exchange'&&q.actor===id){
  const indexes=msg.indexes;if(!Array.isArray(indexes)||indexes.length!==q.keep||new Set(indexes).size!==q.keep||indexes.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length)) fail('Choose the correct number of cards.');
  p.cards=indexes.map(i=>q.options[i]);g.deck.push(...q.options.filter((_,i)=>!indexes.includes(i)));shuffle(g.deck);log(g,`${p.name} exchanges cards.`);return next(g);
 }
 fail('That action is not available.');
}
export function view(g,id) {
 const me=player(g,id),q=g.pending;
 return {phase:g.phase,me:id,host:g.players.find(p=>!p.left)?.id,turn:g.players[g.turn]?.id,winner:g.winner,players:g.players.map((p,i)=>({id:p.id,name:p.name,avatar:p.avatar??i,coins:p.coins,count:p.cards.length,revealed:p.revealed,left:!!p.left,cards:p.id===id?p.cards:undefined})),log:g.log,pending:q?{action:q.action,actor:q.actor,target:q.target,blocker:q.blocker,blockRole:q.blockRole,waiting:q.waiting,passed:q.passed,loser:q.loser,options:g.phase==='exchange'&&q.actor===id?q.options:undefined,keep:g.phase==='exchange'&&q.actor===id?q.keep:undefined}:null};
}
