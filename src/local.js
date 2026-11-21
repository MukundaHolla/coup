import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {processRoom,roomCode} from './api.js';
const rooms=new Map(),root=new URL('../public/',import.meta.url);
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api'&&req.method==='POST'){
   let raw='';for await(const part of req){raw+=part;if(raw.length>10000)throw Error('Request too large.');}
   const body=JSON.parse(raw),code=body.op==='create'?roomCode():body.room;
   if(!/^[a-f0-9]{24}$/.test(code||''))throw Error('Invalid room.');
   const {state,result}=processRoom(rooms.get(code),body);rooms.set(code,state);
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({...result,room:code}));
  }
  const paths={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};const path=paths[url.pathname];if(!path){res.writeHead(404);return res.end('Not found');}
  const data=await readFile(new URL(path,root));res.writeHead(200,{'content-type':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'text/html'});res.end(data);
 }catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log(`Coup running at http://localhost:${process.env.PORT||3000}`));
