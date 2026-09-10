export function validAction(a){
 if(!a||typeof a!=='object')return false;
 switch(a.type){
 case 'allocate':return ['strength','endurance','agility'].includes(a.stat);
 case 'claim':return typeof a.id==='string'&&a.id.length<=150;
 case 'start':return Number.isInteger(a.enemy)&&a.enemy>=0&&a.enemy<=5;
 case 'move':return ['attack','heavy','guard','potion'].includes(a.move);
 case 'forge':return ['weapon','armor'].includes(a.item);
 case 'rest':case 'leave':case 'demo-records':return true;
 case 'import':return Array.isArray(a.records)&&a.records.length>0&&a.records.length<=250&&a.records.every(r=>r&&typeof r.id==='string'&&r.id.length>0&&r.id.length<=150&&typeof r.name==='string'&&r.name.length<=120&&typeof r.type==='string'&&r.type.length<=60&&typeof r.start==='string'&&r.start.length<=50&&Number.isFinite(r.minutes)&&r.minutes>=1&&r.minutes<=1440);
 default:return false;
 }
}
