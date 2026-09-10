/// <reference types="vite/client" />
const ENV='real-leveling-d2g7pu9shcf32cce6';
const BASE=`https://${ENV}.api.tcloudbasegateway.com`;
const GATEWAY='https://real-leveling-d2g7pu9shcf32cce6-1452079345.ap-shanghai.app.tcloudbase.com';
const KEY='real-leveling-cloud-auth-v1';
// Set to the CloudBase HTTP gateway route after deployment.
const API=import.meta.env.VITE_GAME_API || `${GATEWAY}/real-leveling-api`;
let pending:Promise<string>|undefined;
async function token():Promise<string>{
 let session;try{session=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{session={}}
 if(session.access_token&&session.expires_at>Date.now()+30000)return session.access_token;
 if(pending)return pending;
 pending=(async()=>{
  let response:Response|undefined;
  if(session.refresh_token)response=await fetch(`${BASE}/auth/v1/token`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({client_id:ENV,grant_type:'refresh_token',refresh_token:session.refresh_token})});
  if(!response?.ok)response=await fetch(`${BASE}/auth/v1/signin/anonymously`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:'{}'});
  if(!response.ok)throw new Error('暂时无法连接云存档，请稍后重新读取。');
  const data=await response.json();if(!data.access_token)throw new Error('云端登录返回异常。');
  localStorage.setItem(KEY,JSON.stringify({...data,expires_at:Date.now()+(Number(data.expires_in)||3600)*1000}));return data.access_token;
 })();try{return await pending}finally{pending=undefined}
}
export const cloudFetch:typeof fetch=async(input,init={})=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(!url.startsWith('/api/'))throw new Error('未知游戏接口');
 const access=await token();
 const headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${access}`);
 const timeout=AbortSignal.timeout(25000);
 return fetch(API+url,{...init,headers,signal:init.signal?AbortSignal.any([init.signal,timeout]):timeout});
};
