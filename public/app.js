const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const room=new URL(location.href).searchParams.get('room');
let session=room?localStorage.getItem('coup:'+room):null, game=null, error='', busy=false, selected=[];
let soundEnabled=localStorage.getItem('coup:sound')!=='off', audioContext;
const soundBuffers={};
function loadSound(kind){
 if(!soundBuffers[kind])soundBuffers[kind]=fetch(`/sounds/${kind}.mp3`).then(r=>{if(!r.ok)throw Error('Sound unavailable');return r.arrayBuffer()}).then(data=>audioContext.decodeAudioData(data)).catch(()=>{delete soundBuffers[kind];return null});
 return soundBuffers[kind];
}
function unlockSound(){
 if(!soundEnabled)return;
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audioContext ||= new Audio();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});loadSound('coin');loadSound('loss');loadSound('click');}catch{}
}
document.addEventListener('pointerdown',unlockSound,{passive:true});
document.addEventListener('keydown',unlockSound);
function playSound(kind){
 if(!soundEnabled||!audioContext)return;
 try{
  const ready=audioContext.state==='suspended'?audioContext.resume():Promise.resolve();
  Promise.all([ready,loadSound(kind)]).then(([,buffer])=>{if(!buffer||!soundEnabled||audioContext.state!=='running')return;const source=audioContext.createBufferSource();const gain=audioContext.createGain();source.buffer=buffer;gain.gain.value=.55;source.connect(gain);gain.connect(audioContext.destination);source.start();}).catch(()=>{});
 }catch{}
}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.id==='sound-toggle'&&!soundEnabled)return;playSound('click')},true);
function soundForUpdate(previous,next){
 if(!previous||!next||previous.phase==='lobby'||next.phase==='lobby')return;
 const before=previous.log||[],after=next.log||[];
 let overlap=Math.min(before.length,after.length);
 while(overlap>0&&!after.slice(-overlap).every((entry,i)=>entry===before[i]))overlap--;
 const fresh=after.slice(0,after.length-overlap);
 if(fresh.some(line=>/ reveals (Duke|Assassin|Captain|Ambassador|Contessa)(?:\.| and is eliminated\.)$/.test(line)))playSound('loss');
 else if(fresh.some(line=>/ (?:takes [123] coins?\.|steals [12] coins from .+\.)$/.test(line)))playSound('coin');
}
const avatars=['gorilla','rhino','gamer','ape','koala','penguin'];
const names={income:'Income',aid:'Foreign aid',coup:'Coup',tax:'Tax',assassinate:'Assassinate',steal:'Steal',exchange:'Exchange'};
const glyphs={Duke:'♛',Assassin:'⚔',Captain:'⚓',Ambassador:'✦',Contessa:'❖',influence:'◆',income:'◉',aid:'✚',coup:'♜',tax:'♛',assassinate:'⚔',steal:'⚓',exchange:'⇄'};
const icon=(key,cls='')=>`<span class="icon ${cls}" aria-hidden="true">${glyphs[key]||'◆'}</span>`;
const descriptions={income:'+1 coin',aid:'+2 coins',coup:'Pay 7 · unblockable',tax:'+3 coins · Duke',assassinate:'Pay 3 · Assassin',steal:'Up to 2 · Captain',exchange:'Swap cards · Ambassador'};
const card=(role,cls='')=>`<div class="card ${cls}">${icon(role,'card-icon')}<span>${esc(role)}</span></div>`;
const roles=`<div class="role-list"><p>${icon('Duke')} <b>Duke</b> · Take 3 coins; block foreign aid.</p><p>${icon('Assassin')} <b>Assassin</b> · Pay 3 coins to attack.</p><p>${icon('Captain')} <b>Captain</b> · Steal up to 2 coins; block stealing.</p><p>${icon('Ambassador')} <b>Ambassador</b> · Exchange cards; block stealing.</p><p>${icon('Contessa')} <b>Contessa</b> · Block assassination.</p></div><p>Anyone can challenge a claimed role. A failed challenge costs one influence. At 10 coins, you must coup.</p>`;
async function api(body,quiet=false){try{const r=await fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);if(d.id){localStorage.setItem('coup:'+d.room,d.id);location.href='/?room='+d.room;return}const changed=JSON.stringify(game)!==JSON.stringify(d.game);if(changed)soundForUpdate(game,d.game);game=d.game;error=d.notice||'';if(changed||!quiet)render();}catch(e){if(/Room not found|game expired|Player session not found/.test(e.message)){if(room)localStorage.removeItem('coup:'+room);session=null;game=null;error=e.message;render();}else if(!quiet){error=e.message;render()}}}
function send(message){if(busy)return;if(['pass','challenge','block'].includes(message.type))message.window={phase:game.phase,deadline:game.pending?.deadline??null};busy=true;api({op:'command',room,id:session,message}).finally(()=>busy=false)}
function updateCountdown(){const clock=document.querySelector('#response-countdown');if(!clock)return;const seconds=Math.max(0,Math.ceil((Number(clock.dataset.deadline)-Date.now())/1000));clock.textContent=`${seconds}s`;clock.classList.toggle('urgent',seconds<=5);}
const targetDialog=document.querySelector('#target-dialog');
function chooseTarget(action){
 if(busy||!game||game.phase!=='turn'||game.turn!==game.me||targetDialog.open)return;
 const opponents=game.players.filter(p=>p.id!==game.me&&p.count>0&&!p.left);
 targetDialog.dataset.action=action;
 document.querySelector('#target-title').textContent=action==='assassinate'?'Who will you assassinate?':action==='steal'?'Who will you steal from?':'Who will you coup?';
 document.querySelector('#target-options').innerHTML=opponents.map(p=>`<button type="button" class="target-option" data-player="${esc(p.id)}"><img class="player-avatar" src="/avatars/${avatars[p.avatar]||avatars[0]}.png" alt=""><span><strong>${esc(p.name)}</strong><small>${p.coins} ${p.coins===1?'coin':'coins'} · ${p.count} influence</small></span></button>`).join('');
 targetDialog.showModal();
}
document.querySelector('#target-cancel').addEventListener('click',()=>targetDialog.close());
document.querySelector('#target-options').addEventListener('click',event=>{const button=event.target.closest('[data-player]');if(!button)return;const action=targetDialog.dataset.action;targetDialog.close();send({type:'action',action,target:button.dataset.player});});
const helpDialog=document.querySelector('#help-dialog');
document.querySelector('#help-open').addEventListener('click',()=>{if(!helpDialog.open)helpDialog.showModal()});
document.querySelector('#help-close').addEventListener('click',()=>helpDialog.close());
document.querySelector('#help-done').addEventListener('click',()=>helpDialog.close());
const leaveDialog=document.querySelector('#leave-dialog');
let requestedNewGame=false;
function confirmLeave(newGame=false){
 if(busy||leaveDialog.open)return;
 requestedNewGame=newGame;
 const active=game.phase!=='lobby'&&game.phase!=='finished'&&game.players.find(p=>p.id===game.me)?.count>0;
 document.querySelector('#dialog-title').textContent=newGame?'Start a new game?':'Leave the table?';
 document.querySelector('#dialog-description').textContent=(newGame?'You’ll leave this table and create a new one.':'You’ll leave this table and return to the start screen.')+(active?' Your remaining influence will be forfeited.':'');
 document.querySelector('#dialog-confirm').textContent=newGame?'Start new game':'Exit game';
 leaveDialog.showModal();
}
document.querySelector('#dialog-cancel').addEventListener('click',()=>leaveDialog.close());
document.querySelector('#dialog-confirm').addEventListener('click',()=>{leaveDialog.close();leaveGame(requestedNewGame)});
async function leaveGame(newGame=false){
 if(busy)return;busy=true;
 try{const name=game.players.find(p=>p.id===game.me)?.name||'Player';const r=await fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'leave',room,id:session})});const d=await r.json();if(!r.ok)throw Error(d.error);localStorage.removeItem('coup:'+room);if(newGame){const next=await fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'create',name})});const result=await next.json();if(!next.ok)throw Error(result.error);localStorage.setItem('coup:'+result.room,result.id);location.href='/?room='+result.room;}else location.href='/';}
 catch(e){error=e.message;render()}finally{busy=false}
}
function start(){api({op:room?'join':'create',room,name:document.querySelector('#name').value})}
function renderLanding(){app.innerHTML=`<main class="shell"><header class="top"><div class="brand"><img class="brand-logo" src="/favicon.svg" alt="">COUP<span class="accent">.</span></div><span>A GAME OF INFLUENCE & DECEPTION</span></header><div class="landing"><div><div class="eyebrow">Gather your friends · 2–6 players</div><h1>Trust no one.<br><span class="accent">Influence everyone.</span></h1><p>Bluff, scheme, and outlast your friends in a game where power belongs to the best liar.</p></div><div class="panel"><div class="eyebrow">${room?'You’ve been invited':'The table is waiting'}</div><h2>${room?'Join the game':'Start a game'}</h2><p class="muted">${room?'Choose a name and take your seat.':'Create a private table and share the invite link with your friends.'}</p><label for="name">Your name</label><input id="name" maxlength="20" placeholder="What should we call you?" autocomplete="nickname"><button class="primary wide" id="join">${room?'Join table':'Create table'}</button><div class="error" role="alert">${esc(error)}</div><p class="hint">No account needed. Play in your browser.</p>${room?'<p><a class="home-link" href="/">Start a new game</a></p>':''}</div></div><div class="footer">An independent digital adaptation of Coup. Original game by Rikki Tahta.</div></main>`;document.querySelector('#join').onclick=start;document.querySelector('#name').onkeydown=e=>{if(e.key==='Enter')start()};}
function render(){if(!game){renderLanding();return}const g=game,me=g.players.find(p=>p.id===g.me),q=g.pending,p=id=>g.players.find(x=>x.id===id),name=id=>esc(p(id)?.name||'Someone'),myturn=g.phase==='turn'&&g.turn===g.me;
 let status=g.phase==='lobby'?'Waiting for players':g.phase==='finished'?`${name(g.winner)} wins the game`:g.phase==='turn'?`${name(g.turn)}’s turn`:g.phase==='lose'?`${name(q.loser)} must reveal an influence`:g.phase==='exchange'?`${name(q.actor)} is exchanging cards`:g.phase==='challenge-block'?`${name(q.blocker)} claims ${esc(q.blockRole)} to block`:g.phase==='block-response'?`Waiting for a possible block`:`Waiting for challenges`;
 const lastAction=g.phase==='lobby'?null:g.log.find(entry=>!g.players.some(player=>entry===`${player.name}'s turn.`||entry===`${player.name} starts the game.`||entry===`${player.name} joined the table.`));
 const lastActionNotice=lastAction?`<div class="last-action" role="status"><span class="last-action-icon" aria-hidden="true">↺</span><div><div class="eyebrow">Latest action</div><p>${esc(lastAction)}</p></div></div>`:'';
 const result=g.challengeResult;
 const challengeNotice=result?`<div class="challenge-result" role="status"><div class="challenge-result-icon" aria-hidden="true">!</div><div><div class="eyebrow">Most recent challenge</div><strong>${name(result.loser)} lost the challenge</strong><p>${name(result.challenger)} challenged ${name(result.claimant)}’s ${esc(result.role)} claim. ${result.proved?`${name(result.claimant)} proved the claim.`:`${name(result.claimant)} could not prove the claim.`}</p></div></div>`:'';
 const awaiting=q?(g.phase==='lose'?[q.loser]:g.phase==='exchange'?[q.actor]:['action-response','block-response','challenge-block'].includes(g.phase)?(q.waiting||[]).filter(id=>!(q.passed||[]).includes(id)):[]):[];
 const waiting=awaiting.length?`<div class="waiting"><span class="pulse" aria-hidden="true"></span><span>Waiting for <strong>${awaiting.map(name).join(', ')}</strong></span></div>`:'';
 const timer=q&&['action-response','challenge-block'].includes(g.phase)&&q.deadline?`<div class="response-timer"><span>Time to challenge <small>· No response means pass</small></span><strong id="response-countdown" data-deadline="${Number(q.deadline)}">${Math.max(0,Math.ceil((q.deadline-Date.now())/1000))}s</strong></div>`:'';
 let panel='';
 if(g.phase==='lobby'){panel=`<p>Share this link with your friends. The host can start once 2 players have joined.</p><p class="invite">${esc(location.href)}</p><div class="actions"><button id="copy">Copy invite link</button>${g.host===g.me?`<button class="primary" data-type="start" ${g.players.length<2?'disabled':''}>Start game</button>`:''}</div>`;}
 else if(g.phase==='finished'){panel=`<p>That was a convincing performance. Play another round with the same table?</p>${g.host===g.me?`<button class="primary" data-type="start" ${g.players.filter(p=>!p.left).length<2?'disabled':''}>Play again</button>`:'<p class="muted">Waiting for the host to start another game.</p>'}`;}
 else if(myturn){panel=`<p>Choose an action. Character actions can be claimed whether or not you hold that card. For targeted actions, choose a player after selecting the action.</p><div class="action-grid section">${Object.entries(names).map(([key,label])=>`<button class="action-tile" data-action="${key}">${icon(key,'action-icon')}<span><strong>${label}</strong><small>${descriptions[key]}</small></span></button>`).join('')}</div><p class="hint section">Bluff any role, even if it isn’t in your hand. Assassination costs 3 coins; a coup costs 7. With 10 or more coins, you must coup.</p>`;}
 else if(g.phase==='lose'&&q.loser===g.me){panel=`<p>Choose one of your influence cards to reveal permanently.</p><div class="actions">${me.cards.map((c,i)=>`<button class="danger" data-lose="${i}">${icon(c)} Reveal ${esc(c)}</button>`).join('')}</div>`;}
 else if(g.phase==='exchange'&&q.actor===g.me){panel=`<p>Choose ${q.keep} card${q.keep===1?'':'s'} to keep. The rest return to the court deck.</p><div class="checks">${q.options.map((c,i)=>`<label><input type="checkbox" data-choice="${i}" ${selected.includes(i)?'checked':''}> ${icon(c)} ${esc(c)}</label>`).join('')}</div><button class="primary" id="exchange" ${selected.length!==q.keep?'disabled':''}>Keep selected</button>`;}
 else if(q&&q.waiting?.includes(g.me)&&!q.passed?.includes(g.me)&&['action-response','block-response','challenge-block'].includes(g.phase)){
  const blocks=g.phase==='block-response'?(q.action==='aid'?['Duke']:q.action==='steal'?['Captain','Ambassador']:['Contessa']):(g.phase==='action-response'&&q.action==='assassinate'&&q.target===g.me?['Contessa']:[]);
  panel=`<p>${name(q.actor)} declared <b>${esc(names[q.action])}</b>${q.target?' against '+name(q.target):''}. ${g.phase==='challenge-block'?`${name(q.blocker)} claims ${esc(q.blockRole)} to block.`:''}</p><div class="actions"><button data-type="pass">Pass</button>${g.phase!=='block-response'?'<button class="danger" data-type="challenge">Challenge claim</button>':''}${blocks.map(r=>`<button data-block="${r}">${icon(r)} Block as ${r}</button>`).join('')}</div><p class="hint section">Passing applies to this response window.</p>`;
 }else panel=`<p class="muted">${g.phase==='turn'?`Waiting for ${name(g.turn)} to choose an action.`:'Waiting for the table to respond.'}</p>`;
 if(timer)panel+=timer;
 if(waiting) panel+=waiting;
 app.innerHTML=`<main class="shell"><header class="top"><div class="brand"><img class="brand-logo" src="/favicon.svg" alt="">COUP<span class="accent">.</span></div><span>THE COURT IS IN SESSION</span></header><div class="tablehead"><div><div class="eyebrow">Private table · ${g.players.length} players</div><h1>${status}</h1><div class="muted">${g.phase==='lobby'?'Gather your allies. Choose them carefully.':'Your influence is visible only to you.'}</div></div><div class="table-controls"><button id="sound-toggle" aria-pressed="${soundEnabled}" aria-label="${soundEnabled?'Mute game sounds':'Turn on game sounds'}">${soundEnabled?'♫ Sound on':'♫ Sound off'}</button><button id="copy">Copy invite link</button><button id="new-game">New game</button><button id="exit-game">Exit game</button></div></div><div class="layout"><div><div class="players">${g.players.map(x=>`<article class="player ${g.turn===x.id&&g.phase!=='lobby'&&g.phase!=='finished'?'current':''}"><div class="player-identity"><img class="player-avatar" src="/avatars/${avatars[x.avatar]||avatars[0]}.png" alt=""><h3>${esc(x.name)} ${x.id===g.me?'<small> · YOU</small>':''} ${x.id===g.host?'<small> · HOST</small>':''} ${x.left?'<small> · LEFT</small>':''}</h3></div>${g.phase==='lobby'?'<span class="muted">Ready to play</span>':`<span class="coins">${icon('income')} ${x.coins} ${x.coins===1?'coin':'coins'}</span><div class="cards">${x.cards?x.cards.map(c=>card(c)).join(''):Array.from({length:x.count},()=>card('influence','hidden')).join('')}${x.revealed.map(c=>card(c,'dead')).join('')}</div>`}</article>`).join('')}</div>${challengeNotice}<section class="panel section"><div class="eyebrow">${myturn?'Your move':'The table'}</div><h2>${myturn?'Make your play':status}</h2>${panel}<div class="error" role="alert">${esc(error)}</div></section>${lastActionNotice}</div><aside><section class="panel"><div class="eyebrow">The court</div><h2>Game history</h2><ul class="history">${g.log.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="panel section roles"><details><summary>How to play</summary>${roles}<p>Income cannot be blocked. Anyone may block foreign aid as Duke. Only the target may block stealing or assassination. A coup costs 7 and cannot be blocked.</p></details></section></aside></div><div class="footer">Coup · An independent adaptation · 2–6 players</div></main>`;
 document.querySelectorAll('#copy').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/?room='+room);b.textContent='Copied!'}catch{error='Copy the invite link from your address bar.';render()}});
 document.querySelector('#sound-toggle')?.addEventListener('click',()=>{soundEnabled=!soundEnabled;localStorage.setItem('coup:sound',soundEnabled?'on':'off');if(soundEnabled){unlockSound();playSound('click');}render()});
 document.querySelector('#exit-game')?.addEventListener('click',()=>confirmLeave());
 document.querySelector('#new-game')?.addEventListener('click',()=>confirmLeave(true));
 document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>send({type:b.dataset.type}));
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.action;if(['coup','assassinate','steal'].includes(action))chooseTarget(action);else send({type:'action',action})});
 document.querySelectorAll('[data-block]').forEach(b=>b.onclick=()=>send({type:'block',role:b.dataset.block}));
 document.querySelectorAll('[data-lose]').forEach(b=>b.onclick=()=>send({type:'lose',index:Number(b.dataset.lose)}));
 document.querySelectorAll('[data-choice]').forEach(b=>b.onchange=()=>{selected=[...document.querySelectorAll('[data-choice]:checked')].map(x=>Number(x.dataset.choice));const button=document.querySelector('#exchange');button.disabled=selected.length!==q.keep});
 document.querySelector('#exchange')?.addEventListener('click',()=>{send({type:'exchange',indexes:selected});selected=[]});
}
render();setInterval(updateCountdown,250);if(session){api({op:'view',room,id:session});setInterval(()=>{if(!busy&&document.visibilityState==='visible')api({op:'view',room,id:session},true)},2500)}
