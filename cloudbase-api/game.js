export const DAILY_XP_CAP = 150;
export const ENEMIES = [
    { name: '露珠史莱姆', area: '苔石入口', sprite: 'slime', hp: 64, attack: 10, armor: 0, gold: 15, material: 1, hint: '适合熟悉战斗。普通攻击可以恢复能量。', trait: '柔软', color: 'mint' },
    { name: '赤帽菇精', area: '蘑菇小径', sprite: 'mushroom', hp: 88, attack: 14, armor: 2, gold: 20, material: 1, hint: '每三回合喷出孢子。看到蓄力提示时用防御。', trait: '孢子', color: 'red' },
    { name: '暮光蝠', area: '暮色林地', sprite: 'bat', hp: 100, attack: 17, armor: 1, gold: 25, material: 1, hint: '敏捷提高暴击率。积攒能量后，可以使出重击。', trait: '迅捷', color: 'violet' },
    { name: '苔衣游侠', area: '失落哨站', sprite: 'archer', hp: 130, attack: 20, armor: 5, gold: 30, material: 2, hint: '穿着厚甲。重击可穿透一部分护甲。', trait: '护甲', color: 'mint' },
    { name: '琥珀史莱姆', area: '晶石溪谷', sprite: 'slime', hp: 158, attack: 22, armor: 7, gold: 40, material: 2, hint: '晶壳坚硬。锻造武器后再来挑战会更从容。', trait: '晶壳', color: 'gold' },
    { name: '古树石像守卫', area: '遗迹之心', sprite: 'golem', hp: 225, attack: 26, armor: 6, gold: 80, material: 3, hint: '重击前会蓄力。交替防御和进攻，留好恢复药水。', trait: '首领', color: 'gold' },
];
export function localDay(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date)); }
export function xpNeeded(level) { return 100 + (level - 1) * 30; }
export function heroPower(s) { return { hp: 70 + s.stats.endurance * 8 + s.armor * 9, attack: 9 + s.stats.strength * 2 + s.weapon * 4, defense: 1 + s.armor * 3, crit: Math.min(40, 4 + s.stats.agility * 2), energy: 10 + Math.floor(s.stats.endurance / 3) }; }
export function activityKind(type) { if (/weight|strength|crossfit|力量|健身/i.test(type))
    return 'strength'; if (/walk|hike|徒步|步行/i.test(type))
    return 'explore'; return 'cardio'; }
export function activityLabel(type) {
    if (/weight|strength|crossfit|力量/i.test(type))
        return '力量训练';
    if (/ride|cycling|bike|骑行/i.test(type))
        return '骑行';
    if (/swim|游泳/i.test(type))
        return '游泳';
    if (/walk|步行/i.test(type))
        return '步行';
    if (/hike|徒步/i.test(type))
        return '徒步';
    if (/run|跑步/i.test(type))
        return '跑步';
    return '运动';
}
export function makeDemoRecords(now = new Date()) {
    const day = localDay(now);
    return [
        { id: 'demo:ride', name: '林间晨骑', type: 'Ride', start: `${day}T07:30:00+08:00`, minutes: 45 },
        { id: 'demo:strength', name: '完成一堂力量课', type: 'WeightTraining', start: `${day}T09:00:00+08:00`, minutes: 40 },
        { id: 'demo:walk', name: '傍晚散步', type: 'Walk', start: `${day}T18:30:00+08:00`, minutes: 25 },
    ].map(a => ({ ...a, source: 'demo', claimed: false, xp: 0, material: 0 }));
}
export function newGame(mode, now = new Date()) { return { version: 1, level: 1, xp: 20, points: 2, stats: { strength: 4, endurance: 4, agility: 4 }, gold: 20, materials: 2, weapon: 0, armor: 0, potions: 2, cleared: [], records: mode === 'demo' ? makeDemoRecords(now) : [], battle: null, restDate: null, lastSync: null, syncSource: null, notice: mode === 'demo' ? '领取一条演示运动，开启第一次成长。' : '真实冒险已准备好。连接或导入自己的运动记录。' }; }
export function duplicateActivity(a, b) { if (a.id === b.id)
    return true; const as = Date.parse(a.start), bs = Date.parse(b.start); const overlap = Math.max(0, Math.min(as + a.minutes * 60000, bs + b.minutes * 60000) - Math.max(as, bs)); return Math.abs(as - bs) <= 180000 && overlap >= Math.max(a.minutes, b.minutes) * 60000 * .8; }
export function normalizeActivity(a, now = new Date()) {
    if (!a || typeof a.id !== 'string' || !a.id.trim() || a.id.length > 150 || typeof a.name !== 'string' || a.name.length > 120 || typeof a.type !== 'string' || a.type.length > 60 || typeof a.start !== 'string' || !Number.isFinite(a.minutes) || a.minutes < 1 || a.minutes > 1440)
        throw new Error('记录格式不正确，请检查日期、类型和运动时长。');
    const start = /(?:Z|[+-]\d\d:\d\d)$/i.test(a.start) ? a.start : `${a.start}+08:00`;
    if (!Number.isFinite(Date.parse(start)))
        throw new Error('运动记录的日期无效。');
    if (Date.parse(start) > now.getTime() + 300000)
        throw new Error('未来的运动记录暂时不能结算。');
    return { id: a.id.trim(), name: a.name.trim() || '运动记录', type: a.type, start: new Date(start).toISOString(), minutes: Math.round(a.minutes * 10) / 10 };
}
export function mergeActivities(s, inputs, source, now = new Date()) {
    if (inputs.length > 250)
        throw new Error('每次最多导入250条记录。');
    const clean = inputs.map(a => normalizeActivity(a, now));
    let added = 0;
    for (const a of clean) {
        if (s.records.some(b => duplicateActivity(a, b)))
            continue;
        if (s.records.length >= 2000)
            throw new Error('当前存档已达到2000条记录上限。');
        s.records.unshift({ ...a, source, claimed: false, xp: 0, material: 0 });
        added++;
    }
    s.records.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
    s.lastSync = now.toISOString();
    s.syncSource = source === 'intervals' ? 'Intervals.icu' : '文件导入';
    s.notice = added ? `新增${added}条运动记录，${inputs.length - added}条重复记录已略过。` : '记录已是最新，本次没有新增奖励。';
    return s;
}
function addXP(s, amount) { s.xp += amount; let levels = 0; while (s.xp >= xpNeeded(s.level)) {
    s.xp -= xpNeeded(s.level);
    s.level++;
    s.points += 2;
    levels++;
} return levels; }
export function rewardPreview(s, a) { const day = s.records.filter(r => r.claimed && localDay(r.start) === localDay(a.start)); return { xp: Math.max(0, Math.min(80, Math.floor(a.minutes * 2), DAILY_XP_CAP - day.reduce((n, r) => n + r.xp, 0))), material: day.reduce((n, r) => n + r.material, 0) < 2 ? 1 : 0 }; }
export function enemyIntent(b) { return b.enemy > 0 && b.turn % 3 === 0 ? '正在蓄力 · 本回合重击，适合防御' : '准备普通攻击'; }
export function evolveGame(previous, action, mode, now = new Date(), random = Math.random) {
    const s = structuredClone(previous);
    const active = s.battle?.status === 'active';
    if (active && !['move', 'leave'].includes(action.type))
        throw new Error('先结束当前战斗，再整理成长和装备。');
    if (action.type === 'allocate') {
        if (!['strength', 'endurance', 'agility'].includes(action.stat) || s.points < 1)
            throw new Error('暂无可用属性点。');
        s.stats[action.stat]++;
        s.points--;
        s.notice = '属性已提升。每次升级还会获得2点。';
    }
    else if (action.type === 'claim') {
        const a = s.records.find(r => r.id === action.id);
        if (!a || a.claimed)
            throw new Error('这条记录已领取，或不存在。');
        const r = rewardPreview(s, a);
        a.claimed = true;
        a.xp = r.xp;
        a.material = r.material;
        const levels = addXP(s, r.xp);
        s.materials += r.material;
        s.notice = `领取${r.xp}经验、${r.material}枚符石。${levels ? `升至${s.level}级，获得${levels * 2}点属性！` : r.xp === 0 ? '当天经验奖励已达上限，安心休息。' : '成长已记入存档。'}`;
    }
    else if (action.type === 'forge') {
        if (!['weapon', 'armor'].includes(action.item))
            throw new Error('装备不存在。');
        const cost = 20 + s[action.item] * 15;
        if (s[action.item] >= 5)
            throw new Error('这件装备已经强化到最高等级。');
        if (s.gold < cost || s.materials < 2)
            throw new Error(`需要${cost}金币和2枚符石。`);
        s.gold -= cost;
        s.materials -= 2;
        s[action.item]++;
        s.notice = '锻造完成，下一场战斗即可生效。';
    }
    else if (action.type === 'start') {
        const e = ENEMIES[action.enemy];
        if (!e || !Number.isInteger(action.enemy) || action.enemy > 0 && !s.cleared.includes(action.enemy - 1))
            throw new Error('先通关前一个区域。');
        const p = heroPower(s);
        s.battle = { enemy: action.enemy, hp: p.hp, enemyHp: e.hp, energy: p.energy, turn: 1, status: 'active', log: [`遭遇${e.name}。${e.hint}`], lastMove: null };
        s.notice = '战斗开始，留意敌人的下一步行动。';
    }
    else if (action.type === 'move') {
        const b = s.battle;
        if (!b || b.status !== 'active')
            throw new Error('请先开始一场战斗。');
        const e = ENEMIES[b.enemy], p = heroPower(s);
        let line = '';
        if (action.move === 'heavy' && b.energy < 4)
            throw new Error('能量不足，普通攻击或防御可恢复能量。');
        if (action.move === 'potion' && s.potions <= 0)
            throw new Error('药水已用完，回营地可以补给。');
        if (action.move === 'potion' && b.hp === p.hp)
            throw new Error('生命已满，暂时不需要药水。');
        if (action.move === 'attack' || action.move === 'heavy') {
            const crit = random() * 100 < p.crit;
            const damage = Math.max(1, Math.round((p.attack * (action.move === 'heavy' ? 1.65 : 1) - e.armor * (action.move === 'heavy' ? .3 : 1)) * (crit ? 1.5 : 1)));
            b.enemyHp = Math.max(0, b.enemyHp - damage);
            b.energy = Math.min(p.energy, b.energy + (action.move === 'heavy' ? -4 : 2));
            line = `${crit ? '暴击！' : ''}${action.move === 'heavy' ? '重击' : '挥剑'}造成${damage}点伤害。`;
        }
        else if (action.move === 'guard') {
            b.energy = Math.min(p.energy, b.energy + 4);
            line = '举盾防御，恢复4点能量。';
        }
        else if (action.move === 'potion') {
            const heal = Math.min(p.hp - b.hp, Math.round(p.hp * .45));
            b.hp += heal;
            s.potions--;
            line = `喝下药水，恢复${heal}点生命。`;
        }
        else
            throw new Error('无法识别这个行动。');
        b.lastMove = action.move;
        if (b.enemyHp === 0) {
            b.status = 'won';
            const first = !s.cleared.includes(b.enemy);
            if (first) {
                s.cleared.push(b.enemy);
                s.gold += e.gold;
                s.materials += e.material;
            }
            s.notice = first ? `首次通关！获得${e.gold}金币、${e.material}枚符石。${b.enemy === 5 ? '林间远征完成，获得「林间守护者」称号！' : '新区域已解锁。'}` : '重温挑战成功。首次通关奖励已领取。';
            b.log.unshift(`${line} ${s.notice}`);
        }
        else {
            const heavy = b.enemy > 0 && b.turn % 3 === 0;
            const incoming = Math.max(1, Math.round((e.attack * (heavy ? 1.8 : 1) - p.defense) * (action.move === 'guard' ? .25 : 1)));
            b.hp = Math.max(0, b.hp - incoming);
            b.log.unshift(`${line} ${e.name}${heavy ? '重击' : '反击'}造成${incoming}点伤害。`);
            b.turn++;
            if (b.hp === 0) {
                b.status = 'lost';
                s.notice = '暂时撤回营地。等级和装备都保留，可以调整后再战。';
            }
            else
                s.notice = b.log[0];
        }
        b.log = b.log.slice(0, 8);
    }
    else if (action.type === 'rest') {
        const first = s.restDate !== localDay(now);
        s.potions = 2;
        s.battle = null;
        if (first) {
            s.gold += 10;
            s.restDate = localDay(now);
        }
        s.notice = first ? '营地补给完成：药水补满，领取10金币。休息也是冒险的一部分。' : '生命和药水已补满。今日营地奖励已经领取。';
    }
    else if (action.type === 'leave') {
        s.battle = null;
        s.notice = '已回到营地，等级和装备保留。';
    }
    else if (action.type === 'demo-records') {
        if (mode !== 'demo')
            throw new Error('演示记录只可用于演示冒险。');
        for (const a of makeDemoRecords(now))
            if (!s.records.some(r => r.id === a.id))
                s.records.push(a);
        s.notice = '演示记录已准备好。同一条记录只会奖励一次。';
    }
    else if (action.type === 'import') {
        if (mode !== 'real')
            throw new Error('请先切换到真实冒险。');
        return mergeActivities(s, action.records, 'import', now);
    }
    else
        throw new Error('无法识别这个操作。');
    return s;
}
