import test from 'node:test';
import assert from 'node:assert/strict';
import {readGame,writeGame,authorization} from '../cloudbase-api/rest-store.js';
import {validAction} from '../cloudbase-api/validate.js';
test('REST save uses caller identity and atomic timestamp comparison',async()=>{
 const old=globalThis.fetch;const calls=[];let row;
 globalThis.fetch=async(url,init)=>{calls.push({url,init});if(init.method==='POST'){row={state:JSON.parse(init.body).state,updated_at:new Date().toISOString()};return Response.json([row]);}if(init.method==='PATCH'){const match=new URL(url).searchParams.get('updated_at');if(match!=='eq.'+row.updated_at)return Response.json([]);row=JSON.parse(init.body);return Response.json([row]);}return Response.json(row?[row]:[])};
 try{const snapshot=await readGame('Bearer player.token','real');assert.equal(snapshot.revision,0);assert.equal(snapshot.state.records.length,0);const saved=await writeGame('Bearer player.token','real',snapshot,snapshot.state);assert.equal(saved.revision,1);assert.equal(await writeGame('Bearer player.token','real',snapshot,snapshot.state),null);assert.ok(calls.every(c=>c.init.headers.Authorization==='Bearer player.token'));assert.ok(!calls.some(c=>c.init.body?.includes('user_id')));}finally{globalThis.fetch=old}
});
test('unauthenticated requests and invalid actions are rejected',()=>{
 assert.throws(()=>authorization({headers:{}}));assert.equal(validAction({type:'allocate',stat:'__proto__'}),false);assert.equal(validAction({type:'start',enemy:999}),false);assert.equal(validAction({type:'import',records:[{minutes:-1}]}),false);assert.equal(validAction({type:'forge',item:'weapon'}),true);
});
