import {create,join,command,view,leave,updateResponseTimer} from './game.js';
const token = () => crypto.randomUUID().replaceAll('-','');
export const IDLE_MS=10*60*1000;
export const expired=(state,now=Date.now())=>!!state?.lastActivity && now-state.lastActivity>=IDLE_MS;
export function nextWakeAt(state){
 const idle=state.lastActivity+IDLE_MS;
 return ['action-response','challenge-block'].includes(state.phase)&&Number.isFinite(state.pending?.deadline)?Math.min(idle,state.pending.deadline):idle;
}
export function processRoom(state,body,now=Date.now()) {
 const {op,id,name,message}=body || {};
 if(expired(state,now)) throw Error('This game expired after 10 minutes of inactivity. Start a new game.');
 if(op==='create') {if(state) throw Error('Room already exists.');state=create();const playerId=token(),secret=token();join(state,playerId,name);state.players.at(-1).secret=secret;state.lastActivity=now;return {state,result:{id:secret,game:view(state,playerId)}};}
 if(!state) throw Error('Room not found. Check the invite link.');
 if(op==='join'){const playerId=token(),secret=token();join(state,playerId,name);state.players.at(-1).secret=secret;state.lastActivity=now;return {state,result:{id:secret,game:view(state,playerId)}};}
 if(typeof id!=='string')throw Error('Player session missing.');
 const player=state.players.find(p=>p.secret===id&&!p.left);if(!player)throw Error('Player session not found.');
 updateResponseTimer(state,now);
 if(op==='leave'){leave(state,player.id);return {state:state.players.some(p=>!p.left)?Object.assign(state,{lastActivity:now}):null,result:{left:true}};}
 if(op==='command'&&message?.window&&['pass','challenge','block'].includes(message.type)&&(message.window.phase!==state.phase||message.window.deadline!==(state.pending?.deadline??null)))return {state,result:{game:view(state,player.id),notice:'That response window has ended.'}};
 if(op==='command')command(state,player.id,message);
 else if(op!=='view') throw Error('Unknown request.');
 if(op==='command'||!state.lastActivity)state.lastActivity=now;
 return {state,result:{game:view(state,player.id)}};
}
export const roomCode = () => {const a=new Uint8Array(12);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');};
