/* ============================================================
 * 三国志·姜维传 —— 原版规则引擎模块（rules.js）
 * 全部逆向自 Ekd5.exe，地址见 rules_ref.md：
 *   §6.1 射程形状 0x436586 / switch 0x4379c4（16 码）
 *   §6.2 区域形状 0x435d6c / switch 0x436388（12 码）
 *   §5.6 策略可用性 0x420422 / 分类表 0x42093c
 *   地形元素掩码表 0x420acc（30 地形 × 火/水/风/地 4 元素）
 * ============================================================ */
(function () {
  "use strict";

  /* ---------- §6.1 射程形状（16 码，相对格 → 绝对格） ---------- */
  // 0=曼1 1=切1 2=曼2 3=曼2..3 4=曼2..4 5=直线1..2 6=曼1..2
  // 7=曼3..4 8=曼3..5 9=曼3 10=全图 11=无 12=曼1..3 13=曼1..4
  // 14=(±3,-1..1)和(-1..1,±3) 15=切3环去四角
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];             // 上右下左 0x48df68
  const DIAG = [[1,-1],[1,1],[-1,1],[-1,-1]];            // 右上 右下 左下 左上 0x48df48
  const man = (d) => Math.abs(d[0]) + Math.abs(d[1]);
  const cheb = (d) => Math.max(Math.abs(d[0]), Math.abs(d[1]));

  // 每个码的相对格集合（按原版访问顺序，重复格保留→后面去重）
  const RANGE_SHAPES = (function () {
    const S = { 10: [], 11: [] };  // 全图 / 无 特殊处理
    // 曼哈顿环
    const ring = (d) => { const a = []; for (let dx = -d; dx <= d; dx++) for (let dy = -d; dy <= d; dy++) if (man([dx,dy]) === d) a.push([dx,dy]); return a; };
    S[0] = DIRS.slice();
    S[1] = DIRS.concat(DIAG);
    S[2] = DIAG.concat([[-2,0],[2,0],[0,-2],[0,2]]);
    S[3] = ring(2).concat(ring(3));
    S[4] = ring(2).concat(ring(3)).concat(ring(4));
    S[5] = [[1,0],[2,0],[-1,0],[-2,0],[0,1],[0,2],[0,-1],[0,-2]]; // 直线 1..2
    S[6] = DIRS.concat(ring(2));
    S[7] = ring(3).concat(ring(4));
    S[8] = ring(3).concat(ring(4)).concat(ring(5));
    S[9] = ring(3);
    S[12] = DIRS.concat(ring(2)).concat(ring(3));
    S[13] = DIRS.concat(ring(2)).concat(ring(3)).concat(ring(4));
    // 14: (±3, -1..1) and (-1..1, ±3)
    const a14 = [];
    for (const sx of [-3, 3]) for (const dy of [-1, 0, 1]) a14.push([sx, dy]);
    for (const sy of [-3, 3]) for (const dx of [-1, 0, 1]) a14.push([dx, sy]);
    S[14] = a14;
    // 15: 切比雪夫 3 环去四角
    const a15 = [];
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      if (cheb([dx,dy]) === 3 && Math.abs(dx) !== 3 || cheb([dx,dy]) === 3 && Math.abs(dy) !== 3) {}
      if (cheb([dx,dy]) === 3 && !(Math.abs(dx) === 3 && Math.abs(dy) === 3)) a15.push([dx,dy]);
    }
    return S;
  })();

  // 原地访问顺序去重（重复格保留首次）
  function shapeCells(code, x, y, inBounds) {
    if (code === 10) { // 全图
      const all = [];
      for (const [dx, dy] of [[0,0]]) all.push([x+dx, y+dy]);
      return all; // 全图由调用方展开
    }
    if (code === 11) return []; // 无射程
    const rel = RANGE_SHAPES[code] || [];
    const seen = new Set(), out = [];
    for (const [dx, dy] of rel) {
      const k = (x+dx) + "," + (y+dy);
      if (seen.has(k)) continue;
      seen.add(k);
      if (inBounds && !inBounds(x+dx, y+dy)) continue;
      out.push([x+dx, y+dy]);
    }
    return out;
  }

  /* ---------- §6.2 区域形状（12 码，相对 caster→target） ---------- */
  // 0 仅目标 1 +正交4邻 2 +周围8 3 +周围8 4/6/5/12 直线延伸(长度1/2/5/到地图边)
  // 7 +周围8 8 9×9方 9 5×5方 10 扫击(target需caster 8邻, 加target两侧2格) 11 caster周围8格
  function areaCells(code, caster, target, map) {
    const out = [[target.x, target.y]];
    if (code === 0) return out;
    const push = (dx, dy) => { const c = map.get(target.x+dx, target.y+dy); if (c) out.push([target.x+dx, target.y+dy]); };
    const push8 = () => { for (const [dx,dy] of DIRS) push(dx,dy); for (const [dx,dy] of DIAG) push(dx,dy); };
    if (code === 1) { for (const [dx,dy] of DIRS) push(dx,dy); }
    else if (code === 2 || code === 3 || code === 7) { push8(); }
    else if (code === 8) { out.length = 0; for (let dx=-4; dx<=4; dx++) for (let dy=-4; dy<=4; dy++) push(dx,dy); }
    else if (code === 9) { out.length = 0; for (let dx=-2; dx<=2; dx++) for (let dy=-2; dy<=2; dy++) push(dx,dy); }
    else if (code === 11) { for (const [dx,dy] of DIRS) out.push([caster.x+dx, caster.y+dy]); for (const [dx,dy] of DIAG) out.push([caster.x+dx, caster.y+dy]); }
    else if (code === 10) {
      // 扫击：仅当 target 在 caster 8 邻内；加 target 两侧 2 格（垂直于 caster→target）
      const ddx = target.x - caster.x, ddy = target.y - caster.y;
      if (Math.abs(ddx) <= 1 && Math.abs(ddy) <= 1) {
        // 垂直方向
        if (Math.abs(ddx) >= Math.abs(ddy)) { push(0, -Math.sign(ddx||1)); push(0, Math.sign(ddx||1)); }
        else { push(-Math.sign(ddy||1), 0); push(Math.sign(ddy||1), 0); }
      }
    } else if (code === 4 || code === 5 || code === 6 || code === 12) {
      // 直线延伸：caster→target 方向越过 target 延伸
      const len = code === 4 ? 1 : code === 6 ? 2 : code === 5 ? 5 : 9999;
      const sx = Math.sign(target.x - caster.x), sy = Math.sign(target.y - caster.y);
      for (let i = 1; i <= len; i++) {
        const c = map.get(target.x + sx*i, target.y + sy*i);
        if (!c) break;
        out.push([target.x + sx*i, target.y + sy*i]);
        if (code === 12 && !map.inBounds(target.x + sx*i, target.y + sy*i)) break;
      }
    }
    return out;
  }

  /* ---------- §5.6 策略分类表（0x42093c，67 项） ----------
   * 0-3 火/水/风/地元素地形 4 AI 暗算HP满 5 暗鬼MP满 6 debuff stat=2
   * 7 伪书伪令(混乱) 8 毒烟瘴雾(中毒) 9 陷阱濠壑(麻痹) 10 封印
   * 11 heals HP满 12 (none) MP满 13 棒喝超脱(无状态) 14 buffs stat≥4
   * 15 开导诫谕战备(目标是caster) 16 聚气 17 暗杀八阵急行天气(永不失败)
   */
  const STRAT_CAT = [
    0,0,0,0,0, 1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3, 4,
    17, 5, 6,6,6,6,6,6,6,6, 7,7, 8,8, 9,9, 10, 17,
    11,11,11,11,11, 12,12, 13,13, 17,
    14,14,14,14,14,14,14,14, 15,
    17,17,17, 16
  ];
  const catOf = (sid) => (sid < STRAT_CAT.length ? STRAT_CAT[sid] : 17);

  /* ---------- 地形元素掩码（0x420acc，30 地形） ----------
   * 位 1=火 2=水 4=风 8=地；0 = 该元素在此地形不可用（除非 effect 50 左思兵法）
   * 平原05 草原05 树林01 荒地0c 山地0c 岩山00 雪原00 桥梁06 浅滩07 沼泽06
   * 池塘06 小河00 大河00 栅栏06 城墙00 城内00 城门01 城池00 关隘01 鹿砦01
   * 村庄01 兵营01 民居01 宝物库01 云梯01 火00 船00 祭坛00 山崖00 地下00
   */
  const TERRAIN_ELEM = [
    0x05,0x05,0x01,0x0c,0x0c, 0x00,0x00,0x06,0x07,0x06,
    0x06,0x00,0x00,0x06,0x00, 0x00,0x01,0x00,0x01,0x01,
    0x01,0x01,0x01,0x01,0x01, 0x00,0x00,0x00,0x00,0x00
  ];
  // 元素策略 id 区间 → 元素位
  const ELEM_BIT = { fire: [0,4], water: [5,9], wind: [10,14], earth: [15,19] };
  const ELEM_MASK = { fire: 1, water: 2, wind: 4, earth: 8 };

  // 策略元素（type 字段 0=火 1=水 2=地? 3=风；真实表 STRAT_ELEMENT 在 real.js）
  function strategyElement(st) {
    const t = st.type;
    if (t === 0) return "fire";
    if (t === 1) return "water";
    if (t === 2) return "earth";
    if (t === 3) return "wind";
    return null;
  }

  // 地形掩码判断：元素策略在目标地形是否可用
  function elemTerrainOK(st, targetTerrainId, casterHasEffect50) {
    const elem = strategyElement(st);
    if (!elem) return true;
    const bit = ELEM_MASK[elem];
    if (casterHasEffect50) return true;          // 0x420ab6: effect 50 左思兵法 豁免
    const m = targetTerrainId != null ? TERRAIN_ELEM[targetTerrainId] : null;
    if (m === undefined) return true;
    return (m & bit) !== 0;
  }

  window.JW_RULES = {
    shapeCells, areaCells, STRAT_CAT, catOf, TERRAIN_ELEM, ELEM_MASK,
    elemTerrainOK, strategyElement, DIRS, DIAG, RANGE_SHAPES
  };
})();
