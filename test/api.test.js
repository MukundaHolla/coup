import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processRoom} from '../src/api.js';
test('room sessions do not expose credentials or opponents’ hands',()=>{
 let {state,result:host}=processRoom(null,{op:'create',name:'Host'});
 let result;({state,result}=processRoom(state,{op:'join',name:'Friend'}));const friend=result;
 ({state}=processRoom(state,{op:'join',name:'Third'}));
 ({state}=processRoom(state,{op:'command',id:host.id,message:{type:'start'}}));
 const response=processRoom(state,{op:'view',id:friend.id}).result;
 assert.equal(response.game.players.find(p=>p.id!==response.game.me).cards,undefined);
 assert.ok(!JSON.stringify(response).includes(host.id));
 assert.throws(()=>processRoom(state,{op:'view',id:response.game.players[0].id}),/session not found/);
});
