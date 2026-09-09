import { env } from 'cloudflare:workers';
import { newGame, type Mode, type GameState } from './game';
export type Snapshot={state:GameState;revision:number};
function database(){if(!env.DB)throw new Error('Save storage unavailable');return env.DB;}
export function playerId(request:Request){const id=request.headers.get('oai-authenticated-user-id');if(!id)throw new Error('UNAUTHORIZED');return id;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('FORBIDDEN');}
export async function readGame(user:string,mode:Mode):Promise<Snapshot>{
 const id=`${user}:${mode}`;const db=database();let row=await db.prepare('SELECT state, revision FROM adventures WHERE id = ?').bind(id).first<{state:string;revision:number}>();
 if(!row){await db.prepare('INSERT OR IGNORE INTO adventures (id,state,revision,updated_at) VALUES (?,?,0,?)').bind(id,JSON.stringify(newGame(mode)),new Date().toISOString()).run();row=await db.prepare('SELECT state,revision FROM adventures WHERE id = ?').bind(id).first<{state:string;revision:number}>();}
 if(!row)throw new Error('Save unavailable');return {state:JSON.parse(row.state),revision:row.revision};
}
export async function writeGame(user:string,mode:Mode,revision:number,state:GameState){
 const result=await database().prepare('UPDATE adventures SET state = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(state),new Date().toISOString(),`${user}:${mode}`,revision).run();
 if(result.meta.changes!==1)return null;return {state,revision:revision+1};
}
export const privateHeaders={'Cache-Control':'no-store, private','Vary':'Cookie'};
export function apiError(error:unknown){const msg=error instanceof Error?error.message:'';if(msg==='UNAUTHORIZED')return Response.json({error:'请登录后继续冒险。'},{status:401,headers:privateHeaders});if(msg==='FORBIDDEN')return Response.json({error:'请求来源无效。'},{status:403,headers:privateHeaders});return Response.json({error:'暂时无法读取或保存进度，请稍后重试。'},{status:503,headers:privateHeaders});}
