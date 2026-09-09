import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,evolveGame,mergeActivities,heroPower,normalizeActivity,localDay} from '../lib/game.ts';
import {parseActivities} from '../lib/import-activities.ts';
const now=new Date('2026-09-08T23:00:00+08:00');
const evolve=(s,a,m='demo')=>evolveGame(s,a,m,now,()=>.99);
test('exercise rewards are bounded per day, level up, and cannot be claimed twice',()=>{
 let s=newGame('demo',now);for(const a of s.records)s=evolve(s,{type:'claim',id:a.id});
 assert.equal(s.records.reduce((n,a)=>n+a.xp,0),150);assert.equal(s.records.reduce((n,a)=>n+a.material,0),2);assert.equal(s.level,2);assert.equal(s.points,4);
 assert.throws(()=>evolve(s,{type:'claim',id:s.records[0].id}));assert.equal(newGame('real',now).records.length,0);
});
test('sync deduplicates record ids and overlapping recordings from two watches',()=>{
 const a={id:'watch-a',name:'Ride',type:'Ride',start:'2026-09-08T08:00:00+08:00',minutes:45};
 let s=mergeActivities(newGame('real',now),[a,{...a,id:'watch-b',start:'2026-09-08T08:01:00+08:00',minutes:44}],'intervals',now);
 assert.equal(s.records.length,1);s=evolve(s,{type:'claim',id:'watch-a'},'real');s=mergeActivities(s,[a],'intervals',now);assert.equal(s.records.length,1);assert.equal(s.records[0].claimed,true);assert.equal(s.records[0].xp,80);
});
test('future, malformed and unrealistic records are rejected; local dates use Shanghai time',()=>{
 const a={id:'x',name:'Run',type:'Run',start:'2026-09-08T21:00:00',minutes:30};assert.equal(normalizeActivity(a,now).start,'2026-09-08T13:00:00.000Z');
 assert.throws(()=>normalizeActivity({...a,start:'2027-01-01'},now));assert.throws(()=>normalizeActivity({...a,minutes:-1},now));assert.throws(()=>normalizeActivity({...a,minutes:1500},now));assert.equal(localDay('2026-09-08T17:00:00Z'),'2026-09-09');
});
test('CSV parsing handles quoted fields, BOM and seconds; JSON handles minutes',()=>{
 const rows=parseActivities('\uFEFFid,name,type,start_date_local,moving_time\r\nx,"Morning, ride",Ride,2026-09-08T08:00:00,2700\r\n','ride.csv');assert.equal(rows[0].name,'Morning, ride');assert.equal(rows[0].minutes,45);
 assert.equal(parseActivities('[{"id":"a","name":"Swim","type":"Swim","start":"2026-09-07T09:00:00Z","minutes":25}]','a.json')[0].minutes,25);
 assert.throws(()=>parseActivities('id,name\nx,"bad','bad.csv'));
});
test('battle gates, equipment resources, defeat and camp rewards preserve progression',()=>{
 let s=newGame('demo',now);assert.throws(()=>evolve(s,{type:'start',enemy:5}));assert.throws(()=>evolve(s,{type:'allocate',stat:'wrong'}));s=evolve(s,{type:'forge',item:'weapon'});assert.throws(()=>evolve(s,{type:'forge',item:'weapon'}));
 s=evolve(s,{type:'start',enemy:0});assert.throws(()=>evolve(s,{type:'claim',id:s.records[0].id}));const strength=s.stats.strength;
 while(s.battle.status==='active')s=evolve(s,{type:'move',move:'guard'});assert.equal(s.battle.status,'lost');assert.equal(s.stats.strength,strength);assert.equal(s.weapon,1);
 s=evolve(s,{type:'rest'});const gold=s.gold;s=evolve(s,{type:'rest'});assert.equal(s.gold,gold);assert.equal(s.potions,2);
});
test('the complete chapter is winnable using starter demo rewards and strategic play',()=>{
 let s=newGame('demo',now);for(const a of s.records)s=evolve(s,{type:'claim',id:a.id});while(s.points)s=evolve(s,{type:'allocate',stat:'strength'});
 s=evolve(s,{type:'rest'});let wins=0;
 for(let enemy=0;enemy<6;enemy++){
  for(const item of ['weapon','armor','weapon'])if(s.gold>=20+s[item]*15&&s.materials>=2)s=evolve(s,{type:'forge',item});
  s=evolve(s,{type:'start',enemy});let rounds=0;
  while(s.battle.status==='active'&&rounds++<100){const b=s.battle,p=heroPower(s);let move=b.energy>=4?'heavy':'attack';if(b.enemy>0&&b.turn%3===0)move='guard';else if(b.hp<p.hp*.5&&s.potions)move='potion';s=evolve(s,{type:'move',move});}
  assert.equal(s.battle.status,'won',`enemy ${enemy}, HP ${s.battle.hp}`);wins++;const gold=s.gold;s=evolve(s,{type:'start',enemy});
  s=evolve(s,{type:'leave'});assert.equal(s.gold,gold);s=evolve(s,{type:'rest'});
 }
 assert.equal(wins,6);assert.deepEqual(s.cleared,[0,1,2,3,4,5]);
});
