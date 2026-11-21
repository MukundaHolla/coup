import {create,join,command,view} from './game.js';
const token = () => crypto.randomUUID().replaceAll('-','');
export function processRoom(state,body) {
 const {op,id,name,message}=body || {};
 if(op==='create') {if(state) throw Error('Room already exists.');state=create();const playerId=token(),secret=token();join(state,playerId,name);state.players.at(-1).secret=secret;return {state,result:{id:secret,game:view(state,playerId)}};}
 if(!state) throw Error('Room not found. Check the invite link.');
 if(op==='join'){const playerId=token(),secret=token();join(state,playerId,name);state.players.at(-1).secret=secret;return {state,result:{id:secret,game:view(state,playerId)}};}
 if(typeof id!=='string')throw Error('Player session missing.');
 const player=state.players.find(p=>p.secret===id);if(!player)throw Error('Player session not found.');
 if(op==='command')command(state,player.id,message);
 else if(op!=='view') throw Error('Unknown request.');
 return {state,result:{game:view(state,player.id)}};
}
export const roomCode = () => {const a=new Uint8Array(12);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');};
