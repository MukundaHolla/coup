import {test} from 'node:test';
import assert from 'node:assert/strict';
import {create,join,command,view} from '../src/game.js';
function setup(){let g=create();for(const id of ['a','b','c'])join(g,id,id);command(g,'a',{type:'start'});return g}
function pass(g,...ids){for(const id of ids)command(g,id,{type:'pass'})}
test('deals privately and enforces turn and mandatory coup',()=>{const g=setup();assert.equal(g.deck.length,9);assert.equal(view(g,'a').players[1].cards,undefined);assert.throws(()=>command(g,'b',{type:'action',action:'income'}));g.players[0].coins=10;assert.throws(()=>command(g,'a',{type:'action',action:'income'}),/must launch/);});
test('failed challenge reveals influence and cancels bluff',()=>{const g=setup();g.players[0].cards=['Captain','Contessa'];command(g,'a',{type:'action',action:'tax'});command(g,'b',{type:'challenge'});assert.equal(g.phase,'lose');command(g,'a',{type:'lose',index:0});assert.equal(g.players[0].coins,2);assert.equal(g.players[g.turn].id,'b');});
test('truthful assassination challenged by target can eliminate target',()=>{const g=setup();g.players[0].cards=['Assassin','Duke'];g.players[0].coins=3;g.players[1].cards=['Duke'];command(g,'a',{type:'action',action:'assassinate',target:'b'});command(g,'b',{type:'challenge'});command(g,'b',{type:'lose',index:0});assert.equal(g.phase,'turn');assert.equal(g.players[g.turn].id,'c');});
test('failed block challenge then assassination costs two influence',()=>{const g=setup();g.players[0].coins=3;g.players[1].cards=['Captain','Duke'];command(g,'a',{type:'action',action:'assassinate',target:'b'});pass(g,'b','c');command(g,'b',{type:'block',role:'Contessa'});command(g,'c',{type:'challenge'});command(g,'b',{type:'lose',index:0});assert.equal(g.phase,'lose');command(g,'b',{type:'lose',index:0});assert.equal(g.players[1].cards.length,0);});
test('ambassador exchange keeps exact influence count and conserves deck',()=>{const g=setup();command(g,'a',{type:'action',action:'exchange'});pass(g,'b','c');assert.equal(g.phase,'exchange');assert.equal(view(g,'b').pending.options,undefined);assert.throws(()=>command(g,'a',{type:'exchange',indexes:[0,0]}));command(g,'a',{type:'exchange',indexes:[1,2]});assert.equal(g.deck.length,9);assert.equal(g.players[0].cards.length,2);});
test('foreign aid can be blocked by any opponent and challenged',()=>{const g=setup();g.players[2].cards=['Duke','Assassin'];command(g,'a',{type:'action',action:'aid'});command(g,'c',{type:'block',role:'Duke'});command(g,'a',{type:'challenge'});command(g,'a',{type:'lose',index:0});assert.equal(g.players[0].coins,2);assert.equal(g.players[g.turn].id,'b');});
test('a complete game reaches a winner and the host can start a rematch',()=>{
 const g=setup();let moves=0;
 while(g.phase!=='finished' && moves++<100){
  const actor=g.players[g.turn];
  if(actor.coins<7){command(g,actor.id,{type:'action',action:'income'});continue;}
  const target=g.players.find(p=>p.id!==actor.id&&p.cards.length);
  command(g,actor.id,{type:'action',action:'coup',target:target.id});
  assert.equal(g.phase,'lose');command(g,target.id,{type:'lose',index:0});
 }
 assert.equal(g.phase,'finished');assert.equal(g.players.filter(p=>p.cards.length).length,1);
 assert.equal(g.winner,g.players.find(p=>p.cards.length).id);
 assert.throws(()=>command(g,'b',{type:'start'}),/host/);
 command(g,'a',{type:'start'});assert.equal(g.phase,'turn');assert.equal(g.players.every(p=>p.coins===2&&p.cards.length===2),true);
});
test('stealing transfers only the available coins after all responses',()=>{
 const g=setup();g.players[1].coins=1;command(g,'a',{type:'action',action:'steal',target:'b'});
 pass(g,'b','c');assert.equal(g.phase,'block-response');
 assert.throws(()=>command(g,'c',{type:'block',role:'Captain'}));
 pass(g,'b');assert.equal(g.players[0].coins,3);assert.equal(g.players[1].coins,0);
});
test('a player may bluff assassination without the Assassin and responders are visible',()=>{
 const g=setup();g.players[0].cards=['Ambassador','Duke'];g.players[0].coins=3;
 command(g,'a',{type:'action',action:'assassinate',target:'b'});
 assert.equal(g.phase,'action-response');assert.deepEqual(view(g,'a').pending.waiting,['b','c']);
 command(g,'b',{type:'pass'});assert.deepEqual(view(g,'a').pending.passed,['b']);
 command(g,'c',{type:'challenge'});assert.equal(g.phase,'lose');assert.equal(g.pending.loser,'a');
});
test('leaving during a response removes the player from the waiting list',async()=>{
 const {leave}=await import('../src/game.js');const g=setup();
 command(g,'a',{type:'action',action:'tax'});command(g,'b',{type:'pass'});leave(g,'c');
 assert.equal(g.phase,'turn');assert.equal(g.players[0].coins,5);assert.equal(g.players[2].left,true);assert.equal(g.players[g.turn].id,'b');
});
test('leaving on your turn forfeits influence and awards the last player',async()=>{
 const {leave}=await import('../src/game.js');const g=setup();leave(g,'a');assert.equal(g.players[g.turn].id,'b');leave(g,'b');assert.equal(g.phase,'finished');assert.equal(g.winner,'c');
});
test('leaving during an exchange returns the drawn cards to the deck',async()=>{
 const {leave}=await import('../src/game.js');const g=setup();command(g,'a',{type:'action',action:'exchange'});pass(g,'b','c');assert.equal(g.deck.length,7);leave(g,'a');assert.equal(g.deck.length,9);assert.equal(g.players[g.turn].id,'b');
});
test('players retain distinct avatars when lobby seats change and games start',()=>{
 const g=create();for(const id of ['a','b','c'])join(g,id,id);
 const original=g.players.map(p=>p.avatar);assert.equal(new Set(original).size,3);
 command(g,'a',{type:'start'});assert.deepEqual(g.players.map(p=>p.avatar),original);
});

test('two-player game uses the standard opening coins and supports a rematch',()=>{
 const g=create();join(g,'a','a');assert.throws(()=>command(g,'a',{type:'start'}),/2–6/);join(g,'b','b');command(g,'a',{type:'start'});
 assert.deepEqual(g.players.map(p=>p.coins),[1,2]);assert.equal(g.deck.length,11);
 command(g,'a',{type:'action',action:'income'});assert.equal(g.players[g.turn].id,'b');
 g.players[1].coins=7;g.players[0].cards=['Duke'];command(g,'b',{type:'action',action:'coup',target:'a'});command(g,'a',{type:'lose',index:0});
 assert.equal(g.winner,'b');command(g,'a',{type:'start'});assert.deepEqual(g.players.map(p=>p.coins),[1,2]);
});
test('two players can challenge and block claims',()=>{
 const g=create();join(g,'a','a');join(g,'b','b');command(g,'a',{type:'start'});
 g.players[0].cards=['Captain','Assassin'];g.players[1].cards=['Contessa','Duke'];g.players[0].coins=3;
 command(g,'a',{type:'action',action:'assassinate',target:'b'});command(g,'b',{type:'pass'});
 assert.equal(g.phase,'block-response');command(g,'b',{type:'block',role:'Contessa'});
 command(g,'a',{type:'challenge'});assert.equal(g.phase,'lose');command(g,'a',{type:'lose',index:0});
 assert.equal(g.phase,'turn');assert.equal(g.players[g.turn].id,'b');
});
