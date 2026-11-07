/* ============================================================
 * 三国志·姜维传 —— HTML 重制版
 * 战棋核心引擎（数据驱动）
 * 全局命名空间: window.JW
 * ============================================================ */
(function () {
  "use strict";
  const D = window.JW_DATA;

  // ---------- 兵种相克表（jump table 0x4d2140，1:1 逆向；[k,n] 表示 ×k/(2^n)） ----------
  const MATCHUP = {
    0:  { 16: [5, 2], 17: [5, 2] },                       // 英雄 → 雄师/统军 ×5/4
    1:  { 4:  [3, 1], 3:  [3, 2] },                       // 刀兵 → 弓兵×3/2；轻骑×3/4
    2:  { 4:  [5, 2] },                                   // 枪兵 → 弓兵 ×5/4
    3:  { 1:  [2, 0] },                                   // 轻骑 → 刀兵 ×2
    4:  { 3:  [3, 1], 7: [3, 1], 13: [3, 1], 20: [3, 1], 24: [3, 1] }, // 弓兵
    5:  { 9:  [5, 2], 10: [5, 2], 18: [5, 2] },           // 间谍 → 谋/道/国师 ×5/4
    6:  { 5:  [5, 2], 21: [5, 2] },                       // 格斗 → 间谍/战车 ×5/4
    7:  { 2:  [3, 1] },                                   // 重骑 → 枪兵 ×3/2
    8:  { 6:  [3, 1], 19: [3, 1] },                       // 僧兵 → 格斗/力士 ×3/2
    12: { 16: [1, 0], 17: [1, 0] },                       // 锤骑 → 雄师/统军 ×1（被补丁剔除）
    15: { 3: [3, 1], 7: [3, 1], 13: [3, 1], 16: [3, 1], 17: [3, 1], 20: [3, 1], 24: [3, 1] }, // 弓骑
    20: { 1: [3, 1], 2: [3, 1] },                         // 狄骑 → 刀/枪兵 ×3/2
    21: { 6: [3, 2] }                                    // 战车 → 格斗兵 ×3/4
  };

  // ---------- 策略伤害 power 表（table 0x43c31e，1:1 逆向；键为策略 id，取自 EXE 实测） ----------
  // 73 项，索引 0..72，超出按 0 处理（不伤害）
  const STRAT_POWER = [70,90,50,70,90,70,90,50,70,28,50,70,40,50,20,70,90,70,90,120,70,28,50,28,28,28,28,28,28,28,28,28,28,70,40,50,20,28,120,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,70,100,28,28,0,0,0,0,0]; /* EXE 直证 @0x43c31e[73]，2026-11-06 PE 提取（原对象表 21/22/33-38/64-66 错位，已按真值数组替换；sid>0x48=72 不读表=0，@0x43c101） */
  // 兵种修正表 0x4d21b0[40]，按目标兵种 id 索引，100=无修正
  const STRAT_CLASS_MOD = [
    90, 100, 100, 100, 100, 100, 100, 100, 90, 90,
    90, 90, 90, 110, 120, 120, 100, 120, 100, 100,
    90, 100, 100, 90, 100, 100, 90, 130, 100, 150,
    130, 130, 130, 90, 130, 130, 90, 100, 100, 100
  ];

  // ---------- 策略命中系数表（table 0x43bc07→0x43bb6b，1:1 逆向；[n,d]=×n/d，"auto"=固定100） ----------
  const STRAT_HIT = {
    0: [1, 1],      // 焦热
    1: [9, 10],     // 烈焰
    2: [9, 10],     // 炎雷
    3: [4, 5],      // 炼狱
    4: [3, 5],      // 赤链
    5: [1, 1],      // 浊流
    6: [9, 10],     // 惊涛
    7: [9, 10],     // 潮汐
    8: [4, 5],      // 海啸
    9: "狂澜",      // 狂澜：特殊处理
    10: [1, 1],     // 烟尘
    11: [9, 10],    // 飞沙
    12: [1, 1],     // 萧瑟
    13: [9, 10],    // 龙挂
    14: [9, 10],    // 飓风
    15: [1, 1],     // 落石
    16: [9, 10],    // 塌方
    17: [1, 1],     // 碎岩
    18: [4, 5],     // 地裂
    19: [1, 1],     // 移山
    20: [3, 5],     // 暗算
    21: "auto",     // 暗杀
    22: [9, 10],    // 暗鬼
    33: [9, 10],    // 毒烟
    34: [4, 5],     // 瘴雾
    35: [4, 5],     // 陷阱
    36: [3, 5],     // 濠壑
    38: "auto",     // 八阵
    64: [1, 1],     // 青龙
    65: [1, 1]      // 朱雀
  };

  // ---------- 伤害型策略集合（0x449bac/0x449c36：0-20, 22, 33-36, 38, 64, 65） ----------
  const DAMAGE_STIDS = new Set([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,22,33,34,35,36,38,64,65]);
  const _isDamageStrategy = (skill) => {
    const sid = skill && (skill.realId != null ? skill.realId : skill.id);
    return DAMAGE_STIDS.has(sid);
  };

  // ---------- 工具函数 ----------
  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    rnd: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
    choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
    manhattan: (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2),
    chebyshev: (x1, y1, x2, y2) => Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)),
    dist: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2),
    deepClone: (o) => JSON.parse(JSON.stringify(o)),
    uid: (() => { let n = 0; return () => "u" + (++n); })(),
  };
  // grid 可以是 2D 数组或 {w,h,data} 扁平，统一按 (x,y) 取元素
  function gridAt(grid, x, y) {
    if (!grid) return undefined;
    if (Array.isArray(grid)) return (grid[y] && grid[y][x]) ?? grid[y]?.[x];
    if (Array.isArray(grid.data)) return grid.data[y * grid.w + x];
    return undefined;
  }
  // 原版地形 id → 引擎地形对象（1:1）
  const TERRAIN_BY_ID = (function () {
    const R = (typeof window !== "undefined" && window.JW_REAL) || null;
    if (!R) return null;
    return function (tid) {
      if (tid == null || tid === 0xff || tid < 0 || tid >= R.terrainNames.length) return null;
      return {
        id: tid, name: R.terrainNames[tid], color: R.terrainColors[tid] || "#999",
        move: 1, avoid: 0, def: 1.0, hpRegen: 0,
        impassable: tid === 0xff, real: true
      };
    };
  })();

  // ---------- 地图 ----------
  class GameMap {
    // grid: 二维数组 {terrain: terrainId, unit: unit|null, extra:{...}}
    constructor(width, height) {
      this.w = width; this.h = height;
      this.cells = new Array(width * height);
      for (let i = 0; i < this.cells.length; i++) this.cells[i] = { terrain: "plain", unit: null, meta: null, visited: false };
    }
    idx(x, y) { return y * this.w + x; }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      return this.cells[this.idx(x, y)];
    }
    set(x, y, cell) { this.cells[this.idx(x, y)] = cell; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    terrain(x, y) {
      const c = this.get(x, y);
      if (!c) return null;
      if (c.tid !== undefined && TERRAIN_BY_ID) {
        const t = TERRAIN_BY_ID(c.tid);
        if (t) return t;
      }
      return (D.TERRAINS[c.terrain] || D.TERRAINS.plain);
    }
    // 单位在 (x,y) 的真实移动力消耗（族表）
    moveCostAt(unit, x, y) {
      const c = this.get(x, y);
      if (!c) return 99;
      let v;
      if (unit && unit.moveCost && unit.moveCost.length && c.tid !== undefined) {
        v = unit.moveCost[c.tid];
        if (v === 255 || v === 0xff) return 99;      // 不可通行
        if (v === undefined) v = null;
      }
      if (v == null) {
        const t = this.terrain(x, y);
        v = t ? Math.max(1, t.move) : 99;
        if (v === 99) return 99;
      }
      /* §7.1（0x43f7cf）三条修正，按顺序：
       *   34 恶路移动（虎类豹）→ 恒 1
       *   86 辅助地形移动（黄骠马）或 赵云(25) 且 class 41 → c>1 时 −1
       *   6 号人物（太史慈）在 9浅滩/10沼泽/13大河 → 恒 1 */
      if (unit && unit.hasEffect) {
        if (unit.hasEffect(34)) return 1;
        if (v > 1 && (unit.hasEffect(86) || (unit.pid === 25 && unit.clsId === 41))) v = v - 1;
      }
      if (unit && unit.pid === 6 && (c.tid === 9 || c.tid === 10 || c.tid === 13)) return 1;
      return Math.max(1, v);
    }
    isPassable(x, y) {
      const t = this.terrain(x, y);
      if (!t) return false;
      if (t.impassable) return false;
      const c = this.get(x, y);
      return !c || !c.unit;
    }
    // 1:1 Flood（原版 0x438308，§7.2）：均匀代价逐层扩展
    //   - 4 正交邻接（上右下左）
    //   - 非起点格若处于敌方 ZOC（4 邻有敌方单位）则不可再离开（effect 33 突击移动豁免）
    //   - 敌方单位阻挡（不可进入）；友方单位可穿过（不阻挡）
    //   - 层级内按行主序（先 y 后 x）处理，同层代价相同
    reachable(sx, sy, movePts, unitOrClass) {
      const unit = (typeof unitOrClass === "object" && unitOrClass) ? unitOrClass : null;
      const start = this.get(sx, sy);
      // 起点格本身不可通行（原版：站在自己格上且地形不可通行则无 flood）
      const cost0 = unit ? this.moveCostAt(unit, sx, sy) : 1;
      if (cost0 >= 99) return [];
      const key = (x, y) => x + "," + y;
      const cost = {};
      const inQOC = {};
      cost[key(sx, sy)] = 0;
      const result = {};
      let level = 0;
      let changed = true;
      while (changed) {
        changed = false;
        // 收集当前层所有格（行主序）
        const cur = [];
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
          const k = key(x, y);
          if (cost[k] === level) cur.push([x, y]);
        }
        for (const [cx, cy] of cur) {
          const k = key(cx, cy);
          // ZOC 检查：非起点格处于敌方 ZOC 时不可扩展（除非 effect 33）
          if (cx !== sx || cy !== sy) {
            if (inQOC[k] === undefined) {
              inQOC[k] = this._inZoc(unit, cx, cy) ? 1 : 0;
            }
            if (inQOC[k] && !(unit && unit.hasEffect && unit.hasEffect(33))) continue;
          }
          // 4 正交邻接（上右下左）
          for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
            const nx = cx + dx, ny = cy + dy;
            if (!this.inBounds(nx, ny)) continue;
            const nk = key(nx, ny);
            if (cost[nk] !== undefined) continue;
            const cell = this.get(nx, ny);
            const terr = this.terrain(nx, ny);
            if (!terr || terr.impassable) continue;
            // 敌方单位阻挡
            if (cell && cell.unit && unit && cell.unit.faction !== unit.faction && cell.unit.faction !== "neutral") continue;
            let mc;
            if (unit) {
              mc = this.moveCostAt(unit, nx, ny);
              if (mc >= 99) continue;
            } else {
              mc = Math.max(1, (terr.move || 1));
            }
            const nd = level + mc;
            if (nd > movePts) continue;
            cost[nk] = nd;
            result[nk] = { x: nx, y: ny, cost: nd };
            changed = true;
          }
        }
        // 下一最小层
        let next = Infinity;
        for (const k in cost) { if (cost[k] > level && cost[k] < next) next = cost[k]; }
        if (next === Infinity) break;
        level = next;
      }
      delete result[key(sx, sy)];
      return Object.values(result);
    }
    // 敌方 ZOC（原版 InZOC 0x437d59）：4 邻有敌方单位
    _inZoc(unit, x, y) {
      if (!unit) return false;
      for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
        const c = this.get(x + dx, y + dy);
        if (c && c.unit && c.unit.isAlive && c.unit.faction !== unit.faction && c.unit.faction !== "neutral") return true;
      }
      return false;
    }
    /* 逐格路径（原版行走按格移动：0x4574xx 走位逐格推进，每格约 4 tick = 160ms）。
     * 用 Dijkstra 记录前驱，回溯出从 (sx,sy) 到 (tx,ty) 的格子序列（不含起点，含终点）。
     * 通行/代价规则与 reachable 完全一致，保证路径一定落在移动范围内。
     * 返回 null 表示不可达。 */
    pathTo(sx, sy, tx, ty, movePts, unit) {
      if (sx === tx && sy === ty) return [];
      const key = (x, y) => x + "," + y;
      const ds = { [key(sx, sy)]: 0 };
      const prev = {};
      const done = {};
      const open = [[0, sx, sy]];
      while (open.length) {
        // 取最小代价（格子数不大，线性扫描足够）
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
        const [d, x, y] = open.splice(bi, 1)[0];
        const k = key(x, y);
        if (done[k]) continue;
        done[k] = true;
        if (x === tx && y === ty) break;
        for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
          const nx = x + dx, ny = y + dy;
          if (!this.inBounds(nx, ny)) continue;
          const nk = key(nx, ny);
          if (done[nk]) continue;
          const cell = this.get(nx, ny);
          const terr = this.terrain(nx, ny);
          if (!terr || terr.impassable) continue;
          if (cell && cell.unit && unit && cell.unit !== unit &&
              cell.unit.faction !== unit.faction && cell.unit.faction !== "neutral") continue;
          // 非终点格处于敌方 ZOC 时不可穿越（与 reachable 同规则）
          if (!(nx === tx && ny === ty) && (nx !== sx || ny !== sy)) {
            if (this._inZoc(unit, nx, ny) && !(unit && unit.hasEffect && unit.hasEffect(33))) continue;
          }
          let mc = 1;
          if (unit) { mc = this.moveCostAt(unit, nx, ny); if (mc >= 99) continue; }
          const nd = d + mc;
          if (nd > movePts) continue;
          if (ds[nk] === undefined || nd < ds[nk]) {
            ds[nk] = nd; prev[nk] = [x, y];
            open.push([nd, nx, ny]);
          }
        }
      }
      if (ds[key(tx, ty)] === undefined) return null;
      const out = [];
      let cx = tx, cy = ty;
      while (!(cx === sx && cy === sy)) {
        out.push({ x: cx, y: cy });
        const pv = prev[key(cx, cy)];
        if (!pv) return null;
        cx = pv[0]; cy = pv[1];
      }
      return out.reverse();
    }
    // 获取路径
    path(sx, sy, tx, ty, movePts, unitClass) {
      const reach = this.reachable(sx, sy, movePts, unitClass);
      const target = reach.find(r => r.x === tx && r.y === ty);
      return target || null;
    }
    // 范围内所有格（切比雪夫）
    range(x, y, r) {
      const out = [];
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) <= r && this.inBounds(x+dx, y+dy)) {
            out.push({ x: x+dx, y: y+dy, dist: U.chebyshev(x,y,x+dx,y+dy) });
          }
        }
      return out;
    }
    // 曼哈顿距离环（用于移动后攻击范围）
    rangeManhattan(x, y, r) {
      const out = [];
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) {
          if (U.manhattan(0,0,dx,dy) <= r && this.inBounds(x+dx, y+dy)) {
            out.push({ x: x+dx, y: y+dy });
          }
        }
      return out;
    }
  }

  // ---------- 单位 ----------
  let UID_SEQ = 0;
  class Unit {
    constructor(def, x, y, faction) {
      this.id = "unit_" + (++UID_SEQ);
      this.def = def; // 单位定义 {name, class, stats, skills, weapon, ...}
      this.x = x; this.y = y;
      this.faction = faction; // ally | enemy | neutral
      // 优先引用原版角色表（JW_ROLESTORE）的五维数值
      const R = (typeof window !== "undefined" && window.JW_REAL) || null;
      if (R && def.class === "real") {
        // —— 1:1 真实分支：数值全部来自原版 persons/classes/families ——
        const c = R.classes[def.clsId] || R.classes[0];
        const lvl2 = def.level || 1;
        this.lvl = lvl2;
        this.cls = { move: def.clsMove, growth: {}, weapon: null, armor: null, range: def.realRange };
        this.maxHp = def.maxHp;
        this.maxMp = def.maxMp;
        this.unitDef = def;              // 单位定义（名字/兵种/形象索引等）
        /* 装备槽与等级必须先就位：equipStatBonus 依赖它们 */
        this.weapon = def.weapon;
        this.armor = def.armor;
        this.acc = def.acc;
        // 装备等级/经验（原版 0x40c674）
        this.weaponLv = def.weaponLv || 1;
        this.weaponExp = def.weaponExp || 0;
        this.armorLv = def.armorLv || 1;
        this.armorExp = def.armorExp || 0;
        /* 装备加成按 1.2 的属性映射分派（计略/法术系武器加精神，重甲加防御等） */
        this.atk = def.stats.atk + this.equipStatBonus(0);
        this.def = def.stats.def + this.equipStatBonus(1);
        this.mag = def.stats.mag + this.equipStatBonus(2);
        this.spd = def.stats.spd + this.equipStatBonus(3);
        this.hit = def.stats.hit + this.equipStatBonus(4);
        this.mov = def.clsMove + this.equipStatBonus(7);
        /* 5=HP 6=MP：饰品/宝物按映射直接加上限（0x407c0e） */
        this.maxHp += this.equipStatBonus(5);
        this.maxMp += this.equipStatBonus(6);
        this.exp = 0;
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.skills = def.skills ? [...def.skills] : [];
        this.range = def.realRange || [1, 1];
        this.rangeCode = def.rangeCode != null ? def.rangeCode : 1;   // 射程码（rules.js §6.1）
        this.moveCost = def.moveCost || [];
        this.avoidTerr = def.avoidTerr || [];
        this.terrEffect = def.terrEffect || [];
        this.fam = def.fam !== undefined ? def.fam : R.familyOf(def.clsId || 0);
        this.clsId = def.clsId != null ? def.clsId : (R ? R.familyOf(def.clsId) : 0);
        // 升级成长：原版 class.growth[0..4] 与 hpGrow/mpGrow
        const cg = R && R.classes ? R.classes[this.clsId] : null;
        this._raw = def.raw || null;                 // 原始能力(0..100)，决定升级成长等级
        this._growth = cg ? (cg.growth || [0,0,0,0,0]) : [0,0,0,0,0];
        this._hpGrow = cg ? (cg.hpGrow || 0) : 0;
        this._mpGrow = cg ? (cg.mpGrow || 0) : 0;
        this.pid = def.pid;
        this.spriteIdx = def.spriteIdx != null ? def.spriteIdx : null;
        this.faceIdx = def.faceIdx != null ? def.faceIdx : (def.pid != null && window.JW_GAME && window.JW_GAME.persons[def.pid] ? window.JW_GAME.persons[def.pid].face : null);
        this.hasActed = false;
        this.hasMoved = false;
        this.status = {};
        this.dir = 2; // 0=上 1=右 2=下 3=左
        /* 原版单位 state：0 未出现、1 场外待命、2 在场上、3 已撤退。
         * CountUnits(0x44c8e6) 与 unit_reenter(0x55) 都以 state 为准，不是 hp。 */
        /* 原版部署表 hidden 位：初始不出场（state 1 = 已创建但未放置，
         * 等 op 0x4c 现身时才是 state 2）。 */
        this.state = def.hidden ? 1 : 2;
        /* 部署条目原坐标（op 0x4c 现身时按它落位） */
        this.deployX = def.deployX != null ? def.deployX : this.x;
        this.deployY = def.deployY != null ? def.deployY : this.y;
        if (this.state === 1) { this.x = -1; this.y = -1; }
        this.ai = def.ai || "normal";
        this.aiParam = def.aiParam != null ? def.aiParam : (typeof def.ai === "string" ? parseInt(def.ai.replace(/\D/g, "")) || 1 : 1);
        // 原版 AI 附加参数：3/5 → 追击人物；4/6 → 目标坐标
        this.aiPid = def.aiPid != null ? def.aiPid : null;
        /* 原版单位 flags bit1 = kind3（0x449b7b）：CountUnits 的 side 3/5 依赖它 */
        this.kind3 = !!def.kind3;
        this.aiX = def.aiX != null ? def.aiX : null;
        this.aiY = def.aiY != null ? def.aiY : null;
        this.leader = def.leader || false;
        this.portrait = def.portrait || null;
        this.name = def.name || "无名";
        // 保存初始位置（用于取消移动）
        this.initialX = x; this.initialY = y;
        // 行囊（消耗品 id 数组，0xff 结束）
        this.bag = def.bag ? [...def.bag] : [];   // 原版：道具在单位包里，不带初始白送
        return;
      }
      const role = (typeof window !== "undefined" && window.JW_ROLESTORE && window.JW_ROLESTORE[def.name]) || null;
      const rStats = (role && role.stats) || {};
      const cls = D.CLASSES[def.class || (role && role.class) || "infantry"] || D.CLASSES.infantry;
      this.cls = cls;
      const lvl = def.level || 1;
      const grow = cls.growth || {};
      const stat = (k) => def.stats?.[k] ?? rStats[k] ?? cls[k];
      this.maxHp = Math.round(stat("hp") + grow.hp * (lvl - 1));
      this.maxMp = Math.round(stat("mp") + 3 * (lvl - 1));
      this.atk = Math.round(stat("atk") + grow.atk * (lvl - 1));
      this.def = Math.round(stat("def") + grow.def * (lvl - 1));
      this.spd = Math.round(stat("spd") + grow.spd * (lvl - 1));
      this.mag = Math.round(stat("mag") + grow.mag * (lvl - 1));
      this.hit = def.stats?.hit ?? rStats.hit ?? cls.hit;
      this.mov = cls.move;
      this.lvl = lvl;
      this.exp = 0;
      this.hp = this.maxHp;
      this.mp = Math.round(this.maxMp * 0.8);
      this.skills = def.skills ? [...def.skills] : [];
      // 装备
      this.weapon = def.weapon || cls.weapon;
      this.armor = def.armor || cls.armor;
      this.range = cls.range || [1, 1];
      // 状态
      this.hasActed = false;
      this.hasMoved = false;
      this.status = {}; // {atk:+n, def:+n, spd:+n, duration:n, poison:true, ...}
      this.ai = def.ai || "normal";
      this.leader = def.leader || false;
      this.portrait = def.portrait || null;
      this.name = def.name || "无名";
    }
    get effectiveAtk() { return this.atk + (this.status.atk || 0) + (this.weaponBonus?.atk || 0); }
    get effectiveDef() { const arm = D.ARMORS[this.armor] || D.ARMORS.cloth; return this.def + arm.def + (this.status.def || 0); }
    get effectiveSpd() { return this.spd + (this.status.spd || 0) + (this.weaponBonus?.spd || 0); }
    get effectiveMov() { return this.mov + (this.status.mov || 0); }
    get weaponBonus() { const w = D.NAMED_WEAPONS[this.weapon]; return w ? (w.bonus || {}) : {}; }
    get isAlive() { return this.hp > 0; }
    get isParalyzed() { return !!this.status.paralyzed; }
    get isSleeping() { return !!this.status.sleep; }
    get isConfused() { return !!this.status.confused; }
    get isTaunted() { return !!this.status.taunt; }
    get isCharmed() { return !!this.status.charm; }
    damage(n) { this.hp = U.clamp(this.hp - n, 0, this.maxHp); }
    heal(n) { this.hp = U.clamp(this.hp + n, 0, this.maxHp); }
    costMp(n) { this.mp = Math.max(0, this.mp - n); }
    // 装备加成：base + grow × 等级（1:1 原版道具表，type≤25=武器加攻击/其它加防御）
    // 装备等级值（0x40c674）：v = base; repeat (lvl-1): v = min(v+growth, 255)
    equipValue(itemId) {
      const R = window.JW_REAL;
      const it = R && R.items ? R.items[itemId] : null;
      if (!it) return 0;
      const base = it.base || 0;
      const grow = it.grow || 0;
      const lv = this.weaponLv && itemId === this.weapon ? this.weaponLv
               : this.armorLv && itemId === this.armor ? this.armorLv : 1;
      let v = base;
      for (let i = 1; i < lv; i++) v = Math.min(v + grow, 255);
      return v;
    }
    /* 1:1 mod 版属性映射 —— 从 Ekd5.exe 反汇编实测（0x4067d0 / 0x40678e / 0x407c0e），
     * 与基版曹操传文档（§1.2 基版编号）不同：
     *   stat_of_type：type<26 → kind=type>>1 查表 [0,0,0,0,0,0,0,2,2,10,1,1,1]
     *     剑0 矛2 弓4 刀6 炮8 戟10 斧12 → 攻击；扇14 木剑16 → 精神；
     *     银剑18 → 不加成(10)；铠甲20 衣服22 文官袍24 → 防御
     *   type 32..40 → 饰品直接加属性 [0,1,2,3,4,5,6,8,7]（攻/防/精/反/士/HP/MP/经验/移动）
     *   stat_of_special：special 32..40 → 同上表（mod 把基版 24..32 整体 +8 平移）
     *   数值来源：宝物→sval（0x4078eb + 0x420119 等级缩放）；饰品→base（0x41dd72）。
     * stat 索引：0攻 1防 2精神 3反应 4士气 5HP 6MP 7移动 8经验。 */
    static KIND_STAT = [0, 0, 0, 0, 0, 0, 0, 2, 2, 10, 1, 1, 1];
    static ACC_STAT = [0, 1, 2, 3, 4, 5, 6, 8, 7];
    static statOfTypeMod(t) {
      t &= 0xff;
      if (t < 26) return Unit.KIND_STAT[t >> 1];   // 10 = 银剑类：攻/精双加
      if (t >= 32 && t <= 40) return Unit.ACC_STAT[t - 32];
      return -1;
    }
    /* 0x429ad7 statMatches：kind 表返回 10（白银剑/黄金剑/七星剑等）表示
     * 该装备【同时】计入攻击(0)与精神(2)；其余按精确相等。 */
    static statMatchesType(t, stat) {
      const k = Unit.statOfTypeMod(t);
      if (k === 10) return stat === 0 || stat === 2;
      return k === stat;
    }
    static statOfSpecialMod(sp) {
      if (sp == null) return -1;
      if (sp >= 32 && sp <= 40) return Unit.ACC_STAT[sp - 32];
      return -1;
    }
    /* 宝物效果数值（0x420119）：lvl = 装备等级
     *   special 102/108 → 原值；special 31 → 值×(lvl+1)
     *   lvl<7 → 原值；51 且值==4 → +3；50 → ×2；54/66/70 → +1；其余 → 值×3>>1 */
    /* lvl≥10 覆盖表 0x462364（索引 sp<89 ? sp−26 : sp−44，0xfe=不覆盖），实测 dump */
    static OVERRIDE_L10 = {
      26: 100, 27: 200, 28: 255, 29: 200, 30: 200, 31: 255, 32: 200, 33: 200, 34: 200,
      35: 200, 36: 200, 37: 200, 38: 200, 39: 255, 40: 255, 41: 255, 42: 255, 43: 100,
      44: 255, 45: 255, 46: 255, 47: 100, 48: 255, 49: 255, 50: 10, 51: 2, 53: 100,
      55: 200, 56: 200, 57: 100, 60: 100, 61: 100, 62: 99, 63: 99, 66: 16, 67: 100,
      69: 100, 70: 89, 71: 1, 72: 1
    };
    static treasureValue(sp, sval, lvl) {
      if (sp === 102 || sp === 108) return sval;
      if (sp === 31) return sval * (lvl + 1);
      let v = sval;
      if (lvl >= 7) {
        if (sp === 51 && sval === 4) v = sval + 3;
        else if (sp === 50) v = sval * 2;
        else if (sp === 54 || sp === 66 || sp === 70) v = sval + 1;
        else if (lvl < 10) v = (sval * 3) >> 1;
      }
      if (lvl >= 10) {
        const idx = sp < 89 ? sp - 26 : sp - 44;
        const ov = Unit.OVERRIDE_L10[idx];
        if (ov !== undefined) v = ov;
      }
      return v;
    }
    equipStatBonus(stat) {
      const R = window.JW_REAL;
      if (!R || !R.items) return 0;
      let bonus = 0;
      for (const [slotIdx, itemId] of [[0, this.weapon], [1, this.armor]]) {
        if (itemId == null || itemId === 255 || itemId === 65535) continue;
        const it = R.items[itemId];
        if (!it) continue;
        const lvl = slotIdx === 0 ? (this.weaponLv || 1) : (this.armorLv || 1);
        if (Unit.statMatchesType(it.type, stat)) bonus += this.equipValue(itemId);
        /* 宝物（type 奇数）再按 special→属性映射加一份效果数值（0x407c0e 双分支） */
        if ((it.type & 1) && Unit.statOfSpecialMod(it.special) === stat) {
          bonus += Unit.treasureValue(it.special, it.sval || 0, lvl);
        }
      }
      /* 饰品（0x407c0e 尾段）：type 32..40 → 属性，值取 base（0x41dd72=mem+0x15） */
      const acc = this.acc;
      if (acc != null && acc !== 255 && acc !== 65535) {
        const it = R.items[acc];
        if (it && Unit.statOfTypeMod(it.type) === stat) bonus += it.base || 0;
      }
      return bonus;
    }
    // 装备效果加成（1:1 §1.2 0x40c674：武器/防具按【装备等级】取值 v=base+grow×(lvl-1) ≤255；辅助按 base）
    itemBonus(itemId) {
      if (itemId == null || itemId === 255 || itemId === 65535) return 0;
      const R = (typeof window !== "undefined" && window.JW_REAL) || null;
      const it = R && R.items ? R.items[itemId] : null;
      if (!it) return 0;
      if (it.type >= 26) return it.base || 0; // 辅助/宝物：固定 base
      return this.equipValue(itemId);          // 武器/防具：按装备等级
    }
    // 经验倍率（§8.4 exp_mult 0x4072bd）：装备效果 8（金鈚令）→ 150，否则 100
    /* 经验倍率（§8.4 0x4072bd）：exp_mult = 100 + equip_bonus(stat 8)。
     * mod 里 stat 8（辅助经验）来自 type 39 饰品(base) 或 special 39 宝物(sval)，
     * 本 mod 数据无此类装备 → 恒 100；金鈚令(基版 special 8) 在本 mod 未出现。 */
    expMult() {
      return 100 + this.equipStatBonus(8);
    }
    // 装备经验（1:1 §8.4 0x4082d6）：threshold=100(+50 秘宝)(+100 秘宝 Lv9)；max=秘宝?10:3；Lv≥9 每次只 +1
    gainEquipExp(slot, amount) {
      const itemId = slot === "weapon" ? this.weapon : this.armor;
      if (itemId == null || itemId === 255 || itemId === 65535) return false;
      const R = (typeof window !== "undefined" && window.JW_REAL) || null;
      const it = R && R.items ? R.items[itemId] : null;
      if (!it) return false;
      const treasure = it.uniq === 1;
      let lv = (slot === "weapon" ? this.weaponLv : this.armorLv) || 1;
      let exp = (slot === "weapon" ? this.weaponExp : this.armorExp) || 0;
      const maxLevel = treasure ? 10 : 3;
      if (lv >= 9) amount = Math.min(amount, 1);
      exp += amount;
      let leveled = false;
      let guard = 0;
      while (guard++ < 12) {
        const threshold = 100 + (treasure ? 50 : 0) + (treasure && lv >= 9 ? 100 : 0);
        if (exp < threshold || lv >= maxLevel) break;
        exp -= threshold; lv++; leveled = true;
      }
      if (lv >= maxLevel) exp = 255;
      if (slot === "weapon") {
        const oldAtk = this.atk;
        this.weaponLv = lv; this.weaponExp = exp;
        this.atk = this.unitDef ? (this.unitDef.stats.atk + this.itemBonus(this.weapon)) : (this.atk + (leveled ? (it.grow || 0) : 0));
      } else {
        const oldDef = this.def;
        this.armorLv = lv; this.armorExp = exp;
        this.def = this.unitDef ? (this.unitDef.stats.def + this.itemBonus(this.armor)) : (this.def + (leveled ? (it.grow || 0) : 0));
      }
      return leveled;
    }
    addStatus(k, v) { this.status[k] = v; }
    // 原版 buff 等级字节 unit[+0x18..+0x1d]（atk,def,spirit,agility,morale,move；3 = 中性）
    // 0x4d unit_change 把 0/1/2 映射为 0/3/6 写入（0x41538f..0x4153cd）；
    // 战斗属性 getter（0x43f54c）：等级 ≥4 → ×120/100，≤2 → ×80/100，3 = 原值，钳 9999。
    setBuffLevel(idx, level) {
      if (!this.buffs) this.buffs = [3, 3, 3, 3, 3, 3];
      if (idx >= 0 && idx < 6) this.buffs[idx] = level & 0xff;
    }
    buffMul(idx) {
      const b = this.buffs ? this.buffs[idx] : 3;
      return b >= 4 ? 1.2 : (b <= 2 ? 0.8 : 1);
    }
    statBuffed(idx, base) { return Math.min(Math.floor(base * this.buffMul(idx)), 9999); }
    // 原版异常位 unit[+0x1e]（0x45aace）：值 &0x80 → 清除其余位（0x418da0），否则置位（0x40339e）
    applyAilment(v) {
      const clear = (v & 0x80) !== 0;
      const mask = v & 0x7f;
      const bits = { 0x02: "paralyzed", 0x04: "sealed", 0x08: "confused", 0x10: "poison", 0x20: "fear", 0x40: "lost" };
      for (const [b, name] of Object.entries(bits)) {
        if (mask & parseInt(b, 16)) { if (clear) delete this.status[name]; else this.status[name] = true; }
      }
    }
    get bAtk() { return this.statBuffed(0, this.atk); }
    get bDef() { return this.statBuffed(1, this.def); }
    get bMag() { return this.statBuffed(2, this.mag); }
    get bSpd() { return this.statBuffed(3, this.spd); }
    get bHit() { return this.statBuffed(4, this.hit); }
    // 清除全部异常位（原版 0x55af00 逐位清 0x02/0x04/0x08/0x10/0x20/0x40）
    clearAilments() {
      for (const k of ["paralyzed", "sealed", "confused", "poison", "fear", "lost"]) delete this.status[k];
    }
    // 原版状态位（rules_ref §686-691）：0x02麻 0x04穷 0x08乱 0x10毒 0x20怯 0x40迷
    get statusBits() {
      let b = 0;
      if (this.status.paralyzed) b |= 0x02;
      if (this.status.sealed || this.status.poor) b |= 0x04;
      if (this.status.confused) b |= 0x08;
      if (this.status.poison) b |= 0x10;
      if (this.status.fear) b |= 0x20;
      if (this.status.lost || this.status.charm) b |= 0x40;
      return b;
    }
    hasStatusBit(bit) { return (this.statusBits & bit) !== 0; }
    clearStatusBits(mask) {
      const bits = { 0x02:"paralyzed", 0x04:["sealed","poor"], 0x08:"confused", 0x10:"poison", 0x20:"fear", 0x40:["lost","charm"] };
      for (const [b, names] of Object.entries(bits)) {
        const v = parseInt(b, 16);
        if ((mask & v) && (Array.isArray(names) ? names.some(n => this.status[n]) : this.status[names])) {
          if (Array.isArray(names)) names.forEach(n => delete this.status[n]);
          else delete this.status[names];
        }
      }
    }
    // 吃果（0x41dc43）：能力 ≤100 时 +1
    eatFruit(stat) {
      const caps = { atk: 100, mag: 100, spd: 100, def: 100, hit: 100 };
      if (this[stat] >= caps[stat]) return { ok: false, msg: "该项能力已经达到100，不能再提升了。" };
      this[stat] = Math.min(this[stat] + 1, caps[stat]);
      return { ok: true, msg: `${this.name} 的${stat}提升至${this[stat]}！` };
    }
    // 升兵种（印绶）：HP/MP base + 2×旧class growth
    promoteClass(newClsId) {
      const R = window.JW_REAL;
      const oldCls = R.classes[this.clsId] || R.classes[0];
      const newCls = R.classes[newClsId] || R.classes[0];
      /* 1:1 原版 FUN_0041d430 印绶门槛：下一阶需要 (当前cls%3+1)*20 级（20/40），
       * 不查 class 表 promoteLevel（游戏数据里多数类缺该字段，旧写法报 undefined）。 */
      const needLv = (this.clsId % 3 + 1) * 20;
      if (this.lvl < needLv) {
        return { ok: false, msg: `下一个兵种需要等级${needLv}以上。` };
      }
      // HP/MP base + 2×旧class growth
      this.maxHp += 2 * (oldCls.hpGrow || 0);
      this.maxMp += 2 * (oldCls.mpGrow || 0);
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.clsId = newClsId;
      this.fam = R.familyOf(newClsId);
      this.rangeCode = R.rangeCodeOf(newCls.rangeShape);
      this.mov = newCls.move;
      this._growth = newCls.growth || [0,0,0,0,0];
      this._hpGrow = newCls.hpGrow || 0;
      this._mpGrow = newCls.mpGrow || 0;
      // 习得新class策略
      const learned = [];
      for (const st of R.strategies) {
        const need = st.learn && st.learn[newClsId];
        if (need === this.lvl) {
          const key = "r" + st.id;
          if (!this.skills.includes(key)) { this.skills.push(key); learned.push(st.name); }
        }
      }
      return { ok: true, msg: `${this.name} 的兵种提升为${newCls.name}！`, learned };
    }

    // 效果查询：1:1 原版 has_effect 0x407a09（武器/防具 treasure type 奇数 && special==id；饰品 type==id）
    _itemSlots() {
      return [this.weapon, this.armor, this.acc, this.acces, this.accessory].filter(v => v != null && v !== 255 && v !== 65535);
    }
    hasEffect(effectId) {
      const R = (typeof window !== "undefined" && window.JW_REAL) || null;
      const items = R && R.items ? R.items : {};
      for (const slot of this._itemSlots()) {
        const it = items[slot];
        if (!it) continue;
        const t = it.type, sp = it.special;
        if (t >= 26) { if (t === effectId) return true; }        // 饰品 type==id（mod category 26..）
        else { if ((t & 1) && sp === effectId) return true; }     // 武器/防具 treasure 且 special==id
      }
      return false;
    }
    effectValue(effectId) {
      const R = (typeof window !== "undefined" && window.JW_REAL) || null;
      const items = R && R.items ? R.items : {};
      for (const slot of this._itemSlots()) {
        const it = items[slot];
        if (!it) continue;
        const t = it.type, sp = it.special;
        if (t < 26) {
          /* 宝物（type 奇数）→ sval（0x4078eb），按 0x420119 等级缩放 */
          if ((t & 1) && sp === effectId) {
            const lvl = slot === this.weapon ? (this.weaponLv || 1) : (this.armorLv || 1);
            return Unit.treasureValue(sp, it.sval || 0, lvl);
          }
        } else {
          /* 饰品 type==id → base（0x41dd72） */
          if (t === effectId) return it.base || 0;
        }
      }
      return 0;
    }
    /* 策略列表：本兵种已学；带「策略模仿」（兵法二十四篇 type=108）时，另加
     * 施法者【上下左右 4 格】任意阵营单位已学的策略（按原版策略 id 排序）。
     * 注：旧实现误用 hasEffect(51)，但 51 实测为「致命一击」（会心必定），已改为 108。 */
    availableSkills(battle) {
      const ids = new Set((this.unitDef && this.unitDef.realSkillIds) || []);
      if (this.hasEffect && this.hasEffect(108) && battle) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const o = battle.unitAt ? battle.unitAt(this.x + dx, this.y + dy) : null;
          if (o && o.isAlive && o.unitDef && o.unitDef.realSkillIds) {
            for (const sid of o.unitDef.realSkillIds) ids.add(sid);
          }
        }
      }
      return [...ids].sort((a, b) => a - b).map(sid => "r" + sid);
    }
    tickStatus() {
      for (const k of Object.keys(this.status)) {
        const s = this.status[k];
        if (typeof s === "object" && s.duration) { s.duration--; if (s.duration <= 0) delete this.status[k]; }
      }
    }
    resetTurn() { this.hasActed = false; this.hasMoved = false; this._removed = false; }
    /* 升级（§2.1, LevelUp 0x4073b9）
     * 每级成长不是直接用兵种 growth，而是 grade=(能力等级(原始能力)+抖动后的growth)>>1：
     *   grade_of(raw): ≥100→5, ≥90→4, ≥80→3, ≥70→2, ≥60→1, 否则 0（不抖动时 <80 记 2）
     *   jitter(g): 两次 50% 判定 —— 命中则 +1，再命中则 -2（无符号，最低按 0 处理）
     *   成员且无“培养加成计数”时才抖动；g==0 时按 1 计
     * HP/MP 直接加兵种 hpGrow/mpGrow（不参与等级折算）。 */
    _abilityGrade(raw, jittered) {
      if (raw >= 100) return 5;
      if (raw >= 90) return 4;
      if (raw >= 80) return 3;
      if (raw >= 70) return 2;
      if (raw >= 60) return 1;
      return jittered ? 0 : 2;
    }
    _jitterGrowth(g) {
      let v = g | 0;
      if (Math.random() < 0.5) v += 1;
      if (Math.random() < 0.5) v -= 2;
      return v < 0 ? 0 : v;
    }
    levelUp() {
      const growth = this._growth || [0, 0, 0, 0, 0];
      const raw = this._raw || null;
      const names = ["atk", "def", "mag", "spd", "hit"];
      const gains = {};
      for (let i = 0; i < 5; i++) {
        const j = this._jitterGrowth(growth[i] || 0);
        const grade = raw ? this._abilityGrade(raw[i] | 0, true) : 0;
        let g = (grade + j) >> 1;
        if (g === 0) g = 1;                       // 原版：主能力每次至少 +1
        const old = this[names[i]] || 0;
        const ng = Math.min(old + g, 9999);
        this[names[i]] = ng;
        gains[names[i]] = ng - old;
      }
      const nhp = Math.min(this.maxHp + (this._hpGrow || 0), 9999);
      const nmp = Math.min(this.maxMp + (this._mpGrow || 0), 255);
      this.hp = Math.min(this.hp + (nhp - this.maxHp), nhp);
      this.mp = Math.min(this.mp + (nmp - this.maxMp), nmp);
      this.maxHp = nhp; this.maxMp = nmp;
      this.lvl = (this.lvl || 1) + 1;
      // 习得策略（learn[clsId] == 新等级）
      const R = window.JW_REAL;
      const learnedNew = [];
      if (R && R.strategies && this.clsId != null) {
        for (const st of R.strategies) {
          const need = st.learn && st.learn[this.clsId];
          if (need === this.lvl) {
            const key = "r" + st.id;
            if (!this.skills.includes(key)) { this.skills.push(key); learnedNew.push(st.name); }
          }
        }
      }
      return { lvl: this.lvl, gains, learnedNew };
    }
    // 经验（§8.3）：累计满 100 升级；≥70 不再获取
    gainExp(n) {
      if (this.lvl >= 70) { this.exp = 255; return null; }
      this.exp = (this.exp || 0) + n;
      let last = null;
      while (this.exp >= 100 && this.lvl < 70) {
        this.exp -= 100;
        last = this.levelUp();
      }
      if (this.lvl >= 70) this.exp = 255;
      return last;
    }
    // 物理攻击经验（§8.1）
    expFromAttack(target, kill) {
      const La = this.lvl || 1, Lt = target.lvl || 1;
      let e;
      if (kill) e = La < Lt ? Math.min((Lt - La) * 8 + 32, 200) : Math.max(Math.max(32 - (La - Lt) * 4, 0), 10);
      else e = La < Lt ? Math.min((Lt - La) * 2 + 8, 100) : Math.max(Math.max(8 - (La - Lt), 0), 1);
      if (target.leader) e *= 2;
      return Math.floor(e);
    }
    // 策略经验（§8.2）
    expFromStrategy(target, kill, isEnemyDmg) {
      const La = this.lvl || 1, Lt = target.lvl || 1;
      let e;
      if (isEnemyDmg) {
        if (kill) e = La < Lt ? Math.min((Lt - La) * 8 + 32, 200) : Math.max(Math.max(32 - (La - Lt) * 4, 0), 10);
        else e = La < Lt ? Math.min((Lt - La) * 4 + 10, 100) : Math.max(Math.max(10 - Math.floor((La - Lt) / 2), 0), 5);
      } else {
        e = La < Lt ? Math.min((Lt - La) * 4 + 10, 100) : Math.max(Math.max(10 - Math.floor((La - Lt) / 2), 0), 5);
      }
      if (target.leader && isEnemyDmg) e *= 2;
      return Math.floor(e);
    }
  }

  // ---------- 战斗管理器 ----------
  class Battle {
    constructor(chapter, battleIndex) {
      this.chapter = chapter;
      this.index = battleIndex;
      this.config = chapter.battles[battleIndex];
      this.units = [];
      this.round = 1;
      this.phase = "deploy"; // deploy | player | enemy | anim | end
      this.weather = 0;          // 0晴 1阴 2雨 3暴雨 4雪
      this.weatherClimate = 0;
      this.battleEvents = [];
      this._eventTriggered = new Set();
      // 原版战斗脚本事件层（eex_parsed 提取，1:1）
      this.script = null;
      this._scriptDone = new Set();
      this._scriptFlags = {};
      this.forceWin = null;
      this.log = [];
      this.state = "playing";
      this.turnQueue = [];
      this.onEvent = null; // 回调: (evt) => {}
      /* 兵种出手计数表（DAT_00508ec5，2026-11-04 实证）：FUN_00405de1 每攻击段尾部
       * 对目标兵种计数 +1（0xff 饱和、初始全 0）；FUN_00478f08 用它计算效果 107 追伤。 */
      this._clsAtkCount = {};
    }

    /* FUN_00405de1 尾段：目标兵种出手计数 +1（*pc != -1 时 ++，字节饱和 254） */
    _bumpClsAtkCount(clsId) {
      const k = clsId & 0xff;
      const cur = this._clsAtkCount[k] || 0;
      if (cur !== 0xff) this._clsAtkCount[k] = cur + 1;
    }

    /* FUN_00478f08（追伤，2026-11-04 实证）：攻击者持 FUN_004cf398(u,0x2c,0x6b,1,0)
     * → key=0x6b(107) 黄龙升天刀（sval=10）→ dmg += dmg × v107 × 计数表[目标兵种] / 100。
     * 仅普通攻击（param_3==0）时由 FUN_0043bc62 调用；反击/特殊攻击不追加。 */
    _chargeFollowupDmg(attacker, defender, dmg) {
      if (!attacker.hasEffect || !attacker.hasEffect(107)) return 0;
      const v = attacker.effectValue(107);
      if (!v) return 0;
      const cnt = this._clsAtkCount[defender.clsId & 0xff] || 0;
      if (!cnt) return 0;
      return Math.floor(dmg * (v * cnt) / 100);
    }

    init() {
      let cfg = this.config;
      // 1:1 真实数据：{src:"S_NN"} 引用 → 解析自原版 EEX/Hexzmap
      if (cfg && cfg.src && window.JW_REAL) {
        const real = window.JW_REAL.realBattle(cfg.src, this.index);
        if (real) {
          cfg = Object.assign({}, cfg, real);
          this.realData = real;
          if (real.maxRounds) this.maxRounds = real.maxRounds;
          if (real.objective) this.objective = real.objective;
        }
      }
      this.map = new GameMap(cfg.width, cfg.height);
      // 加载战场事件
      this.loadBattleEvents(cfg);
      // 原版战斗脚本事件层
      this.script = (window.JW_BATTLE_EVENTS || {})[cfg.src] || null;
      // EEX 结构化剧情层（1:1 §4 模型）： scenes[sections{conds,body}]，见 pollEexEvents
      this._eexFile = cfg.src || null;
      this._eexScene = 0;
      this._eexNext = false;
      this._lastIf = 1;
      this._scriptDone = new Set();
      this._scriptFlags = {};
      this.forceWin = null;
      if (this.script && this.script.intro && this.script.intro.length) {
        setTimeout(() => this.runIntroEvents(), 600);
      }
      // 填充地形：grid 元素为数字地形 id（原版）或字符串 key（旧）
      for (let y = 0; y < cfg.height; y++)
        for (let x = 0; x < cfg.width; x++) {
          const v = gridAt(cfg.grid, x, y);
          const terr = (typeof v === "number") ? ("t" + v) : (v || "plain");
          this.map.set(x, y, { terrain: terr, tid: v, unit: null, meta: null });
        }
      // 放置单位
      for (const u of cfg.units) {
        const unit = new Unit(u.def, u.x, u.y, u.faction);
        this.units.push(unit);
        /* hidden 单位（state 1，初始不出场）不占用网格，等 op 0x4c 现身时才落位 */
        if (unit.state === 2) {
          const cell = this.map.get(unit.x, unit.y);
          if (cell) cell.unit = unit;
        }
      }
      this.allies = this.units.filter(u => u.faction === "ally");
      this.friends = this.units.filter(u => u.faction === "friend");
      this.enemies = this.units.filter(u => u.faction === "enemy");
      // 我方阵营（含友军）供胜负/敌军目标判定
      this.sideUnits = this.allies.concat(this.friends);
      this.curIndex = 0;
      // 战前准备（原版 battle_prepare）：有可操作我方单位时先进部署阶段
      const deployable = this.units.filter(u => u.faction === "ally");
      this.phase = deployable.length ? "deploy" : "player";
      this._deploySel = null;   // 部署中选中的单位
      if (this.phase === "deploy") this.logEntry("战前准备 —— 调整我方部署后开战");
      else this.logEntry(`第 ${this.round} 回合 —— 敌军 ${this.enemies.length} 名`);
    }

    // ---- 战前准备（部署）----
    // 原版：选中我方单位后可在初始阵位附近（3 格内空地）调整站位
    deployRange(u) {
      // 原版：初始阵位附近 3 步内空地可重排
      const cells = this.map.reachable(u.x, u.y, 3, u);
      return Object.values(cells).filter(c => {
        const t = this.map.get(c.x, c.y);
        return !t || !t.unit || t.unit === u;
      });
    }
    deploySelect(u) {
      if (this.phase !== "deploy" || !u || u.faction !== "ally") return false;
      this._deploySel = u;
      return true;
    }
    deployMove(u, x, y) {
      if (this.phase !== "deploy" || !u || u.faction !== "ally") return false;
      const ok = this.deployRange(u).some(c => c.x === x && c.y === y);
      if (!ok) return false;
      const oc = this.map.get(u.x, u.y);
      if (oc && oc.unit === u) oc.unit = null;
      const nc = this.map.get(x, y);
      nc.unit = u;
      u.x = x; u.y = y;
      this._deploySel = null;
      return true;
    }
    deployDone() {
      if (this.phase !== "deploy") return false;
      this.phase = "player";
      this._deploySel = null;
      this.logEntry(`第 ${this.round} 回合 —— 敌军 ${this.enemies.length} 名`);
      return true;
    }

    // ---- 事件/日志 ----
    logEntry(msg, type) {
      const e = { turn: this.round, msg, type: type || "sys", t: Date.now() };
      this.log.push(e);
      if (this.onEvent) this.onEvent({ type: "log", entry: e });
    }

    // ---- 回合管理 ----
    nextRound() {
      this.round++;
      if (this.clickedUnits) this.clickedUnits.clear();
      // 天气随机更新（第2回合起，0x44efd9）
      if (this.round > 1) this.updateWeather();
      // 暗杀标记递减
      this.tickAssassinationMarks();
      // 我方阶段开始恢复（地形回血+状态恢复）
      this.phaseStartRecovery(this.units.filter(u => u.isAlive && u.faction !== "enemy"));
      // 回合开始事件
      this.checkBattleEvents("turn_start");
      // 毒伤（§689）：phase 开始 HP -= MaxHP/5（玩家/友军与 person≥210 无名敌）或 /10（有名敌）
      // 1:1 原版：毒不致死（扣血后至少留 1 HP，不触发 checkDeath）。
      for (const u of this.units) {
        if (u.isAlive && u.status.poison) {
          // 有名敌(person<210) → /10；玩家/友军及无名敌(person≥210) → /5
          const isNamedEnemy = u.faction === "enemy" && u.pid != null && u.pid < 210;
          const dmg = Math.max(1, Math.floor(u.maxHp / (isNamedEnemy ? 10 : 5)));
          u.hp = Math.max(1, u.hp - dmg);
          if (this.onEvent) this.onEvent({ type: "hit", attacker: "poison", target: u.id, dmg, crit: false, hp: u.hp, maxHp: u.maxHp });
          // 毒伤不致死：不掉到 0，不 checkDeath
        }
      }
      // 各单位重置 + 状态 tick
      for (const u of this.units) { u.resetTurn(); u.tickStatus(); }
      // 地形回血（据点）
      for (const u of this.units) {
        if (u.isAlive) {
          const t = this.map.terrain(u.x, u.y);
          if (t && t.hpRegen > 0) { u.heal(t.hpRegen); }
        }
      }
      this.logEntry(`第 ${this.round} 回合`);
      // 重新排序行动：按 spd 降序（我方）
      this.allies = this.units.filter(u => u.faction === "ally" && u.isAlive);
      this.friends = this.units.filter(u => u.faction === "friend" && u.isAlive);
      this.enemies = this.units.filter(u => u.faction === "enemy" && u.isAlive);
      this.sideUnits = this.allies.concat(this.friends);
      this.curIndex = 0;
    }

    // ---- 移动范围 ----
    moveRange(unit) {
      if (unit.hasActed || unit.hasMoved) return [];
      if (unit.isParalyzed || unit.isSleeping) return [];
      return this.map.reachable(unit.x, unit.y, unit.effectiveMov, unit);
    }

    // ---- 攻击范围（16 码形状，§6.1）----
    // 状态位 0x20（绝招中）→ 码 11 不能攻击（原版 0x43f8be）
    rangeCodeOf(unit) {
      if (unit.status && unit.status.blockAttack) return 11;
      /* 注：0x43f7c3 为地形防御系数函数（浅滩9/沼泽10→11、雪原7/大河13→12 为其防御值），
       * 并非射程逻辑——射程不受地形影响。 */
      /* 射程形状覆盖（0x43f8e8 反汇编实测）：
       *   42 远距攻击 → 形状码 10（全图，且最小射程设 1）
       *   43 → 形状码 6（曼哈顿 1..2）
       *   44 → 形状码 12（曼哈顿 1..3） */
      if (unit.hasEffect) {
        if (unit.hasEffect(42)) return 10;
        if (unit.hasEffect(43)) return 6;
        if (unit.hasEffect(44)) return 12;
      }
      if (unit.rangeCode != null) return unit.rangeCode;
      return 1;
    }
    attackRange(unit, x, y) {
      const code = this.rangeCodeOf(unit);
      if (code === 11) return [];
      const R = window.JW_RULES;
      if (!R) { // 兜底：旧切比雪夫
        const r = unit.range;
        const pts = [];
        for (let dx = -r[1]; dx <= r[1]; dx++)
          for (let dy = -r[1]; dy <= r[1]; dy++) {
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            if (d >= r[0] && d <= r[1] && this.map.inBounds(x+dx, y+dy)) pts.push({ x: x+dx, y: y+dy });
          }
        return pts;
      }
      if (code === 10) { // 全图
        const all = [];
        for (let y2 = 0; y2 < this.map.h; y2++) for (let x2 = 0; x2 < this.map.w; x2++) all.push({ x: x2, y: y2 });
        return all;
      }
      return R.shapeCells(code, x, y, (a, b) => this.map.inBounds(a, b)).map(c => ({ x: c[0], y: c[1] }));
    }

    // ---- 移动单位 ----
    move(unit, tx, ty) {
      const cell = this.map.get(tx, ty);
      if (!cell || cell.unit) return false;
      const oldCell = this.map.get(unit.x, unit.y);
      if (oldCell) oldCell.unit = null;
      /* 冲锋攻击(89)：记录本回合移动起点（0x4cfc00 走位路径首格） */
      if (!unit.hasMoved) { unit._moveStartX = unit.x; unit._moveStartY = unit.y; }
      unit.x = tx; unit.y = ty;
      cell.unit = unit;
      unit.hasMoved = true;
      this.logEntry(`${unit.name} 移动至 (${tx},${ty})`);
      // 到达位置触发事件
      this.checkBattleEvents("reach", unit, tx, ty);
      return true;
    }
    // 取消移动：单位返回本回合移动前位置（保留 hasMoved=false，可继续行动）
    cancelMove(unit) {
      const sx = unit._moveStartX != null ? unit._moveStartX : unit.initialX;
      const sy = unit._moveStartY != null ? unit._moveStartY : unit.initialY;
      if (sx == null || sy == null) return false;
      const cur = this.map.get(unit.x, unit.y);
      if (cur && cur.unit === unit) cur.unit = null;
      const target = this.map.get(sx, sy);
      if (!target) return false;
      if (target.unit && target.unit !== unit) return false;
      unit.x = sx; unit.y = sy;
      target.unit = unit;
      unit.hasMoved = false;
      this.logEntry(`${unit.name} 取消移动，返回 (${unit.x},${unit.y})`);
      return true;
    }

    // ---- 伤害计算 ----
    // 1:1 复刻原版 CalcDamage 0x43bc4b / HitRate 0x43b50d / crit 0x405d69
    terrainEffect(unit, x, y) {
      const cell = this.map.get(x, y);
      const tid = cell ? cell.tid : undefined;
      if (tid === undefined || tid === 0xff || !unit || !unit.terrEffect || !unit.terrEffect.length) return 10;
      /* 原版 0x43f7c3（@0x43f847-0x43f860）防御系数 tid 别名映射：
       *   浅滩9/沼泽10 → 池塘11 系数；雪原7/大河13 → 小河12 系数
       *   （2026-11-06 capstone 直证，此前缺失） */
      let tid2 = tid;
      if (tid === 9 || tid === 10) tid2 = 11;
      else if (tid === 7 || tid === 13) tid2 = 12;
      const v = unit.terrEffect[tid2];
      return (v === undefined || v === 255) ? 10 : v;
    }
    // 武器特效（原版 special 表；伤害/命中类先落地，语义按 dis 资料推断标注）
    weaponSpec(id) {
      if (id == null || id === 255 || id === 65535) return null;
      const R = (typeof window !== "undefined" && window.JW_REAL) || null;
      const it = R && R.items ? R.items[id] : null;
      return it && it.special != null ? it : null;
    }
    /* noRandom=true 时按随机项中值(3)计算，供 UI 预览使用，不消耗随机数 */
    /* 物理伤害：1:1 原版 FUN_0043bc62（0x43bc62）实测链：
     *   ① 攻/防 = stat0/stat1 × 地形系数(t/10)（FUN_0043f7c3）
     *   ② dmg = 等级 + 25；A<D → dmg−(D−A)/2（0→1）；A≥D → +(A−D)/2
     *   ③ 兵种相克表 0x4d1a80[攻兵种*40+防兵种] ≠100 → dmg×v/100
     *   ④ 0x4d2138[攻兵种]=1 且攻方持 special==69（FUN_004cf398(u,0x22,0x45,1,0)）→ 追伤
     *      —— 本 mod 无物品携带 special=69（死码，2026-11-04 key 判据修正，旧值 34 飞景系误绑）
     *   ⑤ 非普通攻击(mode≠0) → dmg×3/4（special==106 免除），下限 1
     *   ⑥ 随机 rand(7)：r<3 → dmg−r(0→1)；r≥3 → dmg+r−2
     *   ⑦ 追伤（FUN_00478f08，仅普通攻击 mode==0）：攻方持 special==107（黄龙升天刀）→
     *      dmg += dmg × v107 × 兵种出手计数表[目标兵种] / 100
     *   ⑧ 上限=目标HP（调用处）。
     * 注：效果21/22 蓄力倍率路径（FUN_004cf398(u,0x16,0x1f) → key=0x1f(31) 青釭剑 →
     * dmg×U+0x1c/100）已实证；U+0x1c 的维护点未定位（本 mod 无蓄力指令），按 100 计不移植。 */
    physicalDamage(attacker, defender, mode, noRandom) {
      const R = window.JW_REAL;
      /* 青釭剑（FUN_0043bc62 实证 2026-11-04）：攻击者持 special==31
       * （FUN_004cf398(u,0x16,0x1f,1,0) → key=0x1f(31)）→ 伤害 = v31 固定值
       * （sp31 特例缩放 0x420119：sval×(武器等级+1)，青釭剑 sval=20 → lv1=40 … lv9=200），
       * 且跳过全部攻防/兵种/相克/装备修正；反击 ×3/4 段亦被绕过（不减）。
       * DAT_0046230e=1（静态实证）→ MaxMP 蓄力倍率段不生效；类别 0x15 攻击（DAT_00500e9b）
       * 走同段但指令未定论，不移植。 FUN_00406b0e 仅 param_2==0（AI 预估）触发，真实攻击不经过。 */
      if (attacker.hasEffect && attacker.hasEffect(31)) {
        return Math.max(attacker.effectValue(31) || 0, 1);
      }
      const tA = this.terrainEffect(attacker, attacker.x, attacker.y);
      const tD = this.terrainEffect(defender, defender.x, defender.y);
      const A = Math.floor((attacker.bAtk != null ? attacker.bAtk : attacker.atk) * tA / 10);
      const D = Math.floor((defender.bDef != null ? defender.bDef : defender.def) * tD / 10);
      let dmg = (attacker.lvl || 1) + 0x19;
      if (A >= D) dmg += (A - D) >> 1;
      else { dmg = Math.max(dmg - ((D - A) >> 1), 0); if (dmg === 0) dmg = 1; }
      // ③ 兵种相克（0x4d1a80 乘法表）
      dmg = this.classMatchup(attacker, defender, dmg);
      // ④ 0x4d2138 兵种标记 + special==69（本 mod 无物品携带，死码对齐；旧误绑 34 飞景系）
      if (R && R.CRIT_CLS && (attacker.clsId || 0) < R.CRIT_CLS.length
          && R.CRIT_CLS[attacker.clsId || 0] && attacker.hasEffect && attacker.hasEffect(69)) {
        dmg += Math.floor(dmg * attacker.effectValue(69) / 100);
      }
      // ⑤ 非普通攻击 ×3/4（special==106 免除）
      if (mode !== 0) {
        if (!(attacker.hasEffect && attacker.hasEffect(106))) dmg = (dmg * 3) >> 2;   // key=0x6a(106)，本 mod 无物品携带（死码对齐）
        dmg = Math.max(dmg, 1);
      }
      else {
        // ⑦ 追伤（FUN_00478f08 实证，仅普通攻击）：攻方 special==107 黄龙升天刀
        dmg += this._chargeFollowupDmg(attacker, defender, dmg);
      }
      // 天气/地形加成（EXE FUN_0044a1d4，table 0x48e100）：仅天气>=4（雪天）时应用
      const w = this.weather !== undefined ? this.weather : 0;
      if (w >= 4) {
      const tId = defender.tid !== undefined ? defender.tid : 0;
        const col = Math.min(5, Math.max(0, tId));
        const modVal = Battle.WEATHER_TERRAIN_MOD[w][col];
        if (modVal) dmg += Math.floor(dmg * modVal / 100);
      }
      if (noRandom) return Math.max(1, dmg);
      const r = U.rnd(0, 6);                     // rand(7)：r>2 → +r-2，r≤2 → -r(0→1)
      dmg = r > 2 ? dmg + r - 2 : Math.max(dmg - r, 0);
      return Math.max(1, dmg);
    }
    hitRate(attacker, defender) {
      // 远距攻击 && 防守方 防御远距攻击(56)：0
      /* 2026-11-04 删除「防御远距攻击(56) → 命中 0」：出自名表 56 推断（第 26 轮批次），
       * EXE 中无 key=0x38 的命中类查询；special=56（破凰凤羽扇）的实证行为是
       * 策略伤害加成（FUN_0043c00f → FUN_004cf398(u,0x28,0x38,1,0)），不再免疫远程。 */
      // 混乱目标必中
      if (defender.status && defender.status.confused) return 100;
      const a = attacker.bSpd != null ? attacker.bSpd : attacker.spd, d = defender.bSpd != null ? defender.bSpd : defender.spd;
      let h;
      if (a >= 2 * d) h = 100;
      else if (a >= d) h = Math.floor((a - d) * 10 / d) + 90;   /* EXE FUN_0043b50c 三段式第二段：防方<=攻方<防方×2 → (a-d)*10/d+90 */
      else if (a >= (d >> 1)) h = Math.floor((a - (d >> 1)) * 30 / (d >> 1)) + 60;
      else { const half = Math.floor(d / 3); h = half > 0 ? Math.floor(Math.max(0, a - half) * 30 / half) + 30 : 30; }
      /* 效果修正（EXE FUN_0043b50c 尾段：FUN_0047fa89=min(h+v,100)、FUN_0047fa9e=max(h−v,0)；
       * 判据取 FUN_004cf398 第 2 参（special）：
       *   - key 0x1e(30)：special==30 → 必中 100
       *   - key 0x1f(31)：special==31 → 命中 +v（青釭剑系）
       *   - key 0x20(32)：special==32 → 命中 −v */
      if (attacker.hasEffect && attacker.hasEffect(30)) return 100;
      if (attacker.hasEffect && attacker.hasEffect(31)) h = Math.min(h + attacker.effectValue(31), 100);
      if (attacker.hasEffect && attacker.hasEffect(32)) h = Math.max(h - attacker.effectValue(32), 0);
      return U.clamp(h, 0, 100);
    }
    // 策略命中：1:1 原版 StratHitRate 0x43b73f（精神+士气，4 段曲线 × 每策略系数）
    stratHitRate(caster, target, skill) {
      const sid = skill.realId != null ? skill.realId : skill.id;
      // 混乱目标必中
      if (target.status && target.status.confused) return 100;
      /* 策略必中（FUN_004cf398(u,0x1b,0x37,1,1)）：key=0x37(55) 琉璃七宝刀 → return 100。
       * 旧绑 27 八卦仙衣为 id 误读——special==27 无任何 key=0x1b 查询点（2026-11-04 修正）。 */
      if (caster.hasEffect && caster.hasEffect(55)) return 100;
      /* 杜断（0x4d4abc）：施法者相邻有 pid 185 同阵营 → 命中曲线 +20（≤100） */
      const duDuan = this.units.some(o => o.isAlive && o.pid === 185 && o.faction === caster.faction
        && Math.abs(o.x - caster.x) + Math.abs(o.y - caster.y) === 1);
      const A = (caster.bMag != null ? caster.bMag : caster.mag) + (caster.bHit != null ? caster.bHit : caster.hit);   // Spirit + Morale
      const B = (target.bMag != null ? target.bMag : target.mag) + (target.bHit != null ? target.bHit : target.hit);
      let h;
      if (A >= 2 * B) h = 100;
      else if (A >= B) h = Math.floor((A - B) * 10 / B) + 90;
      else if (A >= (B >> 1)) h = Math.floor((A - (B >> 1)) * 30 / (B >> 1)) + 60;
      else { const third = Math.floor(B / 3); h = third > 0 ? Math.floor(Math.max(0, A - third) * 30 / third) + 30 : 30; }
      /* 每策略命中系数：0x43ba07[73] 原始字节实测（FUN_0043b6f3 switch）——
       *   ≥5 → 命中×byte/100；1 / 100 → 必中100；0 → ×90/100；2/3/4 → 条件型不乘 */
      const cat = (window.JW_REAL && window.JW_REAL.STRAT_HIT_CAT) ? window.JW_REAL.STRAT_HIT_CAT[sid] : null;
      if (cat != null) {
        if (cat === 1 || cat === 100) h = 100;
        else if (cat === 0) h = Math.floor(h * 90 / 100);
        else if (cat >= 5) h = Math.floor(h * cat / 100);
      }
      // 暗算（0x14）命中 ×3/2（FUN_0043b6f3：target==12 → *3>>1）
      if (sid === 20) {
        const R = window.JW_REAL;
        const tf = target && target.fam != null ? target.fam : ((R && R.familyOf) ? R.familyOf((target && target.clsId) || 0) : -1);
        if (tf === 12) h = (h * 3) >> 1;
      }
      // 杜断（0x4d4abc）：+20（≤100）
      if (duDuan) h = Math.min(h + 20, 100);
      /* FUN_0043b6f3 尾段实测：效果 0x1c(28) → min(h+v,100) 加法；
       * 效果 0x1d(29) → max(h−v,0)。
       * FUN_00405dbd = FUN_004cf398(u, 0x27, '7', 1, 0)：返回值取自 key=0x37(55)，
       * 即 special==55（琉璃七宝刀 sval=20）→ 命中+10；旧 id=39 为 mod 表索引（死参数）。
       * 2026-11-04 汇编实证：FUN_004cf398 返回值 = FUN_0043c794(key)（special 查询），
       * 第 1 参 id 仅进 mod 补丁表 0x5089b0 且被 POP EDX 丢弃。 */
      /* (0x1c, 0x3c)：special==60 → 命中+v（无物品死码）；(0x1d, 0x3e)：special==62 → 命中−v（无物品死码）。
       * 策略必中为 (0x1b, 0x37)：special==55 琉璃七宝刀 → return 100（见下）。 */
      if (caster.hasEffect && caster.hasEffect(60)) h = Math.min(h + caster.effectValue(60), 100);
      if (caster.hasEffect && caster.hasEffect(62)) h = Math.max(h - caster.effectValue(62), 0);
      if (caster.hasEffect && caster.hasEffect(55)) h = Math.min(h + 10, 100);
      return U.clamp(h, 0, 100);
    }
    /* 会心率：1:1 原版 FUN_00405d5b：曲线 FUN_00405d0a(stat4 士气)；
     * 「致命一击」（FUN_004cf398(u, 0x33, '1', 1, 1)）→ 返回值取自 key=0x31(49)，
     * 即 special==49（青龙偃月刀 sval=0，布尔）→ 曲线值 +100（必定触发加成段）。
     * 旧 id=51（养叔穿杨弓等）为 mod 表索引，不参与判定（2026-11-04 汇编实证）。
     * 应用（FUN_00405de1 实测）：触发后 伤害 += 伤害×(曲线值+100)/2/100；
     * 防御方持 special==65（黄金连环铠，FUN_00405dcf key='A'）→ 会心加成不施加且伤害清 0（会心格挡）。 */
    critRate(attacker, defender) {
      /* EXE FUN_00405d5b：会心率 = 曲线 FUN_00405d0a(防方士气 stat4, 攻方士气 stat4)。曲线值越高越会心。
       * 输入取士气（stat4/士气，非命中 hit），方向：攻方士气越高会心率越高。 */
      const morale = (u) => Math.max(1, (u.bHit != null ? u.bHit : u.hit) || 1);
      const a = morale(attacker), d = morale(defender);
      let r;
      if (a >= 3 * d) r = 100;
      else if (a >= 2 * d) r = Math.floor((a - 2 * d) * 80 / d) + 20;
      else if (a >= d) r = Math.floor((a - d) * 18 / d) + 2;
      else r = 1;
      if (attacker.hasEffect && attacker.hasEffect(49)) r += 100;   /* 致命一击 special 49 → 曲线值+100（必定加成段） */
      return r;
    }
    /* 连击率：1:1 原版 FUN_00405cb0（0x405ce6 为其内部地址）
     *   - 「主动连击」（FUN_004cf398(装备, 0x34, 'B', 1, 1)）→ 返回值取自 key=0x42(66)，
     *     即 special==66（雌雄一对剑）→ 直接 100。
     *     旧 id=52（紫绶仙衣）为 mod 表索引，不参与判定（2026-11-04 汇编实证）。
     *   - 曲线 FUN_00405d0a(目标stat3, 攻击者stat3)：stat3 = 敏捷
     *   - 反击中无连击 */
    doubleRate(attacker, defender, inCounter) {
      if (inCounter) return 0;   // 反击中无连击
      if (attacker.hasEffect && attacker.hasEffect(66)) return 100;
      const a = attacker.bSpd != null ? attacker.bSpd : attacker.spd;
      const d = defender.bSpd != null ? defender.bSpd : defender.spd;
      if (a >= 3 * d) return 100;
      if (a >= 2 * d) return Math.floor((a - 2 * d) * 80 / d) + 20;
      if (a >= d) return Math.floor((a - d) * 18 / d) + 2;
      return 1;
    }
    /* 兵种相克（0x4d1a80 40×40 乘法表，FUN_0043bc62 实测）：[攻兵种*40+防兵种]≠100 → dmg×v/100 */
    classMatchup(attacker, defender, dmg) {
      const R = window.JW_REAL;
      if (!R || !R.CLS_MATCHUP) return dmg;
      const af = attacker.clsId || 0, df = defender.clsId || 0;
      const v = R.CLS_MATCHUP[(af & 0x3f) * 40 + (df & 0x3f)];
      return (v != null && v !== 100) ? Math.floor(dmg * v / 100) : dmg;
    }
    // 策略伤害：1:1 原版 StratDamage 0x43c00f（旧注释 0x43bfaa 不准，该处落在函数内部）
    stratDamage(caster, target, skill, preview) {
      const sid = skill.realId != null ? skill.realId : skill.id;
      // 权威威力表 0x43c31e[73]，按 sid 索引
      const power = STRAT_POWER[sid] != null ? STRAT_POWER[sid] : 0;
      if (power <= 0) return 0;
      const R = window.JW_REAL;
      const I = caster.bMag != null ? caster.bMag : caster.mag;      // 精神 Int
      const J = target.bMag != null ? target.bMag : target.mag;
      // 基础伤害 = 等级 + 25（原版 EXE 实测，非 45）
      let dmg = (caster.lvl || 1) + 0x19;
      /* 原版 @0x43c11e..0x43c147：整数 DIV 3（截断），非浮点 */
      if (I >= J) dmg += Math.floor((I - J) / 3);
      else dmg = Math.max(dmg - Math.floor((J - I) / 3), 0);
      dmg = Math.floor(dmg * power / 100);
      // 目标族修正：0x4d21b0[族]（FUN_004077d0 = 族索引，非兵种）
      const R2 = window.JW_REAL;
      const df = target.fam != null ? target.fam : ((R2 && R2.familyOf) ? R2.familyOf(target.clsId || 0) : 0);
      const mod = (R2 && R2.STRAT_FAM_MOD && R2.STRAT_FAM_MOD[df] != null) ? R2.STRAT_FAM_MOD[df] : 100;
      dmg = Math.floor(dmg * mod / 100);
      // 暗算×2：family(target)==12（虚士家族）
      if (sid === 20 && R) {
        const tf = target.fam !== undefined ? target.fam : R.familyOf(df);
        if (tf === 12) dmg = Math.floor(dmg * 2);
      }
      /* 效果修正（FUN_0043c00f 实测 + 2026-11-04 key 判据修正）：
       * 施法者 FUN_004cf398(caster,0x28,'8',1,0) → key=0x38(56) 破凰凤羽扇 → dmg += dmg×v/100；
       * 目标   FUN_004cf398(target,0x29,'C',1,0) → key=0x43(67) 梅花亮银铠 → dmg −= dmg×v/100（下限0）；
       * 施法者 FUN_00405dbd → key=0x37(55) 琉璃七宝刀 → dmg += dmg×v/100。
       * 天气/地形加成（EXE FUN_0044a1d4，table 0x48e100，6×6：行=天气0-5，列=地形tid0-5；
       * FUN_004cf694(dmg, modVal) = dmg×modVal/100，累加）。table 值：
       *   晴 [0,0,0,1,2,3]  阴 [0,0,0,0,1,2]  雨 [0,1,2,2,3,3]
       *   暴雨 [0,0,1,1,4,4] 雪 [0,1,4,4,4,4]  未知5 [0,0,189,225,202,248] */
      const WEATHER_TERRAIN_MOD = [
        [0,0,0,1,2,3], [0,0,0,0,1,2], [0,1,2,2,3,3],
        [0,0,1,1,4,4], [0,1,4,4,4,4], [0,0,189,225,202,248]
      ];
      const tId = target.tid !== undefined ? target.tid : 0;
      const w = this.weather !== undefined ? this.weather : 0;
      const col = Math.min(5, Math.max(0, tId));
      const row = Math.min(5, Math.max(0, w));
      const modVal = Battle.WEATHER_TERRAIN_MOD[row][col];
      if (modVal) dmg += Math.floor(dmg * modVal / 100);
      if (caster.hasEffect && caster.hasEffect(56)) dmg += Math.floor(dmg * caster.effectValue(56) / 100);
      if (target.hasEffect && target.hasEffect(67)) dmg = Math.max(dmg - Math.floor(dmg * target.effectValue(67) / 100), 0);
      if (caster.hasEffect && caster.hasEffect(55)) dmg += Math.floor(dmg * caster.effectValue(55) / 100);
      // 随机：rand(7)，r>2→+r-2，else→-r
      if (!preview) {
        const r = U.rnd(0, 6);
        dmg = r > 2 ? dmg + r - 2 : Math.max(dmg - r, 0);
      }
      dmg = Math.max(dmg, 1);
      const cap = (sid === 22 && target.mp != null) ? target.mp : (target.hp != null ? target.hp : dmg);
      return Math.min(dmg, cap);
    }

    /* UI 用的确定性攻击预览（不消耗随机数）：返回预计伤害区间/命中率/会心率。
     * 与 computeDamage 同源公式，仅供玩家判断，不改变战斗结果。 */
    previewAttack(attacker, defender, skill) {
      if (!attacker || !defender) return null;
      try {
        let dmg, hit, crit = 0;
        if (skill && _isDamageStrategy(skill)) {
          dmg = this.stratDamage(attacker, defender, skill, false);
          hit = this.stratHitRate(attacker, defender, skill);
        } else {
          dmg = this.physicalDamage(attacker, defender, 0, true);   // 随机项取中值
          hit = this.hitRate(attacker, defender);
          crit = this.critRate(attacker, defender);
          // rand(7) 的实际浮动：r=0..2 → -0..-2，r=3..6 → +1..+4
          return { min: Math.max(1, dmg - 2), max: Math.max(1, dmg + 4), hit: Math.round(hit), crit: Math.round(crit) };
        }
        return { min: Math.max(1, dmg), max: Math.max(1, dmg), hit: Math.round(hit), crit: Math.round(crit) };
      } catch (e) { return null; }
    }

    computeDamage(attacker, defender, skill, mode) {
      // 真实单位：1:1 原版物理公式
      const realAtt = attacker && attacker.terrEffect;
      if (skill && _isDamageStrategy(skill)) {
        // 策略伤害：1:1 原版 StratDamage + StratHitRate
        const dmg = this.stratDamage(attacker, defender, skill, false);
        const hit = Math.random() * 100 < this.stratHitRate(attacker, defender, skill);
        return { dmg: hit ? dmg : 0, crit: false, hit };
      }
      if (realAtt && defender && defender.terrEffect) {
        const dmg = this.physicalDamage(attacker, defender, mode || 0);
        const hit = Math.random() * 100 < this.hitRate(attacker, defender);
        if (!hit) return { dmg: 0, crit: false, hit: false };
        /* 会心（FUN_00405de1 实测）：roll(曲线值) 通过（致命一击 → critRate 已含 +100 必定）→
         * 伤害 += 伤害×(曲线值+100)/2/100。
         * 会心格挡（FUN_00405dcf → FUN_004cf398(def,0x30,'A',1,1) key=0x41(65) 黄金连环铠）：
         * 汇编 00405ef0 TEST EAX,EAX; JZ→加成；否则 MOV [puVar1],0 —— 格挡时伤害清 0。
         * 且 FUN_00405de1 仅在第一段(local_8==0)判定会心，多段连击后续段不加成。 */
        const cr = this.critRate(attacker, defender);
        const curve = cr >= 101 ? cr - 100 : cr;   // 剥离致命一击的 +100
        const crit = cr >= 101 || (Math.random() * 100 < curve);
        let out = dmg;
        if (crit) {
          if (defender.hasEffect && defender.hasEffect(65)) {
            return { dmg: 0, crit: true, hit: true, parried: true };   // 会心格挡
          }
          out = dmg + Math.floor(dmg * ((curve + 100) >> 1) / 100);
        }
        return { dmg: out, crit, hit: true };
      }
      /* EXE FUN_0043bc62：始终走完整物理伤害公式，不再因缺 terrEffect 而走简化公式。
       * 技能伤害：物理技能按威力叠加（EXE 非策略技能按各自公式，此处近似）。 */
      let dmg = this.physicalDamage(attacker, defender, mode || 0);
      if (skill && skill.type === "damage" && skill.power != null) dmg += skill.power | 0;
      const hit = Math.random() * 100 < this.hitRate(attacker, defender);
      if (!hit) return { dmg: 0, crit: false, hit: false };
      /* 会心（FUN_00405de1 实测）：roll(曲线值) 通过（致命一击 → critRate 已含 +100 必定）→
       * 伤害 += 伤害×(曲线值+100)/2/100。FUN_00405de1 仅在第一段(local_8==0)判定会心，多段连击后续段不加成。 */
      const cr = this.critRate(attacker, defender);
      const curve = cr >= 101 ? cr - 100 : cr;   // 剥离致命一击的 +100
      const crit = cr >= 101 || (Math.random() * 100 < curve);
      let out = dmg;
      if (crit) {
        if (defender.hasEffect && defender.hasEffect(65)) {
          return { dmg: 0, crit: true, hit: true, parried: true };   // 会心格挡
        }
        out = dmg + Math.floor(dmg * ((curve + 100) >> 1) / 100);
      }
      return { dmg: out, crit, hit: true };
    }

    /* 攻击指令包装（§12.1 0x4d7808）：触发【技】横幅 → 目标抢先反击 → 煞连击。
     * 技表 0x4d76d0：pid 44 横推八马倒、34 盖马三锤、33 凤舞九天、32 龙吟、
     * 43 鬼门刀、4 怒目、3 煞、101/136 双雷引；
     * 触发率 = min(己方士气×50 ÷ 目标士气, 100)。 */
    static TECH_BY_PID = { 44: "hengtui", 34: "gaima", 33: "fengwu", 32: "longyin", 43: "guimen", 4: "numu", 3: "sha", 101: "shuanglei", 136: "shuanglei" };
    async attack(attacker, target, skill, isCounter, depth) {
      if (skill || isCounter || !attacker || !attacker.isAlive || !target || !target.isAlive) {
        return this.attackOnce(attacker, target, skill, isCounter, depth);
      }
      const TE = Battle.TECH_BY_PID[attacker.pid];
      const morale = (a) => Math.max(1, (a.bHit != null ? a.bHit : a.hit) || 1);
      let tech = null;
      if (TE && Math.random() * 100 < Math.min(Math.floor(morale(attacker) * 50 / morale(target)), 100)) tech = TE;
      attacker._tech = tech;
      if (tech === "shuanglei") attacker._shuangLei = 1;
      /* 目标抢先出手（0x4d74e4）：非乱、存活，且（带 60 效果，或 pid 101/136/14
       * 按士气对比掷骰，或 攻击者=双雷引阶段1）且攻击者在目标射程内 */
      if (!tech || tech === "shuanglei") {
        const pre = target.isAlive && !(target.status && target.status.confused)
          && ((target.hasEffect && target.hasEffect(60))
              || ([101, 136, 14].includes(target.pid)
                  && Math.random() * 100 < Math.min(Math.floor(morale(target) * 50 / morale(attacker)), 100)))
          && this.inRange(target, attacker);
        if (pre) {
          if (target.pid === 14) target._tico = 1;        // 抽屉枪：马隆下次出手必双击
          else if (target.pid === 101 || target.pid === 136) target._shuangLei = 1;
          await this.attackOnce(target, attacker, null, false);
          attacker._tech = null; attacker._shuangLei = 0;
          return;
        }
      }
      /* 煞：同一次指令最多打 3 次（双方存活才续） */
      if (tech === "gaima") {
        /* 盖马三锤（0x4d83fe）：3 次随机打攻击者 8 邻格上的敌方单位，
         * 随后 曼哈顿≤4 的全部敌军 怯+穷计（带 57 防御特殊攻击 者免疫） */
        for (let k = 0; k < 3; k++) {
          const around = this.enemies.filter(e => e.isAlive
            && Math.abs(e.x - attacker.x) <= 1 && Math.abs(e.y - attacker.y) <= 1
            && (e.x !== attacker.x || e.y !== attacker.y));
          if (!around.length) break;
          const t = around[Math.floor(Math.random() * around.length)];
          this.logEntry(`${attacker.name}：盖马三锤 → ${t.name}`, "sys");
          await this.attackOnce(attacker, t, null, false);
        }
        for (const e of this.enemies) {
          if (!e.isAlive) continue;
          if (Math.abs(e.x - attacker.x) + Math.abs(e.y - attacker.y) <= 4
              && !(e.hasEffect && e.hasEffect(97))) {
            e.addStatus("fear", true); e.addStatus("sealed", true);
          }
        }
        attacker._tech = null;
        return;
      }
      const rounds = tech === "sha" ? 3 : 1;
      for (let r = 0; r < rounds; r++) {
        if (!attacker.isAlive || (target.hp <= 0 && tech !== "gaima")) break;
        await this.attackOnce(attacker, target, null, false);
        if (attacker._shuangLei === 1) attacker._shuangLei = 2;   // 第一击后进入双击阶段
      }
      /* 凤舞九天(area 码 2) / 横推八马倒(area 码 10)：主目标外，形状内其余敌全伤害（§12.1/§4.5） */
      if (attacker._tech === "fengwu" || attacker._tech === "hengtui") {
        const R = window.JW_RULES;
        const code = attacker._tech === "fengwu" ? 2 : 10;
        const cells = R && R.shapeCells
          ? R.shapeCells(code, target.x, target.y, (a, b) => this.map.inBounds(a, b))
          : [[target.x, target.y]];
        for (const [cx, cy] of cells) {
          if (cx === target.x && cy === target.y) continue;
          const e = this.unitAt(cx, cy);
          if (!e || !e.isAlive || e.faction === attacker.faction) continue;
          await this.attackOnce(attacker, e, null, true);   // 溅射不触发反击（isCounter 压制）
        }
      }
      attacker._tech = null;
      if (attacker._shuangLei === 2) attacker._shuangLei = 0;
      return;
    }
    // ---- 攻击（1:1：可连击至多2击 + 目标存活可反击 mode=1 且不重复） ----
    async attackOnce(attacker, target, skill, isCounter, depth) {
      const cDepth = depth == null ? (isCounter ? 1 : 0) : depth;
      if (!target || !target.isAlive) return;
      let dbl = false;
      if (!skill) {
        /* DoubleCheck（§4.4 mod cave 0x407600/0x4d88df）：
         *   双雷引阶段2 → 首次判定必双击；否则 chance(DoubleRate)；
         *   再否则带 抽屉枪（_tico=1，马隆被抢先反击后获得）→ 双击并清除 */
        if (attacker._shuangLei === 2) dbl = true;
        else if (Math.random() * 100 < this.doubleRate(attacker, target, !!isCounter)) dbl = true;
        else if (attacker._tico === 1) { dbl = true; attacker._tico = 0; }
      }
      const strikes = skill ? 1 : (dbl ? 2 : 1);
      let maxExp = 0;
      let wExp = 0;   // §8.4 武器经验（多目标/多击取最大，攻击后加一次）
      let aExp = 0;   // §8.4 防具经验（受击者，每次击中加）
      let lifestealDmg = 0;   // §8.5 吸血攻击：本攻击序列造成的总伤害
      for (let s = 0; s < strikes; s++) {
        if (!target.isAlive) break;
        const calc = this.computeDamage(attacker, target, skill, isCounter ? 1 : 0);
        /* FUN_00405de1 尾段：每攻击段对目标兵种出手计数 +1（DAT_00508ec5，供 107 追伤用） */
        this._bumpClsAtkCount(target.clsId || 0);
        /* §12.1 各【技】的命中处理（apply step，每次出手） */
        if (attacker._tech && attacker._tech !== "sha" && attacker._tech !== "gaima") {
          const T = attacker._tech;
          if (T === "numu") {
            /* 怒目 0x4d8150：所有目标 MP 全部清空（命中与否） */
            if (target.mp > 0) { target.mp = 0; this.logEntry(`${target.name} 被怒目震慑，MP 清空`, "debuff"); }
          } else if (T === "guimen") {
            /* 鬼门刀 0x4d72e0：目标移动力归 0 且 怯（带 57 免疫） */
            if (!(target.hasEffect && target.hasEffect(97))) {
              target.status.mov = -(target.mov || 0);
              target.addStatus("fear", true);
              this.logEntry(`${target.name} 中鬼门刀，动弹不得且胆怯`, "debuff");
            }
          } else if (T === "longyin") {
            /* 龙吟 0x4d72e0：50% 降目标武器等级 1，否则降防具等级 1（>0 才降；带 57 免疫） */
            if (!(target.hasEffect && target.hasEffect(97))) {
              if (Math.random() < 0.5 && (target.weaponLv || 1) > 1) { target.weaponLv--; this.logEntry(`${target.name} 武器被龙吟震裂（等级${target.weaponLv}）`, "debuff"); }
              else if ((target.armorLv || 1) > 1) { target.armorLv--; this.logEntry(`${target.name} 铠甲被龙吟震碎（等级${target.armorLv}）`, "debuff"); }
            }
          }
        }

        if (!calc.hit) {
          if (this.onEvent) this.onEvent({ type: "miss", attacker: attacker.id, target: target.id });
          this.logEntry(`${attacker.name} ${skill ? "施放" : "攻击"} ${target.name} —— 未命中！`, "dmg");
          if (this._isPlayer(attacker) && !skill) {
            const e = attacker.expFromAttack(target, false);
            if (e > maxExp) maxExp = e;
            // §8.4：未命中（无 HP/MP 伤害）武器经验 1 × exp_mult/100
            const w = Math.floor(1 * attacker.expMult() / 100);
            if (w > wExp) wExp = w;
          }
          continue;
        }
        target.damage(calc.dmg);
        // 引导攻击（§12.1 特殊57 白羽扇/华铤）：目标死亡后，攻击者在射程内链击最近存活敌
        if (calc.dmg > 0 && !target.isAlive && attacker.hasEffect && attacker.hasEffect(57)) {
          const next = this.guidedAttack(attacker, target);
          if (next && next.isAlive && this.inRange(attacker, next)) {
            await this.attackOnce(attacker, next, null, false, cDepth + 1);
          }
        }
        // §8.4 武器经验：造成伤害 → (La>Lt?2:3)；无伤害 → 1
        {
          const La = attacker.lvl || 1, Lt = target.lvl || 1;
          const w = Math.floor((calc.dmg > 0 ? (La > Lt ? 2 : 3) : 1) * attacker.expMult() / 100);
          if (w > wExp) wExp = w;
        }
        // §8.4 防具经验：受击者（有防具）→ 造成伤害 ? (La<Lt?3:4) : 1，按受击者 exp_mult
        if (calc.dmg > 0 && target.armor != null && target.armor !== 255) {
          const La = attacker.lvl || 1, Lt = target.lvl || 1;
          const a = Math.floor((La < Lt ? 3 : 4) * target.expMult() / 100);
          if (a > 0) {
            if (target.gainEquipExp("armor", a) && this.onEvent) this.onEvent({ type: "equipLevelUp", unit: target.id, slot: "armor", lv: target.armorLv });
          }
        }
        if (this._isPlayer(attacker)) {
          const kill = !target.isAlive;
          const e = skill ? attacker.expFromStrategy(target, kill, target.faction === "enemy")
                          : attacker.expFromAttack(target, kill);
          if (e > maxExp) maxExp = e;
        }
        if (this.onEvent) this.onEvent({
          type: "hit", attacker: attacker.id, target: target.id,
          dmg: calc.dmg, crit: calc.crit, hp: target.hp, maxHp: target.maxHp
        });
        this.logEntry(
          `${attacker.name} ${skill ? "施放" : "攻"} ${target.name} ${calc.parried ? "(格挡!)" : calc.crit ? "(会心!)" : ""} ${calc.dmg} 伤害${strikes>1 ? ` (第${s+1}击)` : ""}`,
          "dmg"
        );
        if (calc.dmg > 0) lifestealDmg += calc.dmg;
        /* 梦魇（§12.4 0x4d8caf）：pid 67 命中后给目标 迷失；
         * 目标等级高于自己则不生效（"按顺序直到第一个更高等级"的单目标化） */
        if (calc.dmg > 0 && target.isAlive && attacker.pid === 67
            && (target.lvl || 1) <= (attacker.lvl || 1)
            && !(target.hasEffect && target.hasEffect(97))) {
          target.addStatus("lost", true);
          this.logEntry(`${target.name} 陷入梦魇迷失`, "debuff");
        }
        /* 2026-11-04 清理：原「34 麻痹 / 35 混乱 / 36 中毒 / 38 穷计 / 37 随机六判定 /
         * 兵种自带(cls45/50/38) 状态附加」整块删除 —— 出自 dis4 手动反汇编批次，其地址解读
         * 已被证伪（0x40913d 实为 WinMain，Ghidra 函数边界确认），且按 FUN_004cf398 key 判据
         * special=34/35/36/37/38 无任何引擎查询点（死码）。EXE 中物理攻击无此命中附加状态链。
         * 反击（1:1 §4.4 Counter）：目标存活、未混乱、攻击者无「压制反击」（special=107
         * 黄龙升天刀，FUN_00478f08 同款判据）、攻击者在目标射程内。深度 >1 停止；深度 1 时
         * 仅当被反击方带「遇反击后反击」（FUN_004cf398(u,0x28,0x38,1,0) → key=0x38(56)
         * 破凰凤羽扇，与策略伤害加成同判据）才允许再反击一次（反击反击）。 */
        const allowDepth = cDepth === 0 || (cDepth === 1 && target.hasEffect && target.hasEffect(56));
        if (!skill && s === 0 && target.isAlive && !(target.status && target.status.confused)
            && !(attacker.hasEffect && attacker.hasEffect(107))
            && this.inRange(target, attacker) && cDepth < 2 && allowDepth) {
          await new Promise(r => setTimeout(r, 200));
          await this.attack(target, attacker, null, true, cDepth + 1);   // 反击 mode=1
        }
      }
      this.checkDeath(target);
      /* 吸血攻击（§8.5 0x4d7e01）：攻击序列结束后 HP += 总伤害/2，封顶 MaxHP */
      if (lifestealDmg > 0 && attacker.hasEffect && attacker.hasEffect(81) && attacker.isAlive) {
        const heal = Math.min(Math.floor(lifestealDmg / 2), Math.max(0, attacker.maxHp - attacker.hp));
        if (heal > 0) { attacker.heal(heal); this.logEntry(`${attacker.name} 吸血回复 ${heal} 点体力`, "heal"); }
      }
      // §8.4 武器经验：攻击序列结束后一次性加（取各目标/各击最大）
      if (wExp > 0 && attacker.weapon != null && attacker.weapon !== 255) {
        if (attacker.gainEquipExp("weapon", wExp) && this.onEvent) this.onEvent({ type: "equipLevelUp", unit: attacker.id, slot: "weapon", lv: attacker.weaponLv });
      }
      // 经验：仅玩家控制单位，§8.1/8.2 取最大 e；升级则上报
      if (maxExp > 0) {
        const up = attacker.gainExp ? attacker.gainExp(maxExp) : null;
        if (up) {
          if (this.onEvent) this.onEvent({ type: "levelUp", unit: attacker.id, lvl: up.lvl, learnedNew: up.learnedNew });
          this.logEntry(`${attacker.name} 升至 ${up.lvl} 级！${up.learnedNew && up.learnedNew.length ? " 学会" + up.learnedNew.map(n=>`【${n}】`).join("") : ""}`, "sys");
        }
      }
      // 攻击消耗行动
      if (!skill) attacker.hasActed = true;

      /* 原版单挑触发（FUN_00438eba / 0x43ff54）：攻击结束后，若攻击者持效果 26（饰品 type==id，如凤凰羽衣）
       * 且目标存活，立即进入单挑——不是等回合结束。单挑结束后返回原回合流程。 */
      if (!skill && target.isAlive && attacker.hasEffect && attacker.hasEffect(26)) {
        const H = typeof window !== "undefined" && window.JW && window.JW.App;
        if (H && H.startAutoDuel) {
          await H.startAutoDuel(attacker, target);
        }
      }
    }

    // 目标 u2 是否在 u1 攻击范围内（形状表 §6.1）
    inRange(u1, u2) {
      const cells = this.attackRange(u1, u1.x, u1.y);
      return cells.some(c => c.x === u2.x && c.y === u2.y);
    }

    // 玩家控制的单位（1:1：仅玩家单位获得经验）
    _isPlayer(u) {
      return u && u.faction !== "enemy" && u.faction !== "friend";
    }

    // ---- 策略可用性（§5.6，0x420422/0x41fec9）----
    // 玩家控制单位：仅地形检查 + 自检适用；AI 单位：全量检查
    strategyUsable(skill, caster, target) {
      const R = window.JW_RULES;
      if (!R) return true;
      const sid = skill.realId != null ? skill.realId : skill.id;
      const isAI = caster.faction === "enemy" || caster.faction === "friend";
      const cat = R.catOf(sid);
      // cat 0-3：元素地形过滤（effect 50 左思兵法豁免）
      if (cat >= 0 && cat <= 3) {
        const tcell = target ? this.map.get(target.x, target.y) : null;
        if (!R.elemTerrainOK(skill, tcell ? tcell.tid : null, caster.hasEffect && caster.hasEffect(50))) return false;
      }
      if (isAI) {
        // AI 专用检查
        if (cat === 4 && caster.hp === caster.maxHp) return false;      // 暗算 HP满
        if (cat === 5 && caster.mp === caster.maxMp) return false;      // 暗鬼 MP满
        if (cat === 11 && target && target.hp === target.maxHp) return false; // heals HP满
        if (cat === 12 && target && target.mp === target.maxMp) return false; // MP满
        if (cat === 15 && target === caster) return false;              // 目标是caster
      } else {
        // 玩家：仅地形检查 + 自检
        if (cat === 15 && target === caster) return false;              // 不能对自己使用
      }
      return true;
    }
    // 策略施放范围（§6.1 策略 cast range；flag bit1 加原点 = 友方策略）
    strategyCastRange(skill, caster) {
      const R = window.JW_RULES;
      let code = skill.rangeCode != null ? skill.rangeCode : skill.range;
      /* 逐影随行咒（0x5281c0）：苏烈(35) 施放所有 range≠10 的策略按码 13（曼哈顿1..4） */
      if (caster && caster.pid === 35 && code !== 10) code = 13;
      if (!R || code === undefined || code === 11) return [{ x: caster.x, y: caster.y }];
      if (code === 10) {
        const all = [];
        for (let y = 0; y < this.map.h; y++) for (let x = 0; x < this.map.w; x++) all.push({ x, y });
        return all;
      }
      const cells = R.shapeCells(code, caster.x, caster.y, (a, b) => this.map.inBounds(a, b)).map(c => ({ x: c[0], y: c[1] }));
      if (skill.target === "allies" || skill.side === 1) cells.unshift({ x: caster.x, y: caster.y }); // flag bit1 原点
      return cells;
    }
    // 策略区域（§6.2）
    strategyArea(skill, caster, targetCell) {
      const R = window.JW_RULES;
      const code = skill.areaCode != null ? skill.areaCode : skill.area;
      if (!R || code === undefined || code === 0) return [[targetCell.x, targetCell.y]];
      return R.areaCells(code, caster, targetCell, this.map).map(c => ({ x: c[0], y: c[1] }));
    }

    // ---- 技能 ----
    async castSkill(attacker, skillId, targets) {
      const skill = D.SKILLS[skillId];
      if (!skill) return;
      /* 原版 策略命令(0x43dc21)：穷计状态（异常位 0x04）不能施法 */
      if (attacker.status && attacker.status.sealed) {
        this.logEntry(`${attacker.name}正处于穷计状态。`, "sys");
        return;
      }
      /* 策略耗蓝（0x4664b9/0x422f0d）：cost −(49 节约MP 时) cost×v/100；
       * 连续策略(83) 第二次施放 cost×2；房玄龄(179) 相邻时折半(≥1)。 */
      let cost = skill.mp;
      if (this.isSecondCast(attacker)) cost *= 2;
      /* 节约MP：FUN_00422ede → FUN_0043c794(u,0x46,0,7) key=0x46(70)=藤牌 special（sval=87）
       * → cost −= cost×v/100。旧绑定 49 为 mod 表索引误读（2026-11-04 汇编实证）。 */
      if (attacker.hasEffect && attacker.hasEffect(70)) cost -= Math.floor(cost * attacker.effectValue(70) / 100);
      const hu = this.units.find(u => u.pid === 179 && u.isAlive && u !== attacker
        && Math.abs(u.x - attacker.x) + Math.abs(u.y - attacker.y) === 1);
      if (hu) cost = Math.max(Math.floor(cost / 2), 1);
      cost = Math.max(cost, 0);
      if (attacker.mp < cost) { this.logEntry("MP 不足！"); return; }
      attacker.costMp(cost);
      // 过滤不可用目标（§5.6）
      const valid = targets.filter(t => t.isAlive && this.strategyUsable(skill, attacker, t));
      const skipped = targets.length - valid.length;
      if (skipped > 0) this.logEntry(`${skipped} 个目标不可施放`, "sys");
      let anyHit = false;
      let wExp = 0; // §8.4 施法者武器经验：各目标取最大，施放后加一次；无 exp_mult 加成
      for (const t of valid) {
        await this.applySkill(attacker, t, skill);
        if (t.faction !== attacker.faction || skill.type === "heal") anyHit = true;
        // 施法者武器经验（0x42128b）：记录 0/1 → (Lc>Lt?2:3)，天气(2)→3
        const Lc = attacker.lvl || 1, Lt = t.lvl || 1;
        const w = (skill.typeId === 2) ? 3 : (Lc > Lt ? 2 : 3);
        if (w > wExp) wExp = w;
        // 受击者防具经验（0x4213a3）：红方(kind 0) 且受策略 → (Lc<Lt?3:4)×exp_mult
        if (t.armor != null && t.armor !== 255 && t.faction !== attacker.faction) {
          const a = Math.floor((Lc < Lt ? 3 : 4) * t.expMult() / 100);
          if (a > 0 && t.gainEquipExp("armor", a) && this.onEvent) this.onEvent({ type: "equipLevelUp", unit: t.id, slot: "armor", lv: t.armorLv });
        }
      }
      if (wExp > 0 && attacker.weapon != null && attacker.weapon !== 255) {
        if (attacker.gainEquipExp("weapon", wExp) && this.onEvent) this.onEvent({ type: "equipLevelUp", unit: attacker.id, slot: "weapon", lv: attacker.weaponLv });
      }
      // 策略人物经验（§8.2）：原版施放后一次发放，AOE 各目标取最大（不逐目标累加）
      if (attacker._stratExpPending != null) {
        const e = attacker._stratExpPending;
        delete attacker._stratExpPending;
        if (this._isPlayer(attacker)) {
          const up = attacker.gainExp(e);
          if (up) { if (this.onEvent) this.onEvent({ type: "levelUp", unit: attacker.id, lvl: up.lvl, learnedNew: up.learnedNew }); this.logEntry(`${attacker.name} 升至 ${up.lvl} 级！${up.learnedNew && up.learnedNew.length ? " 学会" + up.learnedNew.map(n=>`【${n}】`).join("") : ""}`, "sys"); }
        }
      }
      if (this.onEvent) this.onEvent({ type: "cast", attacker: attacker.id, skill: skillId, targets: targets.map(t=>t.id) });
      this.logEntry(`${attacker.name} 施放【${skill.name}】`, "sys");
      // 应用持续状态
      for (const t of targets) {
        if (t.isAlive && skill.effect) {
          for (const [k, v] of Object.entries(skill.effect)) {
            if (typeof v === "number" || typeof v === "boolean") {
              if (k === "duration") continue;
              const neg = (attacker.faction === "enemy" && skill.target === "enemy") || (attacker.faction === "ally" && skill.target === "allies");
              t.addStatus(k, typeof v === "number" ? v : true);
              if (skill.effect.duration) t.status[k] = { val: v, duration: skill.effect.duration };
            }
          }
        }
      }
    }

    async applySkill(attacker, target, skill) {
      /* 效果码：JW_REAL.strategies[realId].type 才是原版效果类型(0..27) */
      const _R0 = window.JW_REAL;
      const _s0 = (_R0 && _R0.strategies && skill.realId != null) ? _R0.strategies[skill.realId] : null;
      const effNum0 = (_s0 && typeof _s0.type === "number") ? _s0.type
                    : (typeof skill.type === "number" ? skill.type : -1);
      // 伤害型策略（含暗算20/毒烟33/八阵38/青龙64 等非元素类）统一走原版 StratDamage
      if (_isDamageStrategy(skill)) {
        const calc = this.computeDamage(attacker, target, skill);
        if (calc.hit) {
          /* 5 吸收HP / 6 吸收MP：伤害后按数值补给施法者 */
          if (effNum0 === 6) {
            const mp = Math.min(calc.dmg, target.mp);
            target.mp -= mp; attacker.mp = Math.min(attacker.maxMp, attacker.mp + mp);
          } else if (effNum0 === 5) {
            attacker.heal(Math.min(calc.dmg, Math.max(0, attacker.maxHp - attacker.hp)));
          }
          target.damage(calc.dmg);
          /* 15-18：毒烟(33/34)/定身(35/36) 等「伤害 + 附加状态」策略 */
          if (effNum0 >= 15 && effNum0 <= 18) {
            const st = { 15: "confused", 16: "poison", 17: "paralyzed", 18: "sealed" }[effNum0];
            if (st && target.isAlive) target.addStatus(st, true);
          }
          if (this.onEvent) this.onEvent({ type: "hit", attacker: attacker.id, target: target.id, dmg: calc.dmg, crit: calc.crit, hp: target.hp, maxHp: target.maxHp });
          this.logEntry(`【${skill.name}】击中 ${target.name} ${calc.dmg}`, "dmg");
          this.checkDeath(target);
          if (this._isPlayer(attacker)) {
            const kill = !target.isAlive;
            const up = attacker.gainExp(attacker.expFromStrategy(target, kill, target.faction === "enemy"));
            if (up) { if (this.onEvent) this.onEvent({ type: "levelUp", unit: attacker.id, lvl: up.lvl, learnedNew: up.learnedNew }); this.logEntry(`${attacker.name} 升至 ${up.lvl} 级！${up.learnedNew && up.learnedNew.length ? " 学会" + up.learnedNew.map(n=>`【${n}】`).join("") : ""}`, "sys"); }
          }
        } else {
          if (this.onEvent) this.onEvent({ type: "miss", attacker: attacker.id, target: target.id });
          this.logEntry(`【${skill.name}】未命中 ${target.name}`, "dmg");
          if (this._isPlayer(attacker)) {
            const up = attacker.gainExp(attacker.expFromStrategy(target, false, target.faction === "enemy"));
            if (up) { if (this.onEvent) this.onEvent({ type: "levelUp", unit: attacker.id, lvl: up.lvl, learnedNew: up.learnedNew }); this.logEntry(`${attacker.name} 升至 ${up.lvl} 级！${up.learnedNew && up.learnedNew.length ? " 学会" + up.learnedNew.map(n=>`【${n}】`).join("") : ""}`, "sys"); }
          }
        }
        return;
      }
      /* 原版策略效果类型（skill.type 即效果码，见 §5.1 与效果类型表 0..27）：
       * 5 吸收HP 6 吸收MP 7-10 能力/防御/反应/士气下降 11-14 上升
       * 15 混乱 16 中毒 17 麻痹 18 穷计 19 恢复HP 20 恢复MP 21 恢复状态 22 再次行动
       * 26 全部上升 27 机动上升。之前这些只打一行日志、实际不生效。 */
      /* 效果码来源：JW_REAL.strategies[realId].type 才是原版效果类型(0..27)；
       * JW_DATA.SKILLS 的 type 只是 'damage'/'heal'/'special' 之类的字符串。 */
      const _strat = _s0;
      const effNum = effNum0;
      if (effNum >= 5 && effNum <= 27) {
        const BUFF_IDX = { 7: 0, 8: 1, 9: 3, 10: 4, 11: 0, 12: 1, 13: 3, 14: 4 };
        const STATUS = { 15: "confused", 16: "poison", 17: "paralyzed", 18: "sealed" };
        let applied = false;
        if (effNum === 5 || effNum === 6) {
          // 吸收：造成伤害后按同样数值补给施法者（HP/MP）
          const calc = this.computeDamage(attacker, target, skill);
          if (calc.hit && calc.dmg > 0) {
            if (effNum === 5) {
              target.damage(calc.dmg);
              attacker.heal(Math.min(calc.dmg, Math.max(0, attacker.maxHp - attacker.hp)));
            } else {
              const mp = Math.min(calc.dmg, target.mp);
              target.mp -= mp; attacker.mp = Math.min(attacker.maxMp, attacker.mp + mp);
            }
            this.logEntry(`【${skill.name}】吸取 ${target.name} ${calc.dmg}`, "dmg");
            this.checkDeath(target);
            applied = true;
          } else {
            this.logEntry(`【${skill.name}】未命中 ${target.name}`, "dmg");
          }
        } else if (effNum >= 7 && effNum <= 14) {
          const idx = BUFF_IDX[effNum] != null ? BUFF_IDX[effNum] : 0;
          const down = effNum <= 10;
          if (!target.buffs) target.buffs = [3, 3, 3, 3, 3, 3];
          const cur = target.buffs[idx] != null ? target.buffs[idx] : 3;
          // 1:1 原版施放端跳级（§10 buff）：
          //   上升：cur<3 → 3；cur>=3 → 6（直接到 ×1.2 档）
          //   下降：cur>3 → 3；cur<=3 → 0（对称降到 0 档）
          // （衰减端 ≥4→×1.2 / ≤2→×0.8 已正确，仅此处施放端需跳级）
          target.buffs[idx] = down
            ? (cur > 3 ? 3 : 0)
            : (cur < 3 ? 3 : 6);
          this.logEntry(`【${skill.name}】${target.name} ${down ? "下降" : "上升"}（${["攻击","防御","精神","反应","士气","机动"][idx]}）`, down ? "debuff" : "heal");
          applied = true;
        } else if (STATUS[effNum]) {
          target.addStatus(STATUS[effNum], true);
          const label = { 15: "混乱", 16: "中毒", 17: "麻痹", 18: "穷计" }[effNum];
          this.logEntry(`【${skill.name}】${target.name} 陷入${label}状态`, "debuff");
          applied = true;
        } else if (effNum === 19) {
          target.heal(skill.power || (_strat && _strat.power) || 40);
          this.logEntry(`【${skill.name}】治疗 ${target.name}`, "heal");
          applied = true;
        } else if (effNum === 20) {
          target.mp = Math.min(target.maxMp, target.mp + (skill.power || (_strat && _strat.power) || 30));
          this.logEntry(`【${skill.name}】${target.name} 回复气力`, "heal");
          applied = true;
        } else if (effNum === 21) {
          target.clearAilments();
          this.logEntry(`【${skill.name}】${target.name} 状态恢复`, "heal");
          applied = true;
        } else if (effNum === 22) {
          target.hasActed = false;
          this.logEntry(`【${skill.name}】${target.name} 可再次行动`, "heal");
          applied = true;
        } else if (effNum === 26) {
          if (!target.buffs) target.buffs = [3, 3, 3, 3, 3, 3];
          for (let i = 0; i < 5; i++) target.buffs[i] = Math.min(5, (target.buffs[i] || 3) + 1);
          this.logEntry(`【${skill.name}】${target.name} 全能力上升`, "heal");
          applied = true;
        } else if (effNum === 27) {
          if (!target.buffs) target.buffs = [3, 3, 3, 3, 3, 3];
          target.buffs[5] = Math.min(5, (target.buffs[5] || 3) + 1);
          this.logEntry(`【${skill.name}】${target.name} 机动上升`, "heal");
          applied = true;
        }
        if (applied) {
          if (this.onEvent) this.onEvent({ type: "hit", attacker: attacker.id, target: target.id, dmg: 0, crit: false, hp: target.hp, maxHp: target.maxHp });
          if (this.scene && this.scene.refreshUnits) { try { this.scene.refreshUnits(); } catch (e) {} }
        }
        return;
      }
      switch (skill.type) {
        case "damage": {
          const calc = this.computeDamage(attacker, target, skill);
          if (calc.hit) {
            target.damage(calc.dmg);
            if (this.onEvent) this.onEvent({ type: "hit", attacker: attacker.id, target: target.id, dmg: calc.dmg, crit: calc.crit, hp: target.hp, maxHp: target.maxHp });
            this.logEntry(`【${skill.name}】击中 ${target.name} ${calc.dmg}`, "dmg");
            this.checkDeath(target);
            // 策略经验（§8.2）——原版施放后一次发放，AOE 各目标取最大，不逐目标累加
            if (this._isPlayer(attacker)) {
              const kill = !target.isAlive;
              const e = attacker.expFromStrategy(target, kill, target.faction === "enemy");
              attacker._stratExpPending = Math.max(attacker._stratExpPending || 0, e);
            }
          } else {
            if (this.onEvent) this.onEvent({ type: "miss", attacker: attacker.id, target: target.id });
            this.logEntry(`【${skill.name}】未命中 ${target.name}`, "dmg");
            if (this._isPlayer(attacker)) {
              const e = attacker.expFromStrategy(target, false, target.faction === "enemy");
              attacker._stratExpPending = Math.max(attacker._stratExpPending || 0, e);
            }
          }
          break;
        }
        case "heal": {
          target.heal(skill.power + Math.floor(attacker.mag * 0.3));
          if (this.onEvent) this.onEvent({ type: "heal", attacker: attacker.id, target: target.id, hp: target.hp, maxHp: target.maxHp });
          this.logEntry(`【${skill.name}】治疗 ${target.name}`, "heal");
          break;
        }
        case "buff": {
          if (this.onEvent) this.onEvent({ type: "buff", attacker: attacker.id, target: target.id });
          this.logEntry(`【${skill.name}】鼓舞 ${target.name}`, "heal");
          break;
        }
        case "debuff": {
          if (this.onEvent) this.onEvent({ type: "debuff", attacker: attacker.id, target: target.id });
          this.logEntry(`【${skill.name}】作用于 ${target.name}`, "sys");
          break;
        }
        default: break;
      }
    }

    checkDeath(unit) {
      if (unit.hp <= 0) {
        const cell = this.map.get(unit.x, unit.y);
        if (cell) cell.unit = null;
        unit.state = 0;      // 原版：阵亡离场（state 0），与撤退(state 3) 区分
        this.logEntry(`${unit.name} 阵亡！`, "sys");
        if (this.onEvent) this.onEvent({ type: "death", unit: unit.id });
        // 阵亡触发事件
        this.checkBattleEvents("death", unit, unit.x, unit.y);
      }
    }

    // ---- 物品使用（原版 0x41dc43，§4.6 道具命令）----
    // 返回 {ok, msg}；目标需为己方且在范围内
    itemUsableRange(itemId, caster) {
      // 原版物品范围 = Jiqi.wa[+0xc]（0xff→0x10）；此处默认相邻 1
      return 1;
    }
    /* 物品效果：1:1 原版 FUN_0041dc40 按 type 分派（0x47..0x54），数值取物品记录 base(+0x15)：
     *   71 豆/麦/米 → 回HP（base 50/120/255）        72 山泉水/杜康酒 → 回MP（base 40/80）
     *   73 正气丸 → 清 0x08 混乱                      74 解毒散 → 清 0x10 中毒
     *   75 活血草 → 清 0x02 麻痹                      76 醒脑丸 → 清 0x04 穷计
     *   77 碧灵丹 → 清 0x1e（麻+穷+毒，不清乱/怯/迷）
     *   78 武勇果→攻 79 智慧果→精 80 精壮果→防 81 敏捷果→速 82 好运果→命（各+1，上限100）
     *   83 经验果 → 经验 +base(150)                   84 印绶 → 兵种 class+1
     * 状态位映射由 FUN_0041ce09（'I'/'J'/'K'/'L'/'M' → 8/0x10/2/4/0x1e）与
     * FUN_0041d09f（case 0x4e..0x52 → 能力 idx 0/2/1/3/4）双处实证。 */
    itemEffect(itemId) {
      const R = window.JW_REAL;
      const it = R && R.items ? R.items[itemId] : null;
      if (!it) return { kind: "none" };
      const t = it.type, amt = it.base || 0;
      if (t === 71) return { kind: "heal_hp", amt: amt || 50 };
      if (t === 72) return { kind: "heal_mp", amt: amt || 40 };
      if (t === 73) return { kind: "cure", mask: 0x08 };
      if (t === 74) return { kind: "cure", mask: 0x10 };
      if (t === 75) return { kind: "cure", mask: 0x02 };
      if (t === 76) return { kind: "cure", mask: 0x04 };
      if (t === 77) return { kind: "cure", mask: 0x1e };
      if (t === 78) return { kind: "fruit", stat: "atk" };
      if (t === 79) return { kind: "fruit", stat: "mag" };
      if (t === 80) return { kind: "fruit", stat: "def" };
      if (t === 81) return { kind: "fruit", stat: "spd" };
      if (t === 82) return { kind: "fruit", stat: "hit" };
      if (t === 83) return { kind: "exp", amt: amt || 150 };
      if (t === 84) return { kind: "promote" };
      return { kind: "none" };
    }
    /* 可用性检查：1:1 原版 FUN_0041c4e9（执行路径 param_3=0）+ FUN_0041d430（印绶）。
     * 状态药（73..77）在执行时不拦截（无状态也可吃，只是无效）；经验果要求经验 ≤98；
     * 印绶要求 class<60、class%3≠2（已是本族顶阶）、(class%3+1)*20 ≤ 等级。 */
    canUseItem(itemId, target) {
      const R = window.JW_REAL;
      const it = R && R.items ? R.items[itemId] : null;
      if (!it || !target) return { ok: false, msg: "无法使用" };
      const t = it.type;
      if (t === 83 && (target.exp || 0) > 98) return { ok: false, msg: "经验值已满，不能使用。" };
      if (t === 84) {
        const c = target.clsId | 0;
        if (c >= 60) return { ok: false, msg: "该兵种无法再提升。" };
        if (c % 3 === 2) return { ok: false, msg: "该兵种无法再提升。" };
        if ((c % 3 + 1) * 20 > (target.lvl || 1)) {
          return { ok: false, msg: `下一个兵种需要等级${(c % 3 + 1) * 20}以上。` };
        }
      }
      if (t >= 78 && t <= 82) {
        const stat = this.itemEffect(itemId).stat;
        if ((target[stat] | 0) >= 100) return { ok: false, msg: "该项能力已经达到100，不能再提升了。" };
      }
      return { ok: true };
    }
    useItem(caster, itemId, target) {
      if (!caster.isAlive) return { ok: false, msg: "已阵亡" };
      const idx = caster.bag.indexOf(itemId);
      /* 单位包里没有 → 用共用仓库（原版道具店是共用堆叠，战斗里也能取用） */
      const app = (typeof window !== "undefined" && window.JW && window.JW.App) ? window.JW.App : null;
      let whEntry = null;
      if (idx < 0) {
        if (app && Array.isArray(app.warehouse)) whEntry = app.warehouse.find(e => e && e.id === itemId && (e.count || 0) > 0) || null;
        if (!whEntry) return { ok: false, msg: "没有该物品" };
      }
      // 目标检查：必须是己方
      if (target && (target.faction === "enemy")) return { ok: false, msg: "这是敌军部队。" };
      if (!target) target = caster;
      // 范围检查（默认相邻 1）
      const dist = U.chebyshev(caster.x, caster.y, target.x, target.y);
      if (dist > this.itemUsableRange(itemId, caster)) return { ok: false, msg: "不在范围之内。" };
      const eff = this.itemEffect(itemId);
      if (eff.kind === "none") return { ok: false, msg: "无法使用" };
      /* 前置可用性（1:1 原版 FUN_0041c4e9 执行路径 / FUN_0041d430 印绶）：
       * 经验>98 拒经验果；兵种到顶/等级不足拒印绶；能力=100 拒果实。 */
      const chk = this.canUseItem(itemId, target);
      if (!chk.ok) return chk;
      // 应用
      if (eff.kind === "heal_hp") { target.heal(eff.amt); }
      else if (eff.kind === "heal_mp") { target.mp = U.clamp(target.mp + eff.amt, 0, target.maxMp); }
      else if (eff.kind === "cure") { target.clearStatusBits(eff.mask); }
      else if (eff.kind === "all_up") { target.hp = target.maxHp; target.mp = target.maxMp; target.clearStatusBits(0x7e); }
      else if (eff.kind === "fruit") {
        const cap = { atk: 100, mag: 100, def: 100, spd: 100, hit: 100 };
        if (target[eff.stat] >= cap[eff.stat]) return { ok: false, msg: "该项能力已经达到100，不能再提升了。" };
        target[eff.stat] = Math.min(target[eff.stat] + 1, cap[eff.stat]);
      }
      else if (eff.kind === "exp") {
        /* 经验果 base=150（game_data id103），走统一 gainExp（100/级，70级封顶） */
        const up = target.gainExp ? target.gainExp(eff.amt) : null;
        if (up) {
          if (this.onEvent) this.onEvent({ type: "levelUp", unit: target.id, lvl: up.lvl, learnedNew: up.learnedNew });
          this.logEntry(`${target.name} 升至 ${up.lvl} 级！`, "sys");
        }
      }
      else if (eff.kind === "promote") {
        /* 印绶：class+1（promoteClass 内部再校验等级与 growth/HP/MP/新策略） */
        const pr = target.promoteClass ? target.promoteClass(target.clsId + 1) : { ok: false, msg: "无法提升" };
        if (!pr.ok) return pr;
        /* 战斗精灵同步：promo = clamp(新clsId - 人物基础cls, 0, 2)，
         * 走 real.js mkUnit 权威 spriteIndex（ov 覆盖表分支不受 promo 影响，重算无害）。 */
        if (target.pid != null) {
          const R = window.JW_REAL;
          const p = (window.JW_GAME && window.JW_GAME.persons) ? window.JW_GAME.persons[target.pid] : null;
          if (R && R.mkUnit && p) {
            const promo = Math.max(0, Math.min(2, target.clsId - (p.cls | 0)));
            try {
              const mk = R.mkUnit(target.pid, 0, 0, target.faction, { promo, lv: target.lvl });
              if (mk && mk.def && mk.def.spriteIdx != null) target.spriteIdx = mk.def.spriteIdx;
            } catch (e) {}
          }
        }
        if (this.onEvent) this.onEvent({ type: "classChange", unit: target.id, cls: target.clsId });
        this.logEntry(pr.msg, "sys");
      }
      // 消耗（包内直接移除；仓库则减 1）
      if (whEntry) { whEntry.count -= 1; if (whEntry.count <= 0 && app) app.warehouse = app.warehouse.filter(e => e !== whEntry); }
      else caster.bag.splice(idx, 1);
      const R2 = window.JW_REAL;
      const nm = (R2 && R2.items && R2.items[itemId]) ? R2.items[itemId].name : "道具";
      this.logEntry(`${caster.name} 使用 ${nm} 于 ${target.name}`, "sys");
      if (this.onEvent) this.onEvent({ type: "heal", attacker: caster.id, target: target.id, hp: target.hp, maxHp: target.maxHp });
      // 物品使用消耗行动（原版：道具命令结果 3 = 结束行动）
      caster.hasActed = true;
      return { ok: true, msg: "使用成功" };
    }

    // ---- 地形变化（op 0x58 terrain_change）----
    changeTerrain(x, y, newTerrainId, patch, scroll, silent) {
      const cell = this.map.get(x, y);
      if (!cell) return;
      const old = cell.tid;
      cell.tid = newTerrainId;
      cell.terrain = "t" + newTerrainId;
      if (!this._terrainChanges) this._terrainChanges = [];
      if (this._terrainChanges.length < 250) {
        this._terrainChanges.push({ x, y, new: newTerrainId, old, patch });
      }
      this.logEntry(`地形变化: (${x},${y}) ${old} → ${newTerrainId}`, "sys");
      if (this.onEvent) this.onEvent({ type: "terrain", x, y, old, new: newTerrainId });
    }
    undoTerrainChange(x, y, patch) {
      if (!this._terrainChanges) return;
      const idx = this._terrainChanges.findIndex(t => t.x === x && t.y === y && t.patch === patch);
      if (idx < 0) return;
      const t = this._terrainChanges.splice(idx, 1)[0];
      const cell = this.map.get(x, y);
      if (cell) { cell.tid = t.old; cell.terrain = "t" + t.old; }
      this.logEntry(`地形恢复: (${x},${y}) → ${t.old}`, "sys");
      if (this.onEvent) this.onEvent({ type: "terrain", x, y, old: t.new, new: t.old });
    }

    // ---- 单位行动（op 0x50 unit_status）----
    unitAction(pid, action, preWait, postWait) {
      const u = this.units.find(x => x.pid === pid);
      if (!u) return;
      if (this.onEvent) this.onEvent({ type: "unitAction", unit: u.id, action });
    }
    unitTurn(pid, targetPid, dir) {
      const u = this.units.find(x => x.pid === pid);
      if (!u) return;
      if (this.onEvent) this.onEvent({ type: "unitTurn", unit: u.id, dir });
    }
    // 战场对话（op 0x15 unit_say）
    unitSay(pid, text) {
      const u = this.units.find(x => x.pid === pid);
      if (!u) return;
      this.logEntry(`${u.name}: ${text}`, "dialog");
      if (this.onEvent) this.onEvent({ type: "unitSay", unit: u.id, text });
    }

    // 天气/地形修正表（EXE DAT_0048e100，6×6：行=天气0-5，列=地形tid0-5；
     // EXE FUN_004cf694(dmg, modVal) = dmg*modVal/100，累加到伤害）
    static WEATHER_TERRAIN_MOD = [
      [0,0,0,1,2,3], [0,0,0,0,1,2], [0,1,2,2,3,3],
      [0,0,1,1,4,4], [0,1,4,4,4,4], [0,0,189,225,202,248]
    ];

    // ---- 天气系统（0x44a1d4, table 0x48e100）----
    // weather: 0晴 1阴 2雨 3暴雨 4雪
    // 天气随机更新（0x449f91）
    updateWeather() {
      const r = Math.floor(Math.random() * 8);
      if (r < 6) { this.weather = r; return; }
      // 随机游走（原版 0x44efd9：天气按 6/7 掷值做相邻步进）
      let c = this.weather + 1;
      if (c > r) c -= 1;
      else if (c < r) c += 1;
      this.weather = (c === 0) ? 5 : (c === 7) ? 0 : c - 1;
    }
    // 天气策略可用性（0x41fec9）：火系 0-4 在天气>1 时不可用
    weatherBlocksFire(caster) {
      if (this.weather <= 1) return false;
      return !(caster.hasEffect && caster.hasEffect(50)); // effect 50 左思兵法豁免
    }

    // ---- 再移动（effect 82）----
    canRemove(unit) {
      return unit.hasEffect && unit.hasEffect(82);
    }
    removable(unit) {
      // 再移动：清 flag 再移动
      if (!this.canRemove(unit)) return false;
      if (!unit.hasActed || !unit.hasMoved) return false;
      unit.hasActed = false;
      unit.hasMoved = false;
      return true;
    }

    // ---- 连续攻击（effect 90）----
    /* 0x43dada：攻击收尾后，若攻击者仍站立、未陷 乱(0x08)/怯(0x20)/迷(0x40)，可再选一次目标 */
    canContinuousAttack(attacker) {
      if (!(attacker.hasEffect && attacker.hasEffect(90))) return false;
      if (!attacker.isAlive) return false;
      const st = attacker.status || {};
      return !(st.confused || st.fear || st.lost);
    }
    // 连续策略（effect 83）：第二次施放 MP×2
    isSecondCast(attacker) {
      return attacker._stratChain === true;
    }
    setSecondCast(attacker, val) {
      attacker._stratChain = val;
    }

    // ---- 引导攻击（名表46；FUN_004cf398(u,0x2e,0x39,1,0) → key=0x39(57)）----
    // 载体 = special==57 白羽扇/华铤（2026-11-04 key 判据修正，旧绑 46 死码）
    hasGuidedAttack(attacker) {
      return attacker.hasEffect && attacker.hasEffect(57);
    }
    /* 引导攻击下一目标（0x436586/§10.5 简化）：攻击者射程内的最近存活敌
     * （原版：射程形状内，若列表含 [0x4b2c28]=被杀者槽位则跳过，否则取最优/最后一个） */
    nextGuidedTarget(attacker) {
      let best = null, bestDist = Infinity;
      for (const e of this.enemies) {
        if (!e.isAlive) continue;
        if (!this.inRange(attacker, e)) continue;
        const d = Math.abs(e.x - attacker.x) + Math.abs(e.y - attacker.y);
        if (d < bestDist) { bestDist = d; best = e; }
      }
      return best;
    }
    // 目标死后链击最近敌
    guidedAttack(attacker, killedTarget) {
      if (!this.hasGuidedAttack(attacker)) return null;
      // 找最近敌方
      let best = null, bestDist = Infinity;
      for (const e of this.enemies) {
        if (!e.isAlive) continue;
        const d = U.manhattan(attacker.x, attacker.y, e.x, e.y);
        if (d < bestDist) { bestDist = d; best = e; }
      }
      return best;
    }

    // ---- 暗杀标记（策略 21）----
    markAssassination(target) {
      // [0x569f00+idx] = 2，2 回合后降为 1 HP
      if (!this._assassinationMarks) this._assassinationMarks = [];
      const idx = this.units.indexOf(target);
      if (idx >= 0) this._assassinationMarks[idx] = 2;
    }
    tickAssassinationMarks() {
      if (!this._assassinationMarks) return;
      for (let i = 0; i < this._assassinationMarks.length; i++) {
        if (this._assassinationMarks[i] > 0) {
          this._assassinationMarks[i]--;
          if (this._assassinationMarks[i] === 0) {
            const u = this.units[i];
            if (u && u.isAlive) { u.hp = 1; this.logEntry(`${u.name} 被暗杀标记击中，降至1HP！`, "dmg"); }
          }
        }
      }
    }

    // ---- 地形恢复（据点 18-22）----
    // 原版 0x4351c0: 城池25% 关隘20% 鹿砦20% 村庄15% 兵营20%
    static HEAL_TERRAIN = { 18: 25, 19: 20, 20: 20, 21: 15, 22: 20 };
    /* §9.4 再生（原版 0x43cddd，自己阶段开始时）
     * heal = 地形% × MaxHP（城池25/关隘20/鹿砦20/村庄15/兵营20）
     *      + 若有 effect 18「每回合恢复HP」再加 MaxHP / value
     * heal 截到 MaxHP - HP；MP = effect 19 的 value，截到 MaxMP - MP。 */
    terrainHeal(unit) {
      const cell = this.map.get(unit.x, unit.y);
      let heal = 0;
      const pct = cell ? Battle.HEAL_TERRAIN[cell.tid] : 0;
      if (pct) heal += Math.floor(unit.maxHp * pct / 100);
      if (unit.hasEffect && unit.hasEffect(18)) {
        const v = unit.effectValue(18);
        if (v > 0) heal += Math.floor(unit.maxHp / v);
      }
      heal = Math.min(heal, Math.max(0, unit.maxHp - unit.hp));
      if (heal > 0) unit.heal(heal);
      // MP 回复（effect 19）
      if (unit.hasEffect && unit.hasEffect(19)) {
        const v = unit.effectValue(19);
        const mp = Math.min(v, Math.max(0, unit.maxMp - unit.mp));
        if (mp > 0) { unit.mp += mp; if (this.onEvent) this.onEvent({ type: "mpRecover", unit: unit.id, amount: mp }); }
      }
      return heal;
    }

    // ---- 我方阶段开始恢复（原版 0x43c7d6）----
    // r = 100 若有 effect 20（夜明盔）否则武将胆魄(hit)；地形回血 + 状态按 r% 几率恢复
    phaseStartRecovery(units) {
      const healed = [], recovered = [];
      const ch = (p) => Math.floor(Math.random() * 100) < p;
      /* §12.3 阶段开始技能（0x401118，先于 StatusRecovery）：
       *  29 云袖(吴懿)：3×3 同阵营友军 HP + min(等级+50, 缺额)
       *  31 仙乐(高翔)：3×3 同阵营友军 MP + min(等级/4+1, 缺额)
       *  42 神将(黄崇)：自身攻击 buff = 6（最大）
       *  23 明镜(魏征位)：相邻同阵营带状态单位 → 全状态清除且跳过恢复掷骰 */
      for (const o of this.units) {
        if (!o.isAlive || o.pid == null) continue;
        if (o.pid === 29 || o.pid === 31) {
          for (const [dy] of [[0], [1], [2]]) for (let dx = -1; dx <= 1; dx++) {
            const ax = o.x + dx, ay = o.y + (dy - 1);
            if (ax < 0 || ay < 0) continue;
            const t = this.unitAt(ax, ay);
            if (!t || t === o || t.faction !== o.faction) continue;
            if (o.pid === 29) {
              const h = Math.min(o.lvl + 50, Math.max(0, t.maxHp - t.hp));
              if (h > 0) { t.heal(h); healed.push({ unit: t, amount: h }); }
            } else {
              const m = Math.min(Math.floor(o.lvl / 4) + 1, Math.max(0, t.maxMp - t.mp));
              if (m > 0) t.mp += m;
            }
          }
        } else if (o.pid === 42) {
          o.setBuffLevel(0, 6);
        }
      }
      const mingJing = (u) => this.units.some(o => o.isAlive && o.pid === 23 && o.faction === u.faction
        && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1);
      for (const u of units) {
        if (!u.isAlive) continue;
        const h = this.terrainHeal(u);
        if (h > 0) healed.push({ unit: u, amount: h });
        /* §9.4 尾段（0x43cddd，仅玩家色）：64 恢复MP宝物→人物经验 value·exp_mult/100；
         *  22 轩辕宝鉴→武器经验；23 天闻录→防具经验（值 &0xff，每回合直接加） */
        if (u.faction === "ally" && u.hasEffect) {
          if (u.hasEffect(64)) {
            const e = Math.floor(u.effectValue(64) * (u.expMult() & 0xff) / 100);
            if (e > 0) u.gainExp && u.gainExp(e);
          }
          if (u.hasEffect(22) && u.weapon != null && u.weapon !== 255) u.gainEquipExp("weapon", u.effectValue(22) & 0xff);
          if (u.hasEffect(23) && u.armor != null && u.armor !== 255) u.gainEquipExp("armor", u.effectValue(23) & 0xff);
        }
        /* §9.2 状态恢复：r = 100（effect 20 每回合恢复状态）否则原始胆魄
         * 麻/穷/毒 chance(r)；怯/迷 r==100 或 chance(r - r/10)；乱 r==100 或 chance(max(r-15,10))
         * 明镜（§12.3/0x43c80a）：相邻魏征位 → 直接全清，不掷骰 */
        const r = (u.hasEffect && u.hasEffect(20)) ? 100 : ((u._raw && u._raw[4]) || u.hit || 85);
        let cleared = false;
        if (u.status && Object.keys(u.status).length) {
          if (mingJing(u)) {
            for (const k of ["paralyzed", "sealed", "confused", "poison", "fear", "lost"]) delete u.status[k];
            cleared = true;
          } else {
            if (u.status.paralyzed && ch(r)) { delete u.status.paralyzed; cleared = true; }
            if (u.status.sealed && ch(r)) { delete u.status.sealed; cleared = true; }
            if (u.status.poison && ch(r)) { delete u.status.poison; cleared = true; }
            const rf = r === 100 || ch(Math.max(r - Math.floor(r / 10), 1));
            if (u.status.fear && rf) { delete u.status.fear; cleared = true; }
            if (u.status.lost && rf) { delete u.status.lost; cleared = true; }
            const rc = r === 100 || ch(Math.max(r - 15, 10));
            if (u.status.confused && rc) { delete u.status.confused; cleared = true; }
          }
        }
        if (cleared) recovered.push(u);
        /* §9.3 Buff 衰减（0x43c975）：b≥5 −1；b≤1 +1；b==4 chance(q)→3；b==2 chance(r)→3
         *  q = 原始胆魄>50 ? 10 : max(60−胆魄,0) */
        const rawMor = (u._raw && u._raw[4]) || u.hit || 85;
        const q = rawMor > 50 ? 10 : Math.max(60 - rawMor, 0);
        if (u.buffs) for (let i = 0; i < 6; i++) {
          const b = u.buffs[i];
          if (b >= 5) u.buffs[i] = b - 1;
          else if (b <= 1) u.buffs[i] = b + 1;
          else if (b === 4) { if (ch(q)) u.buffs[i] = 3; }
          else if (b === 2) { if (ch(r)) u.buffs[i] = 3; }
        }
      }
      if (healed.length && this.onEvent) this.onEvent({ type: "phaseRecover", healed: healed.map(x => ({ id: x.unit.id, amount: x.amount })) });
      return { healed, recovered };
    }

    // ---- AI 完整行为（CellScore/BestPhysical/BestStrategy）----
    aiCellScore(unit, cell) {
      let score = 0;
      const tid = this.map.get(cell.x, cell.y)?.tid || 0;
      if (tid >= 18 && tid <= 22) score += 8;
      else {
        const te = unit.terrEffect && unit.terrEffect[tid];
        if (te !== undefined && te !== 255) score += Math.max(te - 10, 0);
      }
      if (unit.ai !== 4) {
        const atkCells = this.attackRange(unit, cell.x, cell.y);
        for (const ac of atkCells) {
          const target = this.map.get(ac.x, ac.y)?.unit;
          if (target && target.isAlive && target.faction !== unit.faction) {
            score += this.aiPhysScore(unit, target, cell);
          }
        }
        // 接近引导（原版 AI 主动进攻：无攻击目标时向最近敌人推进）
        if (score === 0) {
          let minD = Infinity;
          for (const t of this.units) {
            if (!t.isAlive || t.faction === unit.faction || t.faction === "friend") continue;
            if (unit.faction === "enemy" && t.faction !== "ally") continue;
            const d = U.manhattan(cell.x, cell.y, t.x, t.y);
            if (d < minD) minD = d;
          }
          if (minD < Infinity) score += Math.max(0, 12 - minD);
        }
      }
      if (!unit.hasStatusBit || !unit.hasStatusBit(0x04)) {
        score += this.aiStratScore(unit, cell);
      }
      return Math.min(255, score);
    }
    aiPhysScore(unit, target, cell) {
      let s = 0;
      const d = this.computeDamage(unit, target, null, 0).dmg;
      if (d >= target.hp) s = 80;
      else if (d * 10 / target.maxHp >= 1) s = 16;
      else if (target.hp * 100 / target.maxHp <= 40) s = 16;
      else if (unit.aiParam === 1) s = 10;
      else s = 2;
      if (target.hasStatusBit && target.hasStatusBit(0x08)) s += 8;
      const counterCells = this.attackRange(target, target.x, target.y);
      if (counterCells.some(c => c.x === cell.x && c.y === cell.y) && s > 1) s -= 1;
      return Math.max(0, s);
    }
    aiStratScore(unit, cell) {
      let best = 0;
      for (const sk of unit.skills) {
        const skill = window.JW_DATA.SKILLS[sk];
        if (!skill || unit.mp < skill.mp) continue;
        const castCells = this.strategyCastRange(skill, unit);
        if (!castCells.some(c => c.x === cell.x && c.y === cell.y)) continue;
        if (skill.type === "damage" || window.JW_RULES.catOf(skill.realId || skill.id) <= 3) {
          const targets = this.strategyArea(skill, unit, { x: cell.x, y: cell.y })
            .map(p => this.map.get(p.x, p.y)?.unit)
            .filter(t => t && t.isAlive && t.faction !== unit.faction);
          for (const t of targets) {
            const d = this.stratDamage(unit, t, skill, true);
            if (d >= t.hp) best = Math.max(best, 76);
            else if (d * 10 / t.maxHp >= 3) best = Math.max(best, 30);
            else if (d * 10 / t.maxHp >= 1) best = Math.max(best, 10);
            else best = Math.max(best, 1);
          }
        }
      }
      return best;
    }
    /* 朝指定坐标走一步（AI 模式 4/6 用）：在可移动范围内选离目标最近、代价可接受的格。
     * 返回 {x,y}；已在目标或无法接近时返回 null。 */
    aiStepToward(unit, tx, ty) {
      if (tx == null || ty == null) return null;
      if (unit.x === tx && unit.y === ty) return null;
      let reach = [];
      try { reach = this.moveRange(unit) || []; } catch (e) { reach = []; }
      const dist = (p) => Math.abs(p.x - tx) + Math.abs(p.y - ty);
      let best = null, bestD = dist(unit), bestCost = Infinity;
      for (const p of reach) {
        const d = dist(p);
        const cost = p.cost != null ? p.cost : 0;
        if (d < bestD || (d === bestD && cost < bestCost)) { best = p; bestD = d; bestCost = cost; }
      }
      return best ? { x: best.x, y: best.y } : null;
    }

    aiChoosePosition(unit) {
      const reach = this.moveRange(unit);
      const positions = [{ x: unit.x, y: unit.y, cost: 0 }, ...reach];
      let best = unit, bestScore = -1;
      for (const pos of positions) {
        const score = this.aiCellScore(unit, pos);
        if (score > bestScore) { bestScore = score; best = pos; }
      }
      return best;
    }

    // ---- 撤退/再入场 ----
    retreat(unit) {
      const cell = this.map.get(unit.x, unit.y);
      if (cell) cell.unit = null;
      unit.x = -1; unit.y = -1;
      unit.state = 3;          // 原版：撤退即 state 3，unit_reenter 只认 state 3
      unit.hasActed = true;
      this.logEntry(`${unit.name} 撤退`, "sys");
    }
    reenter(unit, x, y) {
      const cell = this.map.get(x, y);
      if (!cell || cell.unit) return false;
      unit.x = x; unit.y = y;
      unit.state = 2;          // 重新入场 = 回到场上
      cell.unit = unit;
      unit.hasActed = false;
      unit.hasMoved = false;
      this.logEntry(`${unit.name} 再入场 (${x},${y})`, "sys");
      return true;
    }

    // ---- 战场事件系统 ----
    // 事件定义：{id, trigger:"reach"|"death"|"turn_start"|"turn_end"|"terrain", condition:{pid,x,y}, action:{type:"say"|"action"|"terrain", text, ...}}

    // 加载战场事件（从 EEX 脚本 otherOps）
    loadBattleEvents(cfg) {
      this.battleEvents = [];
      const ops = (cfg && cfg.otherOps) || [];
      for (const op of ops) {
        const opcode = op.op;
        const args = op.args || [];
        // op 0x15 unit_say: [pid, text]
        if (opcode === 0x15 || opcode === "unit_say") {
          this.battleEvents.push({
            id: "say_" + this.battleEvents.length,
            trigger: "manual",
            action: { type: "say", pid: args[0], text: args[1] || "" }
          });
        }
        // op 0x50 unit_status: [pid, action, pre, post]
        else if (opcode === 0x50 || opcode === "unit_status") {
          this.battleEvents.push({
            id: "action_" + this.battleEvents.length,
            trigger: "manual",
            action: { type: "action", pid: args[0], action: args[1] || 0 }
          });
        }
        // op 0x5b target_area: [x1,y1,x2,y2,flag] → 到达指定地点
        else if (opcode === 0x5b || opcode === "op_5b") {
          this.targetArea = { x1: args[0], y1: args[1], x2: args[2], y2: args[3] };
        }
        // op 0x58 terrain_change: [patch, alt, terrain, x, y, scroll, silent]
        else if (opcode === 0x58 || opcode === "op_58") {
          this.battleEvents.push({
            id: "terrain_" + this.battleEvents.length,
            trigger: "manual",
            action: { type: "terrain", patch: args[0], alt: args[1], terrain: args[2], x: args[3], y: args[4] }
          });
        }
      }
    }

    // 检查并触发事件
    checkBattleEvents(trigger, unit, x, y) {
      for (const ev of this.battleEvents) {
        if (this._eventTriggered.has(ev.id)) continue;
        if (ev.trigger !== trigger) continue;
        // 检查条件
        if (trigger === "reach" && ev.condition) {
          if (unit.pid !== ev.condition.pid) continue;
          if (ev.condition.x !== undefined && x !== ev.condition.x) continue;
          if (ev.condition.y !== undefined && y !== ev.condition.y) continue;
        }
        if (trigger === "death" && ev.condition) {
          if (unit.pid !== ev.condition.pid) continue;
        }
        this._eventTriggered.add(ev.id);
        this.triggerEvent(ev);
      }
    }

    // 触发单个事件
    triggerEvent(ev) {
      const a = ev.action;
      if (!a) return;
      if (a.type === "say") {
        this.unitSay(a.pid, a.text);
      } else if (a.type === "action") {
        this.unitAction(a.pid, a.action, 0, 0);
      } else if (a.type === "terrain") {
        if (a.alt === 0) this.changeTerrain(a.x, a.y, a.terrain, a.patch, 0, 0);
        else this.undoTerrainChange(a.x, a.y, a.patch);
      }
    }

    // ---- 原版战斗脚本引擎（S_XX.eex 事件层 1:1）----
    /* 原版 0x419908：`mov dword [0x4ae4c0], 1` —— 对话框/弹窗关闭时置一次性待处理标志，
     * test_pending(0x415c46) 读到后立即清零。 */
    pulsePending() { this._pendingFlag = true; }
    /* 原版 0x2D test_clicked（0x4119e7）：GS+0 & 0x20 且事件槽 1（被点击的角色）== arg。
     * UI 点击单位时记录被点击的人物号并置点击事件标志。 */
    markClicked(u) {
      if (!u) return;
      this._clickedActor = u.pid !== undefined ? (u.pid | 0) : (u.id | 0);
      this._clickEvent = true;
      if (!this.clickedUnits) this.clickedUnits = new Set();
      this.clickedUnits.add(u.id);
      if (u.pid !== undefined) this.clickedUnits.add(u.pid);
    }
    /* 原版 CountUnits（0x44c8e6）的 side 编码：
     * 0 我方 1 友军 2 敌军 3 敌方 kind3 4 我方+友军 5 全部敌军 6 全部。 */
    _unitsOfSide(side) {
      /* 权威 CountUnits 按「在场上（state 2，任意 HP）」计数，不能用 isAlive（那是 hp>0），
       * 因此从 units 全集按 faction 重取，并只保留 state 2。 */
      const onMap = (this.units || []).filter(u => u && u.state === 2);
      const allies = onMap.filter(u => u.faction === "ally");
      const friends = onMap.filter(u => u.faction === "friend");
      const enemies = onMap.filter(u => u.faction === "enemy");
      switch (side | 0) {
        case 0: return allies;
        case 1: return friends;
        case 2: return enemies.filter(u => !u.kind3);
        case 3: return enemies.filter(u => u.kind3);
        case 4: return allies.concat(friends);
        case 5: return enemies;
        case 6: return allies.concat(friends, enemies);
        default: return [];
      }
    }
    _findUnitByPerson(pid) {
      return this.units.find(u => u.pid === pid) || null;
    }
    /* 某格上的存活单位（策略模仿 51 的 4 邻域查询用） */
    unitAt(x, y) {
      return this.units.find(u => u.isAlive && u.x === x && u.y === y) || null;
    }
    // 条件评估（eex_format_doc.md 条件 op 1:1）
    _evalCond(c) {
      const a = c.args || [];
      if (c.name === "comment" || c.name === "end" || c.name === "if") return true; // 注释/结构 op 不参与条件判定
      switch (c.name) {
        case "test_turn": {
          /* 原版 0x3F：args [n, cmp]；cmp 0 → 回合 ≥ n，1 → 回合 < n，其余 → 回合 == n
           * （文档 tags 04 24：n + 比较码；实测数据第二参数只有 0/1/2 三种） */
          const n = a[0] | 0 || 1;
          const cmp = a[1] !== undefined ? (a[1] | 0) : 2;
          if (cmp === 0) return this.round >= n;
          if (cmp === 1) return this.round < n;
          return this.round === n;
        }
        case "test_side": {
          /* 原版 0x40：args [side]，side 0=我方 1=友军 2=敌方。
           * 本引擎没有独立友军回合（友军与我方同相位），故 1 按我方处理。 */
          const side = a[0] | 0;
          if (side === 2) return this.phase === "enemy";
          return this.phase !== "enemy";
        }
        case "test_adjacent": {
          // [personA, personB, flag]：两单位相邻（含 0=姜维）
          const ua = this._findUnitByPerson(a[0]), ub = this._findUnitByPerson(a[1]);
          if (!ua || !ub || !ua.isAlive || !ub.isAlive) return false;
          return Math.max(Math.abs(ua.x - ub.x), Math.abs(ua.y - ub.y)) <= 1;
        }
        case "test_unit_in_area": {
          // op 0x26 args [side, x1, y1, x2, y2]：side 0=己方任一存活单位在矩形内
          //   证据：S_01 sec12 [0,15,0,17,1]=城门 x15-17,y0-1；sec2 [0,7,0,28,7]=北带
          const side = a[0], x1 = Math.min(a[1], a[3]), x2 = Math.max(a[1], a[3]);
          const y1 = Math.min(a[2], a[4]), y2 = Math.max(a[2], a[4]);
          const pool = side === 0 ? this.sideUnits : this.enemies;
          return pool.some(u => u.isAlive && u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2);
        }
        case "test_unit_at": {
          /* 原版 0x25：args [person 或选择器, x, y]。
           * 选择器 0x400..0x402 = 当前单位（0x401 主将，0x402 视为姜维），
           * 其余 < 0x400 作人物 id。实测 844/956 使用 1025=0x401。 */
          const code = a[0] | 0, x = a[1] | 0, y = a[2] | 0;
          let u = null;
          if (code >= 0x400) {
            const sel = code - 0x400;
            u = (sel <= 1)
              ? (this.units.find(o => o.leader && o.isAlive) || this.units.find(o => o.pid === 0 && o.isAlive) || null)
              : (this.units.find(o => o.pid === 0 && o.isAlive) || null);
          } else {
            u = this._findUnitByPerson(code);
          }
          if (!u) return false;
          return u.x === x && u.y === y;
        }
        case "test_attr": {
          /* 原版 0x36：args [person, attr, 阈值, cmp]；实测 attr 全是 7（HP）。
           * cmp 0 → HP ≥ 阈值，1 → HP < 阈值，其余（2）→ HP == 阈值。
           * 大量 poll 用 [x,7,0,2] 表示「该武将已阵亡/已离场」。 */
          const u = this._findUnitByPerson(a[0]);
          const attr = a[1] | 0, th = a[2] | 0, cmp = a[3] !== undefined ? (a[3] | 0) : 2;
          const val = u ? (attr === 7 ? u.hp : 0) : 0;
          if (cmp === 0) return val >= th;
          if (cmp === 1) return val < th;
          return val === th;
        }
        case "test_event5": return !!this._scriptFlags.event5;
        case "test_event6": return !!this._scriptFlags.event6;
        case "test_flags": {
          /* 原版 test_flags args = [需要置位的旗…, 需要清除的旗…]
           * （形如 [[1003],[19]] / [[],[10,1003]]）。之前一律放行会让所有
           * 靠旗位把关的 poll（含 ui_49 判胜）一开局就触发，必须真实判定。 */
          const mustSet = Array.isArray(a[0]) ? a[0] : [];
          const mustClear = Array.isArray(a[1]) ? a[1] : [];
          const F = this._scriptFlags || {};
          const isSet = (id) => {
            const v = F[id] !== undefined ? F[id] : F[String(id)];
            return v !== undefined && v !== null && v !== 0 && v !== false;
          };
          if (mustSet.some(id => !isSet(id))) return false;
          if (mustClear.some(id => isSet(id))) return false;
          return true;
        }
        /* 原版 0x41 test_units_in_area（0x41149d，rules_ref §10.6）：
         * args [side, n, mode, rect_flag, x1, y1, x2, y2]；
         * c = side 一侧在场单位数（rect_flag 1 → 只数矩形内，否则全图），与 n 比较。
         * mode 0 → ≥，1 → <，其它 → ==（与 test_turn / test_attr 同一 compare 约定）。
         * side 编码（CountUnits 0x44c8e6）：0 我方 1 友军 2 敌军 3 敌方 kind3
         * 4 我方+友军 5 全部敌军 6 全部。 */
        case "test_units_in_area": {
          const side = a[0] | 0;
          const th = a[1] | 0;
          const cmp = a[2] !== undefined ? (a[2] | 0) : 2;
          const inRect = (a[3] | 0) === 1;
          const x1 = Math.min(a[4] | 0, a[6] | 0), x2 = Math.max(a[4] | 0, a[6] | 0);
          const y1 = Math.min(a[5] | 0, a[7] | 0), y2 = Math.max(a[5] | 0, a[7] | 0);
          /* 权威（rules_ref §CountUnits）：在场上（state 2，任意 HP）计数；
           * _unitsOfSide 已按 state 2 过滤，这里不能再加 isAlive（hp>0），
           * 否则 HP 归零但尚未移到 state 0 的单位会被漏算。 */
          const pool = this._unitsOfSide(side);
          const n = pool.filter(u => u && (inRect
            ? (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2)
            : true)).length;
          if (cmp === 0) return n >= th;
          if (cmp === 1) return n < th;
          return n === th;
        }
        /* 原版 0x07 test_pending（0x415c46，已反汇编确认）：
         *   xor eax,eax
         *   cmp dword [0x4ae4c0], eax     ; 一次性待处理标志
         *   je  +9                        ; 未置位 → 返回 0
         *   mov dword [0x4ae4c0], eax     ; 读后立即清零（只触发一次）
         *   mov al, 1                     ; 返回 1
         * 置位方是同一条关闭路径上的 `mov dword [0x4ae4c0], 1`（0x419908），
         * 由 UI 在弹窗/对话框关闭时触发。 */
        case "test_pending": {
          if (!this._pendingFlag) return false;
          this._pendingFlag = false;      // 权威：读后立即清零
          return true;
        }
        /* 原版 0x2D test_clicked（0x4119e7）：GS+0 & 0x20（点击事件标志）且
         * 事件槽 1（被点击的角色 person）== arg。
         * UI 点击单位时由 markClicked 记录 person 并置 clickEvent 标志。 */
        case "test_clicked": {
          if (!this._clickEvent) return false;
          return (this._clickedActor | 0) === (a[0] | 0);
        }
        /* 原版 0x0C 战斗内 choice 的结果寄存器（Reader+0x2038 同族，lastChoice=idx+1）；
         * S_19 战斗选项分支用（2026-11-06 R9 接入战斗层）。 */
        case "test_choice": return (this._lastChoice | 0) === (a[0] | 0);
        case "test_victory": return false; // 由引擎胜负判定接管
        case "test_defeat": return false;
        default: return false;
      }
    }
    _evalConds(conds) {
      // 条件数组：全 test_* 需要全部满足（原版 cond 为 AND，0x0 end 为段尾）
      const tests = conds.filter(c => c.name && c.name.startsWith("test_"));
      if (!tests.length) return false;
      return tests.every(c => this._evalCond(c));
    }
    // 解析 dialog 文本 "&who\ntext\n&who2\ntext2" -> [{who,text}]
    _parseDialog(t) {
      const parts = String(t || "").split("&").map(x => x.trim()).filter(Boolean);
      const out = [];
      for (const p of parts) {
        const nl = p.indexOf("\n");
        if (nl < 0) continue;
        out.push({ who: p.slice(0, nl).trim(), text: p.slice(nl + 1).trim() });
      }
      return out;
    }
        /* 战斗脚本 IF 条件求值（op 0x05 test_flags 直证：set 全置位且 clear 全未置位） */
    _evalBattleCond(c) {
      if (!c) return true;
      if (c.name === "test_flags") {
        const set = c.args[0] || [], clr = c.args[1] || [];
        return set.every(id => !!this._scriptFlags[id]) && clr.every(id => !this._scriptFlags[id]);
      }
      return true; /* comment/choice 等保守通过 */
    }
    /* 1:1 FUN_0041885a：敌方等级基准 = 我方等级表降序前 min(4,n) 人均值（min 1） */
    _partyLevelBase() {
      const App = (typeof window !== "undefined" && window.JW && window.JW.App) ? window.JW.App : null;
      const lvs = [];
      if (App && App.roster) for (const k of Object.keys(App.roster)) { const r = App.roster[k]; if (r && r.lvl) lvs.push(r.lvl | 0); }
      if (!lvs.length) for (const u of this.units) if (u.faction === "ally" && u.isAlive && u.lvl) lvs.push(u.lvl);
      if (!lvs.length) return 1;
      lvs.sort((x, y) => y - x);
      const top = Math.min(4, lvs.length);
      let s = 0; for (let i = 0; i < top; i++) s += lvs[i];
      return Math.max(1, Math.round(s / top));
    }
    async _runActions(actions, label) {
      // 原版 if 分支：条件不满足的分支应跳过。我们没有实现全部条件码，
      // 退而求其次：部署/设定/演出类 op 只执行第一次出现（各分支互为替代）。
      const ONCE_OPS = new Set(["battle_allies", "battle_enemies", "battle_equipment", "battle_settings", "battle_init", "op_4b", "change_scene", "fade_out", "fade_in"]);
      const seenText = new Set();
      /* 1:1 索引走法：op1 IF（cond 真→顺行 child，假→跳到 end）、op3 ELSE（前一 IF 被跳才执行）、
       * op0 END 仅作块尾标记。S_00 开场的 flag1001 双变体即靠它选择。 */
      let _lastIfSkipped = false;
      for (let oi = 0; oi < actions.length; oi++) {
        const o = actions[oi];
        const a = o.args || [];
        if (o.name === "if" || o.op === 1) {
          const ok = this._evalBattleCond(o.cond);
          _lastIfSkipped = !ok;
          if (!ok && o.end != null) { oi = o.end - 1; }
          continue;
        }
        if (o.name === "else" || o.op === 3) {
          if (!_lastIfSkipped && o.end != null) { oi = o.end - 1; }
          continue;
        }
        if (o.name === "end" || o.op === 0) continue;
        if (ONCE_OPS.has(o.name)) {
          const key = o.name === "battle_equipment" ? "beq" : o.name;
          if (this["_once_" + key]) continue;
          this["_once_" + key] = true;
        }
        if (o.name === "dialog" || o.name === "unit_say") {
          const t = String(a[0]);
          if (seenText.has(t)) continue;
          seenText.add(t);
        }
        try {
        switch (o.name) {
          case "dialog": {
            for (const d of this._parseDialog(a[0])) {
              if (this.onEvent) this.onEvent({ type: "scriptDialog", who: d.who, text: d.text });
              await new Promise(r => setTimeout(r, 1400));
            }
            break;
          }
          case "unit_say": {
            this.unitSay(a[1], String(a[2] || "").trim());
            if (this.onEvent) this.onEvent({ type: "scriptDialog", who: "", text: String(a[2] || "") });
            await new Promise(r => setTimeout(r, 1200));
            break;
          }
          case "actor_remove": case "actor_select": {
            /* 原版 0x31 **actor_remove（武将消失）**（eex_format_doc 行 210，0x41311c）：
             * args [mode, person, x1, y1, x2, y2, side]
             *   mode 0   ：移除 person 的单位（0x45a7b7(person,1,0)）—— 剧本演出用；
             *   mode ≠ 0 ：移除矩形 (x1,y1)-(x2,y2) 内 side 阵营的全部单位（0xFFFF→6=全部）。
             * 旧实现把尾参 6 当「撤退」，还顺带判定「我方全灭 → 达成作战目的」，
             * 于是 S_00 赵云单挑结束、赵云按剧本离场时，就把整场判成胜利。
             * **这是剧本移除，不是战败撤退，绝不能触发胜负判定。** */
            const mode = a[0] !== undefined && a[0] !== 65535 ? (a[0] | 0) : 0;
            if (mode === 0) {
              const pid = a[1] | 0;
              const u = this._findUnitByPerson(pid);
              if (u && u.state === 2) {
                const cell = this.map.get(u.x, u.y);
                if (cell && cell.unit === u) cell.unit = null;
                u.state = 0;            // 剧本移出战场：不进入"撤退/阵亡"统计
                u.x = -1; u.y = -1;
                if (pid === 25) { this._scriptFlags.zhaoRemoved = true; this._scriptFlags.event5 = true; }
                if (this.onEvent) this.onEvent({ type: "scriptRemove", person: pid });
              }
            } else {
              const x1 = a[2] | 0, y1 = a[3] | 0, x2 = a[4] | 0, y2 = a[5] | 0;
              const side = (a[6] === undefined || a[6] === 65535) ? 6 : (a[6] | 0);
              const lo = [Math.min(x1, x2), Math.min(y1, y2)];
              const hi = [Math.max(x1, x2), Math.max(y1, y2)];
              for (const u of this.units) {
                if (u.state !== 2) continue;
                if (u.x < lo[0] || u.x > hi[0] || u.y < lo[1] || u.y > hi[1]) continue;
                const match = side === 6 ? true
                  : side === 0 ? u.faction === "ally"
                  : side === 1 ? u.faction === "friend"
                  : u.faction === "enemy";
                if (!match) continue;
                const cell = this.map.get(u.x, u.y);
                if (cell && cell.unit === u) cell.unit = null;
                u.state = 0; u.x = -1; u.y = -1;
              }
              if (this.onEvent) this.onEvent({ type: "refresh" });
            }
            break;
          }
          case "get_item": {
            const itemId = a[0];
            if (window.JW_REAL && window.JW_REAL.items && window.JW_REAL.items[itemId]) {
              const it = window.JW_REAL.items[itemId];
              const nm = it.name;
              this.logEntry(`获得道具：${nm}`, "heal");
              if (this.onEvent) this.onEvent({ type: "scriptItem", item: itemId, name: nm });
            }
            break;
          }
          /* 原版 0x58 terrain_change（0x4166eb，377 处）。参数签名以 opcodes.json 为准：
           * [eff_a(patch), eff_b(alt), eff_c(terrain), int32, int32, person, person]
           * （rules_ref 描述为 patch/alt/terrain/x/y/scroll/silent，位置 3/4 是坐标）。
           * alt=0 → 改地形并记录（可撤销）；alt≠0 → 撤销同 (x,y,patch) 的记录。
           * 灭火典型写法 58 [2,1,0,x,y,1,1]。 */
          case "op_58": {
            const patch = a[0] | 0, alt = a[1] | 0, terrain = a[2] | 0;
            const x = a[3] | 0, y = a[4] | 0;
            const scroll = a[5] !== undefined && a[5] !== 65535 ? (a[5] | 0) : 0;
            if (alt === 0) this.changeTerrain(x, y, terrain, patch, scroll, 0);
            else this.undoTerrainChange(x, y, patch);
            if (scroll && this.onEvent) this.onEvent({ type: "centerOn", x, y });
            break;
          }
          /* 原版 0x5B target_area（0x416cbb，34 处）。opcodes.json 签名
           * [x1, y1, x2, y2, person]（第 5 参是 0xffff→0 的人物槽，非 flag）。
           * 记下目标区域，地图居中到中点并闪 3 次，用于「到达指定地点」类目标。 */
          case "op_5b": {
            /* 1:1 FUN_00416cbb：[x1,y1,x2,y2(type4), person(type26)]；0xffff→0；
             * positive = (person==0)（DAT_004b3d10）；居中=区域中点+矩形闪 3 次（FUN_0045a0ce 直证）。 */
            const x1 = a[0] | 0, y1 = a[1] | 0, x2 = a[2] | 0, y2 = a[3] | 0;
            const person = a[4] !== undefined && a[4] !== 65535 ? (a[4] | 0) : 0;
            this.targetArea = { x1, y1, x2, y2, person, positive: person === 0 };
            const cx = Math.floor((x1 + x2) / 2), cy = Math.floor((y1 + y2) / 2);
            const cells = [];
            for (let yy = Math.min(y1, y2); yy <= Math.max(y1, y2); yy++)
              for (let xx = Math.min(x1, x2); xx <= Math.max(x1, x2); xx++) cells.push({ x: xx, y: yy });
            if (this.onEvent) this.onEvent({ type: "centerOn", x: cx, y: cy, blink: cells });
            break;
          }
          /* 原版 0x5C（0x416e17，36 处）：把地图居中到该人物的在场单位并闪 3 次；无单位则不动作。 */
          case "op_5c": {
            const u = this._findUnitByPerson(a[0] | 0);
            if (u && u.isAlive && u.x >= 0) {
              if (this.onEvent) this.onEvent({ type: "centerOn", x: u.x, y: u.y, blink: [{ x: u.x, y: u.y }] });
            }
            break;
          }
          /* 原版 0x5D（0x417068，10 处）：回合上限。mode 0 = 设置（turn+1 > v 时拒绝），1 = 累加。 */
          case "op_5d": {
            const mode = a[0] | 0, v = a[1] | 0;
            if (mode === 1) this.maxRounds = (this.maxRounds || 0) + v;
            else if (this.round + 1 <= v) this.maxRounds = v;
            break;
          }
          /* 原版 0x52 change_class（0x414d15，33 处）。opcodes.json 签名 [person, unit_side]，
           * 但 rules_ref §10.6.1 明确语义是 change_class(person, class)：第二参为职业号。
           * 换职业后，新职业不能用的装备槽被清空（物品丢失）；战斗中重载图像。 */
          case "op_52": {
            const u = this._findUnitByPerson(a[0] | 0);
            if (!u) break;
            const newCls = a[1] | 0;
            u.clsId = newCls;
            const R = window.JW_REAL;
            if (R && R.classes && R.classes[newCls]) {
              const c = R.classes[newCls];
              u.cls = { move: c.move, growth: {}, weapon: null, armor: null, range: u.cls && u.cls.range };
              u.clsMove = c.move;
            }
            for (const key of ["weapon", "armor", "acc"]) {
              const id = u[key];
              if (id == null || id === 0 || id === 255 || id === 65535) continue;
              const it = R && R.items ? R.items[id] : null;
              if (it && typeof it.type === "number" && it.type < 26) {
                const need = it.type >> 1;
                const clsWeapon = (R.classes[newCls] || {}).weapon;
                if (clsWeapon != null && clsWeapon !== need) u[key] = 0;
              }
            }
            if (typeof u.recalcStats === "function") u.recalcStats();
            if (this.onEvent) this.onEvent({ type: "scriptStatus", unit: u.id });
            break;
          }
          /* 1:1 op 0x6D = FUN_00410d21（旧注 0x410cfc 是 0x6C 函数体内地址，作废）。
           * 签名表 DAT_00484ac8 = [40 02 04 02 04 04 2b 26]，与 opcodes.json 互证：
           * [select, uid, deployIdx, anchorUid, dx, dy, dir(0xffff=保持), style(1走/0跳)]。
           * 实测 5 用全为 [0,X,0,Y,0,0,65535,0]：援军 X 落到 Y 旁。坐标 >40 回绕（模 41）。 */
          case "op_6d": {
            const sel = a[0] | 0;
            let u6d = null;
            if (sel === 1 && (a[2] | 0) >= 0 && (a[2] | 0) < 0x10) {
              u6d = this.units[a[2] | 0] || null;   /* 部署槽重入（FUN_00418dd0 @0x492f90） */
            } else {
              u6d = this._findUnitByPerson(a[1] | 0);
            }
            if (!u6d) break;
            const anchor = this._findUnitByPerson(a[3] | 0);
            if (!anchor || anchor.x < 0) break;    /* EXE 逐帧等待锚点在场；同步脚本直接放弃 */
            const wrap41 = v => ((v % 41) + 41) % 41;
            const tx = wrap41((a[4] | 0) + anchor.x), ty = wrap41((a[5] | 0) + anchor.y);
            const dir6 = (a[6] | 0) === 0xffff ? u6d.dir : (a[6] | 0);
            const styleWalk = (a[7] | 0) === 1;
            const canStand = (x, y) => {
              const c = this.map.get(x, y);
              return !!c && this.map.inBounds(x, y) && (!c.unit || c.unit === u6d);
            };
            let px = tx, py = ty;
            if (!canStand(px, py)) {
              outer6d:
              for (let r = 1; r <= 3; r++) {
                for (let dy2 = -r; dy2 <= r; dy2++) for (let dx2 = -r; dx2 <= r; dx2++) {
                  if (Math.max(Math.abs(dx2), Math.abs(dy2)) !== r) continue;
                  if (canStand(tx + dx2, ty + dy2)) { px = tx + dx2; py = ty + dy2; break outer6d; }
                }
              }
            }
            const reenter = u6d.state !== 2 || u6d.x < 0;
            if (u6d.x >= 0 && this.map.get(u6d.x, u6d.y) && this.map.get(u6d.x, u6d.y).unit === u6d) {
              this.map.get(u6d.x, u6d.y).unit = null;
            }
            u6d.state = 2; u6d.x = px; u6d.y = py;
            const cell6 = this.map.get(px, py);
            if (cell6) cell6.unit = u6d;
            u6d.dir = dir6;
            if (this.onEvent) this.onEvent({ type: styleWalk ? "unitWalk" : "unitAppear", unit: u6d.id, x: px, y: py, dir: dir6 });
            if (this.onEvent) this.onEvent({ type: "centerOn", x: px, y: py });
            this.logEntry(u6d.name + (reenter ? " 入场" : " 移动") + "到 (" + px + "," + py + ")", "sys");
            if (this.scene && this.scene.refreshUnits) { try { this.scene.refreshUnits(); } catch (e) {} }
            break;
          }
          /* 1:1 op 0x1B = FUN_00413c56（handler 表 0x410a9c 直证）。
           * 流序按签名 [type2 值, type0x27 人物]：FUN_00418cb0 把人物记录 +0x20 = (值!=0)
           * （离场撤退台词标记；值读第一个、人物读第二个——旧实现读反，已修）。 */
          case "op_1b": {
            const u1b = this._findUnitByPerson(a[1] | 0);
            if (u1b) u1b.retreatLine = (a[0] | 0) !== 0;
            break;
          }
          /* 原版 0x20（0x416fd8，2 处）：GS+0x11 = v==0xff ? (b & 0xe0) : ((b & 0xf0) | v) */
          case "op_20": {
            if (!this.GS) this.GS = new Array(64).fill(0);
            const v = a[0] | 0;
            const b = this.GS[0x11] | 0;
            this.GS[0x11] = v === 0xff ? (b & 0xe0) : ((b & 0xf0) | v);
            break;
          }
          /* 1:1 op 0x6C = FUN_00410c39（handler 表 0x410be0 直证）。
           * [src(2), dst(2)] 人物合并（唯一使用 R_19 [36,13]）：
           * ① rec[0x00..0x34] 字节复制 src→dst，跳 0x26、0x2a（原版保护 pid/形象字节）；
           * ② 5 word：dst.武具熟練[i] += src.武具熟練[i]；dst.副表[i] = src.副表[i]（相距 0x400 双表）。
           * remake 映射：HP/MP/经验/等级/五维 raw 按 src 覆盖 dst；武器/护具熟练度累加；
           * 空装备槽继承 src；src 撤退（state=3 离场）。 */
          case "op_6c": {
            const src6 = this._findUnitByPerson(a[0] | 0);
            const dst6 = this._findUnitByPerson(a[1] | 0);
            if (!src6 || !dst6 || src6 === dst6) break;
            for (const k of ["maxHp", "maxMp", "exp", "lvl"]) dst6[k] = src6[k];
            dst6.hp = Math.min(src6.hp, dst6.maxHp);
            dst6.mp = Math.min(src6.mp, dst6.maxMp);
            if (src6._raw && dst6._raw) for (let i = 0; i < 5; i++) dst6._raw[i] = src6._raw[i];
            for (const [slot, expKey] of [["weapon", "wexp"], ["armor", "aexp"]]) {
              if (typeof dst6.gainEquipExp === "function" && typeof src6[expKey] === "number" && src6[expKey] > 0) {
                dst6.gainEquipExp(slot, src6[expKey]);
              }
              if ((dst6[slot] == null || dst6[slot] === 255) && src6[slot] != null && src6[slot] !== 255) {
                dst6[slot] = src6[slot];
              }
            }
            if (src6.x >= 0 && this.map.get(src6.x, src6.y) && this.map.get(src6.x, src6.y).unit === src6) {
              this.map.get(src6.x, src6.y).unit = null;
            }
            src6.state = 3; src6.x = -1; src6.y = -1; src6.isAlive = false;
            if (this.onEvent) this.onEvent({ type: "scriptNoop", op: "op_6c", args: a.slice() });
            this.logEntry(src6.name + " 并入 " + dst6.name, "sys");
            if (this.scene && this.scene.refreshUnits) { try { this.scene.refreshUnits(); } catch (e) {} }
            break;
          }
          /* 1:1 op 0x57 = FUN_00414edc（handler 表 0x410b8c 直证；旧注 0x414ec4 是函数体内地址，作废）。
           * arg = 新天气等级；FUN_0041df0b(thiscall 0x4b3d08)：查 DAT_0048e100（第13轮 6×6 表）
           * 行=场景地形 tid（天气对象 +0x11），列 [新等级] vs [当前天气 +0x4]——
           * 相等 → 完全不动（原版怪癖：无音效无切换）；不等 → SE 0x86 + 转场（FUN_00449f91）切天气。
           * 唯一使用 S_25 [5]（雨天入场）。 */
          case "op_57": {
            const lv = a[0] | 0;
            const T = Battle.WEATHER_TERRAIN_MOD;
            const lead57 = (this.sideUnits || this.units || []).find(u => u.isAlive && u.x >= 0);
            const tid57 = lead57 ? (this.map.get(lead57.x, lead57.y)?.tid | 0) : 0;
            const row57 = T[Math.min(Math.max(tid57, 0), 5)] || T[0];
            if (row57[lv] !== row57[this.weather | 0]) {
              if (this.onEvent) this.onEvent({ type: "se", id: 0x86 });
              this.weather = lv;
              if (this.onEvent) this.onEvent({ type: "weather", lv });
              this.logEntry("天气转变（等级 " + lv + "）", "sys");
            }
            break;
          }
          /* 原版 0x5A ui_5a（0x44bac2，58 处）：战斗开场「开始战斗」字幕压在暗化地图上 20 tick */
          case "ui_5a":
            /* 原版 0x5A（0x44bac2）：字幕压在暗化地图上 20 tick（1 tick ≈ 40ms → 800ms），
             * 字幕本身由 UI 淡出，这里等一个完整显示周期再继续。 */
            if (this.onEvent) this.onEvent({ type: "battleCaption", text: "开 始 战 斗" });
            await new Promise(r => setTimeout(r, 1500));
            break;
          /* 原版 0x75 set_byte_var（0x4d100d，9 处）：mod 字节变量 u8 @0x55a000[arg0] = arg1 */
          case "set_byte_var": {
            if (!this.byteVars) this.byteVars = new Uint8Array(0x1000);
            this.byteVars[a[0] | 0] = a[1] & 0xff;
            break;
          }
          /* 原版 0x3B join（0x4148fe，45 处）：加入/离开。战斗中无效（scene mode 3）。 */
          case "join":
            if (this.onEvent) this.onEvent({ type: "join", person: a[0] | 0, mode: a[1] | 0, arg: a[2] | 0 });
            break;
          case "map_mark": {
            // [x, y, mode, scroll, silent]：0=放火 1=灭火
            const x = a[0], y = a[1], mode = a[2] || 0;
            if (mode === 0) {
              this.changeTerrain(x, y, 26, 0, 0, 0);
              /* 原版放火（rules_ref op 0x58/0x21）：patch 0 → SE 0x13（火声） */
              if (this.onEvent) this.onEvent({ type: "se", id: 19 });
            }
            else this.undoTerrainChange(x, y, 0);
            if (this.onEvent) this.onEvent({ type: "terrain" });
            break;
          }
          case "op_4b": {
            /* 原版 0x4b（handler 0x415e36，2026-11-06 capstone 逐行）：
             * args [person, x, y, dir, slot]；查 GS 人物表拿单位对象，
             * **在场**（state&3==0）→ 直接写 x/y/dir（移动+朝向，不隐藏）；
             * 不在场 → 什么都不做。S_01 等 47 章姜维由 allies 空位入场后靠它挪位。
             * 兼容保留：S_00 型剧本里人物不在场时 hidden 创建（等 unit_op_4c 现身）。 */
            const pid4 = a[0] | 0;
            const dx = a[1] | 0, dy = a[2] | 0, ddir = a[3] !== undefined ? (a[3] | 0) : 2;
            if (!this._deployEntries) this._deployEntries = [];
            this._deployEntries[pid4] = { x: dx, y: dy, dir: ddir };
            let u4 = this.units.find(o => o.pid === pid4 && o.faction === "ally");
            if (u4 && u4.state === 2) {
              /* 在场：清旧格 → 落新格（等价原版写记录 x/y + 地图重挂） */
              if (u4.x !== dx || u4.y !== dy) {
                const oc4 = this.map.get(u4.x, u4.y);
                if (oc4 && oc4.unit === u4) oc4.unit = null;
                let nx = dx, ny = dy;
                const nc = this.map.get(nx, ny);
                if (!nc || nc.unit) {
                  const spot = this.findFreeCellNear(dx, dy);
                  if (spot) { nx = spot.x; ny = spot.y; } else { nx = u4.x; ny = u4.y; }
                }
                const fc = this.map.get(nx, ny);
                if (fc && !fc.unit) { fc.unit = u4; u4.x = nx; u4.y = ny; }
              }
              u4.dir = ddir;
              if (this.onEvent) this.onEvent({ type: "refresh" });
              break;
            }
            if (!u4) {
              const R = window.JW_REAL;
              if (!R || !R.mkUnit) break;
              const mk = R.mkUnit(pid4, dx, dy, "ally", { lv: 1, hidden: true, leader: pid4 === 0 });
              u4 = new window.JW.Unit(mk.def, -1, -1, "ally", this);
              this.units.push(u4);
              if (this._syncSides) this._syncSides();
            }
            u4.deployX = dx; u4.deployY = dy;
            if (u4.x >= 0) { const oc5 = this.map.get(u4.x, u4.y); if (oc5 && oc5.unit === u4) oc5.unit = null; }
            u4.state = 1; u4.x = -1; u4.y = -1;
            u4.dir = ddir;
            break;
          }
          case "actor_move": {
            /* 原版 0x32 actor_move（eex_format_doc 行 234，0x4132d4）：
             * args [mode(0xffff→0), person, slot, x, y, dir]
             *   mode 0 = person；mode 1 = 玩家第 slot 号槽位上的单位。
             * 战斗：0x459487(person, x, y, dir) 让单位**沿路径**走到 (x,y) 并转向 dir。
             * 旧实现是直接瞬移（没有走格、也没转向），与原版的行走演出不符。 */
            const mode = a[0] !== undefined && a[0] !== 65535 ? (a[0] | 0) : 0;
            let u = null;
            if (mode === 1) {
              const slot = a[2] | 0;
              u = this.units.find(o => o.faction === "ally" && o.slot === slot && o.state === 2) || null;
            } else {
              u = this._findUnitByPerson(a[1] | 0);
            }
            if (!u || !u.isAlive) break;
            const tx = a[3] | 0, ty = a[4] | 0;
            const dir = a[5] !== undefined && a[5] !== 65535 ? (a[5] | 0) : u.dir;
            if (tx >= 0 && ty >= 0 && this.map.inBounds(tx, ty)) {
              const cell = this.map.get(tx, ty);
              if (cell && !cell.unit) {
                const oc = this.map.get(u.x, u.y);
                if (oc && oc.unit === u) oc.unit = null;
                cell.unit = u;
                u.x = tx; u.y = ty;
              }
            }
            u.dir = dir;
            if (this.onEvent) this.onEvent({ type: "unitMoved", unit: u.id });
            break;
          }
          /* 1:1 op 0x45 battle_settings = FUN_004122f1：arg3(type3e) = 敌我等级修正 DAT_00496e23 */
          case "battle_settings": {
            this._lvOffset = a[3] !== undefined && a[3] !== 65535 ? (a[3] | 0) : 0;
            break;
          }
          /* 1:1 op 0x46/0x47 = FUN_004125c5/FUN_004129a4（handler 表直证）：
           * allies [person,b1,x,y,dir,lv,promo,ai,...] 20 槽；enemies [person,b1,b2,x,y,dir,lv,promo,ai,...] 80 槽。
           * 等级 = min(lv + 我方前4人均值 + settings修正, 99/110)（FUN_0047fab5 + FUN_0041885a）；
           * 隐藏：allies b1 / enemies b2 → state 1，等 op_4c 现身（S_00 全员隐藏开场）。 */
          case "battle_allies":
          case "battle_enemies": {
            const isEnemy = o.name === "battle_enemies";
            /* V2 数据层 args = 条目数组直接平铺（[e0,e1,…]）；兼容包裹式 [[e0,e1,…]]。 */
            const entries = Array.isArray(a[0]) && Array.isArray(a[0][0]) ? a[0] : a.filter(Array.isArray);
            const faction = isEnemy ? "enemy" : "ally";
            const R = window.JW_REAL;
            const base = (this._partyLevelBase() || 1) + (this._lvOffset || 0);
            for (const e of entries) {
              if (!Array.isArray(e)) continue;
              const pid = e[0] | 0;
              if (pid === 65535 || !R || !R.mkUnit) continue;
              const b1 = e[1] | 0;
              const b2 = isEnemy ? (e[2] | 0) : 0;
              const cx = e[isEnemy ? 3 : 2] | 0, cy = e[isEnemy ? 4 : 3] | 0;
              const dv = e[isEnemy ? 5 : 4] | 0;
              const lvRaw = e[isEnemy ? 6 : 5] | 0;
              const promoRaw = e[isEnemy ? 7 : 6] | 0;
              const aiRaw = e[isEnemy ? 8 : 7] | 0;
              const lvl = Math.min((lvRaw === 65535 ? 0 : lvRaw) + base, isEnemy ? 110 : 99) || 1;
              const promo = promoRaw === 65535 ? 2 : promoRaw;
              const aiMode = aiRaw === 65535 ? 1 : aiRaw;
              const hidden = isEnemy ? (b2 !== 0) : (b1 !== 0);
              const old = this.units.find(o2 => o2.pid === pid && o2.faction === faction);
              if (old && old.x >= 0) { const ocx = this.map.get(old.x, old.y); if (ocx && ocx.unit === old) ocx.unit = null; }
              const mk = R.mkUnit(pid, cx, cy, faction, { lv: lvl, promo, ai: "ai" + aiMode, hidden: true, leader: old ? !!old.leader : false });
              let u = new window.JW.Unit(mk.def, hidden ? -1 : cx, hidden ? -1 : cy, faction, this);
              if (old) { u.id = old.id; const ix = this.units.indexOf(old); if (ix >= 0) this.units[ix] = u; }
              else this.units.push(u);
              u.deployX = cx; u.deployY = cy; u.dir = dv;
              u.state = hidden ? 1 : 2;
              if (!hidden) { const c = this.map.get(cx, cy); if (c && !c.unit) c.unit = u; }
            }
            if (this._syncSides) this._syncSides();
            if (this.onEvent) this.onEvent({ type: "refresh" });
            break;
          }
          case "op_51": {
            // 战后恢复：全员满 HP、清移动/行动旗
            for (const u of this.units) { if (u.isAlive) { u.hp = u.maxHp; u.hasMoved = false; u.hasActed = false; } }
            if (this.onEvent) this.onEvent({ type: "scriptRestore" });
            break;
          }
          case "set_result": {
            // 原版 outro：设定本战战果（0 = 达成/胜利）
            const v = a[0] | 0;
            this.scriptResult = v;
            break;
          }
          case "op_59": {
            // args[0]=100：剧情败北推进（S_01 冀城中计，马遵弃城）；其余为奖励结算
            // args[1]=战利品 item id（65535 无）
            if (this.onEvent) {
              if ((a[0] | 0) === 100) this.onEvent({ type: "scriptStoryEnd" });
              else {
                const loot = (a[1] !== undefined && a[1] !== 65535 && a[1] !== 255) ? (a[1] | 0) : null;
                this.onEvent({ type: "scriptReward", base: a[0] | 0, loot });
              }
            }
            break;
          }
          case "duel_setup": {
            // 1:1 单挑演出：从本段收集 duel_* op 序列（至 duel_start），整体交给 UI 回放
            const seq = [];
            let setup = a;
            for (const o2 of (actions || [])) {
              if (o2.name === "duel_setup") { setup = o2.args || []; continue; }
              if (/^duel_/.test(o2.name)) seq.push({ name: o2.name, args: o2.args || [] });
              if (o2.name === "duel_start") break;
            }
            const p1 = setup[0] | 0, p2 = setup[1] | 0;
            const u1 = this.units.find(u => u.pid === p1 && u.x >= 0) || this.units.find(u => u.pid === p1);
            const u2 = this.units.find(u => u.pid === p2 && u.x >= 0) || this.units.find(u => u.pid === p2);
            if (u1 && u2 && this.onEvent) {
              const pr = this.onEvent({ type: "duelCinematic", u1, u2, seq });
              // 兜底：UI 未接管或回放中断时不得永久挂起剧本链（否则敌方回合/回合推进全部冻结）
              if (pr && pr.then) {
                await Promise.race([
                  pr.catch(() => {}),
                  new Promise(r => setTimeout(r, 20000)),
                ]);
              }
            }
            break;
          }
          case "duel_say": case "duel_say2": case "duel_action":
          case "duel_action2": case "duel_action3": case "duel_start": case "duel_end": case "duel_62": {
            // 单挑序列中的其余 op 由 duel_setup 统一回放；单独出现时兜底为对话
            if (o.name === "duel_say" || o.name === "duel_say2") {
              if (this.onEvent) this.onEvent({ type: "scriptDialog", who: "", text: String(a[1] != null ? a[1] : (a[0] || "")) });
              await new Promise(r => setTimeout(r, 1000));
            }
            break;
          }
          case "if": case "end": case "endif": {
            /* 战斗脚本里的 if/end 在提取时已把条件拆成段级 conds（无参数、无 end 目标），
             * 因此这里保持 no-op；不要尝试按栈跳转（会误跳）。 */
            break;
          }
          case "data_transfer": {
            /* 原版 0x78 数据存取：args [var, dir, index, field]。
             * 战斗脚本中实际只出现 [0,1,<索引>,32|1]（把 EV[0] 写入单位/人物字段），
             * EV 未初始化为 0，因此等价于「把该字段清 0」。这里记录到 EV 表，
             * 仅对战斗单位字段 28..41 生效，其余保持不动作以免误改人物表。 */
            if (!this.EV) this.EV = new Array(256).fill(0);
            const v = a[0] | 0, dir = a[1] | 0, idx = a[2] | 0, field = a[3] | 0;
            if (dir === 0) this.EV[v] = 0;
            else if (field >= 28 && field <= 41) {
              const u = this.units[idx - 35] || this.units.find(x => x.pid === idx);
              if (u && this.EV[v] === 0) { /* 清 0：不改动运行态（避免误伤行动标记） */ }
            }
            break;
          }
          case "delay": {
            // 原版 delay：tick 级停顿（1 tick ≈ 40ms，上限 600ms 防拖沓）
            const t = Math.min(Math.max(0, (a[0] | 0) * 40), 600);
            if (t > 0) await new Promise(r => setTimeout(r, t));
            break;
          }
          case "play_sound": {
            // 原版 SE 编号；交给 UI 播放（缺失音源时静默）
            if (this.onEvent) this.onEvent({ type: "se", id: a[0] | 0 });
            break;
          }
          case "popup": case "info": {
            // 原版战场弹窗/情报框（S_01 战斗失败。/S_25 转职提示等）：等价 showBattleSay 气泡（2026-11-06 R9）
            if (this.onEvent) this.onEvent({ type: "scriptInfo", text: String(a[0] || "") });
            await new Promise(r => setTimeout(r, 1600));
            break;
          }
          case "play_music": {
            // 原版战场 BGM：CD 轨号（story.js SoundTrk/NN.mp3），mode 0 单次/1 循环
            {
              const SA = window.JW && window.JW.StoryAudio;
              if (SA && SA.playMusic) { try { SA.playMusic(a[0] | 0, a[1] | 0); } catch (e) {} }
            }
            break;
          }
          case "set_resource": {
            // 原版 0x3A 战场资源增减：金（S_44 搜刮）/民心类 res1/res2；写回 App 并随存档持久（2026-11-06 R9）
            {
              const App = (typeof window !== "undefined" && window.JW && window.JW.App) ? window.JW.App : null;
              if (App) {
                const kind = a[0] | 0, mode = a[1] | 0, val = a[2] | 0;
                if (kind === 0) App.gold = Math.min(9999999, Math.max(0, (App.gold || 0) + val));
                else {
                  const key = kind === 1 ? 'res1' : 'res2';
                  const cur = App[key] | 0;
                  App[key] = Math.min(100, Math.max(0, mode === 1 ? cur + val : mode === 2 ? cur - val : val));
                }
              }
            }
            break;
          }
          case "battle_prepare": {
            // 原版 0x4a 出场选择（S_00 等 9 处）：与 battle_select_units 同族 GS 出阵表写入口（0x41a73f）
            {
              const App = (typeof window !== "undefined" && window.JW && window.JW.App) ? window.JW.App : null;
              if (App && App._parseSortie) {
                const c = App._parseSortie(a);
                if (c) App._sortieConstraint = c;
              }
            }
            break;
          }
          case "choice": {
            /* 原版 0x0C 战场选项（S_19「就此撤退/引出敌军」）：选项挂到战场，
             * 结果存 _lastChoice=idx+1 供 test_choice 分支；超时/无 UI 默认第一项。
             * 等待期间置 _scriptPause 防 poll 重入（2026-11-06 R9）。 */
            {
              const opts = String(a[0] || "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 3);
              if (!opts.length) break;
              const App = (typeof window !== "undefined" && window.JW && window.JW.App) ? window.JW.App : null;
              const ui = App && App.ui;
              if (!ui || !ui.showBattleChoice) { this._lastChoice = 1; break; }
              this._scriptPause = true;
              let pick = 0;
              await new Promise((resolve) => {
                let done = false;
                const finish = (idx) => { if (done) return; done = true; clearTimeout(to); pick = idx; resolve(); };
                const to = setTimeout(() => finish(0), 60000);
                ui.showBattleChoice({ options: opts.map(t => ({ text: t })) }, finish);
              });
              this._scriptPause = false;
              this._lastChoice = pick + 1;
            }
            break;
          }
          case "unit_op_4f": {
            // 原版 0x4f unit_turn（0x415f65 → 0x457428）：
            // args [p1, p2, dir, b1, scroll, wait]；p2=0xffff 时按 dir 定向，否则朝 p2 所在方向。
            const u = this._findUnitByPerson(a[0]);
            if (u && u.isAlive && u.x >= 0) {
              let dir = a[2];
              const p2 = a[1];
              if (p2 !== undefined && p2 !== 65535) {
                const t = this._findUnitByPerson(p2);
                if (t && t.x >= 0) {
                  const dx = t.x - u.x, dy = t.y - u.y;
                  // 原版：|dx| < |dy| 时取纵向，否则横向
                  dir = Math.abs(dx) < Math.abs(dy) ? (dy < 0 ? 0 : 2) : (dx > 0 ? 1 : 3);
                }
              }
              if (dir !== undefined && dir !== 65535) {
                const changed = u.dir !== (dir | 0);
                u.dir = dir | 0;
                if (changed) {
                  if (this.onEvent) this.onEvent({ type: "unitTurn", unit: u.id });
                  if (a[4]) await new Promise(r => setTimeout(r, 120));   // scroll：镜头居中意图
                }
              }
            }
            break;
          }
          case "ui_49": {
            // 原版战斗结束（胜）：交由外层结算
            if (this.onEvent) this.onEvent({ type: "scriptBattleOver", win: true });
            break;
          }
          case "ui_0e": {
            // 原版战斗结束（败）
            if (this.onEvent) this.onEvent({ type: "scriptBattleOver", win: false });
            break;
          }
          case "victory_cond_text": {
            this.victoryText = String(a[0] || "").trim();
            if (this.onEvent) this.onEvent({ type: "victoryText", text: this.victoryText });
            break;
          }
          case "battle_goal_text": {
            this.goalText = String(a[0] || "").trim();
            if (this.onEvent) this.onEvent({ type: "goalText", text: this.goalText });
            break;
          }
          case "unit_op_4c": {
            /* 原版 0x4C unit_appear（0x414f42，rules_ref §10.6.1）：
             * args [mode(0xffff→0), person, slot]
             *   mode 0：person 的单位若处于 state 1（已创建但未放置），
             *           按其**部署条目坐标**放到最近的空格（0x43f040），state 2，地图居中，
             *           SE 15，4 tick；HP 不变。必须有该人物的部署条目。
             *   mode 1：玩家第 slot 号槽位中处于 state 1 的单位，同样放到其部署条目位置。
             * 用途：让伏兵/援军在剧情推进到那一步时登场。
             * S_00 开场就是靠它让赵云等 7 名敌将「先隐藏、后现身」。 */
            const mode = a[0] !== undefined && a[0] !== 65535 ? (a[0] | 0) : 0;
            let u = null;
            if (mode === 1) {
              const slot = a[2] | 0;
              u = (this.sideUnits || []).find(o => o && o.state === 1 && o.slot === slot) || null;
            } else {
              const pid = a[1] | 0;
              u = this.units.find(o => o.pid === pid && o.state === 1) || null;
            }
            if (!u) break;
            /* 落位：优先用部署条目原坐标；被占则找最近空格 */
            let sx = u.deployX, sy = u.deployY;
            if (sx == null || sy == null || sx < 0 || sy < 0) { sx = u.x; sy = u.y; }
            let cell = (sx >= 0 && sy >= 0) ? this.map.get(sx, sy) : null;
            if (!cell || cell.unit) {
              const spot = this.findFreeCellNear(sx >= 0 ? sx : 8, sy >= 0 ? sy : 8);
              if (!spot) break;
              sx = spot.x; sy = spot.y; cell = this.map.get(sx, sy);
            }
            if (!cell) break;
            cell.unit = u;
            u.x = sx; u.y = sy;
            u.state = 2;
            u.hasActed = false; u.hasMoved = false;
            if (this.onEvent) this.onEvent({ type: "unitAppear", unit: u.id, x: sx, y: sy });
            if (this.onEvent) this.onEvent({ type: "refresh" });
            break;
          }
        case "unit_op_4d": {
          // 原版 0x4d unit_change（0x4150e7）：args [mode, person, slot, x1, y1, x2, y2, side,
          //   status, sel(0 buff攻/1 buff敏/2 异常), ailment, hp, mp]
          //   sel 映射 what {0,3,6}（0x41538f）；ailment → what 6（值 &0x80 清除，否则置位 0x45aace）；
          //   hp → what 7：hp -= min(hp,v)，≤1 → 0；mp → what 8：mp -= min(mp,v&0xff)，保 ≥1。
          const mode = a[0] | 0;
          let targets4d = [];
          if (mode === 2) {
            const side = (a[7] === 65535 || a[7] === undefined) ? 6 : (a[7] | 0);
            const sideOf = (u) => (u.faction === "ally" ? 0 : u.faction === "friend" ? 1 : u.faction === "neutral" ? 3 : 2);
            const inRect = (u) => u.x >= Math.min(a[3], a[5]) && u.x <= Math.max(a[3], a[5]) && u.y >= Math.min(a[4], a[6]) && u.y <= Math.max(a[4], a[6]);
            targets4d = this.units.filter(u => u.x >= 0 && inRect(u) && (
              side === 6 ? true : side <= 3 ? sideOf(u) === side : side === 4 ? sideOf(u) <= 1 : sideOf(u) >= 2));
          } else {
            const pu = this._findUnitByPerson(a[1]);
            if (pu && pu.x >= 0) targets4d = [pu];
          }
          for (const u of targets4d) {
            // 0x45aa5c(person, a[8]=字节索引, a[10]/map(a[9])=值, show=1)（0x41538f..0x4153f4 push 序）：
            //   a[8] 0..5 → buff 字节 unit[0x18+a[8]] = map(a[9])（map: 0→0 弱×0.8, 1→3 中, 2→6 强×1.2, 其他→3）
            //   a[8] 6 → 异常字节（罕见，值 map(a[9])）；a[10] → 异常位 unit[0x1e]（&0x80 清除其余，否则置位）
            if (a[8] !== undefined && a[8] !== 65535) {
              const idx = a[8] | 0;
              const level = a[9] === 0 ? 0 : a[9] === 1 ? 3 : a[9] === 2 ? 6 : 3;
              if (idx <= 5) u.setBuffLevel(idx, level);
              else if (idx === 6) u.applyAilment(level);
            }
            // 异常字节 arg10（0x415434 → 0x45aa5c(person,6,a[10],1)；&0x80 清除否则置位）
            if (a[10] !== undefined && a[10] !== 65535) u.applyAilment(a[10] | 0);
            // HP / MP（0x4154a8/0x41550d → 0x45aa5c(person,7|8,a[11]|a[12],1)；
            //   0x45addf mode0：cur > v ? cur - v : 1 —— 保底 1 点，不会打死）
            if (a[11]) {
              const v = a[11] & 0xffff;
              u.hp = u.hp > v ? u.hp - v : 1;
            }
            if (a[12]) {
              const v = a[12] & 0xff;
              u.mp = u.mp > v ? u.mp - v : 1;
            }
            if (this.onEvent) this.onEvent({ type: "scriptStatus", unit: u.id });
            if (!u.isAlive) this.checkDeath(u);
          }
          break;
        }
        case "unit_status": {
          // 原版 0x50（0x416129 → 0x45778f）：战场动画（§13.7 帧序列）
          // args [person, action 0..12, pre_wait, post_wait]；0xffff 不动作
          const act = a[1];
          if (act === undefined || act === 65535) break;
          const u = this._findUnitByPerson(a[0]);
          if (!u || !u.isAlive || u.x < 0) break;
          if (a[2]) await new Promise(r => setTimeout(r, 140));
          if (this.onEvent) this.onEvent({ type: "unitAnim", unit: u.id, action: act | 0 });
          if (act !== 0 && act !== 11 && a[3]) await new Promise(r => setTimeout(r, 140));
          await new Promise(r => setTimeout(r, 260));
          break;
        }
        case "next_scene":
          // 原版 0x?? next_scene：剧情结算（如冀城中计），战斗以剧情败北结束并推进章节
          this._abortScript = true;
          if (this.onEvent) this.onEvent({ type: "scriptStoryEnd" });
          break;
        case "int_var_op": {
            /* 原版 0x77（mod 整型运算）：[dstKind, dstIdx, op, srcKind, srcVal]
             * 实机数据 142 处全是 op=2(=) 且 srcKind=0(立即数)：
             *   dstKind 2 → EV[i]（原版 @0x55b000）赋值；0/1 = PT 指针表（@0x563000）
             *   op: 0 += 1 -= 2 = 3 *= 4 /= 5 %=
             * 这些 EV 值随后被 data_transfer(0x78) 读走写进单位/人物字段。 */
            if (!this.EV) this.EV = new Array(8192).fill(0);
            if (!this.PT) this.PT = new Array(4096).fill(0);
            const dk = a[0] | 0, di = a[1] | 0, iop = a[2] | 0;
            const sk = a[3] | 0, sv = a[4] | 0;
            let val;
            if (sk === 4) val = this.EV[sv] || 0;
            else if (sk === 1 || sk === 2) val = this.PT[sv] || 0;
            else val = sv;
            const ap = (cur) => {
              switch (iop) {
                case 0: return cur + val;
                case 1: return cur - val;
                case 2: return val;
                case 3: return cur * val;
                case 4: return val === 0 ? cur : Math.floor(cur / val);
                case 5: return val === 0 ? cur : cur % val;
                default: return val;
              }
            };
            if (dk === 2) this.EV[di] = ap(this.EV[di] || 0);
            else if (dk === 1) this.PT[di] = ap(this.PT[di] || 0);
            else { const slot = this.PT[di] | 0; this.PT[slot] = ap(this.PT[slot] || 0); }
            break;
          }
        case "unit_move": {
          /* 原版 0x55 unit_reenter（0x41591c → 0x4591a1）：args
           * [mode(0xffff→0), person, slot, x, y, dir(0xffff→2)]。
           * mode 0 → 该人物；mode 1 → 我方第 slot 号单位槽中处于 state 3（已撤退）的单位。
           * 重新入场 = UnitInit：满 HP/MP、buff 清空、落位 (x,y)、朝向 dir，
           * SE 15，地图居中。原版叫 unit_move 是误名。 */
          const mode = a[0] !== undefined && a[0] !== 65535 ? (a[0] | 0) : 0;
          let u = null;
          if (mode === 1) {
            const slot = a[2] | 0;
            const cand = this.sideUnits.filter(o => o && o.slot === slot);
            u = cand.find(o => o.state === 3) || null;
          } else {
            u = this._findUnitByPerson(a[1] | 0);
          }
          if (!u) break;
          const x = a[3] | 0, y = a[4] | 0;
          if (!this.map.inBounds(x, y)) break;
          const dir = a[5] !== undefined && a[5] !== 65535 ? (a[5] | 0) : 2;
          const cell = this.map.get(x, y);
          if (cell && cell.unit && cell.unit !== u) break;   // 占位格不重入
          this.reenter(u, x, y);
          u.state = 2;
          u.dir = dir;
          u.hp = u.maxHp;
          u.mp = u.maxMp;
          u.hasMoved = false; u.hasActed = false;
          if (this.onEvent) this.onEvent({ type: "unitReenter", unit: u.id, x, y });
          break;
        }
        case "set_attr": {
          /* 原版 0x38 set_attr（0x412006，rules_ref §10.6）：args [person, attr≤15, op, value]，
           * op 0 = 设置（0x406f54）、1 = 增加（AddStat 0x406e17）、2 = 减少（饱和到 0）。
           * attr 7 = 战斗单位 HP（减法时 HP = max(HP−v,0)）；HP ≤ 0 即阵亡（0x4121b0）。
           * person 属性 id（0x406d87/0x406f54）：0-4 五维、5 HP 上限、6 MP 上限、9 等级、
           * 10-14 原始能力（武艺/统制/智谋/感知/胆魄）。 */
          const u = this._findUnitByPerson(a[0]);
          if (!u) break;
          const attr = a[1] | 0, op = a[2] | 0, val = a[3] | 0;
          if (attr === 9 || attr === 15) break;          // 权威：这两个属性码无效
          const cur = attr === 7 ? (u.hp | 0) : ((u.scriptAttrs && u.scriptAttrs[attr]) || 0);
          let nv;
          if (op === 1) nv = cur + val;
          else if (op === 2) nv = Math.max(0, cur - val);
          else nv = val;
          if (attr === 7) {
            u.hp = Math.max(0, Math.min(u.maxHp || nv, nv));
            if (u.hp <= 0) { u.hp = 0; this.checkDeath && this.checkDeath(u); }
          } else {
            if (!u.scriptAttrs) u.scriptAttrs = {};
            u.scriptAttrs[attr] = nv;
          }
          if (this.onEvent) this.onEvent({ type: "scriptStatus", unit: u.id });
          break;
        }
        case "set_equipment": {
          /* 原版 0x3E set_equipment（0x416319 / 0x4429f9）：与 0x48 同参数同编码，一次性应用。
           * args [person, weapon, weaponLv, armor, armorLv, accessory]。
           * code 0 = 清空该槽；战场内 code > 0x67 忽略（0x4429f9）；
           * 战场外武器 code 1 = 卸下所有带该 code 的槽（原版对三个槽都测武器 code）。 */
          const u = this._findUnitByPerson(a[0]);
          const w = a[1] | 0, wl = a[2] | 0, ar = a[3] | 0, al = a[4] | 0, ac = a[5] | 0;
          const inBattle = !!this.battle;
          if (inBattle) {
            if (!u) break;
            const setSlot = (key, code, lv) => {
              if (code === 65535) return;
              if (code > 0x67) return;                    // 权威：战场内忽略
              if (code === 0) { u[key] = 0; }              // code 0 = 清空该槽
              else { u[key] = code; if (lv > 0) u[key === "weapon" ? "weaponLv" : "armorLv"] = lv; }
            };
            setSlot("weapon", w, wl);
            setSlot("armor", ar, al);
            if (ac !== 65535 && ac <= 0x67) { if (ac === 0) u.acc = 0; else u.acc = ac; }
          } else {
            if (!u) break;
            if (w === 1) { u.weapon = 0; u.armor = 0; u.acc = 0; }
            else {
              if (w !== 65535) u.weapon = w;
              if (ar !== 65535) u.armor = ar;
              if (ac !== 65535) u.acc = ac;
            }
            if (wl > 0) u.weaponLv = wl;
            if (al > 0) u.armorLv = al;
          }
          if (typeof u.recalcStats === "function") u.recalcStats();
          if (this.onEvent && u) this.onEvent({ type: "scriptStatus", unit: u.id });
          break;
        }
        case "unit_op_4e": {
          /* 原版 0x4E change_ai（0x4146d4，rules_ref §10.6.1）：
           * args [mode, person, x1, y1, x2, y2, side, ai_mode, ai_person, ai_x, ai_y]。
           * mode 0 → SetAI(person)（对我方队员无效）；否则 0x459e79 → 矩形内 side 一侧全部单位 SetAI。
           * ai_mode 3/5 记录追击目标人物，4/6 记录目标坐标。 */
          const mode = a[0] | 0;
          const aiMode = a[7] | 0;
          const side = a[6] | 0;
          const aiPid = a[8] !== undefined && a[8] !== 65535 ? (a[8] | 0) : null;
          const aiX = a[9] !== undefined && a[9] !== 65535 ? (a[9] | 0) : null;
          const aiY = a[10] !== undefined && a[10] !== 65535 ? (a[10] | 0) : null;
          const apply = (u) => {
            if (!u) return;
            u.aiParam = aiMode;
            if (aiMode === 3 || aiMode === 5) u.aiPid = aiPid;
            if (aiMode === 4 || aiMode === 6) { u.aiX = aiX; u.aiY = aiY; }
          };
          if (mode === 0) {
            const u = this._findUnitByPerson(a[1] | 0);
            if (u && u.faction === "enemy") apply(u);   // 权威：对我方队员无效
          } else {
            const x1 = Math.min(a[2] | 0, a[4] | 0), x2 = Math.max(a[2] | 0, a[4] | 0);
            const y1 = Math.min(a[3] | 0, a[5] | 0), y2 = Math.max(a[3] | 0, a[5] | 0);
            this._unitsOfSide(side).forEach(u => {
              if (u && u.isAlive && u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) apply(u);
            });
          }
          break;
        }
        case "unit_op_53": {
          /* 原版 0x53 unit_retreat（0x41557b，rules_ref §10.6.1）：
           * args [mode, person, x1, y1, x2, y2, side, anim(0xffff→0)]。
           * mode 0 → RemoveUnit(silent=0, variant=anim)：0x400..0x402 = 当前单位；
           *   anim ≠ 0 或 person 0 → 播阵亡动画，否则 SE 16 + 两下闪烁；撤退数 +1。
           * 否则 0x45a80f → 矩形内 side 一侧单位 RemoveUnit(silent = anim≠0)。 */
          const mode = a[0] | 0;
          const anim = a[7] !== undefined && a[7] !== 65535 ? (a[7] | 0) : 0;
          const removeOne = (u, silent) => {
            if (!u || !u.isAlive || u.x < 0) return;
            if (!silent && (anim !== 0 || u.pid === 0) && this.onEvent) {
              this.onEvent({ type: "unitAnim", unit: u.id, action: 3 });
            }
            this.retreat(u);
            if (!silent) this._retreatCount = (this._retreatCount || 0) + 1;
            if (this.onEvent) this.onEvent({ type: "scriptRetreat", person: u.pid });
          };
          if (mode === 0) {
            const code = a[1] | 0;
            let u;
            if (code >= 0x400 && code <= 0x402) {
              u = this.units.find(o => o.isAlive && o.state === 2 && (code === 0x402 ? o.faction === "enemy" : o.faction !== "enemy")) || null;
            } else {
              u = this._findUnitByPerson(code);
            }
            removeOne(u, false);
          } else {
            const side = a[6] | 0;
            const x1 = Math.min(a[2] | 0, a[4] | 0), x2 = Math.max(a[2] | 0, a[4] | 0);
            const y1 = Math.min(a[3] | 0, a[5] | 0), y2 = Math.max(a[3] | 0, a[5] | 0);
            this._unitsOfSide(side).forEach(u => {
              if (u && u.isAlive && u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) removeOne(u, anim !== 0);
            });
          }
          break;
        }
        case "op_2f": {
          /* 原版 0x2F（0x4151c2，出现1247次）：单位传送/移动。args=[mode(0=pid/1=槽), person或槽号, slot/ai, x, y, dir]。
           * EXE 逻辑：按 mode 查找单位，传送到 (x, y)，设置方向 dir，触发 reach 事件。 */
          const mode = a[0] | 0;
          const who = a[1] | 0;
          const slot = a[2] | 0;
          const x = a[3] | 0;
          const y = a[4] | 0;
          const dir = a[5] !== undefined && a[5] !== 65535 ? (a[5] | 0) : 2;
          let u = null;
          if (mode === 0) {
            u = this._findUnitByPerson(who);
          } else if (mode === 1) {
            const side = this._unitsOfSide(slot);
            u = side && side.length ? side[0] : null;
          }
          if (u && u.isAlive && this.map.inBounds(x, y)) {
            const oc = this.map.get(u.x, u.y);
            if (oc && oc.unit === u) oc.unit = null;
            const nc = this.map.get(x, y);
            if (!nc || !nc.unit) {
              u.x = x; u.y = y;
              nc.unit = u;
              u.dir = dir;
              if (this.onEvent) this.onEvent({ type: "unitTeleport", unit: u.id, x, y, dir });
              this.checkBattleEvents("reach", u, x, y);
            }
          }
          break;
        }
        case "set_flag": {
          /* 原版 0x0B（handler 0x4142b2）：flag[arg0] = (arg1 != 0)。
           * §4 段自锁全靠它：条件表 test_flags [F] + body set_flag F → 事件只发一次。 */
          const F = this._scriptFlags || (this._scriptFlags = {});
          F[a[0]] = (a[1] !== undefined && a[1] !== 0);
          break;
        }
        case "clear_flags": {
          /* 原版 0x0A（0x415ad7）：清旗 0..255（章首复位），高号旗持久。 */
          const F = this._scriptFlags || (this._scriptFlags = {});
          for (const k of Object.keys(F)) { const n = +k; if (!Number.isNaN(n) && n <= 255) delete F[k]; }
          break;
        }
          default: break; // play_sound/delay/unit_op_4f/4d/ui_49/ui_0e/data_transfer/if/set_result 等
        }
        } catch (err) { console.warn("[script]", label, o.name, err && err.message); }
      }
    }
    /* ===== 战斗剧情 1:1 执行层（EEX §4 模型 —— tools/eex_format_doc.md 实测）=====
     * select(0x4100a1)：顺序评估各段条件表，每条指令返回 1 才算满足（非 test 指令恒真不否决），
     * 最后满足的段胜出并执行其 body。多段场景=事件循环：轮询检查点反复重选；
     * 单段场景=线性演出：body 到 END 即推进下一场景。
     * 块执行(0x4105a8)：end=块尾；if=取条件指令（else→同层上次 IF 为假才执行；test→真才执行），
     * 不成立跳到块尾；exit_section(0x0c)=中止本段重选；next_scene(0x0d)=标记推进但本块走完；
     * goto_scenario(0x11)=结束剧本跳下一章。yield 指令异步等待（dialog/delay/actor_move…）。
     * 战场检查点(0x40bbc7/0x44c638/0x44ec60/0x44ed52/0x44f0c7)：开战/阶段开始/单位行动后/死亡后轮询。
     * S 文件无 goto（实测 0 处），单挑/演出 op 复用 _runActions 单条执行。 */
    _evalSectionConds(conds) {
      for (const c of conds) {
        if (c[0] === "end") break;
        if (c[0].startsWith("test_") && !this._evalCond({ name: c[0], args: c[1] })) return false;
      }
      return true;
    }
    async _runEexBlock(body, depth, label) {
      let i = 0, last = 1;
      while (i < body.length) {
        const ins = body[i], nm = ins[0];
        if (nm === "end") return null;
        if (nm === "if") {
          const end = ins[4];
          let r;
          if (ins[2] === "else") r = last === 0 ? 1 : 0;
          else r = this._evalCond({ name: ins[2], args: ins[3] }) ? 1 : 0;
          last = r;
          if (r === 1) await this._runEexBlock(body.slice(i + 1, end), depth + 1, label + "/if");
          i = end; continue;
        }
        if (nm === "exit_section") return { abort: true };
        if (nm === "next_scene") { this._eexNext = true; i++; continue; }
        if (nm === "goto_scenario") return { scenario: (ins[1] || [])[0] };
        await this._runActions([{ name: nm, args: ins[1] }], label);
        i++;
      }
      return null;
    }
    async pollEexEvents() {
      const CH = (window.JW_BATTLE_EVENTS_V2 || {})[this._eexFile];
      if (!CH || this._eexDone) return false;
      /* 1:1 原版事件循环是串行的：演出段执行期间（_scriptPause，等价原版主循环
       * 阻塞在演出上）与战斗已结算后，战场检查点不得重入选段。否则 S_00 sec10
       * 这种自锁旗在链尾的长链会被每个 unitDone 检查点从头并发重跑（op_51 反复、
       * _eexScene 多次 ++、scriptBattleOver 洪泛，2026-11-06 实证）。 */
      if (this._scriptPause || this.state !== "playing") return true;
      const sc = CH.scenes[this._eexScene || 0];
      if (!sc) { this._eexDone = true; return true; }
      let win = null;                                 // select：最后满足者胜出
      for (const sec of sc.sections) if (this._evalSectionConds(sec.conds)) win = sec;
      if (!win) return true;
      const hasShow = win.body.some(b => b[0] === "dialog" || b[0] === "unit_say" || b[0] === "duel_setup");
      if (hasShow) this._scriptPause = true;
      this._eexNext = false;
      const r = await this._runEexBlock(win.body, 0, this._eexFile + "/s" + this._eexScene);
      if (hasShow) {
        this._scriptPause = false;
        if (this.forceWin && this.onEvent) this.onEvent({ type: "scriptForceWin", reason: this.forceWin });
      }
      if (r && r.scenario !== undefined && this.onEvent) this.onEvent({ type: "scriptScenarioJump", scenario: r.scenario });
      // 场景推进：0x0d 标记，或单段场景 body 自然走完（0x0c 中止则停留重选）
      if (!(r && r.abort) && (this._eexNext || sc.sections.length === 1)) {
        this._eexScene++;
        if (this._eexScene >= CH.scenes.length) {
          this._eexDone = true;
          if (this.onEvent) this.onEvent({ type: "scriptScenarioDone" });
        }
      }
      return true;
    }
    async runIntroEvents() {
      // v2 结构化层优先：scene0 = 部署场景，线性走完即入 scene1 事件循环
      if ((window.JW_BATTLE_EVENTS_V2 || {})[this._eexFile]) {
        const CH = window.JW_BATTLE_EVENTS_V2[this._eexFile];
        const sc = CH.scenes[0];
        if (sc) {
          let win = null;
          for (const sec of sc.sections) if (this._evalSectionConds(sec.conds)) win = sec;
          if (win) await this._runEexBlock(win.body, 0, this._eexFile + "/s0");
        }
        this._eexScene = 1;
        if (this.onEvent) this.onEvent({ type: "scriptIntroDone" });
        return;
      }
      if (!this.script || !this.script.intro) return;
      for (let i = 0; i < this.script.intro.length; i++) {
        if (this._scriptDone.has("intro" + i)) continue;
        const sec = this.script.intro[i];
        this._scriptDone.add("intro" + i);
        await this._runActions(sec.actions, "intro" + i);
      }
      if (this.onEvent) this.onEvent({ type: "scriptIntroDone" });
    }
    /* 战后演出（原版 outro 段）：设定战果 set_result / 音效等。
     * 之前完全未执行，导致战果旗不落。胜利/败北结算前调用。 */
    async runOutroEvents() {
      if (!this.script || !this.script.outro) return;
      for (let i = 0; i < this.script.outro.length; i++) {
        if (this._scriptDone.has("outro" + i)) continue;
        const sec = this.script.outro[i];
        if (sec.conds && sec.conds.length && !this._evalConds(sec.conds)) continue;
        this._scriptDone.add("outro" + i);
        await this._runActions(sec.actions, "outro" + i);
      }
    }

    async pollScriptEvents() {
      if (await this.pollEexEvents()) return;      // v2 §4 结构化层优先
      if (!this.script || !this.script.polls || this.forceWin) return;
      for (let i = 0; i < this.script.polls.length; i++) {
        if (this._scriptDone.has("poll" + i)) continue;
        const sec = this.script.polls[i];
        if (!this._evalConds(sec.conds)) continue;
        this._scriptDone.add("poll" + i);
        const hasShow = sec.actions.some(a => a.name === "dialog" || a.name === "duel_setup" || a.name === "unit_say");
        if (hasShow) this._scriptPause = true; // 原版：演出期间全场暂停（含敌 AI）
        await this._runActions(sec.actions, "poll" + i);
        if (hasShow) {
          this._scriptPause = false;
          // 撤退类剧本（如 S_00 单挑后撤离）在链内设置 forceWin，但链内无 unitDone 事件 → 这里立即收割
          if (this.forceWin && this.onEvent) this.onEvent({ type: "scriptForceWin", reason: this.forceWin });
        }
        // 事件旗联动：赵云撤退 → event5（S_00 结算段由 test_event5 触发）
        if (this._scriptFlags.zhaoRetreated || this._scriptFlags.zhaoRemoved) this._scriptFlags.event5 = true;
      }
    }

    // 强制位移（测试/剧本用）：清旧格→占新格，保持 map 一致
    teleportUnit(u, x, y) {
      if (!u || !this.map.inBounds(x, y)) return false;
      const oc = this.map.get(u.x, u.y);
      if (oc && oc.unit === u) oc.unit = null;
      const nc = this.map.get(x, y);
      if (!nc || nc.unit) return false;
      nc.unit = u;
      u.x = x; u.y = y;
      return true;
    }

    // 主将附近可用格（援军落位）
    findFreeCellNear(cx, cy) {
      for (let r = 0; r <= 6; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          const cell = this.map.get(x, y);
          if (cell && !cell.unit && !cell.terrain.impassable) return { x, y };
        }
      }
      return null;
    }

    // ---- 胜利判定 ----
    checkWin() {
      const aliveEnemies = this.enemies.filter(u => u.isAlive);
      const aliveSide = this.sideUnits.filter(u => u.isAlive);
      // 胜利：敌军全灭
      if (aliveEnemies.length === 0) return { result: "win" };
      // 原版脚本过关（如 S_00 完成目的后撤退结算）
      if (this.forceWin) return { result: "win", reason: this.forceWin };
      // 失败：我方（含友军）全灭
      if (aliveSide.length === 0) return { result: "lose" };
      // 失败：主将阵亡（原版 0x46 首个我方强制出场单位为主将）
      const leader = this.sideUnits.find(u => u.leader) || null;
      if (leader && !leader.isAlive) return { result: "lose", reason: "主将阵亡" };
      // 回合上限失败不在这里判：原版 FUN_0044eec5 只在回合边界（外循环 while(cur<cap)）
      // 检查，战斗中阵亡只触发即时胜负。用 roundLimitHit() 在 endTurn 末尾判。
      // 关卡自定义条件
      if (this.config.objective === "survive") {
        return null;
      }
      // 到达指定地点（op 0x5b target area）
      if (this.targetArea) {
        const { x1, y1, x2, y2 } = this.targetArea;
        if (this.sideUnits.some(u => u.isAlive && u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2)) {
          return { result: "win", reason: "到达指定地点" };
        }
      }
      return null;
    }

    // 回合上限判定（原版 0 基外循环：打满第 maxRounds 回合即败，无宽限）
    roundLimitHit() { return !!(this.maxRounds && this.round >= this.maxRounds); }

    // ---- AI ----
    async runEnemyTurn() {
      if (this._scriptPause) return; // 剧情演出（单挑等）期间战斗暂停，敌人不行动
      this.phase = "enemy";
      if (this.onEvent) this.onEvent({ type: "phase", phase: "enemy" });
      // 敌方阶段开始恢复（原版 0x43c7d6 每方阶段开始）
      this.phaseStartRecovery(this.enemies.filter(u => u.isAlive));
      await new Promise(r => setTimeout(r, 400));
      const enemies = this.enemies.filter(u => u.isAlive && !u.hasActed);
      for (const enemy of enemies) {
        if (this._abort || this.state !== "playing") return;
        await new Promise(r => setTimeout(r, 250));
        await this.actEnemy(enemy);
        if (this.onEvent) this.onEvent({ type: "unitDone", unit: enemy.id });
      }
      this.phase = "player";
      if (this.onEvent) this.onEvent({ type: "phase", phase: "player" });
    }

    // 友军 AI 回合（原版 0x46 友军单位自动行动）
    async runFriendTurn() {
      const friends = this.friends.filter(u => u.isAlive && !u.hasActed);
      for (const f of friends) {
        await new Promise(r => setTimeout(r, 200));
        await this.actFriend(f);
        if (this.onEvent) this.onEvent({ type: "unitDone", unit: f.id });
      }
    }

    async actFriend(f) {
      if (!f.isAlive || f.hasActed) return;
      if (f.isParalyzed || f.isSleeping) { f.hasActed = true; return; }
      const targets = this.enemies.filter(u => u.isAlive);
      if (!targets.length) { f.hasActed = true; return; }
      // 找最近敌
      let best = null, bestDist = Infinity;
      for (const t of targets) {
        const d = U.chebyshev(f.x, f.y, t.x, t.y);
        if (d < bestDist) { bestDist = d; best = t; }
      }
      const range = this.attackRange(f, f.x, f.y);
      if (range.some(p => this.map.get(p.x, p.y)?.unit === best)) {
        await this.attack(f, best);
        f.hasActed = true; return;
      }
      const reach = this.moveRange(f);
      if (reach.length) {
        let bestMove = null, bestScore = Infinity;
        for (const mv of reach) {
          const r2 = this.attackRange(f, mv.x, mv.y);
          let minD = Infinity;
          for (const t of targets) { const d = U.chebyshev(mv.x, mv.y, t.x, t.y); if (d < minD) minD = d; }
          if (minD < bestScore) { bestScore = minD; bestMove = mv; }
        }
        if (bestMove) {
          this.map.set(f.x, f.y, Object.assign({}, this.map.get(f.x, f.y), { unit: null }));
          f.x = bestMove.x; f.y = bestMove.y;
          this.map.set(f.x, f.y, Object.assign({}, this.map.get(f.x, f.y), { unit: f }));
          f.hasMoved = true;
          const r2 = this.attackRange(f, f.x, f.y);
          if (r2.some(p => this.map.get(p.x, p.y)?.unit === best)) {
            await this.attack(f, best);
          }
        }
      }
      f.hasActed = true;
    }

    async actEnemy(enemy) {
      if (!enemy.isAlive || enemy.hasActed) return;
      if (enemy.isParalyzed || enemy.isSleeping) {
        enemy.hasActed = true;
        this.logEntry(`${enemy.name} 无法行动`, "sys");
        return;
      }
      // 混乱：随机攻击
      if (enemy.isConfused) {
        const targets = this.sideUnits.filter(u => u.isAlive);
        if (targets.length) {
          const t = U.choice(targets);
          await this.attack(enemy, t);
        }
        enemy.hasActed = true;
        return;
      }
      // 找最近我方（含友军）
      const targets = this.sideUnits.filter(u => u.isAlive);
      if (!targets.length) return;
      /* 原版 AI 模式（battle_enemies 槽 ai_mode）：
       *   0/1 主动出击　2 半主动（原地，进射程才打）　3 追击指定人物(ai_pid)
       *   4 前往指定坐标(ai_x,ai_y)　5 追击指定人物（同 3）　6 前往指定坐标（同 4） */
      /* 原版 AI 模式（rules_ref §10.3，槽 ai_mode → 单位 AI code）：
       *   0 被动出击(code3)：只有能移动到「可攻击到敌」的格子才行动
       *   1 主动出击(code1)　2 坚守原地(code2，不移动)
       *   3 攻击武将(code0)　4 到达地点(code0)
       *   5 跟随武将(code4，只走不打)　6 逃至地点(code4，只走不打) */
      const rawAi = enemy.aiParam | 0;
      const aiMode = (rawAi >= 0 && rawAi <= 6) ? rawAi : 1;
      // 5/6：只移动、不攻击
      const moveOnly = (aiMode === 5 || aiMode === 6);
      // 0：被动出击——先看是否存在「走过去就能打到人」的落点，没有则待命
      if (aiMode === 0) {
        const reach = (() => { try { return this.moveRange(enemy) || []; } catch (e) { return []; } })();
        const spots = [{ x: enemy.x, y: enemy.y }, ...reach];
        let canHit = false;
        for (const sp of spots) {
          let rng = [];
          try { rng = this.attackRange(enemy, sp.x, sp.y) || []; } catch (e) { rng = []; }
          if (rng.some(p2 => { const u2 = this.map.get(p2.x, p2.y)?.unit; return u2 && u2.isAlive && u2.faction !== enemy.faction; })) { canHit = true; break; }
        }
        if (!canHit) { enemy.hasActed = true; return; }
      }
      let best = null, bestDist = Infinity, pursueTarget = null;
      // EXE FUN_0043d509：用目标队列逐个评估（FUN_0045418f 取下一目标 → FUN_004401a8 判攻击可达 → action=4 沿路径移动攻击）。
      // remake 无法完整复现运行时队列顺序，近似为：优先血量百分比最低的敌人（最易被击破，符合“逐个评估、选第一个可攻击”的语义），其次距离最近。
      const scored = targets.map(t => {
        const hpRatio = t.maxHp > 0 ? t.hp / t.maxHp : 1;
        const d = U.chebyshev(enemy.x, enemy.y, t.x, t.y);
        return { t, hpRatio, d };
      });
      scored.sort((a, b) => a.hpRatio - b.hpRatio || a.d - b.d);
      if (scored.length) { best = scored[0].t; bestDist = scored[0].d; }
      // 3（攻击武将）/5（跟随武将）：锁定指定人物（不存在则退回上面选定的目标）
      if ((aiMode === 3 || aiMode === 5) && enemy.aiPid != null) {
        const wanted = this.units.find(u => u.pid === enemy.aiPid && u.isAlive);
        if (wanted) { best = wanted; pursueTarget = wanted; bestDist = U.chebyshev(enemy.x, enemy.y, wanted.x, wanted.y); }
      }
      // 4（到达地点）/6（逃至地点）：走向指定格；6 只走不打
      if ((aiMode === 4 || aiMode === 6) && enemy.aiX != null && enemy.aiY != null) {
        const atSpot = enemy.x === enemy.aiX && enemy.y === enemy.aiY;
        if (!atSpot) {
          const step = this.aiStepToward ? this.aiStepToward(enemy, enemy.aiX, enemy.aiY) : null;
          if (step) { this.move(enemy, step.x, step.y); await new Promise(r => setTimeout(r, 160)); }
          // 移动后仍可攻击射程内目标
          const r2 = this.attackRange(enemy, enemy.x, enemy.y);
          const t2 = r2.map(p => this.map.get(p.x, p.y)?.unit)
            .filter(u => u && u.isAlive && u.faction !== enemy.faction)
            .sort((a, b) => this.aiPhysScore(enemy, b, { x: enemy.x, y: enemy.y }) - this.aiPhysScore(enemy, a, { x: enemy.x, y: enemy.y }))[0];
          if (t2 && !moveOnly) await this.attack(enemy, t2);
          enemy.hasActed = true;
          return;
        }
      }
      // 若在攻击范围内，直接攻击（5/6 只移动不攻击）
      const range = this.attackRange(enemy, enemy.x, enemy.y);
      if (!moveOnly && range.some(p => this.map.get(p.x, p.y)?.unit === best)) {
        await this.attack(enemy, best);
        enemy.hasActed = true;
        return;
      }
      if (aiMode === 2) { enemy.hasActed = true; return; } // 半主动：不移动
      /* AI 选位：3/5 追击时朝目标人物走（否则通用评分选位）。
       * 之前只锁定了攻击目标却没影响选位，看起来像不追人。 */
      let bestPos = null;
      if (aiMode === 6 && enemy.aiX != null && enemy.aiY != null) {
        const st6 = this.aiStepToward(enemy, enemy.aiX, enemy.aiY);
        if (st6) bestPos = st6;
      }
      if (pursueTarget) {
        const st = this.aiStepToward(enemy, pursueTarget.x, pursueTarget.y);
        if (st) bestPos = st;
      }
      /* 0/1（被动/主动出击）：EXE 沿路径逐步推进，向选定攻击目标 best 推进一格（FUN_00437e23 语义），再重判射程；
       * 3/5/4/6 的目标点已在前面用 aiStepToward 处理，此处只对 0/1 补充。 */
      if (!bestPos && best) {
        const st = this.aiStepToward(enemy, best.x, best.y);
        if (st) bestPos = st;
      }
      if (!bestPos) bestPos = this.aiChoosePosition(enemy);
      if (bestPos.x !== enemy.x || bestPos.y !== enemy.y) {
        this.move(enemy, bestPos.x, bestPos.y);
        await new Promise(r => setTimeout(r, 200));
      }
      // 再判断攻击：移动后可能进入射程，优先攻击 best（否则按评分取最高分目标）
      let attackTarget = null;
      const range3 = this.attackRange(enemy, enemy.x, enemy.y);
      if (best && range3.some(p => p.x === best.x && p.y === best.y)) {
        attackTarget = best;
      } else {
        attackTarget = range3.map(p => this.map.get(p.x, p.y)?.unit)
          .filter(u => u && u.isAlive && u.faction !== enemy.faction)
          .sort((a, b) => this.aiPhysScore(enemy, b, { x: enemy.x, y: enemy.y }) - this.aiPhysScore(enemy, a, { x: enemy.x, y: enemy.y }))[0];
      }
      if (attackTarget && !moveOnly) {
        await this.attack(enemy, attackTarget);
      }
      enemy.hasActed = true;
    }

    /* 围攻（原版 mod：菜单 result 6 → 0x4cfe6c → 0x4cfef9）
     * 0x4cfef9 的实现：以目标为中心遍历 8 个方向（0x4359f5 取邻格），
     * 把每个能对该目标出手的相邻友军收集起来（结果存 0x500e9d），
     * 一个都没有时提示「不能围攻该部队」。 */
    siegeCandidates(actor, target) {
      if (!target || !target.isAlive) return [];
      const sideOk = (u) => u.isAlive && u.faction === actor.faction && u !== target;
      const list = [];
      for (const u of this.units) {
        if (!sideOk(u) || u.faction === target.faction) continue;
        if (u.hasActed) continue;
        // 8 方向相邻
        const d = Math.max(Math.abs(u.x - target.x), Math.abs(u.y - target.y));
        if (d !== 1) continue;
        // 必须打得到（射程判定 1:1 复用 attackRange）
        let rng = [];
        try { rng = this.attackRange(u, u.x, u.y) || []; } catch (e) { rng = []; }
        if (!rng.some(p => p.x === target.x && p.y === target.y)) continue;
        list.push(u);
      }
      return list;
    }

    async siegeAttack(actor, target) {
      const mates = this.siegeCandidates(actor, target);
      if (!mates.length) { this.logEntry("不能围攻该部队", "sys"); return false; }
      this.logEntry(`围攻 ${target.name}！(${mates.length} 人)`, "sys");
      for (const u of mates) {
        if (!target.isAlive) break;
        await this.attack(u, target);
        u.hasActed = true;
        await new Promise(r => setTimeout(r, 120));
      }
      actor.hasActed = true;
      return true;
    }

    // ---- 序列化（存档）1:1 原版：保存战斗完整状态 ----
    serialize() {
      return {
        round: this.round, curIndex: this.curIndex, phase: this.phase,
        state: this.state, maxRounds: this.maxRounds, objective: this.objective,
        terrainChanges: (this._terrainChanges || []).map(t => ({ x: t.x, y: t.y, new: t.new, old: t.old, patch: t.patch })),
        units: this.units.map(u => ({
          id: u.id, def: u.def, x: u.x, y: u.y, faction: u.faction,
          hp: u.hp, mp: u.mp, exp: u.exp, lvl: u.lvl,
          hasActed: u.hasActed, hasMoved: u.hasMoved,
          buffs: u.buffs ? [...u.buffs] : undefined,
          status: JSON.parse(JSON.stringify(u.status)),
          bag: [...u.bag], weapon: u.weapon, armor: u.armor, acc: u.acc,
          atk: u.atk, def: u.def, mag: u.mag, spd: u.spd, hit: u.hit,
          maxHp: u.maxHp, maxMp: u.maxMp, mov: u.mov, skills: [...u.skills],
          initialX: u.initialX, initialY: u.initialY,
          spriteIdx: u.spriteIdx, faceIdx: u.faceIdx, name: u.name,
          pid: u.pid, clsId: u.clsId, fam: u.fam, rangeCode: u.rangeCode,
          moveCost: u.moveCost, avoidTerr: u.avoidTerr, terrEffect: u.terrEffect,
          leader: u.leader, ai: u.ai, aiParam: u.aiParam, portrait: u.portrait,
          unitDef: u.unitDef, cls: u.cls
        })),
        mapTerrain: this.map.cells.map(c => ({ terrain: c.terrain, tid: c.tid })),
        flags: this.flags || {}
      };
    }
    deserialize(data) {
      if (!data) return false;
      this.round = data.round || 1;
      this.curIndex = data.curIndex || 0;
      this.phase = data.phase || "player";
      this.state = data.state || "playing";
      this.maxRounds = data.maxRounds;
      this.objective = data.objective;
      this._terrainChanges = (data.terrainChanges || []).map(t => ({ x: t.x, y: t.y, new: t.new, old: t.old, patch: t.patch }));
      if (data.mapTerrain) {
        for (let i = 0; i < this.map.cells.length; i++) {
          const mt = data.mapTerrain[i];
          if (mt) { this.map.cells[i].terrain = mt.terrain; this.map.cells[i].tid = mt.tid; }
        }
      }
      this.units = [];
      for (const ud of (data.units || [])) {
        const u = new Unit(ud.def, ud.x, ud.y, ud.faction);
        u.hp = ud.hp; u.mp = ud.mp; u.exp = ud.exp; u.lvl = ud.lvl;
        u.hasActed = ud.hasActed; u.hasMoved = ud.hasMoved;
        u.status = ud.status || {};
        u.bag = ud.bag || [];
        u.weapon = ud.weapon; u.armor = ud.armor; u.acc = ud.acc;
        u.atk = ud.atk; u.def = ud.def; u.mag = ud.mag; u.spd = ud.spd; u.hit = ud.hit;
        u.maxHp = ud.maxHp; u.maxMp = ud.maxMp; u.mov = ud.mov;
        u.skills = ud.skills || [];
        u.initialX = ud.initialX; u.initialY = ud.initialY;
        u.spriteIdx = ud.spriteIdx; u.faceIdx = ud.faceIdx; u.name = ud.name;
        u.pid = ud.pid; u.clsId = ud.clsId; u.fam = ud.fam; u.rangeCode = ud.rangeCode;
        u.moveCost = ud.moveCost || []; u.avoidTerr = ud.avoidTerr || []; u.terrEffect = ud.terrEffect || [];
        u.leader = ud.leader; u.ai = ud.ai; u.aiParam = ud.aiParam; u.portrait = ud.portrait;
        this.units.push(u);
        const cell = this.map.get(u.x, u.y);
        if (cell) cell.unit = u;
      }
      this.allies = this.units.filter(u => u.faction === "ally" && u.isAlive);
      this.friends = this.units.filter(u => u.faction === "friend" && u.isAlive);
      this.enemies = this.units.filter(u => u.faction === "enemy" && u.isAlive);
      this.sideUnits = this.allies.concat(this.friends);
      this.flags = data.flags || {};
      return true;
    }
  }

  // 对外暴露
  window.JW = window.JW || {};
  window.JW.U = U;
  window.JW.GameMap = GameMap;
  window.JW.Unit = Unit;
  window.JW.Battle = Battle;
})();