import { z } from 'zod';
import { evolveGame } from '@/lib/game';
import { playerId,sameOrigin,readGame,writeGame,privateHeaders,apiError } from '@/lib/store';
export const dynamic='force-dynamic';
const modeSchema=z.enum(['demo','real']);
const activity=z.object({id:z.string().min(1).max(150),name:z.string().max(120),type:z.string().max(60),start:z.string().max(50),minutes:z.number().min(1).max(1440)});
const actionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('allocate'),stat:z.enum(['strength','endurance','agility'])}),z.object({type:z.literal('claim'),id:z.string().max(150)}),
 z.object({type:z.literal('start'),enemy:z.number().int().min(0).max(5)}),z.object({type:z.literal('move'),move:z.enum(['attack','heavy','guard','potion'])}),
 z.object({type:z.literal('forge'),item:z.enum(['weapon','armor'])}),z.object({type:z.literal('rest')}),z.object({type:z.literal('leave')}),
 z.object({type:z.literal('demo-records')}),z.object({type:z.literal('import'),records:z.array(activity).min(1).max(250)})
]);
export async function GET(request:Request){try{const user=playerId(request);const mode=modeSchema.safeParse(new URL(request.url).searchParams.get('mode')||'demo');if(!mode.success)return Response.json({error:'冒险模式无效。'},{status:400,headers:privateHeaders});return Response.json(await readGame(user,mode.data),{headers:privateHeaders});}catch(e){return apiError(e);}}
export async function POST(request:Request){
 try{const user=playerId(request);sameOrigin(request);const text=await request.text();if(text.length>500000)return Response.json({error:'导入内容过大。'},{status:413,headers:privateHeaders});let json;try{json=JSON.parse(text);}catch{return Response.json({error:'请求格式无效。'},{status:400,headers:privateHeaders});}
 const input=z.object({mode:modeSchema,revision:z.number().int().nonnegative(),action:actionSchema}).safeParse(json);if(!input.success)return Response.json({error:'操作内容不正确。'},{status:400,headers:privateHeaders});
 const {mode,revision,action}=input.data;const current=await readGame(user,mode);if(current.revision!==revision)return Response.json({...current,error:'另一窗口有新进度，已更新，请再操作。'},{status:409,headers:privateHeaders});
 let state;try{state=evolveGame(current.state,action,mode);}catch(e){return Response.json({error:e instanceof Error?e.message:'操作未完成。'},{status:400,headers:privateHeaders});}
 const result=await writeGame(user,mode,revision,state);if(!result)return Response.json({...await readGame(user,mode),error:'另一窗口有新进度，已更新，请再操作。'},{status:409,headers:privateHeaders});return Response.json(result,{headers:privateHeaders});
 }catch(e){return apiError(e);}
}
