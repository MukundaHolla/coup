import {DurableObject} from 'cloudflare:workers';
import {processRoom,roomCode} from './api.js';
export class Room extends DurableObject {
 async request(body){
  // Synchronous SQLite transactions serialize each complete state transition.
  return this.ctx.storage.transactionSync(()=>{
   const sql=this.ctx.storage.sql;sql.exec('CREATE TABLE IF NOT EXISTS game (id INTEGER PRIMARY KEY, state TEXT NOT NULL)');
   const row=sql.exec('SELECT state FROM game WHERE id=1').toArray()[0];
   const {state,result}=processRoom(row?JSON.parse(row.state):null,body);
   if(body.op!=='view')sql.exec('INSERT INTO game VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state=excluded.state',JSON.stringify(state));
   return result;
  });
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
