import {DurableObject} from 'cloudflare:workers';
import {processRoom,roomCode,expired,nextWakeAt} from './api.js';
import {updateResponseTimer} from './game.js';
export class Room extends DurableObject {
 async request(body){
  // Synchronous SQLite transactions serialize each complete state transition.
  const outcome=this.ctx.storage.transactionSync(()=>{
   const sql=this.ctx.storage.sql;sql.exec('CREATE TABLE IF NOT EXISTS game (id INTEGER PRIMARY KEY, state TEXT NOT NULL)');
   const row=sql.exec('SELECT state FROM game WHERE id=1').toArray()[0];
   const {state,result}=processRoom(row?JSON.parse(row.state):null,body);
   if(!state)sql.exec('DELETE FROM game WHERE id=1');
   else if(!row||JSON.stringify(state)!==row.state)sql.exec('INSERT INTO game VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state=excluded.state',JSON.stringify(state));
   return {result,state};
  });
  if(!outcome.state)await this.ctx.storage.deleteAll();
  else await this.ctx.storage.setAlarm(nextWakeAt(outcome.state));
  return outcome.result;
 }
 async alarm(){
  const rows=this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='game'").toArray();
  if(!rows.length)return;
  const row=this.ctx.storage.sql.exec('SELECT state FROM game WHERE id=1').toArray()[0];
  if(!row)return;
  const state=JSON.parse(row.state);
  if(expired(state))await this.ctx.storage.deleteAll();
  else {if(updateResponseTimer(state))this.ctx.storage.sql.exec('UPDATE game SET state=? WHERE id=1',JSON.stringify(state));await this.ctx.storage.setAlarm(nextWakeAt(state));}
 }
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname!=='/api')return env.ASSETS.fetch(request);
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 try{
  if(Number(request.headers.get('content-length')||0)>10000)throw Error('Request too large.');
  const body=await request.json(),room=body.op==='create'?roomCode():body.room;
  if(!/^[a-f0-9]{24}$/.test(room||''))throw Error('Invalid room.');
  const result=await env.ROOMS.getByName(room).request(body);
  return Response.json({...result,room},{headers:{'cache-control':'no-store'}});
 }catch(e){return Response.json({error:e.message||'Request failed.'},{status:400});}
}};
