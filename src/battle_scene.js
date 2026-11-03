/* ============================================================
 * 三国志·姜维传 —— Phaser 3 战斗渲染层
 *
 * 职责：把 engine.js 的战斗状态（1:1 复刻原版）渲染成画面。
 * 逻辑（移动范围/伤害/命中/反击/连击/经验/升级）全部在 engine.js，
 * 本文件只做显示与输入，不含任何数值判定。
 * ============================================================ */
(function () {
  "use strict";
  const D = window.JW_DATA;

  /* 战场地形 → 原版调色板色（JW_TERRAIN_PALS 来自 Spalet.e5）
   * 地形 ID 为原版 Hexzmap 网格值（0..29），对应 real.js 的 TN 表。
   * TERRAIN_KEY 把原版 ID 映射到 data.js 的 TERRAINS 键。
   */
  /* 原版地形 ID 0..29 权威名表（rules_ref.md §1.4，0x48bd40[28..57]）：
   * 平原 草原 树林 荒地 山地 岩山 山崖 雪原 桥梁 浅滩 沼泽 池塘 小河 大河
   * 栅栏 城墙 城内 城门 城池 关隘 鹿砦 村庄 兵营 民居 宝物库 云梯 火 船 祭坛 地下
   * 旧表从 2 起整体错一位（把 2 树林当道路、26 火当船），火攻剧情改成地形 26
   * 后被渲染成灰色"船"，完全没有火焰表现 —— 用户实测反馈的根因。 */
  const TERRAIN_KEY = {
    0: "plain", 1: "field", 2: "forest", 3: "wilderness", 4: "mountain",
    5: "hill", 6: "cliff", 7: "snow", 8: "bridge", 9: "shallow",
    10: "swamp", 11: "water", 12: "river", 13: "river", 14: "fence",
    15: "wall", 16: "inside", 17: "gate", 18: "fort", 19: "gate",
    20: "deer", 21: "village", 22: "barracks", 23: "house", 24: "storehouse",
    25: "ladder", 26: "fire", 27: "ship", 28: "altar", 29: "underground",
  };
  const TERRAIN_TINT = {
    plain:  0xd6c896, field:   0xbec27e, road:   0xc4b280, forest: 0x4a6e3e,
    hill:   0xa09876, mountain:0x8c8274, snow:   0xe0e4e8, bridge: 0xac9c76,
    shallow:0x8fae9a, swamp:  0x6c6c4e, pond:   0x5e8fb0, river:  0x4e82aa,
    fence:  0x9a8464, wall:   0x967e5c, inside: 0xb09668, gate:   0xa88c60,
    castle: 0xb08040, pass:   0x96724c, deer:   0x8f8a5a, village:0xb89a6a,
    barracks:0xa87848, house: 0xa89070, storehouse:0xc8a840, ladder:0x8a6a4a,
    fire:   0xd84315, ship:   0x8a8a8a, altar:  0xa0a0b0, cliff:  0x5a4a3a,
    wilderness:0xc4b280, shallow:0x8fae9a, fence:  0x9a8464, inside: 0xb09668,
    deer:   0x8f8a5a, village:0xb89a6a, barracks:0xa87848, house:  0xa89070,
    storehouse:0xc8a840, ladder: 0x8a6a4a, underground:0x3a3a3a,
  };

  class BattleScene extends Phaser.Scene {
    constructor() { super("battle"); }

    init(data) {
      try {
        // Phaser 首次自动启动场景时 data 为空，从 UI 取当前战斗
        const ui = window.JW.App && window.JW.App.ui;
        this.battle = (data && data.battle) || (ui && ui.battle);
        this.onEvent = (data && data.onEvent) || ((ui && ui.onPhaserEvent) ? (e) => ui.onPhaserEvent(e) : (() => {}));
        this.onReady = (data && data.onReady) || (ui ? () => ui.bindBattleScene() : null);
        this.cellPx = 40;
        this.baseCellPx = 40;         // 基础格像素（不含 zoom）
        this.zoom = 1;                // 缩放因子 0.5~3.0
        this.panX = 0; this.panY = 0; // 平移偏移
        this.sprites = new Map();     // unitId → sprite 容器
        this.overlayGfx = null;
        /* 换战斗必须丢弃上一场的地面纹理缓存，否则复用 scene 时沿用旧底图。
         * 关键：`_groundLoading` 也要复位 —— 上一场底图 onload 还没回来就切下一场时，
         * 这个标志会一直为 true，_ensureGroundImage 直接 return，新战场底图永远不加载
         * （表现为「进入战斗后背景有时丢失」）。 */
        this._groundTex = undefined;
        this._groundImg = null;
        this._groundLoading = false;
        this._groundCells = null;
        this._groundKey = null;
        this.cursorGfx = null;
        this.hoverCell = null;
        // 本场需要的战斗形象（只加载用到的，避免 518 张全量解码）
        const mov = window.JW_UNIT_MOV || [];
        this.neededSprites = [];
        const seen = new Set();
        for (const u of (this.battle ? this.battle.units : [])) {
          const idx = u.spriteIdx;
          if (idx == null || seen.has(idx) || !mov[idx]) continue;
          seen.add(idx);
          this.neededSprites.push(idx);
        }
      } catch (e) { console.error("JW_BattleScene.init 失败", e); }
    }

    /* 预加载本场用到的原版战斗形象
     * Unit_mov = 11 帧 × 48×48（25344 = 11×48×48，已用行内容周期验证）。
     * 必须走 Phaser 的 loader（preload 阶段由框架异步管理，create 保持同步）。 */
    preload() {
      const mov = window.JW_UNIT_MOV || [];
      for (const idx of this.neededSprites) {
        const key = "umov" + idx;
        if (this.textures.exists(key)) continue;
        this.load.spritesheet(key, mov[idx], { frameWidth: 48, frameHeight: 48 });
      }
    }

    create() {
      try {
        this.buildScene();
        /* 原版开局：镜头对准我方部队（而不是地图几何中心）。
         * 地图常比视口大（本例 20×20×52px=1040 而视口高 666），只居中地图的话
         * 靠边/靠上的单位会滚出画面、看起来「小人消失」。 */
        this.centerOnLeader();
      } catch (e) {
        console.error("JW_BattleScene.create 失败", e);
      }
      if (this.onReady) this.onReady(this);
    }

    /* 把镜头居中到我方主将（无则第一个我方单位）；不改任何战斗数据 */
    centerOnLeader() {
      const b = this.battle;
      if (!b || !b.units) return;
      const pool = b.units.filter(u => u && u.state === 2 && u.x >= 0);
      if (!pool.length) return;
      const lead = pool.find(u => u.leader && u.faction === "ally")
        || pool.find(u => u.faction === "ally")
        || pool[0];
      if (!lead) return;
      this.panX = Math.round(this.scale.width / 2 - (lead.x + 0.5) * this.cellPx);
      this.panY = Math.round(this.scale.height / 2 - (lead.y + 0.5) * this.cellPx);
      this.clampPan();
      this.recalcLayout();
      this.redrawAll();
      this.refreshUnits();
    }

    /* 平移范围限制：地图小于视口时居中；大于视口时不允许滚出地图边界 */
    clampPan() {
      const b = this.battle;
      if (!b || !b.map) return;
      const mapW = b.map.w * this.cellPx, mapH = b.map.h * this.cellPx;
      const vw = this.scale.width, vh = this.scale.height;
      if (mapW <= vw) this.panX = 0;
      else {
        const minX = vw - mapW - Math.floor((vw - mapW) / 2);
        const maxX = -Math.floor((vw - mapW) / 2);
        this.panX = Math.max(Math.min(this.panX, maxX), minX);
      }
      if (mapH <= vh) this.panY = 0;
      else {
        const minY = vh - mapH - Math.floor((vh - mapH) / 2);
        const maxY = -Math.floor((vh - mapH) / 2);
        this.panY = Math.max(Math.min(this.panY, maxY), minY);
      }
    }

    buildScene() {
      const b = this.battle;
      if (!b) { console.warn("JW_BattleScene: 无战斗数据"); return; }
      this.applyScale();
      this.recalcLayout();

      // ---- 地形层 ----
      // ---- 统一 Graphics（地形/覆盖层/光标/单位图形全部画在这一个对象上） ----
      this._g();
      this.unitLayer = null;
      /* 只为「在场上」的单位建精灵：hidden 未出场(state1)/撤退(3)/阵亡(0) 都不该有图 */
      for (const u of b.units) if (u.state === 2) this.createUnitSprite(u);
      // 兜底：把不在地图内的单位挪到可见位置（防止整队不可见）
      // 注意：state !== 2 的单位（hidden 未出场 / 已撤退 / 已阵亡）**不是**异常，
      // 它们本来就不该在图上，不能被这个兜底塞进空格。
      for (const u of b.units) {
        if (u.state !== 2) continue;
        if (u.x >= 0 && u.x < b.map.w && u.y >= 0 && u.y < b.map.h) continue;
        const cell = b.map.get(u.x, u.y);
        if (cell) continue;
        for (let y = 0; y < b.map.h; y++) for (let x = 0; x < b.map.w; x++) {
          const c = b.map.get(x, y);
          if (c && !c.unit) { u.x = x; u.y = y; c.unit = u; break; }
        }
      }
      this.redrawAll();

      // ---- 输入（只用原生画布事件，Phaser 内部坐标在 CSS 偏移下不可靠） ----
      this._bindNativeInput();

      this.scale.on("resize", () => this.layout());
      this.events.emit("battle-ready", this);
    }

    /* ---------- 坐标换算 ---------- */
    cellAt(px, py) {
      const x = Math.floor((px - this.originX) / this.cellPx);
      const y = Math.floor((py - this.originY) / this.cellPx);
      if (!this.battle.map.inBounds(x, y)) return null;
      return { x, y };
    }
    unitCenter(u) {
      return { x: this.originX + (u.x + 0.5) * this.cellPx, y: this.originY + (u.y + 0.5) * this.cellPx };
    }

    /* 单位脚底相对格子中心的偏移：+0.5 格 = 正好落在格子下缘（原版人物站在格子里，
     * 脚底贴格子底边）。旧值 0.40 把脚底抬到格子内部偏上，看起来整个人浮在格子上半格。 */
    get footOffsetY() { return this.cellPx * 0.5; }

    /* 按容器尺寸调整画布（Scale.NONE 模式下手动） */
    applyScale() {
      const holder = this.scale.parent;
      const w = Math.max(320, holder ? holder.clientWidth : this.scale.width);
      const h = Math.max(240, holder ? holder.clientHeight : this.scale.height);
      if (w !== this.scale.width || h !== this.scale.height) {
        this.scale.resize(w, h);
      }
    }

    layout() {
      this.applyScale();
      this.recalcLayout();
      this.redrawAll();
      this.refreshUnits();
    }

    /* 重新计算布局：baseCellPx 随容器变化，cellPx = base × zoom，origin = 居中 + pan */
    recalcLayout() {
      const b = this.battle;
      if (!b) return;
      /* 原版战斗地图铺满整个窗口（tile 48×48，超出部分裁切）。
       * 用 cover 而不是 contain：取两个方向的较大者，保证四边不留 letterbox。 */
      const fitW = this.scale.width / Math.max(1, b.map.w);
      const fitH = this.scale.height / Math.max(1, b.map.h);
      this.baseCellPx = Math.max(16, Math.min(64, Math.ceil(Math.max(fitW, fitH))));
      this.cellPx = this.baseCellPx * this.zoom;
      const mapW = b.map.w * this.cellPx, mapH = b.map.h * this.cellPx;
      this.originX = Math.floor((this.scale.width - mapW) / 2) + this.panX;
      this.originY = Math.floor((this.scale.height - mapH) / 2) + this.panY;
    }

    /* 原版「地图居中到某格」（0x5b target_area / 0x5c 在场单位 / 0x55 重入场共用）：
     * 通过 panX/panY 把该格移到画布中心，并可选闪烁若干次。 */
    centerOnCell(cx, cy, blinks = 0) {
      const b = this.battle;
      if (!b || !b.map) return;
      this.panX = Math.floor(this.scale.width / 2) - (cx + 0.5) * this.cellPx;
      this.panY = Math.floor(this.scale.height / 2) - (cy + 0.5) * this.cellPx;
      this.recalcLayout();
      this.redrawAll();
      if (blinks > 0) this.blinkCells([{ x: cx, y: cy }], blinks);
    }
    /* 原版 0x45a0ce/0x416e17：区域闪烁 3 次（10 亮 10 灭 tick） */
    blinkCells(cells, times = 3) {
      if (!cells || !cells.length) return;
      this._blinkSet = cells.slice();
      this.redrawAll();
      let n = 0;
      const step = () => {
        if (!this.scene || !this.scene.isActive()) return;
        n++;
        this._blinkOn = !this._blinkOn;
        this.redrawAll();
        if (n < times * 2) this.time.delayedCall(160, step);
        else { this._blinkSet = null; this._blinkOn = false; this.redrawAll(); }
      };
      step();
    }

    /* 以画布坐标 (mx,my) 为中心缩放 */
    zoomAt(factor, mx, my) {
      const newZoom = Math.max(0.5, Math.min(3.0, this.zoom * factor));
      if (Math.abs(newZoom - this.zoom) < 0.01) return;
      // 鼠标在地图上的相对位置（cell 坐标，含小数）
      const relX = (mx - this.originX) / this.cellPx;
      const relY = (my - this.originY) / this.cellPx;
      this.zoom = newZoom;
      this.cellPx = this.baseCellPx * this.zoom;
      // 保持鼠标下的地图点不变
      this.originX = mx - relX * this.cellPx;
      this.originY = my - relY * this.cellPx;
      this.redrawAll();
      this.refreshUnits();
    }

    /* 平移（像素） */
    panBy(dx, dy) {
      this.panX += dx; this.panY += dy;
      this.recalcLayout();
      this.redrawAll();
      this.refreshUnits();
    }

    /* ---------- 地形绘制（写入统一 Graphics） ---------- */
    drawTerrain() {
      const b = this.battle;
      // 原版纹理底图（HmXX.e5 解码纹理块，1:1 素材复用）：一次性画到离屏画布
      this._ensureGroundImage();
      const g = this._g();
      this._terrain = [];
      // 原版地图已含地形美术（森林/山/兵营画在图里）→ 纹理就绪后不再叠加程序化符号
      const realMap = !!this._groundTex;
      if (realMap) {
        /* 纹理图只覆盖 Hexzmap 的格数，扩展出的格子才需要底色。
         * 旧实现无脑铺满整块地图矩形，把 depth -10 的纹理图整个盖住（战斗背景变纯深褐的根因）。 */
        const cw = (this._groundCells && this._groundCells.gw) || b.map.w;
        const ch = (this._groundCells && this._groundCells.gh) || b.map.h;
        const mapW = b.map.w * this.cellPx, mapH = b.map.h * this.cellPx;
        const texW = cw * this.cellPx, texH = ch * this.cellPx;
        g.fillStyle(0x2a2116, 1);
        if (mapW > texW) g.fillRect(this.originX + texW, this.originY, mapW - texW, mapH);
        if (mapH > texH) g.fillRect(this.originX, this.originY + texH, Math.min(texW, mapW), mapH - texH);
      }
      /* 地形配色：原版是引擎按格子的地形类型给地面上色（草地绿、山岩灰、荒地土黄），
       * Hm 底图本身只是灰度/土色纹理。所以有真实底图时也要叠一层地形色，
       * 否则整张地图会是底图那种统一的土棕色（与原版差距最大的地方）。 */
      /* 有真实底图（Hm 解码）时完全不叠色调：底图本身就是原版地表。 */
      const tintAlpha = realMap ? 0 : 0.62;
      /* 有真实底图时暂不叠地形色：底图本身已是渲染好的地表，
       * 叠 0.42 的色块只会整体变浑（实测与不加几乎无差别，且更脏）。
       * 原版草地/岩地的着色来自引擎的地形调色板，待破解后再接。 */
      for (let y = 0; y < b.map.h; y++) {
        for (let x = 0; x < b.map.w; x++) {
          const cell = b.map.get(x, y);
          const tid = cell ? (cell.tid !== undefined ? cell.tid : 0) : 0;
          const key = TERRAIN_KEY[tid] || "plain";
          const tint = TERRAIN_TINT[key] !== undefined ? TERRAIN_TINT[key] : TERRAIN_TINT.plain;
          const px = this.originX + x * this.cellPx, py = this.originY + y * this.cellPx;
          g.fillStyle(tint, tintAlpha);
          g.fillRect(px, py, this.cellPx, this.cellPx);
          if (realMap) continue;   // 底图已含美术，只叠地形色，不再叠噪点/符号/格线
          const seed = (x * 73856093) ^ (y * 19349663);
          const n = (seed >>> 8) & 7;
          g.fillStyle(0, 0, 0, 0.035);
          for (let i = 0; i < 3; i++) {
            const ox = (seed + i * 977) % this.cellPx, oy = ((seed >> 5) + i * 613) % this.cellPx;
            g.fillRect(px + ox, py + oy, 2 + n, 1);
          }
          // 地形符号
          g.lineStyle(1, 40, 28, 12, 0.30);
          g.strokeRect(px + 0.5, py + 0.5, this.cellPx - 1, this.cellPx - 1);
          this.drawTerrainGlyph(g, key, px, py);
        }
      }
      // 外框
      g.lineStyle(2, 0xe0b452, 0.85);
      g.strokeRect(this.originX + 1, this.originY + 1, b.map.w * this.cellPx - 2, b.map.h * this.cellPx - 2);
      // 地面纹理图随布局同步（onload 异步完成时 cellPx/origin 可能已变，resize/zoom 后同理）
      if (this._groundImg) {
        /* 必须按底图原生格数显示：旧代码拉到 b.map.w/h（战场可能被扩展过），
         * 底图被非等比拉伸，美术细节与格子/单位就对不上了。多出的格子由上面的底色补。 */
        const gcw = (this._groundCells && this._groundCells.gw) || b.map.w;
        const gch = (this._groundCells && this._groundCells.gh) || b.map.h;
        this._groundImg.setPosition(this.originX, this.originY);
        this._groundImg.setDisplaySize(gcw * this.cellPx, gch * this.cellPx);
      }
      /* 原版火攻：op 0x21 map_mark / 0x58 terrain_change 把格子改成地形 26（火），
       * 并在覆盖层画火焰 mark（patch 0 播 SE 0x13 火声）。对火格叠程序化火焰动画，
       * 灭火（地形改回）后 redrawAll → 这里收集不到火格 → 火焰自动消失。 */
      this._drawFires();
    }

    /* 原版战场背景图：assets/maps/hmNN.png（逆向 HmNN.e5：gridW*48 × gridH*48 索引图 + Spalet BGR 调色板） */
    _ensureGroundImage() {
      const b = this.battle;
      const m = /^S_(\d\d)$/.exec(b.config && b.config.src || "");
      const key = m ? m[1] : null;
      // 同一场：已加载/加载中则不重复；换了场（key 变化）则强制重来
      if (this._groundKey === key && (this._groundTex !== undefined || this._groundLoading)) return;
      if (!m) { this._groundTex = null; return; }
      this._groundKey = key;
      this._groundLoading = true;
      const img = new Image();
      img.src = "assets/maps/hm" + m[1] + ".png?v=3";   // v3：按图块顺序 + Spalet(BGR) 重新解码
      img.onload = () => {
        this._groundLoading = false;
        // 加载期间又换了场 → 丢弃这次结果，避免把旧底图贴到新战场
        if (this._groundKey !== key) return;
        const gkey = "ground" + b.config.src;
        if (this.textures.exists(gkey)) this.textures.remove(gkey);
        const tex = this.textures.addImage(gkey, img);
        this._groundTex = tex;
        if (this._groundImg) this._groundImg.destroy();
        /* 原版地图位图只覆盖 Hexzmap 的格子数（可能小于扩展后的战场），
         * 因此按原生格数绘制，避免纵向/横向拉伸；多出的格子由 drawTerrain 铺底色。 */
        const gw0 = Math.max(1, Math.round(img.width / 48));
        const gh0 = Math.max(1, Math.round(img.height / 48));
        this._groundCells = { gw: gw0, gh: gh0 };
        this._groundImg = this.add.image(this.originX, this.originY, gkey)
          .setOrigin(0, 0)
          .setDisplaySize(gw0 * this.cellPx, gh0 * this.cellPx)
          .setDepth(-10);
        // 首遍地形已用实心色调画过 → 纹理就绪后重绘，改为轻叠加
        if (this.redrawAll) this.redrawAll();
      };
      img.onerror = () => { this._groundLoading = false; };
    }

    /* 火格火焰（原版是 Mark 覆盖层动画；先用程序化火苗近似，Meff.e5 帧解码后替换） */
    _drawFires() {
      if (this._fireTimer) { this._fireTimer.remove(); this._fireTimer = null; }
      if (this._fireLayer) { this._fireLayer.destroy(); this._fireLayer = null; }
      const b = this.battle;
      if (!b || !b.map) return;
      const cells = [];
      for (let y = 0; y < b.map.h; y++) for (let x = 0; x < b.map.w; x++) {
        const cell = b.map.get(x, y);
        const tid = cell ? (cell.tid !== undefined ? cell.tid : 0) : 0;
        if (TERRAIN_KEY[tid] === "fire") cells.push([x, y]);
      }
      if (!cells.length) return;
      const layer = this.add.graphics();
      layer.setDepth(6);
      const draw = () => {
        layer.clear();
        const t = this.time.now / 130;
        for (const [x, y] of cells) {
          const px = this.originX + x * this.cellPx, py = this.originY + y * this.cellPx;
          const sz = this.cellPx;
          for (let i = 0; i < 3; i++) {
            const fx = px + sz * (0.26 + 0.24 * i);
            const fh = sz * (0.42 + 0.26 * Math.abs(Math.sin(t + i * 2.1 + x * 1.7 + y * 0.9)));
            layer.fillStyle(0xd84315, 0.85);
            layer.fillTriangle(fx - sz * 0.14, py + sz, fx + sz * 0.14, py + sz, fx, py + sz - fh);
            layer.fillStyle(0xff9800, 0.9);
            layer.fillTriangle(fx - sz * 0.09, py + sz, fx + sz * 0.09, py + sz, fx, py + sz - fh * 0.7);
            layer.fillStyle(0xffd54f, 0.95);
            layer.fillTriangle(fx - sz * 0.045, py + sz, fx + sz * 0.045, py + sz, fx, py + sz - fh * 0.42);
          }
        }
      };
      draw();
      this._fireLayer = layer;
      this._fireTimer = this.time.addEvent({ delay: 120, loop: true, callback: draw });
    }

    drawTerrainGlyph(g, terrain, px, py) {
      const s = this.cellPx, cx = px + s / 2, cy = py + s / 2;
      if (s < 18) return;
      g.lineStyle(Math.max(1, s / 16), 46, 32, 14, 0.42);
      switch (terrain) {
        case "forest":
          for (let i = -1; i <= 1; i++) {
            g.beginPath();
            g.moveTo(cx + i * s * 0.26, cy - s * 0.22);
            g.lineTo(cx + i * s * 0.26 - s * 0.14, cy + s * 0.2);
            g.lineTo(cx + i * s * 0.26 + s * 0.14, cy + s * 0.2);
            g.closePath(); g.strokePath();
          }
          break;
        case "mountain":
          g.beginPath();
          g.moveTo(cx - s * 0.3, cy + s * 0.2); g.lineTo(cx, cy - s * 0.28); g.lineTo(cx + s * 0.3, cy + s * 0.2);
          g.closePath(); g.strokePath();
          break;
        case "river": case "water": case "pond": case "shallow":
          for (let i = -1; i <= 1; i++) {
            g.beginPath();
            g.moveTo(cx - s * 0.3, cy + i * s * 0.18);
            g.lineTo(cx - s * 0.1, cy + i * s * 0.18 - s * 0.08);
            g.lineTo(cx + s * 0.1, cy + i * s * 0.18 + s * 0.08);
            g.lineTo(cx + s * 0.3, cy + i * s * 0.18);
            g.strokePath();
          }
          break;
        case "fort": case "gate": case "wall": case "castle": case "pass":
        case "fence": case "village": case "barracks": case "house": case "storehouse":
        case "inside": case "altar": case "ship": case "ladder": case "deer":
          g.strokeRect(cx - s * 0.26, cy - s * 0.18, s * 0.52, s * 0.36);
          g.beginPath(); g.moveTo(cx - s * 0.1, cy - s * 0.18); g.lineTo(cx - s * 0.1, cy + s * 0.18);
          g.moveTo(cx + s * 0.1, cy - s * 0.18); g.lineTo(cx + s * 0.1, cy + s * 0.18);
          g.strokePath();
          break;
        case "bridge":
          g.strokeRect(cx - s * 0.28, cy - s * 0.12, s * 0.56, s * 0.24);
          break;
        case "swamp":
          for (let i = -1; i <= 1; i++) {
            g.beginPath();
            g.moveTo(cx - s * 0.2, cy + i * s * 0.16); g.lineTo(cx + s * 0.2, cy + i * s * 0.16);
            g.strokePath();
          }
          break;
        case "snow":
          for (let i = 0; i < 3; i++) {
            const a = i * Math.PI / 3;
            g.beginPath();
            g.moveTo(cx - Math.cos(a) * s * 0.22, cy - Math.sin(a) * s * 0.22);
            g.lineTo(cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.22);
            g.strokePath();
          }
          break;
        case "desert":
          g.beginPath();
          g.moveTo(cx - s * 0.24, cy + s * 0.16); g.quadraticCurveTo(cx, cy - s * 0.24, cx + s * 0.24, cy + s * 0.16);
          g.strokePath();
          break;
        case "hill":
          g.beginPath();
          g.arc(cx, cy + s * 0.16, s * 0.24, Math.PI, 0);
          g.strokePath();
          break;
        case "field":
          for (let i = -1; i <= 1; i++) {
            g.beginPath();
            g.moveTo(cx - s * 0.24, cy + i * s * 0.16 + s * 0.06);
            g.lineTo(cx + s * 0.24, cy + i * s * 0.16 - s * 0.06);
            g.strokePath();
          }
          break;
        case "road":
          g.beginPath();
          g.moveTo(cx - s * 0.3, cy + s * 0.14);
          g.lineTo(cx + s * 0.3, cy - s * 0.14);
          g.strokePath();
          break;
        case "cliff":
          g.beginPath();
          g.moveTo(cx - s * 0.26, cy + s * 0.2);
          g.lineTo(cx - s * 0.26, cy - s * 0.1);
          g.lineTo(cx - s * 0.06, cy - s * 0.2);
          g.lineTo(cx - s * 0.06, cy + s * 0.2);
          g.strokePath();
          break;
        case "underground":
          g.beginPath();
          g.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
          g.strokePath();
          break;
        case "fire":
          g.beginPath();
          g.moveTo(cx, cy - s * 0.24);
          g.lineTo(cx + s * 0.14, cy + s * 0.16);
          g.lineTo(cx - s * 0.14, cy + s * 0.16);
          g.closePath(); g.strokePath();
          break;
      }
    }

    /* ---------- 单位精灵 ----------
     * Phaser CANVAS 模式下多个 Graphics 共享同一 canvas 上下文会互相覆盖，
     * 因此所有单位的图形（底圆/名牌/血条/阴影）统一由一个 Graphics 绘制；
     * 原版形象用 Image（独立纹理，可并存）。
     */
    createUnitSprite(u) {
      const c = this.unitCenter(u);
      let img = null;
      const key = "umov" + u.spriteIdx;
      if (this.textures.exists(key)) {
        img = this.add.image(c.x, c.y + this.footOffsetY, key, 0).setOrigin(0.5, 1).setDepth(20);
        img.displayHeight = this.cellPx * 1.12;
        img.displayWidth = img.displayHeight;   // 48×48 方形帧
      }
      const rec = { unit: u, img, barW: this.cellPx * 0.9 };
      this.sprites.set(u.id, rec);
      if (img) img.setFlipX(u.dir === 3);
      return rec;
    }

    /* 统一重绘所有单位图形（写入统一 Graphics） */
    redrawUnits() {
      const g = this._g();
      if (!this.battle) return;
      for (const u of this.battle.units) {
        const c = this.unitCenter(u);
        const alive = u.isAlive;
        const a = alive ? 1 : 0.3;
        const rec = this.sprites.get(u.id);
        /* 原版单位是直接站在格子上的，没有底座圆圈；只留一层很淡的落影。 */
        try {
          g.fillStyle(0x000000, 0.16 * a);
          g.fillEllipse(c.x, c.y + this.cellPx * 0.34, this.cellPx * 0.5, this.cellPx * 0.14);
        } catch (e) { console.warn("单位落影绘制失败", e); }
        // 朝向指示（小箭头）
        try {
          const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
          const d = dirs[u.dir || 2];
          const ax = c.x + d[0] * this.cellPx * 0.3;
          const ay = c.y + d[1] * this.cellPx * 0.3;
          g.fillStyle(0xe0b452, 0.8 * a);
          g.beginPath();
          g.moveTo(ax, ay);
          g.lineTo(ax - d[1] * 4, ay + d[0] * 4);
          g.lineTo(ax + d[1] * 4, ay - d[0] * 4);
          g.closePath();
          g.fillPath();
        } catch (e) {}

        // 名牌（Phaser Text，Graphics 的 fillText 在 CANVAS 模式不可用）
        try {
          const fs = Math.max(10, Math.round(this.cellPx * 0.3));
          if (!rec.label) {
            rec.label = this.add.text(c.x, c.y - this.cellPx * 0.52, u.name, {
              fontFamily: "serif", fontSize: fs + "px", color: "#f4e6c8",
              stroke: "#241608", strokeThickness: 3,
            }).setOrigin(0.5, 0.5).setDepth(21);
          }
          rec.label.setPosition(c.x, c.y - this.cellPx * 0.62);
          /* 原版战斗区不常驻显示部队名；只在选中/待机高亮时露出，避免画面被文字糊住。 */
          rec.label.setAlpha(this.selectedUnit && this.selectedUnit.id === u.id ? a : 0);
        } catch (e) { console.warn("名牌绘制失败", e); }
        // 血条
        try {
          const ratio0 = u.maxHp ? Math.max(0, u.hp / u.maxHp) : 0;
          if (ratio0 >= 0.999 && !(this.selectedUnit && this.selectedUnit.id === u.id)) continue;
          const bw = this.cellPx * 0.9, bh = Math.max(3, this.cellPx * 0.09);
          const by = c.y + this.cellPx * 0.56;
          g.fillStyle(0x1a0d04, 0.85 * a);
          g.fillRect(c.x - bw / 2, by - bh / 2, bw, bh);
          const ratio = u.maxHp ? Math.max(0, u.hp / u.maxHp) : 0;
          g.fillStyle(ratio > 0.5 ? 0x6cbb44 : ratio > 0.25 ? 0xd0a13a : 0xbb4433, a);
          g.fillRect(c.x - bw / 2, by - bh / 2, bw * ratio, bh);
          g.lineStyle(1, 0xe0b452, 0.6 * a);
          g.strokeRect(c.x - bw / 2, by - bh / 2, bw, bh);
        } catch (e) { console.warn("血条绘制失败", e); }
      }
    }

    updateUnitSprite(rec) {
      const u = rec.unit;
      const c = this.unitCenter(u);
      if (rec.img) {
        rec.img.setPosition(c.x, c.y + this.footOffsetY);
        rec.img.setAlpha(u.isAlive ? 1 : 0.28);
      }
      this.redrawAll();
    }

    refreshUnits() {
      /* 清除已不在战场上的单位精灵（出阵换人/单位移除后会留下孤儿） */
      if (this.battle && this.battle.units) {
        const alive = new Set(this.battle.units.map(u => u.id));
        for (const [id, rec] of [...this.sprites.entries()]) {
          if (alive.has(id)) continue;
          if (rec.img) { if (rec._tw) rec._tw.stop(); rec.img.destroy(); }
          this.sprites.delete(id);
        }
      }
      /* 位置变化时用补间平滑滑动（时长受设置「移动速度」影响），
       * 而不是瞬移——原版单位移动是有过程动画的。 */
      const mf = (window.JW && window.JW.App && window.JW.App.moveFactor) ? window.JW.App.moveFactor() : 1;
      for (const rec of this.sprites.values()) {
        const u = rec.unit, c = this.unitCenter(u);
        if (rec.img) {
          const ty = c.y + this.footOffsetY;   // 与单位创建/行走保持同一基准
          const moved = Math.abs(rec.img.x - c.x) > 0.5 || Math.abs(rec.img.y - ty) > 0.5;
          rec.img.setAlpha(u.isAlive ? 1 : 0.28);
          rec.img.displayHeight = this.cellPx * 1.12;
          rec.img.displayWidth = rec.img.displayHeight;   // 48×48 方形帧
          /* 正在逐格行走的单位由 walkAlongPath 自己控制位置，这里不能再起补间，
           * 否则走完会被 tween 再「滑」一次（表现为瞬移一下）。 */
          if (this._walkingIds && this._walkingIds.has(u.id)) {
            if (rec._tw) { rec._tw.stop(); rec._tw = null; }
            continue;
          }
          if (moved && this.tweens) {
            if (rec._tw) rec._tw.stop();
            rec._tw = this.tweens.add({
              targets: rec.img, x: c.x, y: ty,
              duration: Math.max(60, Math.round(220 * mf)), ease: "Quad.easeOut",
              onComplete: () => { rec._tw = null; if (this.redrawAll) this.redrawAll(); },
            });
          } else if (!moved) {
            rec.img.setPosition(c.x, ty);
          }
        }
      }
      this.redrawAll();
    }

    /* ---------- 覆盖层：射程 / 移动范围 ----------
     * Phaser CANVAS 模式下多个 Graphics 会互相覆盖，因此整张战场只用一个
     * Graphics 对象（this.gfx），按 地形 → 覆盖层 → 光标 → 单位 的顺序重绘。
     */
    _g() { if (!this.gfx) this.gfx = this.add.graphics().setDepth(1); return this.gfx; }

    /* 整张战场重绘（单一 Graphics，顺序：地形 → 覆盖层 → 光标 → 单位图形） */
    redrawAll() {
      const g = this._g();
      g.clear();
      this.drawTerrain();
      /* 原版闪烁：_blinkSet 亮灭交替（0x45a0ce / 0x416e17 的 3 次闪烁） */
      if (this._blinkSet && this._blinkOn) {
        for (const c of this._blinkSet) {
          const px = this.originX + c.x * this.cellPx, py = this.originY + c.y * this.cellPx;
          g.lineStyle ? g.lineStyle(2, 0xffd25a, 0.95) : null;
          g.strokeRect(px + 1, py + 1, this.cellPx - 2, this.cellPx - 2);
          g.fillStyle(0xffd25a, 0.22);
          g.fillRect(px, py, this.cellPx, this.cellPx);
        }
      }
      // 单位图形（先画，形象 Image 在其上）
      this.redrawUnits();
      // 射程/移动范围
      if (this._overlay) {
        const { cells, color, alpha } = this._overlay;
        for (const c of cells) {
          const px = this.originX + c.x * this.cellPx, py = this.originY + c.y * this.cellPx;
          g.fillStyle(color, alpha);
          g.fillRect(px, py, this.cellPx, this.cellPx);
          g.lineStyle(1, 0xe0b452, 0.5);
          g.strokeRect(px + 0.5, py + 0.5, this.cellPx - 1, this.cellPx - 1);
        }
      }
      // 光标
      if (this._cursor) {
        const { x, y } = this._cursor;
        const px = this.originX + x * this.cellPx, py = this.originY + y * this.cellPx;
        g.lineStyle(2, 0xffd873, 1);
        g.strokeRect(px + 1, py + 1, this.cellPx - 2, this.cellPx - 2);
        const k = this.cellPx * 0.22;
        g.lineStyle(3, 0xffd873, 1);
        g.beginPath();
        g.moveTo(px, py); g.lineTo(px + k, py);
        g.moveTo(px, py); g.lineTo(px, py + k);
        g.moveTo(px + this.cellPx, py); g.lineTo(px + this.cellPx - k, py);
        g.moveTo(px + this.cellPx, py); g.lineTo(px + this.cellPx, py + k);
        g.moveTo(px, py + this.cellPx); g.lineTo(px + k, py + this.cellPx);
        g.moveTo(px, py + this.cellPx); g.lineTo(px, py + this.cellPx - k);
        g.moveTo(px + this.cellPx, py + this.cellPx); g.lineTo(px + this.cellPx - k, py + this.cellPx);
        g.moveTo(px + this.cellPx, py + this.cellPx); g.lineTo(px + this.cellPx, py + this.cellPx - k);
        g.strokePath();
      }
      // 选中光环
      if (this._selectedId != null) {
        const rec = this.sprites.get(this._selectedId);
        if (rec) {
          const c = this.unitCenter(rec.unit);
          g.lineStyle(2, 0xffd873, 0.95);
          g.strokeCircle(c.x, c.y, this.cellPx * 0.52);
        }
      }
    }

    showCells(cells, color, alpha) {
      this._overlay = { cells, color, alpha };
      this.redrawAll();
    }
    clearOverlay() {
      this._overlay = null;
      this.redrawAll();
    }

    /* ---------- 光标 ---------- */
    showCursor(cell) {
      this._cursor = cell ? { x: cell.x, y: cell.y } : null;
      this.redrawAll();
    }
    clearCursor() { this._cursor = null; this.redrawAll(); }

    /* ---------- 选中光环 ---------- */
    setSelection(unitId) {
      this._selectedId = unitId == null ? null : unitId;
      this.redrawAll();
    }
    drawSelection(unitId) { this.setSelection(unitId); }
    clearSelection() { this._selectedId = null; this.redrawAll(); }

    /* ---------- 动画：移动 ---------- */
    /* 原版行走：按格子逐格推进（0x4574xx）。每格耗时约 4 tick ≈ 160ms，
     * 4 正交方向依次走完；走路帧在 Unit_mov 的第 1..2 帧间交替（0 站立）。
     * path 是 {x,y} 格子序列（不含起点）。不传 path 时退化为单格。 */
    async walkAlongPath(u, path) {
      const rec = this.sprites.get(u.id);
      if (!rec || !rec.img || !path || !path.length) return;
      if (!this._walkingIds) this._walkingIds = new Set();
      this._walkingIds.add(u.id);
      if (rec._tw) { rec._tw.stop(); rec._tw = null; }
      const sheet = this.textures.exists("umov" + u.spriteIdx) ? this.textures.get("umov" + u.spriteIdx) : null;
      const nfr = sheet && sheet.frameTotal > 1 ? sheet.frameTotal : 0;
      const PER_STEP = 160;          // 每格约 160ms（原版 4 tick）
      let frameIdx = 0;
      for (const step of path) {
        const from = { x: u.x, y: u.y };
        const sx = this.originX + (from.x + 0.5) * this.cellPx;
        const sy = this.originY + (from.y + 0.5) * this.cellPx;
        const ex = this.originX + (step.x + 0.5) * this.cellPx;
        const ey = this.originY + (step.y + 0.5) * this.cellPx;
        // 朝向：下/左/右/上（原版 dir 0=上 1=右 2=下 3=左）
        if (step.y < from.y) u.dir = 0;
        else if (step.x > from.x) u.dir = 1;
        else if (step.y > from.y) u.dir = 2;
        else if (step.x < from.x) u.dir = 3;
        // 翻转 sprite：默认朝右，dir=3（左）时水平翻转
        if (rec.img) rec.img.setFlipX(u.dir === 3);
        // 一格的插值（分 4 小段，保证逐格而不是跨越）
        const subs = 4;
        for (let i = 1; i <= subs; i++) {
          const t = i / subs;
          if (!rec.img.active) { this._walkingIds.delete(u.id); return; }
          rec.img.setPosition(sx + (ex - sx) * t, sy + (ey - sy) * t);
          if (nfr > 1) {
            // 走路帧循环：第 0 帧站立，1..2 帧为迈步
            frameIdx = 1 + (frameIdx % Math.min(2, nfr - 1));
            rec.img.setFrame(frameIdx);
          }
          await this.wait(PER_STEP / subs);
        }
        u.x = step.x; u.y = step.y;
      }
      if (rec.img.active && nfr) rec.img.setFrame(0);   // 走完回站立帧
      this._walkingIds.delete(u.id);
    }

    /* 兼容旧调用：单格/直线移动，内部转换为逐格 path */
    async moveUnitTo(u, tx, ty) {
      const rec = this.sprites.get(u.id);
      if (!rec) return;
      const path = (this.battle && this.battle.map && this.battle.map.pathTo)
        ? (this.battle.map.pathTo(u.x, u.y, tx, ty, u.effectiveMov || 99, u) || [{ x: tx, y: ty }])
        : [{ x: tx, y: ty }];
      await this.walkAlongPath(u, path);
      u.x = tx; u.y = ty;
      this.refreshUnits();
    }

    wait(ms) { return new Promise(r => this.time.delayedCall(ms, r)); }

    /* ---------- 战场单位动画（原版 0x45778f §13.7 帧序列近似） ----------
     * 0 站立 1 欢呼 2 防御转身 3 受击 4 虚弱 5 起手 6 单挥 7 双挥
     * 8 原地转向 9 六拍虚弱 10 受击上浮 11 两转+欢呼 12 单转 */
    playUnitAnim(unitId, action) {
      const rec = this.sprites.get(unitId);
      if (!rec || !rec.img) return;
      const img = rec.img;
      const s = this.cellPx;
      const u = rec.unit;
      const sheet = this.textures.exists("umov" + u.spriteIdx) ? this.textures.get("umov" + u.spriteIdx) : null;
      const nfr = sheet && sheet.frameTotal > 1 ? Math.min(3, sheet.frameTotal) : 0;
      const flick = (times, ms) => {
        if (!nfr) return;
        let i = 0;
        const step = () => { if (i < times && img.active) { img.setFrame((i % nfr)); this.time.delayedCall(ms, () => { i++; if (i < times) step(); else if (img.active) img.setFrame(0); }); } else if (img.active) img.setFrame(0); };
        step();
      };
      const bump = (dx, dy, ms) => this.tweens.add({ targets: img, x: img.x + dx, y: img.y + dy, duration: ms / 2, yoyo: true, ease: "Quad.easeOut" });
      switch (action | 0) {
        case 1: case 11: bump(0, -s * 0.18, 320); flick(4, 90); break;             // 欢呼
        case 2: bump(s * 0.12, 0, 260); break;                                      // 防御转身
        case 3: bump(-s * 0.14, 0, 240); break;                                     // 受击
        case 4: case 9: bump(0, s * 0.08, 200); flick(action === 9 ? 12 : 4, 70); break; // 虚弱/六拍
        case 5: bump(s * 0.16, -s * 0.06, 220); break;                              // 起手
        case 6: bump(s * 0.22, 0, 200); flick(3, 60); break;                        // 单挥
        case 7: bump(s * 0.22, 0, 200); this.time.delayedCall(210, () => bump(s * 0.22, 0, 200)); flick(6, 60); break; // 双挥
        case 8: case 12: bump(0, 0, 1); img.setAngle(10); this.tweens.add({ targets: img, angle: 0, duration: 360 }); flick(6, 60); break; // 转向
        case 10: bump(0, -4, 180); break;                                           // 受击上浮 4px
        default: break;                                                             // 0 站立
      }
    }

    /* ---------- 原版动作动画（Unit_atk / Unit_spc）----------
     * Unit_atk = 12 帧 × 64×64，Unit_spc = 5 帧 × 48×48（外部图集按需加载）。
     * 帧序列语义见 rules_ref §13.7：接入时按 1 帧 ≈ 70ms 播放。 */
    _animSheetKey(kind, idx) { return kind + "_" + idx; }

    async ensureAnimSheet(kind, idx) {
      const key = this._animSheetKey(kind, idx);
      if (this.textures.exists(key)) return key;
      const fw = kind === "atk" ? 64 : 48;
      const fh = kind === "atk" ? 64 : 48;
      const url = `assets/units/${kind}_${idx}.png`;
      const img = await new Promise((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = url;
      });
      if (!img) return null;
      try { this.textures.addSpriteSheet(key, img, { frameWidth: fw, frameHeight: fh }); }
      catch (e) { return null; }
      return this.textures.exists(key) ? key : null;
    }

    /* 播放动作动画；不阻塞战斗逻辑（失败时静默回落到静止帧） */
    async playUnitAction(unitId, kind, dx = 0, dy = 0) {
      const rec = this.sprites.get(unitId);
      if (!rec || !rec.img) return;
      const idx = rec.unit && rec.unit.spriteIdx;
      if (idx == null) return;
      const key = await this.ensureAnimSheet(kind, idx);
      if (!key || !rec.img.active) return;
      const tex = this.textures.get(key);
      const n = Math.max(1, (tex.frameTotal || 1) - 1);   // 去掉 __BASE
      const holder = this.add.image(rec.img.x, rec.img.y, key, 0)
        .setOrigin(0.5, 1).setDepth(21);
      holder.displayHeight = this.cellPx * (kind === "atk" ? 1.28 : 1.12);
      holder.displayWidth = holder.displayHeight * ((kind === "atk" ? 64 : 48) / (kind === "atk" ? 64 : 48));
      // 攻击/被攻击时朝目标翻转：默认朝右，目标在左侧（dx<0）时翻转
      if (kind === "atk" && dx !== undefined) rec.img.setFlipX(dx < 0);
      rec.img.setVisible(false);
      for (let i = 0; i < n; i++) {
        if (!holder.active) break;
        holder.setFrame(i);
        await this.wait(kind === "atk" ? 70 : 90);
      }
      holder.destroy();
      if (rec.img.active) rec.img.setVisible(true);
    }

    /* 死亡动画：闪烁 + 缩小消失，动画结束后销毁精灵（原版阵亡离场） */
    async playDeathAnim(unitId) {
      const rec = this.sprites.get(unitId);
      if (!rec || !rec.img) return;
      const img = rec.img;
      const s = this.cellPx;
      const tw = (target, props, ms) => new Promise(r => {
        this.tweens.add({ targets: target, ...props, duration: ms, ease: "Linear", onComplete: r });
      });
      try {
        for (let i = 0; i < 4 && img.active; i++) {
          img.setVisible(i % 2 === 0);
          await tw(img, { alpha: i % 2 === 0 ? 1 : 0.25 }, 60);
        }
        img.setVisible(true);
        await tw(img, { scaleX: 0.1, scaleY: 0.1, alpha: 0 }, 300);
      } catch (e) { /* 页面关闭等导致 tweens 失效，忽略 */ }
      if (img.active) {
        img.destroy();
        this.sprites.delete(unitId);
      }
      this.redrawAll();
    }

    /* 攻击预览浮签：显示在目标格上方（UI 增强，不参与战斗结算） */
    showPreview(info) {
      if (!info) {
        if (this._previewObj) { this._previewObj.destroy(); this._previewObj = null; }
        return;
      }
      const c = this.unitCenter({ x: info.x, y: info.y });
      if (!this._previewObj) {
        this._previewObj = this.add.text(c.x, c.y - this.cellPx * 1.15, "", {
          fontFamily: "monospace", fontSize: Math.max(11, Math.round(this.cellPx * 0.42)) + "px",
          color: "#ffe9b0", backgroundColor: "#2a1a0cdd", padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 1).setDepth(60);
      }
      this._previewObj.setText(info.text);
      this._previewObj.setPosition(c.x, c.y - this.cellPx * 1.05);
      this._previewObj.setVisible(true);
    }

    /* ---------- 浮字 ---------- */
    floatText(x, y, text, cls) {
      const c = { x: this.originX + (x + 0.5) * this.cellPx, y: this.originY + (y + 0.5) * this.cellPx };
      const color = cls === "crit" ? "#ffd873" : cls === "heal" ? "#8fd46a" : cls === "miss" ? "#b8b8b8" : "#ff6a5a";
      const t = this.add.text(c.x, c.y, text, {
        fontFamily: "serif", fontSize: Math.max(13, Math.round(this.cellPx * 0.42)) + "px",
        color, stroke: "#1a0d04", strokeThickness: 4, fontStyle: "bold",
      }).setOrigin(0.5).setDepth(1000);
      this.tweens.add({
        targets: t, y: c.y - this.cellPx * 0.9, alpha: 0, duration: 900,
        ease: "Quad.easeOut", onComplete: () => t.destroy(),
      });
    }

    /* ---------- 输入 ----------
     * 直接监听画布的原生指针事件：用 clientX/clientY 减去画布实际位置，
     * 避免 Phaser Scale 模式对画布位置的内部推算偏差。 */
    _bindNativeInput() {
      const cv = this.game && this.game.canvas;
      if (!cv || cv._jwInputBound) return;
      cv._jwInputBound = true;
      const toCell = (ev) => {
        const r = cv.getBoundingClientRect();
        return this.cellAt(ev.clientX - r.left, ev.clientY - r.top);
      };
      // 滚轮缩放（以鼠标为中心）
      cv.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        const r = cv.getBoundingClientRect();
        const mx = ev.clientX - r.left, my = ev.clientY - r.top;
        const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        this.zoomAt(factor, mx, my);
      }, { passive: false });
      /* 原版：右键 = 取消/系统菜单（与 Esc 等价），中键才是拖拽平移。
       * 旧实现把右键当平移用，玩家没有明确的"取消"操作。 */
      let dragging = false, dragStart = null;
      cv.addEventListener("pointerdown", (ev) => {
        /* 触摸由下方 touch* 处理器统一接管（点击/拖动/捏合/长按），
         * 否则手指按下会立刻被当成一次格点击。 */
        if (ev.pointerType === "touch") return;
        if (ev.button === 2) {
          ev.preventDefault();
          if (this.onCancel) this.onCancel();
          return;
        }
        if (ev.button === 1) {
          dragging = true;
          dragStart = { x: ev.clientX, y: ev.clientY, panX: this.panX, panY: this.panY };
          ev.preventDefault();
          return;
        }
        const cell = toCell(ev);
        if (cell && this.onCellClick) this.onCellClick(cell);
      });
      window.addEventListener("pointermove", (ev) => {
        if (!dragging) return;
        this.panX = dragStart.panX + (ev.clientX - dragStart.x);
        this.panY = dragStart.panY + (ev.clientY - dragStart.y);
        this.recalcLayout();
        this.redrawAll();
        this.refreshUnits();
      });
      window.addEventListener("pointerup", () => { dragging = false; });
      cv.addEventListener("contextmenu", (ev) => ev.preventDefault());
      cv.addEventListener("pointermove", (ev) => {
        if (ev.pointerType === "touch") return;   // 触摸无 hover 概念，避免预览残留
        const cell = toCell(ev);
        if (!cell) return;
        if (this.hoverCell && this.hoverCell.x === cell.x && this.hoverCell.y === cell.y) return;
        this.hoverCell = cell;
        if (this.onCellHover) this.onCellHover(cell);
      });
      this._bindTouchInput(cv, toCell);
    }

    /* ---------- 触屏手势 ----------
     * 原版是鼠标游戏（滚轮缩放 / 中键平移 / 右键取消），手机上三者都没有。
     * 映射：单指点选格；单指拖动 = 平移；双指捏合 = 缩放；长按 = 取消（Esc 等价）。
     * 通过位移阈值（8px）区分「点选」与「拖动」，两者不互相吞掉。 */
    _bindTouchInput(cv, toCell) {
      if (cv._jwTouchBound) return;
      cv._jwTouchBound = true;
      const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const LONG_PRESS_MS = 600;
      let st = null;

      const reset = () => {
        if (st && st.lp) clearTimeout(st.lp);
        st = null;
      };

      cv.addEventListener("touchstart", (ev) => {
        ev.preventDefault();
        if (ev.touches.length >= 2) {
          if (st && st.lp) clearTimeout(st.lp);
          const a = ev.touches[0], b = ev.touches[1];
          st = { mode: "pinch", lastD: dist(a, b) };
          return;
        }
        const t = ev.touches[0];
        if (!t) return;
        st = {
          mode: "tap", x0: t.clientX, y0: t.clientY,
          panX: this.panX, panY: this.panY, moved: false,
          t0: Date.now(), lp: null,
        };
        st.lp = setTimeout(() => {
          if (st && st.mode === "tap" && !st.moved) {
            st.mode = "canceled";
            st.lp = null;
            if (this.onCancel) this.onCancel();
          }
        }, LONG_PRESS_MS);
      }, { passive: false });

      cv.addEventListener("touchmove", (ev) => {
        ev.preventDefault();
        if (!st) return;
        if (ev.touches.length >= 2) {
          const a = ev.touches[0], b = ev.touches[1];
          const d = dist(a, b);
          const r = cv.getBoundingClientRect();
          const cx = (a.clientX + b.clientX) / 2 - r.left;
          const cy = (a.clientY + b.clientY) / 2 - r.top;
          if (st.mode !== "pinch") { st = { mode: "pinch", lastD: d }; }
          else if (st.lastD > 0) this.zoomAt(d / st.lastD, cx, cy);
          st.lastD = d;
          return;
        }
        const t = ev.touches[0];
        if (!t) return;
        if (st.mode === "pinch") {                 // 双指抬起一指 → 续为拖动
          st = { mode: "pan", x0: t.clientX, y0: t.clientY, panX: this.panX, panY: this.panY, moved: true };
          return;
        }
        const dx = t.clientX - st.x0, dy = t.clientY - st.y0;
        if (!st.moved && Math.hypot(dx, dy) > 8) {
          st.moved = true;
          if (st.lp) { clearTimeout(st.lp); st.lp = null; }
          st.mode = "pan";
        }
        if (st.mode === "pan") {
          this.panX = st.panX + dx;
          this.panY = st.panY + dy;
          this.recalcLayout();
          this.redrawAll();
          this.refreshUnits();
        }
      }, { passive: false });

      cv.addEventListener("touchend", (ev) => {
        if (!st) return;
        const s = st;
        if (ev.touches.length === 0) {
          if (s.mode === "tap" && !s.moved && Date.now() - s.t0 < 600) {
            const t = (ev.changedTouches && ev.changedTouches[0]) || null;
            if (t) {
              const cell = toCell(t);
              if (cell && this.onCellClick) this.onCellClick(cell);
            }
          }
          reset();
        }
      }, { passive: false });

      cv.addEventListener("touchcancel", () => reset(), { passive: true });
    }


    onPointerDown(p) {
      const cell = this.cellAt(p.x, p.y);
      if (!cell) return;
      if (this.onCellClick) this.onCellClick(cell);
    }
    onPointerMove(p) {
      const cell = this.cellAt(p.x, p.y);
      if (!cell) return;
      if (this.hoverCell && this.hoverCell.x === cell.x && this.hoverCell.y === cell.y) return;
      this.hoverCell = cell;
      if (this.onCellHover) this.onCellHover(cell);
    }
  }

  window.JW_BattleScene = BattleScene;
})();
