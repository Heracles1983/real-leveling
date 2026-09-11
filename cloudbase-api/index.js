import {validAction} from './validate.js';
import http from 'node:http';
import {evolveGame,localDay,mergeActivities} from './game.js';
import {authorization,readGame,writeGame,publicSnapshot,PublicError} from './rest-store.js';
const PORT=9000;
const ENV=process.env.CLOUDBASE_ENV_ID||'real-leveling-d2g7pu9shcf32cce6';
const AUTH_BASE=`https://${ENV}.api.tcloudbasegateway.com/auth/v1`;
const ORIGINS=new Set(['https://heracles1983.github.io','http://localhost:5173']);
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function readBody(req,limit=500000){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>limit)throw new PublicError(413,'请求过大。');chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw new PublicError(400,'请求格式错误。')}}
async function cloudSession(input){
 const deviceId=typeof input.deviceId==='string'?input.deviceId:'';
 if(!/^[A-Za-z0-9._:-]{8,128}$/.test(deviceId))throw new PublicError(400,'设备标识无效。');
 const headers={'Content-Type':'application/json','Accept':'application/json','x-device-id':deviceId};
 let response;
 if(typeof input.refreshToken==='string'&&input.refreshToken.length>=16)response=await fetch(`${AUTH_BASE}/token`,{method:'POST',headers,body:JSON.stringify({client_id:ENV,grant_type:'refresh_token',refresh_token:input.refreshToken}),signal:AbortSignal.timeout(12000)});
 if(!response?.ok)response=await fetch(`${AUTH_BASE}/signin/anonymously`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new PublicError(503,'暂时无法建立云存档会话。');
 const data=await response.json();
 if(!data.access_token)throw new PublicError(503,'云存档登录返回异常。');
 return {access_token:data.access_token,refresh_token:data.refresh_token,expires_in:data.expires_in};
}
async function syncIntervals(input,current){
 if(typeof input.apiKey!=='string'||! /^[\x21-\x7E]{10,128}$/.test(input.apiKey))throw new PublicError(400,'请填写有效的个人 API Key。');
 if(current.state.battle?.status==='active')throw new PublicError(400,'先结束当前战斗，再同步运动。');
    const now = new Date(); const url = new URL('https://intervals.icu/api/v1/athlete/0/activities');
    url.searchParams.set('oldest', localDay(new Date(now.getTime() - 29 * 86400000))); url.searchParams.set('newest', localDay(now));
    let apiResponse; try { apiResponse = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`API_KEY:${input.apiKey}`).toString('base64')}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); } catch { throw new PublicError(502, '运动平台暂时未响应，请稍后重试。'); }
    if (!apiResponse.ok) throw new PublicError(502, apiResponse.status === 401 || apiResponse.status === 403 ? '连接未获授权，请检查个人 API Key 和账户访问权限。' : apiResponse.status === 429 ? '同步请求较多，请稍后再试。' : '暂时无法从运动平台读取记录。');
    const raw = await apiResponse.text(); if (raw.length > 5_000_000) throw new PublicError(502, '返回记录过多，请改用文件导入。');
    let rows; try { rows = JSON.parse(raw); } catch { throw new PublicError(502, '运动平台返回的数据无法读取。'); }
    if (!Array.isArray(rows)) throw new PublicError(502, '运动平台返回的记录格式不正确。');
    const records = rows.filter((r) => r && r.id && r.type && (r.start_date || r.start_date_local) && Number(r.moving_time ?? r.elapsed_time) >= 60).map((r) => ({ id: String(r.id).slice(0, 150), name: String(r.name || '运动记录').slice(0, 120), type: String(r.type).slice(0, 60), start: String(r.start_date || r.start_date_local), minutes: Number(r.moving_time ?? r.elapsed_time) / 60 }));
    if (records.length > 250) throw new PublicError(400, '近30天记录超过250条，请分批导入文件。');
    let state; try { state = mergeActivities(structuredClone(current.state), records, 'intervals', now); } catch (error) { throw new PublicError(400, error instanceof Error ? error.message : '记录无法导入。'); }

 return state;
}
export const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 res.setHeader('Vary','Origin');
 if(origin&&ORIGINS.has(origin))res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 if(origin&&!ORIGINS.has(origin))return json(res,403,{error:'请求来源无效。'});
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,version:3});
  if(req.method==='POST'&&url.pathname==='/api/session')return json(res,200,await cloudSession(await readBody(req,2048)));
  if(!['/api/game','/api/intervals'].includes(url.pathname))throw new PublicError(404,'接口不存在。');
  const auth=authorization(req);
  if(req.method==='GET'&&url.pathname==='/api/game'){
   const mode=url.searchParams.get('mode')||'demo';if(!['demo','real'].includes(mode))throw new PublicError(400,'模式无效。');
   return json(res,200,publicSnapshot(await readGame(auth,mode)));
  }
  if(req.method!=='POST')throw new PublicError(405,'请求方法无效。');
  const input=await readBody(req,url.pathname==='/api/intervals'?2048:500000);
  const mode=url.pathname==='/api/intervals'?'real':input.mode;
  if(!['demo','real'].includes(mode)||!Number.isInteger(input.revision)||input.revision<0)throw new PublicError(400,'操作内容不正确。');
  if(url.pathname==='/api/game'&&!validAction(input.action))throw new PublicError(400,'操作内容不正确。');
  const current=await readGame(auth,mode);
  if(current.revision!==input.revision)return json(res,409,{...publicSnapshot(current),error:'另一窗口有新进度，已更新，请再操作。'});
  let state;
  if(url.pathname==='/api/intervals')state=await syncIntervals(input,current);
  else {try{state=evolveGame(current.state,input.action,mode)}catch{throw new PublicError(400,'操作无效，请检查当前战斗和可用资源。')}}
  const saved=await writeGame(auth,mode,current,state);
  if(!saved)return json(res,409,{...publicSnapshot(await readGame(auth,mode)),error:'进度发生变化，请重试。'});
  return json(res,200,saved);
 }catch(e){return json(res,e instanceof PublicError?e.status:503,{error:e instanceof PublicError?e.message:'服务暂时不可用，请稍后重试。'})}
});
if(process.env.NODE_ENV!=='test')server.listen(PORT,'0.0.0.0');
