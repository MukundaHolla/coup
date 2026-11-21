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

test('idle expiry ignores polling and successful actions extend the deadline',()=>{
 const start=1000000;
 let {state,result:host}=processRoom(null,{op:'create',name:'Host'},start);
 ({state}=processRoom(state,{op:'view',id:host.id},start+500000));
 assert.equal(state.lastActivity,start);
 assert.throws(()=>processRoom(state,{op:'view',id:host.id},start+600000),/expired/);
 ({state}=processRoom(state,{op:'join',name:'Friend'},start+500000));
 assert.equal(state.lastActivity,start+500000);
 assert.doesNotThrow(()=>processRoom(state,{op:'view',id:host.id},start+600000));
});
test('leaving a lobby transfers the host and removes the last room',()=>{
 let {state,result:host}=processRoom(null,{op:'create',name:'Host'});
 let friend;({state,result:friend}=processRoom(state,{op:'join',name:'Friend'}));
 ({state}=processRoom(state,{op:'leave',id:host.id}));
 assert.equal(processRoom(state,{op:'view',id:friend.id}).result.game.host,state.players[0].id);
 assert.throws(()=>processRoom(state,{op:'view',id:host.id}),/session not found/);
 ({state}=processRoom(state,{op:'leave',id:friend.id}));assert.equal(state,null);
});
