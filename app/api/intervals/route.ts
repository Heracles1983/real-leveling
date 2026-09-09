import {z} from 'zod';
import {mergeActivities,localDay,type ActivityInput} from '@/lib/game';
import {playerId,sameOrigin,readGame,writeGame,privateHeaders,apiError} from '@/lib/store';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{const user=playerId(request);sameOrigin(request);let data;try{const raw=await request.text();if(raw.length>2048)throw new Error();data=JSON.parse(raw);}catch{return Response.json({error:'连接信息格式无效。'},{status:400,headers:privateHeaders});}
 const parsed=z.object({apiKey:z.string().trim().min(10).max(128).regex(/^[\x21-\x7E]+$/),revision:z.number().int().nonnegative()}).safeParse(data);
 if(!parsed.success)return Response.json({error:'请填写有效的个人 API Key。'},{status:400,headers:privateHeaders});
 const current=await readGame(user,'real');if(current.state.battle?.status==='active')return Response.json({error:'先结束当前战斗，再同步运动。'},{status:400,headers:privateHeaders});
 if(current.revision!==parsed.data.revision)return Response.json({...current,error:'进度已更新，请再点一次同步。'},{status:409,headers:privateHeaders});
 const now=new Date();const oldest=localDay(new Date(now.getTime()-29*86400000));const url=new URL('https://intervals.icu/api/v1/athlete/0/activities');url.searchParams.set('oldest',oldest);url.searchParams.set('newest',localDay(now));
 let response:Response;try{response=await fetch(url,{headers:{Authorization:`Basic ${btoa('API_KEY:'+parsed.data.apiKey)}`,Accept:'application/json'},signal:AbortSignal.timeout(15000)});}catch{return Response.json({error:'运动平台暂时未响应，请稍后重试。也可以先导入记录文件。'},{status:502,headers:privateHeaders});}
 if(!response.ok){const message=response.status===401||response.status===403?'连接未获授权，请检查个人 API Key 和账户访问权限。':response.status===429?'同步请求较多，请稍后再试。':'暂时无法从运动平台读取记录。';return Response.json({error:message},{status:502,headers:privateHeaders});}
 const raw=await response.text();if(raw.length>5000000)return Response.json({error:'返回记录过多，请改用文件导入。'},{status:502,headers:privateHeaders});let rows;try{rows=JSON.parse(raw);}catch{return Response.json({error:'运动平台返回的数据无法读取。'},{status:502,headers:privateHeaders});}
 if(!Array.isArray(rows))return Response.json({error:'运动平台返回的记录格式不正确。'},{status:502,headers:privateHeaders});
 const records:ActivityInput[]=rows.filter(r=>r&&r.id&&r.type&&(r.start_date||r.start_date_local)&&Number(r.moving_time??r.elapsed_time)>=60).map(r=>({id:String(r.id).slice(0,150),name:String(r.name||'运动记录').slice(0,120),type:String(r.type).slice(0,60),start:String(r.start_date||r.start_date_local),minutes:Number(r.moving_time??r.elapsed_time)/60}));
 if(records.length>250)return Response.json({error:'近30天记录超过250条，请分批导入文件。'},{status:400,headers:privateHeaders});
 let state;try{state=mergeActivities(structuredClone(current.state),records,'intervals',now);}catch(e){return Response.json({error:e instanceof Error?e.message:'记录无法导入。'},{status:400,headers:privateHeaders});}
 const result=await writeGame(user,'real',parsed.data.revision,state);if(!result)return Response.json({...await readGame(user,'real'),error:'进度已更新，请重新同步；重复记录不会重复奖励。'},{status:409,headers:privateHeaders});return Response.json({...result,skipped:rows.length-records.length},{headers:privateHeaders});
 }catch(e){return apiError(e);}
}
