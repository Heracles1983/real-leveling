import {newGame} from './game.js';
const ENV=process.env.CLOUDBASE_ENV_ID||'real-leveling-d2g7pu9shcf32cce6';
const BASE=`https://${ENV}.api.tcloudbasegateway.com/v1/rdb/rest/real_leveling_saves`;
export class PublicError extends Error {constructor(status,message){super(message);this.status=status}}
export function authorization(request){const value=request.headers.authorization;if(!/^Bearer [A-Za-z0-9._~-]+$/.test(value||''))throw new PublicError(401,'请重新读取云存档。');return value}
async function db(auth,query='',init={}){
 const response=await fetch(BASE+query,{...init,headers:{Authorization:auth,'Content-Type':'application/json',Prefer:'return=representation',...init.headers},signal:AbortSignal.timeout(12000)});
 if(!response.ok){if(response.status===401)throw new PublicError(401,'云端登录已过期，请刷新重试。');throw new PublicError(503,'云存档暂时无法读写，请稍后重试。')}
 return response.status===204?[]:await response.json();
}
export async function readGame(auth,mode){
 let rows=await db(auth,`?mode=eq.${mode}&select=state,updated_at&limit=1`);
 if(!rows.length){try{rows=await db(auth,'',{method:'POST',body:JSON.stringify({mode,state:{...newGame(mode),_revision:0}})})}catch(e){rows=await db(auth,`?mode=eq.${mode}&select=state,updated_at&limit=1`);if(!rows.length)throw e}}
 const row=rows[0];if(!row)throw new PublicError(503,'云存档尚未就绪。');
 const {_revision=0,...stored}=row.state;
 const state={...newGame(mode),...stored};
 // Preserve existing simplified saves while bringing records and battles to the shared format.
 state.records=(state.records||[]).map(r=>({...r,source:r.source||(String(r.id).startsWith('demo:')?'demo':'import')}));
 if(state.battle&&!state.battle.status)state.battle={...state.battle,status:'active',log:[],lastMove:null};
 return {state,revision:_revision,updated_at:row.updated_at};
}
export async function writeGame(auth,mode,current,state){
 const revision=current.revision+1;
 const rows=await db(auth,`?mode=eq.${mode}&updated_at=eq.${encodeURIComponent(current.updated_at)}`,{method:'PATCH',body:JSON.stringify({state:{...state,_revision:revision},updated_at:new Date(Math.max(Date.now(),Date.parse(current.updated_at)+1)).toISOString()})});
 return rows.length?{state,revision}:null;
}
export function publicSnapshot(s){return {state:s.state,revision:s.revision}}
