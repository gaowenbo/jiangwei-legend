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

  // 战斗形象索引（person.wa 规则，rules_ref §1.7 / 原版 0x406a75）
  //   v=0    → 兵种形象（class sprite）
  //   v=1..5 → 0x35 + 3*(v-1) + cls%3
  //   v=6    → cls<40 ? 0x44 : 0x45
  //   v>=7   → v + 0x3f
  const CLASS_SPRITE_BASE = 0x44;   // 兵种形象在 Unit_mov 段表中的起点
  /* 原版 Unit_mov 段号 = persons[pid].sprite（Data.e5 +0x0F）。
   * 权威证据（2026-10-31 逆向 + 实测）：
   *  - 原版 0x442403 `mov dl,[unit+4]; imul edx,edx,0x6300` → 单位对象 +4 存的就是
   *    Unit_mov 段号（段大小 0x6300 = 25344 = 11 帧×48×48）；
   *  - 0x44249f `mov dl,[person+0xF]` → 直接读人物表的 sprite 字节；
   *  - 数据侧：全部 571 个非杂兵 sprite 值都落在 0..517（Unit_mov 段数）内，
   *    且 sprite 值与 Unit_mov 段逐一对上（例：姜维 sprite=0→段0 是其专属形象、
   *    赵云 sprite=25→段25 是白袍银甲持枪；而旧公式给赵云算的是 88 = 另一个武将）。
   *  - sprite=0/255 表示「按兵种形象」，这类值本身已是有效的 Unit_mov 段号
   *    （sprite=255 + cls=54 即轻骑兵一组，329 个 pid 用 sprite=201、104 个用 254）。
   * 旧公式（v+0x3f / 0x35+3(v-1)+cls%3 / 0x44+cls）抄自 rules_ref §1.7 的
   * 兴唐传坐标，姜维传不适用，已作废。 */
  function spriteIndex(v, cls) {
    if (v == null || v < 0 || v === 255) return CLASS_SPRITE_BASE + (cls || 0);
    return v | 0;
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
      // 战斗形象索引（person.wa 规则，rules_ref §1.7 / 0x406a75）：
      //   v=0 → 兵种形象；v=1..5 → 0x35+3(v-1)+cls%3；v=6 → cls<40?0x44:0x45；v>=7 → v+0x3f
      spriteIdx: spriteIndex(p.sprite, cls),
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
