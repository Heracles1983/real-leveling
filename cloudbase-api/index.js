import http from 'node:http';
import { Pool } from 'pg';
import { evolveGame, localDay, mergeActivities, newGame } from './game.js';

const PORT = Number(process.env.PORT || 9000);
const ALLOWED_ORIGINS = new Set([
  'https://heracles1983.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
]);
const pool = new Pool(databaseOptions());
let schemaReady;

function databaseOptions() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;
  if (connectionString) return { connectionString, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } };
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  };
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`CREATE TABLE IF NOT EXISTS real_leveling_saves (
      player_id varchar(100) NOT NULL,
      mode varchar(10) NOT NULL CHECK (mode IN ('demo', 'real')),
      revision integer NOT NULL DEFAULT 0,
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, mode)
    )`).catch((error) => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

function cors(request, response) {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Real-Leveling-Player');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Cache-Control', 'no-store');
}
function json(response, status, body) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(body)); }
function validMode(mode) { return mode === 'demo' || mode === 'real'; }
function playerId(request) {
  const id = request.headers['x-real-leveling-player'];
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw new PublicError(401, '请刷新页面后重试。');
  return id;
}
function requireOrigin(request) {
  if (request.headers.origin && !ALLOWED_ORIGINS.has(request.headers.origin)) throw new PublicError(403, '请求来源无效。');
}
async function readBody(request, limit = 500_000) {
  const chunks = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > limit) throw new PublicError(413, '请求内容过大。'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new PublicError(400, '请求格式无效。'); }
}
async function snapshot(client, player, mode, lock = false) {
  await client.query('INSERT INTO real_leveling_saves (player_id, mode, state) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [player, mode, JSON.stringify(newGame(mode))]);
  const result = await client.query(`SELECT state, revision FROM real_leveling_saves WHERE player_id=$1 AND mode=$2${lock ? ' FOR UPDATE' : ''}`, [player, mode]);
  return { state: result.rows[0].state, revision: result.rows[0].revision };
}
async function getGame(request, response, url) {
  const player = playerId(request), mode = url.searchParams.get('mode') || 'demo';
  if (!validMode(mode)) throw new PublicError(400, '冒险模式无效。');
  await ensureSchema(); const client = await pool.connect();
  try { json(response, 200, await snapshot(client, player, mode)); } finally { client.release(); }
}
async function mutateGame(request, response) {
  requireOrigin(request); const player = playerId(request); const input = await readBody(request);
  if (!validMode(input?.mode) || !Number.isInteger(input?.revision) || input.revision < 0 || !input?.action?.type) throw new PublicError(400, '操作内容不正确。');
  await ensureSchema(); const client = await pool.connect();
  try {
    await client.query('BEGIN'); const current = await snapshot(client, player, input.mode, true);
    if (current.revision !== input.revision) { await client.query('ROLLBACK'); return json(response, 409, { ...current, error: '另一窗口有新进度，已更新，请再操作。' }); }
    let state; try { state = evolveGame(current.state, input.action, input.mode); } catch (error) { await client.query('ROLLBACK'); throw new PublicError(400, error instanceof Error ? error.message : '操作未完成。'); }
    await client.query('UPDATE real_leveling_saves SET state=$1, revision=revision+1, updated_at=now() WHERE player_id=$2 AND mode=$3', [JSON.stringify(state), player, input.mode]);
    await client.query('COMMIT'); json(response, 200, { state, revision: current.revision + 1 });
  } catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; } finally { client.release(); }
}
async function syncIntervals(request, response) {
  requireOrigin(request); const player = playerId(request); const input = await readBody(request, 2048);
  if (typeof input?.apiKey !== 'string' || !/^[\x21-\x7E]{10,128}$/.test(input.apiKey) || !Number.isInteger(input?.revision) || input.revision < 0) throw new PublicError(400, '请填写有效的个人 API Key。');
  await ensureSchema(); const client = await pool.connect();
  try {
    await client.query('BEGIN'); const current = await snapshot(client, player, 'real', true);
    if (current.state.battle?.status === 'active') throw new PublicError(400, '先结束当前战斗，再同步运动。');
    if (current.revision !== input.revision) { await client.query('ROLLBACK'); return json(response, 409, { ...current, error: '进度已更新，请再点一次同步。' }); }
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
    await client.query('UPDATE real_leveling_saves SET state=$1, revision=revision+1, updated_at=now() WHERE player_id=$2 AND mode=$3', [JSON.stringify(state), player, 'real']);
    await client.query('COMMIT'); json(response, 200, { state, revision: current.revision + 1, skipped: rows.length - records.length });
  } catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; } finally { client.release(); }
}
class PublicError extends Error { constructor(status, message) { super(message); this.status = status; } }
const server = http.createServer(async (request, response) => {
  cors(request, response);
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true });
    if (request.method === 'GET' && url.pathname === '/api/game') return await getGame(request, response, url);
    if (request.method === 'POST' && url.pathname === '/api/game') return await mutateGame(request, response);
    if (request.method === 'POST' && url.pathname === '/api/intervals') return await syncIntervals(request, response);
    throw new PublicError(404, '接口不存在。');
  } catch (error) {
    const status = error instanceof PublicError ? error.status : 503;
    if (!(error instanceof PublicError)) console.error(error);
    return json(response, status, { error: error instanceof PublicError ? error.message : '服务暂时不可用，请稍后重试。' });
  }
});
server.listen(PORT, () => console.log(`real-leveling-api listening on ${PORT}`));
