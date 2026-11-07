/* ============================================================
 * 1:1 真实数据接入层（逆向自原版 Data.e5 / Hexzmap.e5 / EEX）
 * 注入到 window.JW_REAL，供 Battle 用 {src:"S_NN"} 引用
 * ============================================================ */
(function () {
  "use strict";
  const G = window.JW_GAME;         // 由 build 内嵌的 game_data.json
  if (!G) { console.warn("JW_GAME 未加载"); return; }
  const P = G.persons, CL = G.classes, FM = G.families, IT = G.items, ST = G.strategies;

  // 30 种原版地形（Hexzmap 网格值）
  const TN = ["平原","草原","树林","荒地","山地","岩山","雪原","桥梁","浅滩","沼泽",
              "池塘","小河","大河","栅栏","城墙","城内","城门","城池","关隘","鹿砦",
              "村庄","兵营","民居","宝物库","云梯","火","船","祭坛","山崖","地下"];
  const TC = ["#c8d38a","#cfc08a","#5a7a3a","#b8a878","#8a7a6a","#7a6a5a","#d8dcd0",
              "#a08a6a","#7a9a6a","#6a6a4a","#6a9ab8","#5a8aa8","#4a6a8a","#8a7a5a",
              "#6a6a6a","#b8a888","#7a5a3a","#b08040","#7a5a3a","#9a8a5a",
              "#c09060","#a87848","#a89070","#c8a840","#8a6a4a","#b04020","#8a8a8a",
              "#a0a0b0","#5a4a3a","#3a3a3a"];

  // 五维索引 → 引擎属性名
  // attrs: 武艺(攻) 统制(防) 智谋(魔) 感知(速) 胆魄(士气/命中)
  const AKEY = ["atk", "def", "mag", "spd", "hit"];

  /* 兵种→家族（1:1 0x4077d0 反汇编实测）：
   *   cls ≤ 59        → ⌊cls/3⌋   （每族 3 个兵种）
   *   60 ≤ cls ≤ 79   → cls − 40  （族 20..39）
   *   cls ≥ 80        → 40（本作无）
   * 旧实现 cls>>1 把每族当 2 兵，地形移动/闪避表与相克全部错位。 */
  function familyOf(cls) {
    if (cls <= 59) return Math.floor(cls / 3);
    if (cls < 80) return cls - 40;
    return 40;
  }

  /* 兵种名（exe 0x48C570 指针表，40 项；实测校正后的 class→家族映射）：
   * 杂兵实测 弓兵=cls6、轻骑兵=9、重骑兵=12、武术家=18、贼兵=21、策士=24、
   * 道士=30、无当军=42、弓骑兵=48、弩兵=57 → 均满足 家族 = ⌊cls/3⌋（cls≤57）。
   * 62/67/70/71/72 另有实测对应，单独列出；其余未知的只显示编号，不硬套。 */
  const FAMILY_NAMES = ["将军","刀兵","弓兵","轻骑兵","重骑兵","炮车","武术家","贼兵","策士","医师",
    "道士","骑策士","咒术士","西凉骑兵","无当军","南中骑","弓骑兵","戟兵","枪兵","弩兵",
    "都督","舟师","锦帆贼","皇帝","粮秣队","宿卫骑","枭姬","游牧骑","白马骑","战鬼",
    "匈奴骑","鲜卑骑","羌族骑","上将军","蛮族兵","山越兵","奇才","江东骑","踏浪军","凤凰骑"];
  const CLASS_FAMILY_FIX = { 62: 22, 67: 27, 70: 30, 71: 31, 72: 32 };
  function className(cls) {
    if (cls == null) return "";
    /* 名表（0x48C570 的 40 项）按【家族】索引；familyOf 即 0x4077d0 权威规则 */
    return FAMILY_NAMES[familyOf(cls)] || ("#" + cls);
  }

  /* 战斗人物形象段号 —— 原版 FUN_0043fc48 逆向（2026-11-04 逐行钉死）。
   * 权威链（asm_r60/r61/r62）：
   *   ov = u16 tbl[pid]                       // VA 0x501000, 1024 项, SHL EDX,1 = pid*2 字节
   *   FUN_004068a1: ov==0 → 0xffff（无覆盖）
   *                   ov<0x21 → (ov-1)*3 + 0x50 + (sprite%3)   // IDIV 3 的余数 = sprite%3
   *                   ov>=0x21 → ov + 0x8f
   *   FUN_0040685a: ov!=0xffff 用 ov 结果作 base；否则 base = sprite（rec+0x2b, FUN_00406610）
   *   FUN_0043fc48: base<0x50 → base*3 + min(form,2)；否则 base + 0xa0
   * sprite = persons[pid].sprite（Data.e5 +0x0F，运行时 unit+0x2b，0x414d96 处由 DL 写入）。
   * form = 部署字段 0x45（unit+5，0..2 三形态），remake 默认 0。
   * 视觉裁决（three_way.png）：刘禅 sprite=49,ov=0 → base=49<0x50 → 49*3=147 银甲剑盾兵
   * （旧实现直接给 49 = 辎重车，错）；赵云 ov=0x69 → base=0x69+0x8f=248 → 248+0xa0=408 金甲大将
   * （旧实现给 25 = 弓兵杂兵，错）。全部 1024 pid 段号落在 0..513，无越界。 */
  const SPRITE_OV = { 2:0x20,6:0x11,7:0x5,14:0x7,19:0x8,24:0x12,25:0x69,26:0x46,27:0x6,28:0x27,29:0x5a,30:0x38,32:0x9,33:0xc7,34:0x3b,36:0x61,37:0x6f,38:0x70,39:0x41,40:0x3f,41:0x13,42:0x6b,43:0x6c,44:0x6d,46:0x71,47:0x71,48:0x72,52:0x73,53:0x59,54:0x77,56:0xf,57:0x10,58:0x5b,60:0x81,61:0x63,62:0x5d,64:0x3e,70:0x7f,71:0x4f,72:0x75,73:0x58,74:0x76,79:0x24,80:0xa,81:0x64,83:0x1b,84:0x99,85:0x32,86:0x1,87:0x1c,88:0x79,89:0x7a,90:0x7b,91:0x7c,92:0x7d,94:0x42,95:0x22,97:0x74,98:0x2a,99:0xb7,100:0x5f,104:0x3,105:0x1d,106:0x7e,107:0x4,108:0x37,109:0xc6,110:0x80,111:0x60,112:0xe,113:0x14,114:0x68,115:0x2f,116:0x1a,117:0x82,118:0x28,119:0x2,121:0x4c,122:0x83,123:0x84,126:0x85,127:0x86,128:0xbd,129:0x19,130:0x5c,131:0x3c,132:0x87,133:0x30,134:0x47,135:0x4b,136:0x88,137:0x89,138:0x49,139:0x8a,140:0x8b,141:0x57,142:0x8c,143:0x8d,144:0x8e,145:0x8f,146:0x66,147:0x16,148:0x17,149:0x18,150:0x50,151:0x90,152:0x36,153:0x15,155:0x3a,164:0x23,165:0xb,166:0xc8,167:0x21,168:0x2c,169:0x1f,171:0x34,172:0x3d,173:0x91,174:0x92,175:0x93,176:0x52,177:0x94,178:0x65,179:0x95,180:0x40,182:0x96,184:0x45,185:0x62,186:0x97,189:0x98,190:0x56,191:0xd2,192:0x9a,193:0x26,194:0x9b,195:0x9c,196:0x9d,201:0x9e,202:0x2d,203:0xcf,205:0xa0,206:0xa1,207:0xa2,208:0x43,209:0x43,210:0xa3,211:0xa4,216:0xa5,217:0x29,218:0x9f,220:0xc,221:0xa7,222:0xa8,224:0xa9,225:0xaa,231:0xab,233:0x1e,234:0x35,235:0xac,237:0xae,238:0xaf,240:0x51,242:0xc9,244:0xca,251:0xb0,253:0x6a,254:0xb1,255:0xb2,256:0x4d,549:0x54,556:0x2b,557:0xb3,558:0xb4,581:0x55,582:0xb5,584:0x53,591:0xb6,644:0xcb,645:0x3,646:0xd,648:0x5e,649:0xb8,650:0xb9,651:0xba,653:0xbb,659:0x44,661:0xbc,663:0xbe,664:0xbf,667:0x25,707:0xc0,710:0x19,711:0x1,712:0x9,713:0x48,714:0x4,715:0x4,716:0xc1,718:0x4e,723:0xc3,725:0xc4,728:0x39,731:0x25,732:0xb4,799:0xce,800:0xcd,801:0x78,822:0x4a,847:0xcc };   // pid → ov（0x501000 表非零项）
  function spriteIndex(pid, sprite, cls, form) {
    const spr = sprite | 0;
    const ov = SPRITE_OV[pid] || 0;
    let base;
    if (ov !== 0) base = ov < 0x21 ? (ov - 1) * 3 + 0x50 + (spr % 3) : ov + 0x8f;
    else base = cls | 0;          // 杂兵 ov==0：取兵种 cls 区分步兵/弓兵/轻骑兵（EXE 回退 sprite=unit+0x2b，部署默认0）
    const f = form > 2 ? 2 : (form > 0 ? form : 0);
    return base < 0x50 ? base * 3 + f : base + 0xa0;
  }

  // 射程码（原版 class byte 1 → 0x43f8be → 16 码形状表，rules.js §6.1）
  // rangeShape 值即射程码；>15 的保留值（18/29）映射为切1兜底
  function rangeCodeOf(shape) {
    if (shape == null || shape === 0xff) return 1;
    if (shape <= 15) return shape;
    return 1;
  }
  function rangeOf(shape) {
    const code = rangeCodeOf(shape);
    if (code === 0) return [1, 1];
    if (code === 1) return [1, 1];
    if (code === 2) return [2, 2];
    if (code === 3) return [2, 3];
    if (code === 4) return [1, 1];
    if (code === 5) return [1, 2];
    if (code === 6) return [1, 2];
    if (code === 7) return [3, 4];
    if (code === 8) return [3, 5];
    if (code === 9) return [3, 3];
    if (code === 10) return [1, 99];
    if (code === 11) return [0, 0];
    if (code === 12) return [1, 3];
    if (code === 13) return [1, 4];
    if (code === 14) return [3, 3];
    if (code === 15) return [3, 3];
    return [1, 1];
  }

  function mkUnit(personId, x, y, faction, opts) {
    const o = opts || {};
    const p = P[personId] || { id: personId, name: "??", attrs: [50,50,50,50,50], hp: 100, mp: 10, cls: 0, lv: 1 };
    const lv = o.lv || Math.max(1, p.lv || 1);
    // 兵种晋升（原版 Promote 0x442890）：部署表 promo 字段决定精锐形态
    const cls = promoteCls(p.cls, o.promo || 0, lv);
    const c = CL[cls] || CL[p.cls] || CL[0];
    const stats = {};
    for (let i = 0; i < 5; i++) {
      stats[AKEY[i]] = (p.attrs[i] || 0) + (c.growth[i] || 0) * (lv - 1);
    }
    const hp = (p.hp || 100) + (c.hpGrow || 0) * (lv - 1);
    const mp = (p.mp || 10) + (c.mpGrow || 0) * (lv - 1);
    const fam = FM[familyOf(cls)] || { move: [], avoid: [] };
    // 策略：learn[兵种id] <= 等级 才习得（1:1 原版 learn 表）
    const learned = [];
    if (ST) {
      /* 统军（§12.5 0x465d40）：class 43 且 pid&0xff==8 → 策略 ≥0x29 按兵种 35 的习得表 */
      const tongjun = cls === 43 && (personId & 0xff) === 8;
      for (const st of ST) {
        const lc = (tongjun && st.id >= 0x29) ? 35 : cls;
        const lvNeed = (st.learn && st.learn[lc]) || 0;
        if (lvNeed > 0 && lvNeed <= lv) learned.push("r" + st.id);
      }
    }
    const def = {
      name: p.name,
      class: "real",                 // 触发真实分支
      pid: personId,
      clsId: cls,
      level: lv,
      stats,
      raw: p.attrs ? p.attrs.slice(0, 5) : null,   // 原始能力值(≤100)，升级成长等级用
      hit: stats.hit,
      skills: learned,
      realSkillIds: learned.map(x => +x.slice(1)),   // 原版策略 id（0x465a40 列表按 id 排序）
      spriteIdx: spriteIndex(personId, p.sprite, cls, o.promo != null ? o.promo : (o.form || 0)),
      weapon: o.weapon != null ? o.weapon : (p.wp !== 255 ? p.wp : undefined),
      armor:  o.armor  != null ? o.armor  : (p.ar !== 255 ? p.ar : undefined),
      acc:    o.acc    != null ? o.acc    : (p.ac !== 255 ? p.ac : undefined),
      leader: !!o.leader,
      ai: o.ai || "normal",
      kind3: !!o.kind3,       // 原版部署表 flags bit1（CountUnits side 3/5）
      hidden: !!o.hidden,     // 原版部署表 flags bit2：初始不出场（state 1），由 op 0x4c 现身
      /* 部署条目原坐标：op 0x4c 现身时按它落位（0x4570ee 取部署条目 (x,y)） */
      deployX: o.deployX, deployY: o.deployY,
      // 原版 AI 附加参数（ai_mode 3/5 追击人物、4/6 目标坐标）
      aiPid: o.aiPid != null ? o.aiPid : null,
      aiX: o.aiX != null ? o.aiX : null,
      aiY: o.aiY != null ? o.aiY : null,
      portrait: o.portrait || null,
      maxHp: hp, maxMp: mp,
      // 族表 0..29 = 地形防御效果（10=100%），30..59 = 移动消耗
      terrEffect: fam.avoid || [], moveCost: fam.move || [],
      clsMove: c.move, realRange: rangeOf(c.rangeShape), rangeCode: rangeCodeOf(c.rangeShape), fam: familyOf(cls)
    };
    return { def, x, y, faction };
  }

  // 解析槽参数 → 单位部署
  // allies: [person,b1,x,y,dir,lv,promo,ai,t,0,0]
  // enemies:[person,b1,b2,x,y,dir,lv,promo,ai,t,0,0]
  function slots(arr, isEnemy) {
    const out = [];
    for (const s of (arr || [])) {
      if (s[0] === 65535 || s[0] == null) continue;
      let x = s[isEnemy ? 3 : 2], y = s[isEnemy ? 4 : 3];
      const lv = s[isEnemy ? 6 : 5];
      // 槽未启用：人物/坐标/等级任一为 65535 均视为空
      if (x === 65535 || y === 65535 || lv === 65535) continue;
      const ai = s[isEnemy ? 8 : 7];
      const promo = s[isEnemy ? 7 : 6]; // 兵种晋升（原版 0x442890）
      /* 原版 AI 参数：ai_mode 3/5 把「追击目标人物」存 +0x0e，4/6 把「目标坐标」存 +0x0e/+0x0f；
       * 槽位字段依次是 ai_mode, ai_person, ai_x, ai_y。 */
      const aiPid = s[isEnemy ? 9 : 8];
      const aiX = s[isEnemy ? 10 : 9];
      const aiY = s[isEnemy ? 11 : 10];
      const clean = (v) => (v === 65535 || v == null ? null : (v | 0));
      /* 原版部署表（rules_ref §10.1）：
       *   allies 行  = [person, hidden, x, y, dir, lv, promo, ai_mode, ai_person, ai_x, ai_y]
       *   enemies 行 = [person, kind3, hidden, x, y, dir, lv, promo, ai_mode, ai_person, ai_x, ai_y]
       * flags = enemy位 | kind3位 | hidden位(bit2)。hidden=1 表示该单位**初始不出场**
       * （state 1），必须由 op 0x4c 让其现身。
       * S_00 的 7 个敌将（赵云/轻骑306/307/258/259/266/283）hidden 全为 1 —— 漏解析这个
       * 字段会导致他们战斗一开场就全部在场，而原版是剧情推进到那一步才登场。 */
      const hidden = !!(s[isEnemy ? 2 : 1] | 0);
      const kind3 = isEnemy ? !!(s[1] | 0) : false;
      out.push({ pid: s[0], x, y, lv: lv || 1, ai: ai || 1, promo: promo === 65535 || promo == null ? 0 : promo,
                 kind3, hidden,
                 aiPid: clean(aiPid), aiX: clean(aiX), aiY: clean(aiY) });
    }
    return out;
  }

  // 原版 Promote(0x442890)：promo 0 无；1 若 class≤38 且 lv≥20 → class+1；
  // 2 若 class≤38：lv≥40 → class+2，lv≥20 → class+1
  function promoteCls(cls, promo, lv) {
    if (cls > 38 || !promo) return cls;
    if (promo === 1) return lv >= 20 ? Math.min(cls + 1, 79) : cls;
    if (promo === 2) return lv >= 40 ? Math.min(cls + 2, 79) : (lv >= 20 ? Math.min(cls + 1, 79) : cls);
    return cls;
  }

  // 把 S_NN 解析成引擎 cfg
  function realBattle(src, battleIndex) {
    const B = G.battles[src] || G.battles[Object.keys(G.battles)[0]];
    const T = G.terrains[parseInt(src.slice(2), 10)] || G.terrains[0];
    const grid = T.grid.map(row => row.slice());      // 数字地形 id 二维
    let w = T.w, h = T.h;
    /* 战场网格扩展：Hexzmap 只覆盖"画出来的"区域，而部署表/剧本会用到更大坐标
     * （已核实 S_02 的 test_unit_at[1025,7,22] 用 y=22，而地形仅 20 行）。
     * 原版战场必然容纳这些格子，故把网格扩到覆盖全部部署坐标，新增格用默认地形 0。 */
    {
      let needW = w, needH = h;
      for (const row of (B.battle_allies || [[]])[0] || []) {
        if (!row || row[0] === 65535 || row[0] == null) continue;
        const rx = row[2], ry = row[3];
        if (rx === 65535 || ry === 65535) continue;
        needW = Math.max(needW, rx + 1); needH = Math.max(needH, ry + 1);
      }
      for (const row of (B.battle_enemies || [[]])[0] || []) {
        if (!row || row[0] === 65535 || row[0] == null) continue;
        const rx = row[3], ry = row[4];
        if (rx === 65535 || ry === 65535) continue;
        needW = Math.max(needW, rx + 1); needH = Math.max(needH, ry + 1);
      }
      needW = Math.max(needW, w); needH = Math.max(needH, h);
      if (needW !== w || needH !== h) {
        for (let y = 0; y < h; y++) for (let x = w; x < needW; x++) grid[y][x] = 0;
        for (let y = h; y < needH; y++) grid.push(new Array(needW).fill(0));
        w = needW; h = needH;
      }
    }

    const settings = B.battle_settings && B.battle_settings[0];
    const rounds = settings ? settings[2] : 12;       // 回合数限制
    const obj = (B.victory_cond_text && B.victory_cond_text[0]) || (B.battle_goal_text && B.battle_goal_text[0]) || "全灭敌军";
    const objStr = Array.isArray(obj) ? (obj[0] || "") : obj;

    // 战前装备分配（原版 battle_equipment）：[[person, wp, ar, ac, ...]]，0/255=空槽
    const equipMap = {};
    for (const row of (B.battle_equipment || [])) {
      if (!Array.isArray(row) || !row.length) continue;
      const pid = row[0];
      if (pid == null || pid === 65535) continue;
      const eq = row.slice(1, 4).map(v => (v === 255 || v === 65535 || !v) ? undefined : v);
      equipMap[pid] = { weapon: eq[0], armor: eq[1], acc: eq[2] };
    }
    const applyEq = (pid, o2) => {
      const e = equipMap[pid];
      if (!e) return o2;
      const m = Object.assign({}, o2);
      if (e.weapon != null) m.weapon = e.weapon;
      if (e.armor != null) m.armor = e.armor;
      if (e.acc != null) m.acc = e.acc;
      return m;
    };

    const allySlots = (B.battle_allies && B.battle_allies[0]) || [];
    const enemySlots = (B.battle_enemies && B.battle_enemies[0]) || [];
    // 我方（玩家控制）= battle_prepare 段 0：count 后接 person id
    const prep0 = (B.battle_prepare && B.battle_prepare[0]) || [];
    const playerSlots = [];
    const pCnt = prep0[0] || 0;
    for (let i = 0; i < pCnt && i + 1 < prep0.length; i++) {
      if (prep0[i + 1] === 65535) continue;
      playerSlots.push(prep0[i + 1]);
    }
    const units = [];
    // 玩家单位：放在友军首槽附近空白格（原版为玩家部署区，此处就近落位）
    const occupied = new Set();
    const isFree = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const k = x + "," + y;
      if (occupied.has(k)) return false;
      const tid = (grid[y] && grid[y][x]) ?? 0;
      if (tid === 0xff) return false;
      return true;
    };
    let px, py;
    // 兜底 anchor 优先玩家部署区（flags=1 首行），其次友军首槽
    const anchorRow = allySlots.find(s => Array.isArray(s) && s[0] !== 65535 && (s[1] & 1)) || allySlots.find(s => Array.isArray(s) && s[0] !== 65535) || null;
    px = anchorRow ? anchorRow[2] : Math.floor(w / 2);
    py = anchorRow ? anchorRow[3] : h - 3;
    // 预占友军/敌军格，避免玩家落点重叠
    for (const s of slots(allySlots, false)) occupied.add(s.x + "," + s.y);
    for (const s of slots(enemySlots, true)) occupied.add(s.x + "," + s.y);
    // 优先使用 battle_allies 中 flags=1 的行（原版部署表：[person, flags, y, x, ...]）
    /* 我方（玩家控制）行：与 slots() 同序（[person, hidden, x, y] → x=s[2], y=s[3]）。
     * 没有 battle_prepare 的战斗（S_05/S_06/... 共 11 战）我方就是 battle_allies 里的行，
     * 因此 playerSlots 为空时改用友军行的人选，避免整场 0 兵直接判负。 */
    if (!playerSlots.length) {
      for (const s of allySlots) {
        if (!Array.isArray(s) || s[0] === 65535 || s[0] == null) continue;
        playerSlots.push(s[0]);
      }
    }
    const playerRows = allySlots.filter(s => Array.isArray(s) && s[0] !== 65535 && ((s[1] & 1) || !B.battle_prepare || !(B.battle_prepare[0] || []).length));
    let playerIdx = 0;
    for (const s of playerRows) {
      let x = s[2], y = s[3];
      if (x === 65535 || y === 65535) continue;
      if (x >= w || y >= h) { const t = x; x = y; y = t; }
      if (x >= w || y >= h) { x = Math.min(Math.max(x, 0), w - 1); y = Math.min(Math.max(y, 0), h - 1); }
      if (!isFree(x, y)) {
        // 被预占（敌我同格）→ 就近找空格，而不是丢弃该兵
        const spot = this && null;
        let found = false;
        for (let r = 1; r <= 4 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < w && ny < h && isFree(nx, ny)) { x = nx; y = ny; found = true; }
            }
          }
        }
        if (!found) { x = Math.min(Math.max(x, 0), w - 1); y = Math.min(Math.max(y, 0), h - 1); }
      }
      units.push(mkUnit(s[0], x, y, "ally", applyEq(s[0], { lv: 1, leader: s[0] === playerSlots[0] })));
      occupied.add(x + "," + y);
      playerIdx++;
    }
    // 兜底：部署表中缺失的 prepare 单位用 anchor 螺旋补齐
    const placedPids = new Set(playerRows.map(s => s[0]));
    for (let i = 0; i < playerSlots.length; i++) {
      if (placedPids.has(playerSlots[i])) continue;
      let placed = false;
      const mk = (x, y) => {
        units.push(mkUnit(playerSlots[i], x, y, "ally", applyEq(playerSlots[i], { lv: 1, leader: i === 0 })));
        occupied.add(x + "," + y);
      };
      for (let r = 0; r <= 8 && !placed; r++) {
        for (let dy = -r; dy <= r && !placed; dy++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = px + dx, y = py + dy;
            if (isFree(x, y)) { mk(x, y); placed = true; }
          }
        }
      }
      if (!placed) mk(0, 0);
    }
    for (const s of slots(allySlots, false)) {
      if (placedPids.has(s.pid)) continue; // 玩家行已放置：避免同一人物生成两份（曾致幽灵实例扰乱轮转）
      if (s.x >= w || s.y >= h) { const t = s.x; s.x = s.y; s.y = t; } // 行格式两种排布并存，越界即交换
      if (s.x >= w || s.y >= h) continue;
      /* hidden 单位初始不出场（state 1），**不占用网格**，等 op 0x4c 现身时才落位。 */
      if (!s.hidden) occupied.add(s.x + "," + s.y);
      units.push(mkUnit(s.pid, s.x, s.y, "friend", applyEq(s.pid, { lv: s.lv, ai: "ai" + s.ai, promo: s.promo,
        hidden: s.hidden, deployX: s.x, deployY: s.y,
        aiPid: s.aiPid, aiX: s.aiX, aiY: s.aiY })));
    }

    /* 敌军部署：原版部署表坐标可能与地形网格不一致（已核实 29/58 战存在越界槽，
     * 例如 S_02 的 y 达 23 而网格仅 20 高）。原版不会丢兵，因此这里
     *  ①坐标越界 → 尝试 (y,x) 互换；②仍越界 → 钳入网格边界；并在 cfg 里记录被钳数量。 */
    let clampedEnemies = 0;
    for (const s of slots(enemySlots, true)) {
      let ex = s.x, ey = s.y;
      if (ex >= w || ey >= h) { const t = ex; ex = ey; ey = t; }
      if (ex >= w || ey >= h) {
        ex = Math.min(Math.max(ex, 0), w - 1);
        ey = Math.min(Math.max(ey, 0), h - 1);
        clampedEnemies++;
      }
      /* hidden 单位初始不出场：不占格、也不做同格挪动 —— 它的部署坐标要原样保留，
       * 之后由 op 0x4c 按部署条目坐标让它现身。 */
      if (!s.hidden) {
        if (occupied.has(ex + "," + ey)) {
          // 同格冲突：就近找空格，找不到则覆盖（避免重复同格导致 AI/寻路异常）
          let found = false;
          for (let r = 1; r <= 3 && !found; r++) {
            for (let dy = -r; dy <= r && !found; dy++) {
              for (let dx = -r; dx <= r && !found; dx++) {
                const nx = ex + dx, ny = ey + dy;
                if (nx >= 0 && ny >= 0 && nx < w && ny < h && !occupied.has(nx + "," + ny)) { ex = nx; ey = ny; found = true; }
              }
            }
          }
        }
        occupied.add(ex + "," + ey);
      }
      units.push(mkUnit(s.pid, ex, ey, "enemy", applyEq(s.pid, { lv: s.lv, ai: "ai" + s.ai, promo: s.promo,
        kind3: s.kind3, hidden: s.hidden, deployX: s.x, deployY: s.y,
        aiPid: s.aiPid, aiX: s.aiX, aiY: s.aiY })));
    }

    // 幽灵清理：任何越界/挂起（@-1）实例不得进入战场（曾致轮转 find 命中旧体）
    // hidden 单位例外：它们初始 x/y = -1 是「未出场」的正常状态，等 op 0x4c 现身。
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (!u) { units.splice(i, 1); continue; }
      if (u.def && u.def.hidden) continue;
      if (!(u.x >= 0) || !(u.y >= 0)) units.splice(i, 1);
    }

    // 主角归一：姜维恒为主将（leader），避免部署表差异导致主将漂移
    const jwLead = units.find(u => u.name === "姜维");
    if (jwLead) { for (const u of units) u.leader = false; jwLead.leader = true; }

    return {
      width: w, height: h,
      grid, units,
      objective: objStr,
      maxRounds: rounds || 12,
      playerSlots,
      clampedEnemies,
      src, battleIndex: battleIndex || 0
    };
  }

  window.JW_REAL = {
    persons: P, classes: CL, families: FM, items: IT, strategies: ST,
    mkUnit,
    terrainNames: TN, terrainColors: TC,
    familyOf, rangeOf, rangeCodeOf, realBattle,
    className, familyNames: FAMILY_NAMES
  };

  // —— 策略桥接：真实策略表 → D.SKILLS 兼容对象（保持原版 mp/范围/效果 1:1） ——
  // range code 表：0=曼1 1=切1 2=曼2 3=曼2..3 4=曼2..4 5=直线1..2 6=曼1..2
  // 7=曼3..4 8=曼3..5 9=曼3 10=全图 11=自身 12=曼1..3 13=曼1..4
  const RANGE_SHAPE = {
    0:[1,1],1:[1,1],2:[2,2],3:[2,3],4:[2,4],5:[1,2],6:[1,2],
    7:[3,4],8:[3,5],9:[3,3],10:[1,99],11:[0,0],12:[1,3],13:[1,4],
    14:[3,3],15:[3,3]
  };
  // area code → 波及半径（0=单体）
  const AREA_RADIUS = { 0:0, 1:1, 2:2, 5:1 };
  const STRAT_ELEMENT = { 0:"fire", 1:"water", 2:"earth", 3:"wind", 4:null };
  const STRAT_KIND = {
    0:"damage",1:"damage",2:"damage",3:"damage",4:"damage",5:"heal",6:"mp",
    7:"debuff",8:"debuff",9:"debuff",10:"debuff",11:"buff",12:"buff",13:"buff",
    14:"buff",15:"special",16:"special",17:"special",18:"special",19:"heal",
    20:"mp",21:"special",22:"special",23:"special",24:"special",25:"special",
    26:"buff",27:"special"
  };
  const REAL_SKILLS = {};
  for (const st of ST) {
    const kind = STRAT_KIND[st.type] || "damage";
    const shape = RANGE_SHAPE[st.range] || [1, 99];
    const radius = AREA_RADIUS[st.area] || 0;
    const key = "r" + st.id;
    REAL_SKILLS[key] = {
      id: key, realId: st.id, name: st.name,
      type: kind, target: st.side === 1 ? "allies" : "enemy",
      area: radius ? "all" : "single",
      power: kind === "damage" ? 40 + (st.type === 4 ? 0 : 0) : (kind === "heal" ? 60 : 0),
      range: shape, mp: st.mp, element: STRAT_ELEMENT[st.type] || null,
      realRange: shape, realArea: radius, anim: st.anim, typeId: st.type,
      rangeCode: st.range, areaCode: st.area,
      desc: st.name + "（MP " + st.mp + "）"
    };
  }
  if (window.JW_DATA && window.JW_DATA.SKILLS) {
    Object.assign(window.JW_DATA.SKILLS, REAL_SKILLS);
  }
  window.JW_REAL.realSkills = REAL_SKILLS;
})();


/* ===== 2026-11-03 EXE 实测权威表（FUN_0043bc62 / FUN_0043c00f / FUN_0043b6f3）=====
 * CLS_MATCHUP  : 0x4d1a80 兵种相克 40x40 乘法表 [atkCls*40+defCls]（100=不变）
 * CRIT_CLS     : 0x4d2138 兵种40字节（1=该兵种持有效果34武器时伤害+sv%）
 * STRAT_FAM_MOD: 0x4d21b0 策略伤害目标族系数表[40]
 * STRAT_HIT_CAT: 0x43ba07 策略命中系数表[73]（>=5→命中x/100；1/100→必中；0→x90；2/3/4→不变） */
(function(){
  if(!window.JW_REAL) return;
  window.JW_REAL.CLS_MATCHUP = [100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,150,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,150,100,100,100,100,100,100,100,100,100,100,120,150,100,150,100,100,100,100,100,100,100,110,100,100,100,100,100,100,100,100,100,100,130,100,100,100,100,130,120,100,100,100,100,100,100,110,100,100,100,100,110,100,100,100,100,100,100,100,100,120,100,110,150,100,120,120,120,100,100,100,100,130,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,110,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,110,100,100,100,100,100,150,100,100,100,100,100,100,100,100,100,100,100,100,120,100,100,90,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,120,100,100,100,100,100,100,100,130,150,100,100,100,100,100,100,120,100,130,100,130,110,150,100,100,100,100,100,100,100,130,100,110,150,100,120,120,120,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,110,110,120,120,120,120,120,100,100,100,100,90,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,140,100,100,100,100,100,100,100,100,100,100,100,100,110,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,110,100,100,100,100,100,100,130,110,110,130,100,100,100,100,100,100,100,100,100,100,120,110,110,140,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,110,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,110,100,100,100,100,100,100,100,130,120,100,100,100,100,100,100,120,100,120,100,120,100,100,100,100,100,100,100,100,100,120,100,110,150,100,120,120,120,100,100,100,100,130,100,100,100,100,100,130,150,100,100,100,100,100,100,120,100,140,100,130,120,100,100,100,100,100,100,100,100,140,100,120,100,100,120,120,120,100,100,100,100,130,100,100,100,100,120,100,100,130,100,100,100,100,100,100,100,100,100,100,110,100,100,130,100,100,100,100,100,100,100,110,100,100,100,100,100,100,100,100,100,100,120,100,100,100,100,130,150,100,100,100,100,100,100,120,100,140,100,130,120,100,100,100,100,100,100,100,100,140,100,120,150,100,130,130,130,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,140,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,110,100,100,100,100,100,100,100,100,100,100,120,120,120,120,120,120,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,140,130,100,100,100,100,100,100,120,100,130,100,130,120,100,100,100,100,100,100,100,100,120,100,100,150,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,120,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,120,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,150,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,140,100,100,100,100,100,100,100,100,100,100,120,100,100,140,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,130,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,90,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,120,110,100,100,100,100,100,100,110,100,110,100,120,110,100,100,100,100,100,100,100,100,110,100,100,150,100,100,100,100,100,100,100,100,100,100,100,100,150,100,100,100,100,100,100,100,100,100,100,100,100,120,100,100,100,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,120,100,100,100,100];
  window.JW_REAL.CRIT_CLS = [0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0];
  window.JW_REAL.STRAT_FAM_MOD = [90,100,100,100,100,100,100,100,90,90,90,90,90,110,120,120,100,120,100,100,90,100,100,90,100,100,90,130,100,150,130,130,130,90,130,130,90,100,100,100];
  window.JW_REAL.STRAT_HIT_CAT = [2,90,90,80,60,2,90,90,80,3,2,90,2,90,90,2,90,2,80,2,60,4,90,90,80,90,80,80,60,80,60,80,50,90,80,80,60,80,100,100,100,100,100,100,100,100,1,0,100,100,90,100,90,100,100,100,100,100,2,2,2,2,2,2,2,2,2,100,60,2,60,100,100];
})();
