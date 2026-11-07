(function () {
  "use strict";
  const D = window.JW_DATA;
  const U = window.JW.U;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  class UI {
    constructor(rootEl) {
      this.root = rootEl;
      this.screen = null;
      this.battle = null;
      this.selectedUnit = null;
      this.cursor = { x: 0, y: 0 };
      this.mode = null; // idle | select | move | target | command | skill | item
      this.cellPx = 40;
      this.offsetX = 0; this.offsetY = 0;
      this.onAction = null;
      this._init();
    }

    _init() {
      this.root.innerHTML = `
        <div id="title-screen" class="jw-screen">
          <div class="decor-brush"></div>
          <div class="title-art">姜<span class="accent">维</span>传</div>
          <div class="title-sub">—— HTML 重制 · 三国志战棋 ——</div>
          <div class="menu">
            <button class="jw-btn jw-btn--primary" data-action="start">开始游戏</button>
            <button class="jw-btn" data-action="skip-intro">跳过序章 · 直接开战</button>
            <button class="jw-btn" data-action="chapter">章节选择</button>
            <button class="jw-btn" data-action="load">读取存档</button>
            <button class="jw-btn" data-action="help">操作说明</button>
          </div>
        </div>
        <div id="chapter-screen" class="jw-screen hidden"></div>
        <div id="story-screen" class="jw-screen hidden">
          <div class="bg"></div>
          <div class="story-actors"></div>
          <!-- 原版顶栏：菜单栏(文件/功能/情报) + 图标工具条 + 右侧双蓝条 -->
          <div class="orig-topbar">
            <div class="otb-menu"><span>文件</span><span>功能</span><span>情报</span></div>
            <div class="otb-row">
              <div class="otb-icons"><i class="ic" title="城门"><svg viewBox="0 0 24 24"><path d="M3 21V9h3V6h2v3h2V5h4v4h2V6h2v3h3v12z" fill="#cfd6dd" stroke="#5a6672" stroke-width="1.3"/><path d="M9 21v-6a3 3 0 0 1 6 0v6" fill="#7d8894" stroke="#5a6672" stroke-width="1.2"/></svg></i><i class="ic" title="营地"><svg viewBox="0 0 24 24"><path d="M12 4 3 20h18z" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M12 4v16" stroke="#5a6672" stroke-width="1.1"/><path d="M12 2v3" stroke="#5a6672" stroke-width="1.4"/></svg></i><i class="ic" title="人物"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3.4" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M5.5 21c0-4 3-6.5 6.5-6.5S18.5 17 18.5 21z" fill="#cfd6dd" stroke="#5a6672" stroke-width="1.3"/></svg></i><i class="ic" title="物品"><svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="12" rx="1.5" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M4 11h16M8 7V5h8v2" stroke="#5a6672" stroke-width="1.2" fill="none"/></svg></i><i class="ic" title="策略"><svg viewBox="0 0 24 24"><path d="M6 4h11a2 2 0 0 1 2 2v15H8a2 2 0 0 1-2-2z" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M9 9h7M9 12.5h7M9 16h4" stroke="#5a6672" stroke-width="1.1"/></svg></i><i class="ic" title="宝物"><svg viewBox="0 0 24 24"><path d="M4 11h16v9H4z" fill="#e6dcc4" stroke="#5a6672" stroke-width="1.3"/><path d="M4 11a8 8 0 0 1 16 0" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><rect x="10.5" y="12.5" width="3" height="4" fill="#c8a24a" stroke="#5a6672" stroke-width="1"/></svg></i><i class="ic" title="存档"><svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><rect x="8" y="12" width="8" height="8" fill="#cfd6dd" stroke="#5a6672" stroke-width="1.1"/><rect x="9" y="6" width="6" height="4" fill="#9aa6b2" stroke="#5a6672" stroke-width="1"/></svg></i><i class="ic" title="读档"><svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v10H3z" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M3 7V5h6l2 2" fill="none" stroke="#5a6672" stroke-width="1.2"/></svg></i><i class="ic" title="设置"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="#5a6672" stroke-width="1.4"/></svg></i></div>
              <div class="otb-bars">
                <div class="otb-bar"><div class="otb-name"></div><div class="otb-track"><i></i></div></div>
                <div class="otb-bar"><div class="otb-name"></div><div class="otb-track"><i></i></div></div>
                <div class="otb-barsub">
                  <span class="otb-fly red"></span>
                  <span class="otb-hp red"></span>
                  <span class="otb-hp blue"></span>
                  <span class="otb-fly blue"></span>
                </div>
              </div>
            </div>
          </div>
          <div class="story-caption-band hidden"><div class="cap-text"></div></div>
          <div class="story-banner hidden"><div class="bn-text"></div></div>
          <div class="story-titlecard hidden"><div class="tc-text"></div></div>
          <div class="story-fade"></div>
          <!-- 原版：说话人大立绘（Tou 120×120 放大）靠左/靠右 -->
          <div class="fig-holder left"><img class="fig-img" alt=""></div>
          <div class="fig-holder right"><img class="fig-img" alt=""></div>
          <!-- 原版：白色圆角对话气泡（人名着色 + 黑色正文），靠近说话人 -->
          <div class="dialogue-box bubble">
            <div class="pname-top"></div>
            <div class="text"></div>
            <div class="advance-hint">▼</div>
          </div>
        </div>
        <div id="battle-screen" class="jw-screen hidden">
          <div id="battle-grid"></div>
          <!-- 原版 0x5A：战斗开场字幕（压暗化地图 20 tick） -->
          <div id="battle-caption" class="hidden">开 始 战 斗</div>
          <div id="deploy-bar" class="hidden" style="position:absolute;left:50%;top:52px;transform:translateX(-50%);z-index:60;display:flex;gap:10px;align-items:center;background:rgba(30,22,12,.92);border:1px solid #6a5636;padding:6px 14px">
            <span style="color:#e8d5a3;font-size:14px">战前准备：点我方单位 → 点周围空地调整站位</span>
            <button class="jw-btn jw-btn--sm hidden" id="sortie-btn" data-action="sortie">出 阵</button>
            <button class="jw-btn jw-btn--primary jw-btn--sm" data-action="deploy-done">开 战</button>
          </div>
          <!-- 原版战斗顶栏：与剧情屏同款（菜单栏 + 图标组 + 右侧信息区） -->
          <div id="topbar" class="orig-topbar">
            <div class="otb-menu"><span>文件</span><span>功能</span><span>情报</span></div>
            <div class="otb-row">
              <div class="otb-icons">
                <i class="ic" title="城门"><svg viewBox="0 0 24 24"><path d="M3 21V9h3V6h2v3h2V5h4v4h2V6h2v3h3v12z" fill="#cfd6dd" stroke="#5a6672" stroke-width="1.3"/><path d="M9 21v-6a3 3 0 0 1 6 0v6" fill="#7d8894" stroke="#5a6672" stroke-width="1.2"/></svg></i><i class="ic" title="营地"><svg viewBox="0 0 24 24"><path d="M12 4 3 20h18z" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M12 4v16" stroke="#5a6672" stroke-width="1.1"/><path d="M12 2v3" stroke="#5a6672" stroke-width="1.4"/></svg></i><i class="ic" title="人物"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3.4" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M5.5 21c0-4 3-6.5 6.5-6.5S18.5 17 18.5 21z" fill="#cfd6dd" stroke="#5a6672" stroke-width="1.3"/></svg></i><i class="ic" title="物品"><svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="12" rx="1.5" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M4 11h16M8 7V5h8v2" stroke="#5a6672" stroke-width="1.2" fill="none"/></svg></i><i class="ic" title="策略"><svg viewBox="0 0 24 24"><path d="M6 4h11a2 2 0 0 1 2 2v15H8a2 2 0 0 1-2-2z" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M9 9h7M9 12.5h7M9 16h4" stroke="#5a6672" stroke-width="1.1"/></svg></i><i class="ic" title="宝物"><svg viewBox="0 0 24 24"><path d="M4 11h16v9H4z" fill="#e6dcc4" stroke="#5a6672" stroke-width="1.3"/><path d="M4 11a8 8 0 0 1 16 0" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><rect x="10.5" y="12.5" width="3" height="4" fill="#c8a24a" stroke="#5a6672" stroke-width="1"/></svg></i>
                <i class="ic" data-action="cancel" title="取消（右键 / Esc）"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#dfe4e9" stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#5a6672" stroke-width="1.3"/></svg></i>
                <i class="ic" data-action="endturn" title="结束我方回合"><svg viewBox="0 0 24 24"><path d="M6 21V3" stroke="#5a6672" stroke-width="1.8"/><path d="M6 4h11l-2.5 4L17 12H6z" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/></svg></i>
                <i class="ic" data-action="zoom-out" title="缩小"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M7.5 12h9" stroke="#5a6672" stroke-width="1.8"/></svg></i>
                <i class="ic" data-action="zoom-reset" title="重置缩放"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M8 15V9h3.2a2 2 0 0 1 0 4H8M15 9v6" stroke="#5a6672" stroke-width="1.4" fill="none"/></svg></i>
                <i class="ic" data-action="zoom-in" title="放大"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M12 7.5v9M7.5 12h9" stroke="#5a6672" stroke-width="1.8"/></svg></i>
                <i class="ic" data-action="menu" title="菜单"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="#dfe4e9" stroke="#5a6672" stroke-width="1.3"/><path d="M7 9h10M7 12.5h10M7 16h6" stroke="#5a6672" stroke-width="1.5"/></svg></i>
              </div>
              <div class="otb-bars">
                <div class="otb-info">
                  <div class="otb-round" id="round-info">第 1 回合</div>
                  <div class="otb-unit hidden" id="unit-detail"></div>
                  <div class="otb-tip" id="hud-tip">点击我方单位 → 移动 / 攻击 / 技能</div>
                </div>
                <div class="otb-bar"><div class="otb-name"></div><div class="otb-track"><i></i></div></div>
                <div class="otb-bar"><div class="otb-name"></div><div class="otb-track"><i></i></div></div>
                <div class="otb-barsub">
                  <span class="otb-fly red"></span>
                  <span class="otb-hp red"></span>
                  <span class="otb-hp blue"></span>
                  <span class="otb-fly blue"></span>
                </div>
              </div>
            </div>
          </div>
          <div id="log-panel"></div>
          <div id="item-panel" class="jw-panel hidden"></div>
          <div id="fx-layer"></div>
          <div id="command-menu" class="hidden"></div>
          <div id="target-list" class="hidden"></div>
        </div>
        <div id="duel-screen" class="jw-screen hidden">
          <div class="duel-bg"></div>
          <div class="duel-panel jw-panel">
            <div class="duel-title" id="duel-title">单挑</div>
            <div class="duel-fighters">
              <div class="duel-fighter" id="duel-f1">
                <div class="duel-name"></div>
                <div class="duel-hp-bar"><div class="duel-hp-fill"></div></div>
                <div class="duel-hp-text"></div>
              </div>
              <div class="duel-vs">VS</div>
              <div class="duel-fighter" id="duel-f2">
                <div class="duel-name"></div>
                <div class="duel-hp-bar"><div class="duel-hp-fill"></div></div>
                <div class="duel-hp-text"></div>
              </div>
            </div>
            <div class="duel-dialogue" id="duel-dialogue"></div>
            <div class="duel-actions" id="duel-actions"></div>
            <div class="duel-result" id="duel-result"></div>
          </div>
        </div>
        <div id="result-screen" class="jw-screen hidden">
          <div class="result-panel jw-panel">
            <div class="result-title" id="result-title">胜利</div>
            <div class="result-stats" id="result-stats"></div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px">
              <button class="jw-btn jw-btn--primary" data-action="next">继续</button>
              <button class="jw-btn" data-action="chapter">返回章节</button>
            </div>
          </div>
        </div>
      `;
      /* 布局重算：窗口尺寸、横竖屏切换、手机地址栏伸缩都会改变可视区。
       * visualViewport 在 iOS Safari 里比 window.resize 更早/更准。 */
      const relayout = () => {
        if (this.scene && this.scene.recalcLayout) {
          this.scene.recalcLayout();
          this.scene.redrawAll();
          this.scene.refreshUnits();
        }
      };
      window.addEventListener("resize", relayout);
      window.addEventListener("orientationchange", () => setTimeout(relayout, 260));
      if (window.visualViewport) window.visualViewport.addEventListener("resize", relayout);
      /* 旋转/改尺寸后，已打开的选项框也要重新避让气泡 */
      const reflowChoice = () => {
        const l = this.storyScreen && this.storyScreen.querySelector(".choice-list");
        if (l) this._fitChoiceList(l);
      };
      window.addEventListener("orientationchange", () => setTimeout(reflowChoice, 300));
      window.addEventListener("resize", reflowChoice);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Esc") { this.handleEsc(); return; }
        // 回车推进剧情（独立屏 或 叠加层）
        if (e.key === "Enter" && (this.screen === "story" || this.storyOverlayActive)) {
          e.preventDefault();
          this.storyAdvance();
          return;
        }
        // 结算界面：回车等同「继续」（避免只能用鼠标）
        if (e.key === "Enter" && this.screen === "result") {
          e.preventDefault();
          const btn = document.querySelector('#result-screen [data-action="next"]');
          if (btn) btn.click();
        }
      });
      // 原版：右键 = 取消/系统菜单（与 Esc 等价）；战斗地图内的右键在 battle_scene 里拦截
      this.root.addEventListener("contextmenu", (e) => {
        if (this.screen === "battle" || this.screen === "story" || this.storyOverlayActive) {
          e.preventDefault();
          if (this.screen === "battle") this.cancelMode();
        }
      });
      this.root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (btn) { this.emitAction(btn.dataset.action, btn); return; }
        // 战斗地图点击
        if (this.screen === "battle" && !this.storyOverlayActive) this.handleGridClick(e);
        // 剧情推进（独立屏 或 叠加层）
        if (this.screen === "story") this.storyAdvance();
        else if (this.storyOverlayActive) this.storyAdvance();
      });
      this.titleScreen = $("#title-screen", this.root);
      this.chapterScreen = $("#chapter-screen", this.root);
      /* 校正接口：JW.setPortrait(人物id, 头像号)，写入 localStorage 并立即生效 */
      try {
        window.JW = window.JW || {};
        window.JW.setPortrait = (pid, idx) => {
          this._portraitFix[pid] = idx;
          try { localStorage.setItem("jw_portrait_fix", JSON.stringify(this._portraitFix)); } catch (e) {}
          return { ...this._portraitFix };
        };
      } catch (e) { /* 无 window 环境忽略 */ }
      this.storyScreen = $("#story-screen", this.root);
      this.battleScreen = $("#battle-screen", this.root);
      this.resultScreen = $("#result-screen", this.root);
      this.showScreen("title");
    }

    // 战前准备横幅显隐
    setDeployBar(on) {
      const bar = $("#deploy-bar", this.battleScreen);
      if (bar) bar.classList.toggle("hidden", !on);
    }

    emitAction(name, el) {
      if (this.onAction) this.onAction({ name, el });
    }

    showScreen(name) {
      this.screen = name;
      for (const s of ["title","chapter","story","battle","duel","result"]) {
        const el = $("#" + s + "-screen", this.root);
        if (el) el.classList.toggle("hidden", s !== name);
      }
    }

    // ---- 章节选择 ----
    renderChapters(chapters, unlocked) {
      const c = this.chapterScreen;
      c.innerHTML = `<div class="jw-scroll"><h2>章节选择</h2></div><div class="ch-list"></div>`;
      const list = $(".ch-list", c);
      for (const ch of chapters) {
        const card = document.createElement("div");
        card.className = "jw-panel ch-card" + (unlocked && !unlocked.includes(ch.id) ? " locked" : "");
        card.innerHTML = `
          <div class="ch-num">第 ${ch.num} 章</div>
          <div class="ch-title">${ch.title}</div>
          <div class="ch-desc">${ch.desc || ""}</div>
        `;
        card.addEventListener("click", () => this.emitAction("chapter-open", { chapter: ch.id }));
        list.appendChild(card);
      }
      this.showScreen("chapter");
    }

    // ---- 剧情 ----
    showStory() {
      this.showScreen("story");
    }
    setStoryBG(canvasName) {
      const canvas = $("canvas", this.storyScreen.querySelector(".bg"));
      if (canvas) {
        canvas.width = 1280; canvas.height = 720;
        window.JW.renderBG(canvas, canvasName || "default");
      }
    }
    storySay(node, isNarr) {
      this.storyScreen.style.display = "block";
      this._renderBubble(node, isNarr, false);
    }
    /* 原版剧情呈现（1:1，参照原版截图）：
     * - 说话人 120×120 大立绘（Tou 图放大）贴左/贴右，无框无底
     * - 白色圆角气泡：人名着色 + 黑色正文，气泡靠近说话人一侧
     * - 顶栏右侧双蓝条显示当前在场单位名（原版为行动方/敌对方条）
     * 旁白：无立绘、无名字，气泡居中。 */
    _renderBubble(node, isNarr, overlay) {
      const box = this.storyScreen.querySelector(".dialogue-box");
      /* 换场景时气泡被隐藏过（storyBubbleHide），这里显式恢复，
       * 否则下一句台词会不可见。 */
      box.style.opacity = "1";
      box.style.visibility = "visible";
      const textEl = box.querySelector(".text");
      const nameEl = box.querySelector(".pname-top");
      textEl.innerHTML = (node.text || "").replace(/\*\*(.+?)\*\*/g, "<em>$1</em>");
      const fl = this.storyScreen.querySelector(".fig-holder.left");
      const fr = this.storyScreen.querySelector(".fig-holder.right");
      const imgL = fl.querySelector(".fig-img"), imgR = fr.querySelector(".fig-img");
      box.classList.remove("side-left", "side-right", "narr");
      fl.classList.remove("show"); fr.classList.remove("show");
      if (isNarr || !node.who) {
        nameEl.textContent = "";
        box.classList.add("narr");
      } else {
        nameEl.textContent = node.who;
        const url = this.figureUrlFor(node.face != null ? node.face : node.who);
        /* 原版：场上有该 actor 时气泡贴其位置；否则按说话人左右交替 */
        const pos = this.actorPos(node.face != null ? node.face : node.who);
        let side;
        if (pos) side = pos.x <= 50 ? "left" : "right";
        else {
          this._bubbleAlt = !this._bubbleAlt;
          side = this._bubbleAlt ? "left" : "right";
        }
        if (url) {
          const img = side === "left" ? imgL : imgR;
          img.src = url;
          (side === "left" ? fl : fr).classList.add("show");
        }
        /* 气泡贴说话人一侧（原版气泡在说话人旁边） */
        box.classList.add(side === "left" ? "side-left" : "side-right");
      }
      box.querySelector(".advance-hint").style.display = "block";
      this._updateTopBars();
    }
    /* 大立绘资源 URL（Tou 120×120，按 face 号） */
    figureUrlFor(who) {
      const idx = this.figureIndexFor(who);
      if (idx == null) return "";
      const n = String(idx).padStart(3, "0");
      /* 用透明底版本（边缘连通黑色已抠除），贴合原版"立绘直接叠在场景上" */
      return `assets/figures_t/fig_${n}.png?v=2`;
    }
    /* 战斗顶栏双蓝条：显示选中单位与目标的 HP 比例 */
    _updateBattleBars(b) {
      const bars = document.querySelectorAll("#topbar .otb-bar");
      if (!bars.length) return;
      const sel = this.selectedUnit || null;
      const foe = this._lastTarget || null;
      const pick = (u) => {
        if (!u) return null;
        const hp = u.hp == null ? 1 : u.hp;
        const max = u.maxHp || u.hpMax || hp || 1;
        return { name: u.name || "", ratio: Math.max(0, Math.min(1, hp / (max || 1))) };
      };
      [pick(sel), pick(foe)].forEach((d, i) => {
        const bar = bars[i];
        if (!bar) return;
        bar.querySelector(".otb-name").textContent = d ? d.name : "";
        bar.querySelector(".otb-track i").style.width = d ? Math.round(d.ratio * 100) + "%" : "0%";
      });
    }

    /* 顶栏双蓝条：原版显示当前行动单位与目标单位名；剧情时显示最近两名 actor */
    _updateTopBars() {
      const bars = this.storyScreen.querySelectorAll(".otb-bar");
      const layer = this.storyScreen.querySelector(".story-actors");
      const els = layer ? [...layer.querySelectorAll("[data-actor]")] : [];
      const names = els.slice(0, 2).map(el => el.querySelector(".sa-name")?.textContent || "");
      /* 原版 ref_b：没有在场 unit 时，左蓝条上方显示当前地名（如「汉中沔阳」） */
      if (!names[0] && this._lastPlace) names[0] = this._lastPlace;
      bars.forEach((b, i) => {
        b.querySelector(".otb-name").textContent = names[i] || "";
        b.querySelector(".otb-track i").style.width = "100%";
      });
    }
    storyChoice(node, cb) {
      this.clearChoice();
      const list = document.createElement("div");
      list.className = "choice-list";
      const nums = "一二三四五六七八九";
      node.options.forEach((opt, i) => {
        const btn = document.createElement("div");
        btn.className = "jw-btn";
        btn.innerHTML = `<span>${nums[i] || (i+1)}、</span>${opt.text}`;
        btn.addEventListener("click", (e) => { e.stopPropagation(); list.remove(); cb(opt); });
        list.appendChild(btn);
      });
      this.storyScreen.appendChild(list);
      this._fitChoiceList(list);
    }
    clearChoice() { const l = this.storyScreen.querySelector(".choice-list"); if (l) l.remove(); }
    storyAdvance() {
      /* 原版 0x419908：对话框/弹窗关闭时置一次性待处理标志（test_pending 读后清零） */
      if (this.engine && this.engine.pulsePending) this.engine.pulsePending();
      if (this.storyCb) this.storyCb();
    }
    // ---- 剧情叠加战场（原版：战斗地图可见，对话框在底部）----
    showStoryOverlay() {
      this.storyOverlayActive = true;
      this.storyScreen.classList.add("overlay");
      this.storyScreen.classList.remove("hidden");
      this.storyScreen.style.display = "block";
    }
    storySayOverlay(node, isNarr) {
      this.storyScreen.style.display = "block";
      this._renderBubble(node, isNarr, true);
    }
    storyChoiceOverlay(node, cb) {
      this.clearChoice();
      const list = document.createElement("div");
      list.className = "choice-list overlay-choice";
      /* 原版 0x0C（0x42def9）：选项框旁显示说话人的大立绘（arg1 = person id，0xffff→无）。
       * 之前 arg1 完全没用上，选项框光秃秃。 */
      if (node.person != null && node.person !== 0xffff && node.person !== 65535) {
        const fig = this.figureUrlFor(node.person);
        if (fig) {
          const portrait = document.createElement("img");
          portrait.className = "choice-portrait";
          portrait.src = fig;
          portrait.alt = "";
          list.appendChild(portrait);
        }
      }
      const nums = "一二三四五六七八九";
      node.options.forEach((opt, i) => {
        const btn = document.createElement("div");
        btn.className = "jw-btn";
        btn.innerHTML = `<span>${nums[i] || (i+1)}、</span>${opt.text}`;
        btn.addEventListener("click", (e) => { e.stopPropagation(); list.remove(); cb(i); });
        list.appendChild(btn);
      });
      this.storyScreen.appendChild(list);
      this._fitChoiceList(list);
    }
    /* 选项框避让：窄屏时气泡贴在底部，选项列表若也贴底就会盖住对话框。
     * 量出气泡实际高度，把选项框抬到气泡上方；宽屏保持原版 fixed bottom:210px。 */
    _fitChoiceList(list) {
      if (!list) return;
      const narrow = window.matchMedia("(orientation: portrait) and (max-width: 900px)").matches;
      if (!narrow) { list.style.bottom = ""; list.style.maxHeight = ""; list.style.overflowY = ""; return; }
      const box = this.storyScreen.querySelector(".dialogue-box");
      const vh = window.innerHeight || document.documentElement.clientHeight;
      let bottom = 12;
      if (box) {
        const r = box.getBoundingClientRect();
        bottom = Math.max(12, Math.round(vh - r.top + 8));
      }
      list.style.bottom = bottom + "px";
      list.style.maxHeight = Math.max(120, vh - bottom - 20) + "px";
      list.style.overflowY = "auto";
    }
    clearStoryOverlay() {
      this.storyOverlayActive = false;
      this.storyScreen.classList.remove("overlay");
      this.storyScreen.classList.add("hidden");
      this.storyScreen.style.display = "";
      this.clearChoice();
      this.storyCaptionClear(true);
      this.storyBanner("", null);
      this.storyTitleCardClear();
    }

    /* ---- 剧情场景演出层（1:1 原版 op 语义）---- */
    /* 原版剧情地图（Mmap.e5 115 张 640×400，逐场景调色板 Pmpalet）
     * change_scene 的 id 直接作为地图序号；缺省时按地名哈希稳定选图。
     * 先尝试真实素材，失败再回落到程序化背景。 */
    /* change_scene 的 args[3] 就是 Mmap 场景序号；65535 表示「保持当前地图」。
     * 原实现把 65535 当无效值后按地名哈希乱选图，导致背景与原文不符。 */
    _storyMapIndex(a) {
      const id = Number(a);
      /* 65535（0xFFFF）=「保持当前地形」，原版 change_scene 野外模式大量使用。
       * 其余合法值 0..57 切换地形图。 */
      if (Number.isFinite(id) && id >= 0 && id < 58) { this._curMapIdx = id; return id; }
      if (this._curMapIdx != null) return this._curMapIdx;
      this._curMapIdx = 0;
      return 0;
    }

    _storyMapCache = null;

    /* 原版 change_scene 的 mode 0 = 剧情 CG 图（args[1] 就是图片编号 0..39）。
     * 依据：ch00 开场 change_scene(1,30,..) → change_scene(0,26,..)，原版画面上正是
     * 港口楼船图，而 assets/story/mm_026.png 就是同一张；此前把 mode 0 当"黑场"，
     * 开场背景才会对不上。mode 1 只是转场特效（全部 151 次调用里 150 次 args[1]=30）。 */
    _storyCGCache = null;
    storyCGFrame(idx, canvas) {
      if (idx == null || idx < 0 || idx > 114) return false;
      /* 资源版本号：CG 重新导出后文件名不变，旧构建/浏览器缓存会继续用旧图
       * （表现为「颜色不对」）。带 ?v= 强制按新内容取。 */
      const url = `assets/story/mm_${String(idx).padStart(3, "0")}.png?v=2`;
      const draw = (img) => {
        const g = canvas.getContext("2d");
        const W = canvas.width, H = canvas.height;
        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;
        g.imageSmoothingEnabled = true;
        g.clearRect(0, 0, W, H);
        /* CG 是 640×400（4:3），视口 16:9。用 cover 会切掉上下 25%（楼船桅杆/屋顶），
         * 所以改成：主体按高度完整显示，左右两侧用同一张图的模糊放大版补满，
         * 既保留整幅原画，也不出现黑边。 */
        const scCover = Math.max(W / sw, H / sh);
        const cw = Math.round(sw * scCover), ch = Math.round(sh * scCover);
        g.save();
        if (typeof g.filter === "string") g.filter = "blur(22px) brightness(0.7)";
        g.drawImage(img, Math.round((W - cw) / 2), Math.round((H - ch) / 2), cw, ch);
        g.restore();
        const sc = Math.min(W / sw, H / sh);   // contain：整幅可见
        const dw = Math.round(sw * sc), dh = Math.round(sh * sc);
        g.drawImage(img, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
      };
      this._storyCGCache = this._storyCGCache || {};
      if (this._storyCGCache[url]) { draw(this._storyCGCache[url]); return true; }
      const im = new Image();
      /* 异步加载期间画布先铺一层底色，避免出现纯黑帧；
       * 图片到达后再覆盖成真正的 CG。 */
      {
        const g0 = canvas.getContext("2d");
        g0.fillStyle = "#000";
        g0.fillRect(0, 0, canvas.width, canvas.height);
      }
      im.onload = () => { this._storyCGCache[url] = im; if (canvas.isConnected) draw(im); };
      im.onerror = () => {};
      im.src = url;
      return true;
    }

    /* 参数：(mode, args[1], args[3], canvas)。args[1] 是 CG 图号，args[3] 是场景号。 */
    storySceneReal(mode, arg1, a, canvas) {
      /* mode 1：转场特效，不改场景（保持当前画面） */
      if (mode === 1) return true;
      if (mode === 0) {
        const cg = (arg1 >= 0) ? (arg1 | 0) : -1;
        if (this.storyCGFrame(cg, canvas)) return true;
        return false;                               // 无对应 CG → 兜底黑场
      }
      /* 参数角色（2026-10-31 修正）：
       *   change_scene [mode, arg1, arg2, arg3, arg4]
       *   **arg1 才是要显示的资源编号**，三种 mode 一致：
       *     mode 0 → arg1 = CG 图号（已验证：ch00 的 26 正是港口楼船 mm_026）
       *     mode 1 → arg1 = 室内/转场编号（150 次调用里 149 次为 30）
       *     mode 2 → arg1 = **地形图编号**（Hm 编号）；65535 = 保持当前地形
       *   arg3 是**场景序号**（0..73，正好对应 Pmap.e5 的 74 段装饰/物件表），
       *   不是地图号 —— 旧实现把 arg3 当地图号，导致 58..73 找不到地图而退回手绘。
       *   例：ch00「汉中沔阳」那幕是 change_scene[2, 39, 65535, 68, 65535]，
       *   地形应为 hm39，场景 68 只用于取装饰表。 */
      const mapArg = (arg1 != null && arg1 >= 0) ? (arg1 | 0) : 0xffff;
      const idx = this._storyMapIndex(mapArg);
      /* 原版野外背景是实时 3D 地形渲染；这里用 Hm 地图（已按 Spalet-BGR 上色）
       * 做透视投影近似：逐行缩放，越靠下越宽，模拟俯视透视。 */
      /* 场景号已接通（story.js 传 change_scene 的 args[3]）。
       * 原版共 74 个场景号：0..57 对应 Hm00..Hm57 地形图（占野外场景 83%），
       * 58..73 暂无可解码资源（Mmap 对应段非图像数据），走既有手绘背景兜底。 */
      const hmCount = 58;
      let hi;
      if (idx < hmCount) hi = idx;
      else return false;             // 交回 storyScene 的 renderBG 兜底
      const url = `assets/maps/hm${String(hi).padStart(2, "0")}.png`;
      this._storyMapCache = this._storyMapCache || {};
      const draw = (img) => {
        const g = canvas.getContext("2d");
        g.imageSmoothingEnabled = true;
        /* 素材是异步加载的：绘制时若画布尺寸尚未就绪会得到 0×0 的空画面，
         * 所以在这里统一确定尺寸（设 width 会清空画布，必须在 clearRect 之前）。 */
        if (canvas.width !== 1280 || canvas.height !== 720) { canvas.width = 1280; canvas.height = 720; }
        g.clearRect(0, 0, canvas.width, canvas.height);
        const W = canvas.width, H = canvas.height;
        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;

        /* ── 原版野外背景还原 ─────────────────────────────────────────────
         * 原版把战斗地图（Hm*.e5，已成 3D 预渲染的等距地形）当作剧情场景地面，
         * 用透视相机俯视渲染。旧实现只做 1~1.55 倍的行拉伸，等于俯视图摊平，
         * 所以看起来「扁平、没有远近」。这里改成真正的地平面透视：
         *   屏幕行 y → 深度 d = 1/(k·t + e)，t 为 0(地平线)..1(画面底)
         *   源行 v 与横向缩放都正比于 d，于是近处铺满、远处急剧收敛。
         * 再叠两层大气效果（远处雾化 + 天空渐变），这才是原版那种纵深感。 */

        /* 地平线：参考图 ref_b/ref_c 里远景约占画面 30% 高 */
        const horizon = Math.round(H * 0.30);

        /* 取地图的「天空色」：用最上面几行的平均色，作为远景雾与天空的基色 */
        let skyR = 150, skyG = 165, skyB = 170;
        try {
          const tmp = document.createElement("canvas");
          tmp.width = sw; tmp.height = 1;
          tmp.getContext("2d").drawImage(img, 0, 0, sw, 1, 0, 0, sw, 1);
          const d0 = tmp.getContext("2d").getImageData(0, 0, sw, 1).data;
          let r = 0, gg = 0, b = 0, n = 0;
          for (let k = 0; k < d0.length; k += 4) {
            if (d0[k + 3] < 8) continue;
            r += d0[k]; gg += d0[k + 1]; b += d0[k + 2]; n++;
          }
          if (n) { skyR = Math.round(r / n); skyG = Math.round(gg / n); skyB = Math.round(b / n); }
        } catch (e) { /* 取色失败用默认雾色 */ }

        /* 参考图（ref_b/ref_c）远景天空是冷蓝灰，而地图顶部多为土黄/草绿；
         * 这里把地图取色往大气蓝偏移，避免整屏发黄发脏。 */
        skyR = Math.round(skyR * 0.62 + 96 * 0.38);
        skyG = Math.round(skyG * 0.66 + 122 * 0.34);
        skyB = Math.round(skyB * 0.62 + 158 * 0.38);
        /* 天空：上深下浅，接近地平线处与雾色相接 */
        const sky = g.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, `rgb(${Math.round(skyR * 0.72)},${Math.round(skyG * 0.78)},${Math.round(skyB * 0.92)})`);
        sky.addColorStop(0.72, `rgb(${skyR},${skyG},${skyB})`);
        sky.addColorStop(1, `rgb(${Math.min(255, skyR + 26)},${Math.min(255, skyG + 26)},${Math.min(255, skyB + 26)})`);
        g.fillStyle = sky;
        g.fillRect(0, 0, W, horizon);

        /* 地面：逐行透视采样。源图只用下 88%（上方是地图边界，避免露出黑边） */
        const srcBottom = sh - 1;
        const srcSpan = sh * 0.88;
        const K = 0.92;          // 透视强度：越大远处收敛越猛
        const EPS = 0.12;        // 地平线附近的软化，避免除零与闪烁
        const FOG_NEAR = 0.0, FOG_FAR = 0.70;   // 雾化强度（近/远）

        /* ── 透视地面：逐行逐格绘制 ───────────────────────────────────
         * 同一地图行的所有格子深度相同 ⇒ 缩放一致，可以整格 drawImage，
         * 瓦片保持清晰（旧做法把整行横拉，栅栏/城墙会被拉成横条）。
         * 屏幕纵坐标按 y = horizon + K/d 收敛，横向尺寸 ∝ 1/d。 */
        const TILE = 48;                       // 地图 PNG 每格像素
        const mw = Math.max(1, Math.round(sw / TILE));
        const mh = Math.max(1, Math.round(sh / TILE));
        /* NEAR_D 决定近景的纵向拉伸比：一行在屏幕上的高度 = K2/(d(d+1))，
         * 取 NEAR_D=7 时近处约 1.3 倍（接近 1:1），再小就会把每个地形行
         * 拉成又高又平的横条，看起来是「条纹」而不是地面。 */
        const NEAR_D = 7.0;
        const K2 = (H - horizon) * NEAR_D;     // 纵向透视常数
        const PX = TILE * NEAR_D;              // 横向比例：深度 NEAR_D 时一格 = 48px
        const camX = mw / 2;                   // 相机所在的列（地图中央）
        const camY = mh - 1;                   // 相机贴地图下沿，向前看
        /* 远处行超出地图后**钳制到地图最上沿**继续延伸，让地面一直铺到天边
         * （否则地图只有 32 行，填不满地平线以下，会留下一条雾带缺口）。 */
        const MAX_D = 140;

        for (let d = NEAR_D; d < MAX_D; d += 1) {
          const jrow = Math.min(mh - 1, Math.max(0, Math.floor(camY - d)));   // 行钳制
          const yTop = horizon + K2 / (d + 1);
          const yBot = horizon + K2 / d;
          /* 远处行高会小于 1px：不能直接跳过（跳过会留下透明缝隙，透出白底），
           * 统一压成 1px 继续画，由雾化层把它们自然吃掉。 */
          const hRow = Math.max(1, yBot - yTop);
          const cellW = PX / d;
          if (cellW < 0.4) continue;
          const far = Math.min(1, Math.max(0, (d - NEAR_D) / (MAX_D - NEAR_D)));
          const fog = FOG_FAR * Math.pow(far, 1.25);
          /* 打底：万一某行没铺满也不会露出画布白底 */
          g.fillStyle = `rgb(${Math.round(skyR * 0.55 + 62 * 0.45)},${Math.round(skyG * 0.55 + 74 * 0.45)},${Math.round(skyB * 0.55 + 52 * 0.45)})`;
          g.fillRect(0, Math.max(horizon, yTop), W, hRow + 1);
          /* 可见列范围：按屏幕宽度算，超出地图的列**钳制到边缘瓦片**，
           * 这样地面一直延伸到天边，不会露出地图边界的「金字塔」缺口。 */
          const half = (W / 2) / cellW + 2;
          const i0 = Math.floor(camX - half);
          const i1 = Math.ceil(camX + half);
          const sy2 = jrow * TILE;
          for (let i = i0; i <= i1; i++) {
            const ci = Math.min(mw - 1, Math.max(0, i));    // 边缘钳制
            const sx = ci * TILE;
            const px = W / 2 + (i + 0.5 - camX) * cellW - cellW / 2;
            g.drawImage(img, sx, sy2, TILE, TILE, px, yTop, cellW + 0.6, hRow + 0.6);
          }
          /* 大气雾化：整行盖一层雾色 */
          if (fog > 0.01) {
            g.fillStyle = `rgba(${skyR},${skyG},${skyB},${fog.toFixed(3)})`;
            g.fillRect(0, Math.max(horizon, yTop), W, hRow + 1);
          }
        }
        /* 地平线接缝处再压一道柔光，避免天地交界出现硬边 */
        /* 地平线到「最远一行」之间还有一段没有被任何行覆盖（深度收敛不到地平线），
         * 之前这段是透明的，会透出画布后面的白底 —— 补一层纯雾色填平。 */
        const farY = horizon + K2 / (MAX_D + 1);
        if (farY > horizon) {
          const haze = g.createLinearGradient(0, horizon, 0, farY + 2);
          haze.addColorStop(0, `rgb(${Math.min(255, skyR + 30)},${Math.min(255, skyG + 30)},${Math.min(255, skyB + 30)})`);
          haze.addColorStop(1, `rgb(${Math.round(skyR * 0.9 + 20)},${Math.round(skyG * 0.92 + 22)},${Math.round(skyB * 0.9 + 24)})`);
          g.fillStyle = haze;
          g.fillRect(0, horizon - 1, W, farY - horizon + 3);
        }
        const seam = g.createLinearGradient(0, horizon - 6, 0, horizon + 18);
        seam.addColorStop(0, `rgba(${Math.round(skyR * 0.92)},${Math.round(skyG * 0.94)},${Math.round(skyB * 0.96)},0.85)`);
        seam.addColorStop(1, `rgba(${skyR},${skyG},${skyB},0)`);
        g.fillStyle = seam;
        g.fillRect(0, horizon - 6, W, 24);
      };
      if (this._storyMapCache[url]) { draw(this._storyMapCache[url]); return true; }
      const im = new Image();
      im.onload = () => { this._storyMapCache[url] = im; if (canvas.isConnected) draw(im); };
      im.onerror = () => {};
      im.src = url;
      return true;    // 已接管（异步绘制，失败时保持上一次画面）
    }

    // change_scene：mode 0 黑场 / 1 室内 / 2 野外；重绘背景并擦除字幕带
    storyScene(mode, a, c) {
      const holder = this.storyScreen.querySelector(".bg");
      if (!holder) return;
      let canvas = holder.querySelector("canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.style.cssText = "width:100%;height:100%;display:block;image-rendering:pixelated";
        holder.appendChild(canvas);
      }
      let name;
      if (mode === 0) name = "black";
      else if (mode === 1) name = "palace";
      else {
        // 野外：按地名关键词选主题（原版 Pmap 每图一主题，此处以地名近似路由）
        const place = this._lastPlace || "";
        if (/营|寨|屯|军/.test(place)) name = "camp";
        else if (/城|关|郡|县|府|狱|池|门/.test(place)) name = "city";
        else if (/夜|更|暮/.test(place)) name = "night";
        else name = "field";
      }
      /* 画布尺寸：只在内容真正绘制时设置。canvas.width=... 会清空画布，
       * 若在这里先设、而素材是异步加载的，就会留下一帧黑屏并覆盖上一次画面。 */
      if (canvas.width !== 1280 || canvas.height !== 720) { canvas.width = 1280; canvas.height = 720; }
      /* 第三个参数才是 change_scene 的 args[3]（Mmap 场景序号）；第二个是坐标 x */
      /* 画布一旦画上真实场景/CG，就隐藏 CSS 兜底背景（宣纸渐变+远山剪影） */
      holder.classList.add("has-canvas");
      if (!this.storySceneReal(mode, a, c, canvas)) {
        // 真实素材缺失时才回退到手绘，并把兜底层放回来
        holder.classList.remove("has-canvas");
        window.JW.renderBG(canvas, name);
      }
      this.storyCaptionClear(true);
      /* 换场景时清掉上一屏的残留：场上小人 + 对话气泡。
       * 用户实测反馈「人物和对话到下一个界面没有消失」——
       * 原版 change_scene 会整屏重绘，上一幕的站位与台词不会带过来。
       * 注意：演员随后会被 change_scene 之后的 actor_appear 重新放上去，
       * 所以这里清空不会导致该出现的角色缺席。 */
      this.storyActorsClear();
      this.storyBubbleHide();
    }

    /* 隐藏对话框 + 说话人立绘，但不结束剧情推进（换场景用）。
     * 用户实测反馈「左上角头像还在」：切场景后气泡藏了，但 .fig-holder 没藏。 */
    storyBubbleHide() {
      const box = this.storyScreen && this.storyScreen.querySelector(".dialogue-box");
      if (box) {
        box.classList.remove("show");
        box.style.opacity = "0";
        box.style.visibility = "hidden";
      }
      const fl = this.storyScreen && this.storyScreen.querySelector(".fig-holder.left");
      const fr = this.storyScreen && this.storyScreen.querySelector(".fig-holder.right");
      if (fl) fl.classList.remove("show");
      if (fr) fr.classList.remove("show");
    }
    // caption：画面下方 640×80 深色字幕带（原版 y 360..440）
    storyCaption(text, newline) {
      const band = this.storyScreen.querySelector(".story-caption-band");
      const el = band && band.querySelector(".cap-text");
      if (!band || !el) return;
      band.classList.remove("hidden");
      if (newline) el.innerHTML += (el.innerHTML ? "<br>" : "") + text;
      else el.textContent = text;
    }
    storyCaptionClear(hard) {
      const band = this.storyScreen.querySelector(".story-caption-band");
      if (!band) return;
      const el = band.querySelector(".cap-text");
      if (el) el.innerHTML = "";
      if (hard) band.classList.add("hidden");
    }
    // place_name / title_text：横幅
    storyBanner(text, kind) {
      const bn = this.storyScreen.querySelector(".story-banner");
      if (!bn) return;
      const el = bn.querySelector(".bn-text");
      if (text) {
        this._lastPlace = text;          // 地名驱动背景主题（原版 Pmap 地图主题近似）
        this._updateTopBars();           // 原版 ref_b：地名显示在蓝条上方
      }
      if (!text) { bn.classList.add("hidden"); return; }
      /* kind==='place' 不再显示横幅：原版地名只写在蓝条上方（ref_b），
       * 且横幅位置正好被对话气泡压住，会露出一截黑字。 */
      if (kind !== "title") { bn.classList.add("hidden"); return; }
      bn.classList.remove("hidden");
      bn.classList.add("bn-title");
      el.textContent = text;
      clearTimeout(this._bnTimer);
      this._bnTimer = setTimeout(() => bn.classList.add("hidden"), 1600);
    }
    // chapter_title：章节标题卡
    storyTitleCard(text) {
      const tc = this.storyScreen.querySelector(".story-titlecard");
      if (!tc) return;
      tc.classList.remove("hidden");
      tc.querySelector(".tc-text").textContent = text;
    }
    storyTitleCardClear() {
      const tc = this.storyScreen.querySelector(".story-titlecard");
      if (tc) tc.classList.add("hidden");
    }
    // fade_out=从黑淡入 / fade_in=淡出到黑（原版命名相反）
    storyFade(dir) {
      const f = this.storyScreen.querySelector(".story-fade");
      if (!f) return;
      f.style.transition = "opacity .5s";
      f.style.opacity = dir === "in" ? "0" : "1";
    }
    /* 剧情立绘朝向：dir 1=朝左 2=朝右（与战斗 u.dir 同源），作用于 .sa-img，
     * 不与 el 上的动作动画（transform）相互覆盖。 */
    _actorFace(el, dir) {
      if (!el) return;
      const img = el.querySelector(".sa-img");
      if (!img) return;
      img.style.transform = dir === 1 ? "scaleX(-1)" : dir === 2 ? "scaleX(1)" : "";
    }
    // actor_appear/move/action/face：剧情立绘（100×100 格 → 屏幕百分比）
    storyActor(kind, args) {
      const layer = this.storyScreen.querySelector(".story-actors");
      if (!layer) return;
      /* 原版 0x2F：重置角色表——清掉场上全部剧情立绘。 */
      if (kind === "clear") {
        layer.querySelectorAll(".story-actor").forEach((el) => el.remove());
        this._updateTopBars();
        return;
      }
      /* 实测参数布局（eex_parsed）：appear=[pid,x,y,dir,?] move=[?,pid,?,x,y]
       * action=[pid,act] face=[pid,?,dir] —— 旧代码对 action/face 误取 args[1] 当 pid。 */
      const pid = kind === "move" ? (args[1] | 0) : (args[0] | 0);
      const key = "a" + pid;
      let el = layer.querySelector(`[data-actor="${key}"]`);
      const R = window.JW_REAL;
      const p = R && R.persons ? R.persons[pid] : null;
      const name = p ? p.name : "";
      if (kind === "appear") {
        if (!el) {
          el = document.createElement("div");
          el.className = "story-actor";
          el.dataset.actor = key;
          /* 场上立绘用战斗单位图（Unit_mov 48×48 首帧，原版剧情人物就是这样站着的），
           * 120×120 人物图只用于对话框头像。 */
          /* promo(形态)取自战斗单位档案（部署 0x45 字段），剧情里通常 0 */
          const bu = window.JW.App && window.JW.App.battle
            ? window.JW.App.battle.units.find(x => x.pid === pid || x.name === name) : null;
          const unit = this.unitFigureFor(pid, bu ? (bu.promo || 0) : 0);
          /* 原版剧情场上小人是「裸精灵」：脚下**没有**名字标签
           * （姓名只出现在对话框与顶栏蓝条）。 */
          el.innerHTML = `<div class="sa-img">${unit || '<div class="sa-ph"></div>'}</div>`;
          layer.appendChild(el);
        }
        /* 原版 actor 坐标是 **100×100 的格子坐标**（eex_format_doc 行 206：
         * 「actor table 0x80×64 B，3×3 cell footprint on a 100×100 cell grid」），
         * 小人占 3×3 格、**脚踩在格子底边**。
         * 旧实现把 y 直接当百分比且再减 12（当成了顶部锚点），人跑到画面上方。 */
        const x = (args[1] | 0) / 100, y = (args[2] | 0) / 100;
        el.style.left = Math.max(2, Math.min(94, x * 100)) + "%";
        el.style.top = Math.max(8, Math.min(92, y * 100)) + "%";
        el.style.transform = "translate(-50%, -100%)";
        el.dataset.x = args[1]; el.dataset.y = args[2];
        el.style.opacity = "1";
        if (args[3] !== undefined && args[3] !== 65535) this._actorFace(el, args[3] | 0);
        /* 原版：actor 一上场，顶栏双蓝条就显示其名（ref_c 的「常山赵云/蜀国军营」） */
        this._updateTopBars();
      } else if (kind === "move") {
        if (!el) return;
        const x = (args[3] | 0) / 100, y = (args[4] | 0) / 100;
        el.style.transition = "left .8s linear, top .8s linear";
        el.style.left = Math.max(2, Math.min(94, x * 100)) + "%";
        el.style.top = Math.max(8, Math.min(92, y * 100)) + "%";
        el.style.transform = "translate(-50%, -100%)";
        el.dataset.x = args[3]; el.dataset.y = args[4];
        el.classList.add("sa-walk");
        setTimeout(() => el && el.classList.remove("sa-walk"), 900);
      } else if (kind === "action" || kind === "face") {
        if (!el) return;
        const act = (args[1] !== undefined ? (args[1] | 0) : 0);
        if (kind === "face") this._actorFace(el, args[2] !== undefined ? (args[2] | 0) : 0);
        /* 动作码语义同战斗 playUnitAnim：0站立 1欢呼 2防御 3受击 5起手 6单挥 7双挥 8转向… */
        for (let i = 1; i <= 12; i++) el.classList.remove("sa-act-" + i);
        el.classList.remove("sa-act");
        void el.offsetWidth;   // 重启 CSS 动画
        if (act > 0) {
          const cls = "sa-act-" + Math.min(act, 12);
          el.classList.add(cls);
          setTimeout(() => { if (el) el.classList.remove(cls); }, 460);
        }
      }
    }
    actorPos(pid) {
      const layer = this.storyScreen && this.storyScreen.querySelector(".story-actors");
      const el = layer && layer.querySelector(`[data-actor="a${pid}"]`);
      if (!el) return null;
      return { x: +(el.dataset.x || 50), y: +(el.dataset.y || 50) };
    }
    storyActorsClear() {
      const layer = this.storyScreen && this.storyScreen.querySelector(".story-actors");
      if (layer) layer.innerHTML = "";
    }

    teleportActor(mode, who, slot, x, y, dir) {
      const layer = this.storyScreen && this.storyScreen.querySelector(".story-actors");
      if (!layer) return;
      let el = null;
      if (mode === 0) {
        el = layer.querySelector(`[data-actor="a${who}"]`);
      } else {
        const all = layer.querySelectorAll(".story-actor");
        el = all[slot];
      }
      if (!el) return;
      el.dataset.x = x | 0;
      el.dataset.y = y | 0;
      el.style.left = Math.max(2, Math.min(94, x | 0)) + "%";
      el.style.top = Math.max(8, Math.min(92, y | 0)) + "%";
      el.style.transform = "translate(-50%, -100%)";
      if (dir !== undefined && dir !== 65535) this._actorFace(el, dir | 0);
      const b = window.JW.App && window.JW.App.battle;
      if (b) b.checkBattleEvents("reach", { pid: who, x: x | 0, y: y | 0 }, x | 0, y | 0);
    }

    /* 立绘：优先角色档案（剧情解锁），否则按人物表的 face 索引取原版 Face.e5（64×80） */
    faceFor(who) {
      const role = window.JW_ROLESTORE && window.JW_ROLESTORE[who];
      if (role && role.portrait) {
        return `<img src="${role.portrait}" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">`;
      }
      const idx = this.faceIndexFor(who);
      const faces = window.JW_FACES || [];
      if (idx != null && faces[idx]) {
        return `<img src="${faces[idx]}" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated;background:#1a1208">`;
      }
      return "";
    }

    /* 场上立绘：战斗单位图 Unit_mov（48×48、11 帧），显示首帧并放大。
     * sprite 索引复用战斗的 spriteIndex 规则（person.sprite + 兵种）。 */
    unitFigureFor(who, form) {
      /* 第 11 轮修正：原版战场/剧情小人的 Unit_mov 段号**不是** persons[pid].sprite 直查，
       * 必须先经 ov 覆盖表变换（第 7 轮定论 FUN_0043fc48，real.js spriteIndex）：
       *   ov = SPRITE_OV[pid]（VA 0x501000 u16 表）；
       *   base = ov==0 ? sprite : (ov<0x21 ? (ov-1)*3+0x50+(sprite%3) : ov+0x8f)；
       *   seg  = base<0x50 ? base*3+min(form,2) : base+0xa0。
       * 旧实现在这里直接用 p.sprite（注释写“sprite 直查无转换”，已被第 7 轮作废），
       * 导致剧情小人张冠李戴（如赵云应 408 金甲，直查只得 0x69=105）。
       * 数值一律取 real.js 已算好的 mkUnit().spriteIdx（同一权威实现），避免两份公式漂移。 */
      const p = this._personFor(who);
      if (!p) return "";
      const pid = (typeof who === "number") ? who : p.id;
      const R = window.JW_REAL;
      let idx = null;
      if (R && R.mkUnit) {
        /* 用 mkUnit 的权威 spriteIdx（内部即 spriteIndex(pid, p.sprite, promo)）。
         * 签名：mkUnit(personId, x, y, faction, opts)；form 走 opts.promo。 */
        try {
          const mk = R.mkUnit(pid, 0, 0, "ally", { promo: form != null ? form : 0 });
          /* mkUnit 返回 {def,x,y,faction}，spriteIdx 在 def 上（real.js:139） */
          if (mk && mk.def && mk.def.spriteIdx != null) idx = mk.def.spriteIdx;
        } catch (e) { idx = null; }
      }
      if (idx == null) idx = (p.sprite == null || p.sprite < 0) ? (0x44 + (p.cls | 0)) : (p.sprite | 0);
      const sheets = window.JW_UNIT_MOV || [];
      const url = sheets[idx];
      if (!url) return "";
      /* Unit_mov 实测尺寸 48×528 = 48 宽 × 11 帧【竖排】（Phaser spritesheet 按
       * frameWidth/Height 48 行主序切，宽度只容 1 列，故等价于竖排 11 帧）。
       * 因此必须 background-size:100% 1100%（纵向铺 11 帧）+ position 0 0 取首帧。
       * 旧实现按横排 1100% 100% 切，把 48×528 竖表横拉 11 倍 → 横条纹噪声
       * （用户反馈"图是乱的"的直接原因）。 */
      return `<div style="width:100%;height:100%;background-image:url('${url}');`
        + `background-size:100% 1100%;background-position:0 0;`
        + `background-repeat:no-repeat;image-rendering:pixelated"></div>`;
    }

    /* 头像号校正表：人物 id → 资源号。运行时可用 JW.setPortrait(pid, idx) 追加并持久化。 */
    /* 头像号 = persons[pid].face（1:1 原版人物记录 +0x04）。
     * 旧内置默认 {799:354} 是"把 pid 当资源号"错误前提下的补丁，根因已修（faceIndexFor
     * 现按 face 解析），故清空默认，仅保留 localStorage 手动覆盖通道。 */
    _portraitFix = (() => { try { return JSON.parse(localStorage.getItem("jw_portrait_fix") || "{}"); } catch (e) { return {}; } })();

    _personFor(who) {
      const R = window.JW_REAL;
      if (typeof who === "number") return (R && R.persons) ? R.persons[who] : null;
      const tbl = (R && R.persons) || [];
      return tbl.find(x => x && x.name === who) || null;
    }

    /* 武将大图：assets/figures/fig_NNN.png（立绘号 = face + 7，见 figureIndexFor） */
    figureFor(who) {
      const idx = this.figureIndexFor(who);
      if (idx == null) return "";
      const n = String(idx).padStart(3, "0");
      return `<img src="assets/figures/fig_${n}.png?v=2" alt="" `
        + `style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated" `
        + `onerror="this.style.display='none'">`;
    }

    /* 头像号解析（1:1）：数字按【人物 id】查 persons[pid].face，字符串按名查；
     * Face.e5 段号 = face 直查（第 6 轮定论）。 */
    faceIndexFor(who) {
      const p = this._personFor(who);
      if (p && p.face != null) return p.face;
      /* 无档案时：数字仍当资源号兜底，字符串无解 */
      return (typeof who === "number") ? who : null;
    }

    /* 对话立绘号（原版 FUN_00407657 + Tou.dll 像素比对，第 8 轮定论）：
     * 立绘号 = face + 7；Tou 资源 ID = 立绘号 + 301（fig_N ≡ Tou 301+N 全等）。
     * 旧覆盖表 {李明:354} 即 face 347+7，正是缺 +7 偏移的补丁，已删。
     * pid 0/1/4/8/35 的剧情换装特例（state 命中切固定像 214/223/224/226/227）
     * 在默认 state=0 下同样落回 face+7，故统一 face+7。
     * 视觉裁决（tou_offset/tou_specials.png）：诸葛亮 fig_032 羽扇纶巾、
     * 赵云 fig_033 白甲白裘、刘禅 fig_057 冕冠、魏延 fig_034 红袍老将 ✓ */
    figureIndexFor(who) {
      if (typeof who === "number" && this._portraitFix[who] != null) return this._portraitFix[who];
      const idx = this.faceIndexFor(who);
      return idx == null ? null : idx + 7;
    }

    // ---- 战斗 ----
    enterBattle(battle) {
      this.battle = battle;
      this.mode = "idle";
      this.selectedUnit = null;
      if (this.scene && this.scene.showPreview) this.scene.showPreview(null);
      this.showScreen("battle");
      this.startPhaser(battle);
      this.updateHUD();
      this.refreshRoundInfo();
    }
    /* ---- Phaser 3 渲染层 ---- */
    startPhaser(battle) {
      const holder = $("#battle-grid", this.battleScreen);
      // 清理异常重建残留的死画布（会叠在真画布上吞掉点击）
      if (holder) holder.querySelectorAll("canvas").forEach((c) => {
        if (!this.phaser || c !== this.phaser.canvas) c.remove();
      });
      const sceneOpts = { battle, onEvent: (e) => this.onPhaserEvent(e), onReady: () => this.bindBattleScene() };
      if (this.phaser) {
        // 已有实例：重启场景换战斗数据
        this.rebuildPhaserScene();
        return;
      }
      // 首次创建：Phaser 必须在 DOM 就绪后初始化
      const launch = () => {
        if (this.phaser) return;
        try {
          this.phaser = new Phaser.Game({
            type: Phaser.CANVAS,
            parent: holder,
            width: holder.clientWidth || 960,
            height: holder.clientHeight || 640,
            backgroundColor: "#2a1a0c",
            transparent: true,
            scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
            scene: [window.JW_BattleScene],
            audio: { noAudio: true },
            banner: false,
            fps: { target: 60, forceSetTimeOut: true },
          });
          // 某些环境下 Phaser 的 RAF 循环未启动，手动兜底
          setTimeout(() => {
            if (this.phaser && !this.phaser.loop.running) {
              console.warn("Phaser loop 未启动，手动启动");
              this.phaser.loop.start(this.phaser.step.bind(this.phaser));
            }
          }, 300);
        } catch (e) {
          console.error("Phaser 创建失败", e);
          return;
        }
        this.phaser.events.once(Phaser.Core.Events.READY, () => {
          this.phaser.scene.start("battle", sceneOpts);
        });
        // 兜底：确保场景已启动（部分环境下 READY 早于 boot 完成）
        let tries = 0;
        const kick = () => {
          const sc = this.phaser.scene.getScene("battle");
          if (sc && sc.sys && sc.sys.settings && sc.sys.settings.status >= 5) {
            if (!sc.scene.isActive()) this.phaser.scene.start("battle", sceneOpts);
            else if (!this.scene) this.bindBattleScene();
          } else if (tries++ < 200) {
            setTimeout(kick, 30);
          }
        };
        setTimeout(kick, 60);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => launch(), { once: true });
      } else {
        launch();
      }
    }

    bindBattleScene() {
      const scene = this.phaser && this.phaser.scene.getScene("battle");
      if (!scene || !scene.input) return;
      if (!scene._jwBound) {
        scene._jwBound = true;
        scene.onCellClick = (cell) => this.handleCellClick(cell.x, cell.y);
        scene.onCancel = () => this.cancelMode();   // 原版：右键 = 取消
        scene.onCellHover = (cell) => {
          // 光标只在 idle/select 跟随鼠标；move/target/skill 阶段保持锁定
          if (this.mode === "idle" || this.mode === "select") this.showCursor(cell.x, cell.y);
          // 攻击/策略阶段：悬停敌方显示确定性伤害预览（UI 增强，不改战斗结果）
          this.updateAttackPreview(cell);
          // 平时：悬停格子显示地形信息（原版有地形/移动消耗提示）
          this.updateTerrainTip(cell);
        };
        scene.onReady = () => this.bindBattleScene();
      }
      this.scene = scene;
      this.refreshUnits();
    }

    /* 战斗数据就绪后重建 Phaser 场景 */
    rebuildPhaserScene() {
      if (!this.phaser || !this.battle) return;
      const sceneOpts = { battle: this.battle, onEvent: (e) => this.onPhaserEvent(e), onReady: () => this.bindBattleScene() };
      this.phaser.scene.start("battle", sceneOpts);
    }

    onPhaserEvent(ev) {
      if (ev.type === "hit" || ev.type === "miss" || ev.type === "heal" || ev.type === "death") {
        this.refreshUnits();
      }
      /* 原版 0x5B/0x5C/0x55：地图居中到该格（可带闪烁） */
      if (ev.type === "centerOn" && this.scene && this.scene.centerOnCell) {
        this.scene.centerOnCell(ev.x, ev.y, ev.blink ? 3 : 0);
        if (ev.blink && this.scene.blinkCells) this.scene.blinkCells(ev.blink, 3);
      }
      /* 原版 0x5A：战斗开场字幕 */
      if (ev.type === "battleCaption") this.showBattleCaption(ev.text || "开 始 战 斗");
    }

    /* 原版 0x5A ui_5a（0x44bac2）：字幕压暗化地图约 20 tick */
    showBattleCaption(text) {
      const el = $("#battle-caption");
      if (!el) return;
      el.textContent = text;
      el.classList.remove("hidden");
      clearTimeout(this._battleCapTimer);
      this._battleCapTimer = setTimeout(() => el.classList.add("hidden"), 1300);
    }

    /* 地形提示：显示地形名 + 移动消耗 + 回避修正（不改任何数值） */
    updateTerrainTip(cell) {
      /* 顶栏双蓝条：左条=当前选中/行动单位，右条=最近交战对手（无则留空） */
      this._updateBattleBars(b);
      const tip = $("#hud-tip");
      if (!tip) return;
      const b = this.battle;
      if (!b || !cell) return;
      const t = b.map.terrain ? b.map.terrain(cell.x, cell.y) : null;
      if (!t) return;
      /* 真实消耗在「兵种家族 × 地形」表里（G.families[fam].move/avoid[terrainId]），
       * 有选中/待移动单位时按该单位兵种显示，否则只显示地形名。 */
      const R = window.JW_REAL;
      const u = this._moveUnit || this.selectedUnit;
      const parts = [t.name];
      if (u && R && R.families) {
        const fam = (u.fam !== undefined && u.fam !== null) ? u.fam : R.familyOf(u.clsId || 0);
        const F = R.families[fam];
        if (F) {
          const mv = (F.move && F.move[t.id] !== undefined) ? F.move[t.id] : null;
          const av = (F.avoid && F.avoid[t.id] !== undefined) ? F.avoid[t.id] : 0;
          if (mv !== null) parts.push(mv >= 99 ? "不可通行" : `移动消耗 ${mv}`);
          if (av) parts.push(`回避 ${av > 0 ? "+" : ""}${av}`);
        }
      }
      if (this.mode === "idle" || this.mode === "select") tip.textContent = `地形：${parts.join(" · ")}`;
    }

    /* 攻击预览：target/skill 模式下悬停敌人，显示 预计伤害区间 / 命中% / 会心% */
    updateAttackPreview(cell) {
      const sc = this.scene;
      if (!sc || !sc.showPreview) return;
      const b = this.battle;
      if (!b || !this.selectedUnit || (this.mode !== "target" && this.mode !== "skill")) { sc.showPreview(null); return; }
      const target = b.units.find(u => u.isAlive && u.x === cell.x && u.y === cell.y && u.faction === "enemy");
      if (!target) { sc.showPreview(null); return; }
      const skill = this.mode === "skill" && this._skillId != null ? D.SKILLS[this._skillId] : null;
      const pv = b.previewAttack ? b.previewAttack(this.selectedUnit, target, skill) : null;
      if (!pv) { sc.showPreview(null); return; }
      sc.showPreview({ x: cell.x, y: cell.y,
        text: `伤害 ${pv.min}~${pv.max}  命中${pv.hit}%${pv.crit ? "  会心" + pv.crit + "%" : ""}` });
    }

    refreshUnits() {
      if (this.scene && this.scene.refreshUnits) this.scene.refreshUnits();
    }

    renderBattleMap() {
      // 地形由 Phaser 场景绘制（renderBattleMap 保留为兼容入口）
      if (this.scene && this.scene.drawTerrain) this.scene.drawTerrain();
    }

    renderUnits() {
      if (this.scene && this.scene.refreshUnits) this.scene.refreshUnits();
    }

    updateHUD() {
      const b = this.battle;
      /* 目标行：优先脚本给出的 battle_goal_text，否则从 victory_cond_text 里
       * 跳过「胜利条件 / 失败条件」表头，取第一条实质条目（如「一、全灭敌军。」）。 */
      const rawGoal = (b.goalText || b.victoryText || b.objective || (b.config && b.config.objective) || "").trim();
      let goal = "";
      for (const ln of rawGoal.split("\n")) {
        const t = ln.trim();
        if (!t) continue;
        if (/^(胜利条件|失败条件|作战目标)$/.test(t)) continue;
        goal = t; break;
      }
      const maxR = b.maxRounds || (b.config && b.config.maxRounds) || 0;
      const roundStr = maxR ? `第 ${b.round} / ${maxR} 回合` : `第 ${b.round} 回合`;
      $("#round-info").innerHTML = `${roundStr} · ${b.phase === "enemy" ? "敌军行动" : "我方行动"}`
        + (goal ? `<div style="font-size:11px;color:var(--gold-bright);opacity:.9;margin-top:2px;max-width:190px;line-height:1.25">${goal}</div>` : "");
      const tip = $("#hud-tip");
      if (tip) {
        if (b.phase === "enemy") tip.textContent = "敌军行动中…";
        else if (this.mode === "move") tip.textContent = "点击高亮格移动";
        else if (this.mode === "target") tip.textContent = "点击敌方单位攻击";
        else if (this.mode === "skill") tip.textContent = "点击目标施放策略";
        else if (this.selectedUnit) tip.textContent = "选择 移动 / 攻击 / 技能 / 待机";
        else tip.textContent = "点击我方单位 → 移动 / 攻击 / 技能";
      }
      const detail = $("#unit-detail");
      if (this.selectedUnit) {
        const u = this.selectedUnit;
        detail.classList.remove("hidden");
        detail.innerHTML = `
          <div class="name">${u.name} <span style="font-size:12px;color:var(--ink-faint)">Lv${u.lvl} ${u.cls.name}</span></div>
          <div class="stats">
            <span>HP <b>${u.hp}/${u.maxHp}</b></span>
            <span>MP <b>${u.mp}/${u.maxMp}</b></span>
            <span>攻 <b>${u.effectiveAtk}</b></span>
            <span>防 <b>${u.effectiveDef}</b></span>
            <span>速 <b>${u.effectiveSpd}</b></span>
          </div>
        `;
      } else detail.classList.add("hidden");
    }

    refreshRoundInfo() { this.updateHUD(); }

    showMoveRange(cells) {
      this.clearOverlay();
      // 原版：移动范围 = 浅黄色半透明
      if (this.scene && this.scene.showCells) this.scene.showCells(cells, 0xffe68c, 0.28);
    }
    showAttackRange(cells) {
      this.clearOverlay();
      // 原版：攻击范围 = 红色半透明
      if (this.scene && this.scene.showCells) this.scene.showCells(cells, 0xc8281c, 0.25);
    }
    showCursor(x, y) {
      this.cursor = { x, y };
      if (this.scene && this.scene.showCursor) this.scene.showCursor({ x, y });
    }
    hideCursor() {
      if (this.scene && this.scene.clearCursor) this.scene.clearCursor();
    }
    clearOverlay() {
      if (this.scene && this.scene.clearOverlay) this.scene.clearOverlay();
    }

    handleCellClick(x, y) {
      if (!this.battle || !this.battle.map.inBounds(x, y)) return;
      if (this._moving) return;   // 行走动画期间忽略点击，避免打断/重入
      if (this.battle._scriptPause) return;   // 开场演出/剧情对话期间禁止操作（原版演出时无指令）
      this.cursor = { x, y };
      /* 原版 0x2D test_clicked：点击角色即记录「事件槽 1 = 被点击的角色」并置点击事件标志
       * （GS+0 & 0x20）。放在点击入口而非选中，才能涵盖点敌人/友军等情况。 */
      const cu = this.battle.map.get(x, y);
      if (cu && cu.unit && this.engine && this.engine.markClicked) this.engine.markClicked(cu.unit);
      // 战前准备（部署阶段）：点我方选中，再点高亮格落位
      if (this.battle.phase === "deploy") {
        const b = this.battle;
        const sel = b._deploySel;
        if (sel && b.deployMove(sel, x, y)) {
          this.clearOverlay();
          if (this.onDeployState) this.onDeployState(b);
          this.status("站位已调整");
          return;
        }
        const c = b.map.get(x, y);
        if (c && c.unit && c.unit.faction === "ally") {
          b.deploySelect(c.unit);
          this.showMoveRange(b.deployRange(c.unit)); // 金色可落位区
          this.status(`部署：${c.unit.name} —— 点周围 3 格内空地调整站位`);
        } else this.status("部署中：先点选我方单位");
        return;
      }
      if (this.mode === "select") this.trySelect(x, y);
      else if (this.mode === "move") this.tryMove(x, y);
      else if (this.mode === "target") this.tryTarget(x, y);
      else if (this.mode === "skill") this.trySkillTarget(x, y);
      else if (this.mode === "item") this._handleItemTarget(x, y);
      else if (this.mode === "idle") this.trySelect(x, y);
    }
    // ESC 取消
    handleEsc() { this.cancelMode(); }

    handleGridClick(e) {
      const rect = this.battleScreen.querySelector("#battle-grid").getBoundingClientRect();
      const cp = this.scene ? this.scene.cellPx : this.cellPx;
      const x = Math.floor((e.clientX - rect.left) / cp);
      const y = Math.floor((e.clientY - rect.top) / cp);
      this.handleCellClick(x, y);
    }

    trySelect(x, y) {
      const cell = this.battle.map.get(x, y);
      if (!cell || !cell.unit) return;
      const u = cell.unit;
      if (u.faction !== "ally" || u.hasActed || u.isParalyzed || u.isSleeping) return;
      this.selectedUnit = u;
      this.engine && this.engine.markClicked && this.engine.markClicked(u);
      this.showCursor(x, y);
      if (this.scene && this.scene.setSelection) this.scene.setSelection(u.id);
      this.updateHUD();
      /* 经典流程（原版曹操传系）：点我方单位 → 立即亮蓝色移动范围（mode=move）；
       * 点可达格 → 走过去 → 弹指令菜单；再点单位本体 → 直接弹指令菜单（不移动也
       * 能攻击/施法/用道具）。修复「点完单位点格子没反应」的不能移动问题。 */
      this.mode = "move";
      this._moveUnit = u;
      this._moveOrigin = { x: u.x, y: u.y };
      this.showMoveRange(this.battle.moveRange(u));
      return;
    }

    showCommandMenu(x, y, u) {
      this.hideCommandMenu();
      const menu = $("#command-menu");
      menu.classList.remove("hidden");
      const cp = this.scene ? this.scene.cellPx : this.cellPx;
      const ox = this.scene ? this.scene.originX : this.offsetX;
      const oy = this.scene ? this.scene.originY : this.offsetY;
      // 放在单位右下方，避免遮住单位本体（否则再次点击会误触菜单）
      const px = ox + (x + 1) * cp + 6;
      const py = oy + y * cp + 4;
      menu.style.left = Math.min(px, this.battleScreen.clientWidth - 140) + "px";
      menu.style.top = Math.max(50, py) + "px";
      const items = [];
      items.push({ k: "attack", t: "攻击" });
      if (u.availableSkills ? u.availableSkills(this.battle).length : u.skills.length) items.push({ k: "skill", t: "策略" });
      /* 交给（原版菜单 result 6）：与相邻友军交换装备。
       * 证据：Ekd5.exe 0x4cfe6c/0x4cf967 里是“交换武器/交换护具/交换辅助装备”与“没有此项装备”。 */
      if (this.battle && this.battle.units.some(o => o !== u && o.isAlive && o.faction === u.faction
            && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1)) {
        items.push({ k: "handover", t: "交给" });
      }
      /* 围攻（原版菜单 result 6）：目标旁有可出手的友军时可用 */
      if (this.battle && this.battle.units.some(o => o.isAlive && o.faction === u.faction
            && !o.hasActed && this.battle.units.some(e => e.isAlive && e.faction !== u.faction
              && Math.max(Math.abs(o.x - e.x), Math.abs(o.y - e.y)) === 1))) {
        items.push({ k: "siege", t: "围攻" });
      }
      items.push({ k: "item", t: "道具" });
      items.push({ k: "info", t: "情报" });
      items.push({ k: "wait", t: "待机" });
      // 如果已经移动过但未行动，可取消移动返回原地（原版 0x43dde3: cancel move returns to menu）
      if (u.hasMoved && !u.hasActed) items.unshift({ k: "cancel-move", t: "取消移动" });
      menu.innerHTML = items.map(i => `<div class="cmd-item" data-cmd="${i.k}">${i.t}<span class="arrow">▶</span></div>`).join("");
      menu.querySelectorAll(".cmd-item").forEach(el => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hideCommandMenu();
          this.selectCommand(el.dataset.cmd, u);
        });
      });
    }
    hideCommandMenu() { $("#command-menu").classList.add("hidden"); }

    selectCommand(cmd, u) {
      switch (cmd) {
        case "move": {
          const cells = this.battle.moveRange(u);
          this.mode = "move"; this._moveUnit = u;
          this.showMoveRange(cells);
          this.updateHUD();
          break;
        }
        case "cancel-move": {
          // 取消移动：unit 返回原位（hasMoved=false, pos restore）
          if (!this.battle.cancelMove(u)) return;
          this.mode = "select";
          this.trySelect(u.x, u.y);
          this.updateHUD();
          if (this.scene && this.scene.refreshUnits) this.scene.refreshUnits();
          break;
        }
        case "attack": {
          this.mode = "target"; this._moveUnit = u;
          // 攻击范围 = 当前格 + 可移动格后的攻击范围
          this.showAttackTargets(u);
          this.updateHUD();
          break;
        }
        case "skill": {
          this.mode = "skill"; this._moveUnit = u;
          this.showSkillMenu(u);
          this.updateHUD();
          break;
        }
        case "item": 
          this.emitAction("item", { unit: u });
          break;
        case "wait": 
          this.finishAction(u); 
          break;
        case "handover":
          this.showHandOver(u);
          break;
        case "siege":
          this.showSiegeTargets(u);
          break;
        case "info":
          this.showUnitInfo(u);
          break;
      }
    }

    /* 武将情报（原版「武将情报」页：立绘 + 能力 + 装备 + 策略 + 状态） */
    showUnitInfo(u) {
      const R = window.JW_REAL;
      const names = ["武艺", "统制", "智谋", "感知", "胆魄"];
      const battleNames = ["攻击", "防御", "精神", "反应", "士气"];
      const itName = (id) => (id != null && R && R.items && R.items[id]) ? R.items[id].name : "（空）";
      const raw = (u._raw && u._raw.length) ? u._raw : null;
      const pairs = battleNames.map((bn, i) => {
        const v = [u.atk, u.def, u.mag, u.spd, u.hit][i] | 0;
        const b = u.buffs ? (u.buffs[i] != null ? u.buffs[i] : 3) : 3;
        const mark = b > 3 ? `<span style="color:#7fdc7f">▲${b - 3}</span>` : b < 3 ? `<span style="color:#e07070">▼${3 - b}</span>` : "";
        const rv = raw ? ` <span style="opacity:.65">(${names[i]} ${raw[i]})</span>` : "";
        return `<div>${bn} ${v} ${mark}${rv}</div>`;
      }).join("");
      const skills = (u.skills || []).map(k => {
        const sk = window.JW_DATA && window.JW_DATA.SKILLS ? window.JW_DATA.SKILLS[k] : null;
        return sk ? sk.name : k;
      });
      const st = Object.keys(u.status || {}).map(k => ({
        paralyzed: "麻痹", sealed: "穷计", confused: "混乱", poison: "中毒", fear: "怯", lost: "迷失",
      }[k] || k));
      const face = this.figureFor(u.pid != null ? u.pid : u.name) || this.faceFor(u.name);
      const panel = document.createElement("div");
      panel.className = "jw-panel";
      panel.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;padding:16px 20px;min-width:420px;background:linear-gradient(180deg,#241708,#1a0f06);border:2px solid var(--gold);color:#e8d5a3";
      panel.innerHTML = `
        <div style="display:flex;gap:14px">
          <div style="width:96px;height:96px;flex:0 0 96px;border:2px solid var(--gold-bright);background:#1a1208;overflow:hidden">${face || ""}</div>
          <div style="flex:1">
            <div style="font-size:18px;color:var(--gold-bright);font-weight:bold">${u.name}</div>
            <div style="opacity:.8;margin-top:2px">Lv ${u.lvl}　经验 ${u.exp != null ? u.exp : 0}/100　兵种 ${(R && R.className) ? R.className(u.clsId) : ("#" + (u.clsId != null ? u.clsId : "?"))}</div>
            <div style="margin-top:4px">HP ${u.hp}/${u.maxHp}　MP ${u.mp}/${u.maxMp}</div>
            <div style="margin-top:4px">${st.length ? "状态：" + st.join("、") : "状态：正常"}</div>
          </div>
        </div>
        <div style="display:flex;gap:18px;margin-top:10px">
          <div style="flex:1;line-height:1.7">${pairs}</div>
          <div style="flex:1;line-height:1.7">
            <div>武器：${itName(u.weapon)}</div>
            <div>防具：${itName(u.armor)}</div>
            <div>辅助：${itName(u.acc)}</div>
          </div>
        </div>
        <div style="margin-top:8px;opacity:.9;line-height:1.6">策略：${skills.length ? skills.join("、") : "（无）"}</div>
        <div style="text-align:center;margin-top:12px"><div class="jw-btn" data-close="1" style="display:inline-block;padding:4px 18px">关闭</div></div>`;
      document.body.appendChild(panel);
      panel.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-close]")) panel.remove();
      });
    }

    /* 围攻：选一个"旁边有可出手友军"的敌人 */
    showSiegeTargets(u) {
      const b = this.battle;
      const targets = b.units.filter(e => {
        if (!e.isAlive || e.faction === u.faction) return false;
        return b.siegeCandidates(u, e).length > 0;
      });
      if (!targets.length) { this.addLog("不能围攻该部队", "sys"); return; }
      const panel = document.createElement("div");
      panel.className = "jw-panel";
      panel.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;padding:14px 18px;background:linear-gradient(180deg,#241708,#1a0f06);border:2px solid var(--gold);color:#e8d5a3;min-width:260px";
      panel.innerHTML = `<div style="color:var(--gold-bright);margin-bottom:8px">围攻 · 选择目标</div>` +
        targets.map((t, i) => {
          const n = b.siegeCandidates(u, t).length;
          return `<div class="jw-btn" data-i="${i}" style="padding:4px 10px;margin:3px 0">${t.name}（HP ${t.hp}/${t.maxHp}，${n} 人围攻）</div>`;
        }).join("") +
        `<div class="jw-btn" data-i="-1" style="padding:4px 10px;margin:6px 0 0;opacity:.75">取消</div>`;
      document.body.appendChild(panel);
      panel.addEventListener("click", async (ev) => {
        const el = ev.target.closest("[data-i]");
        if (!el) return;
        const idx = +el.dataset.i;
        panel.remove();
        if (idx < 0) { this.mode = "select"; this.trySelect(u.x, u.y); return; }
        await b.siegeAttack(u, targets[idx]);
        if (this.scene && this.scene.refreshUnits) this.scene.refreshUnits();
        this.updateHUD();
        this.finishAction(u);
      });
    }

    /* 交给（与相邻友军交换装备）：先选人，再选武器/护具/辅助 */
    showHandOver(u) {
      const b = this.battle;
      const mates = b.units.filter(o => o !== u && o.isAlive && o.faction === u.faction
        && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) === 1);
      if (!mates.length) { this.addLog("附近没有可交换的友军。", "sys"); return; }
      const pick = (title, rows, onPick, onCancel) => {
        const panel = document.createElement("div");
        panel.className = "jw-panel";
        panel.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;padding:14px 18px;background:linear-gradient(180deg,#241708,#1a0f06);border:2px solid var(--gold);color:#e8d5a3;min-width:240px";
        panel.innerHTML = `<div style="color:var(--gold-bright);margin-bottom:8px">${title}</div>` +
          rows.map((r, i) => `<div class="jw-btn" data-i="${i}" style="padding:4px 10px;margin:3px 0">${r.text}</div>`).join("") +
          `<div class="jw-btn" data-i="-1" style="padding:4px 10px;margin:6px 0 0;opacity:.75">取消</div>`;
        document.body.appendChild(panel);
        panel.addEventListener("click", (ev) => {
          const el = ev.target.closest("[data-i]");
          if (!el) return;
          const idx = +el.dataset.i;
          panel.remove();
          if (idx < 0) { if (onCancel) onCancel(); return; }
          onPick(rows[idx]);
        });
      };
      pick("交给 · 选择对象", mates.map(m => ({ text: `${m.name}（${m.x},${m.y}）`, unit: m })), (row) => {
        const t = row.unit;
        const R = window.JW_REAL;
        const nm = (id) => (id != null && R.items[id]) ? R.items[id].name : "（空）";
        const slots = [
          { k: "weapon", label: "交换武器" },
          { k: "armor", label: "交换护具" },
          { k: "acc", label: "交换辅助装备" },
        ].map(s2 => ({ ...s2, text: `${s2.label}：${nm(u[s2.k])} ⇄ ${nm(t[s2.k])}` }));
        pick(`交给 ${t.name}`, slots, (r2) => {
          const k = r2.k;
          const a = u[k], c = t[k];
          if (a == null && c == null) { this.addLog("没有此项装备。", "sys"); return; }
          u[k] = c; t[k] = a;
          // 武器/防具影响攻防，需重算
          for (const x of [u, t]) {
            if (x.unitDef && x.unitDef.stats) {
              x.atk = x.unitDef.stats.atk + (x.weapon != null ? x.itemBonus(x.weapon) : 0);
              x.def = x.unitDef.stats.def + (x.armor != null ? x.itemBonus(x.armor) : 0);
            }
          }
          this.addLog(`${u.name} 与 ${t.name} 交换了${r2.label.replace("交换", "")}。`, "heal");
          if (this.scene && this.scene.refreshUnits) this.scene.refreshUnits();
          this.finishAction(u);
        }, () => { this.mode = "select"; this.trySelect(u.x, u.y); });
      }, () => { this.mode = "select"; this.trySelect(u.x, u.y); });
    }

    showAttackTargets(u) {
      // 原版：未移动时攻击范围 = 当前格 + 所有可达位置的攻击范围并集
      // （先移动再攻击；已移动则只显示当前格攻击范围）
      const all = [];
      let positions;
      if (!u.hasMoved) {
        const reach = this.battle.moveRange(u);
        positions = [{ x: u.x, y: u.y }, ...reach];
      } else {
        positions = [{ x: u.x, y: u.y }];
      }
      for (const p of positions) {
        for (const r of this.battle.attackRange(u, p.x, p.y)) {
          if (!all.find(a => a.x === r.x && a.y === r.y)) all.push(r);
        }
      }
      this._attackCells = all;
      this.showAttackRange(all);
    }

    showSkillMenu(u) {
      const menu = $("#command-menu");
      menu.classList.remove("hidden");
      const cp = this.scene ? this.scene.cellPx : this.cellPx;
      const ox = this.scene ? this.scene.originX : this.offsetX;
      const oy = this.scene ? this.scene.originY : this.offsetY;
      const px = ox + (u.x + 1) * cp + 6;
      const py = oy + u.y * cp + 4;
      menu.style.left = Math.min(px, this.battleScreen.clientWidth - 160) + "px";
      menu.style.top = Math.max(50, py) + "px";
      const list = u.availableSkills ? u.availableSkills(this.battle) : u.skills;
      menu.innerHTML = list.map(s => {
        const sk = D.SKILLS[s];
        const name = sk ? sk.name : s;
        const mp = sk ? sk.mp : 0;
        const dis = u.mp < mp ? "disabled" : "";
        return `<div class="cmd-item ${dis}" data-skill="${s}">${name} <span style="font-size:11px;opacity:0.7">${mp}MP</span></div>`;
      }).join("");
      menu.querySelectorAll(".cmd-item").forEach(el => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hideCommandMenu();
          this._skillId = el.dataset.skill;
          this._skillUnit = u;
          // 显示技能施放范围（§6.1 形状）
          const sk = D.SKILLS[this._skillId];
          if (sk) {
            const cells = this.battle.strategyCastRange(sk, u);
            this.showAttackRange(cells);
            this.mode = "skill";
          }
        });
      });
    }

    async tryMove(x, y) {
      const u = this._moveUnit;
      if (!u) return;
      const cells = this.battle.moveRange(u);
      const target = cells.find(c => c.x === x && c.y === y);
      if (!target) {
        /* 点了不可达格：若是另一个可行动己方单位 → 改选它；否则取消 */
        const c2 = this.battle.map.get(x, y);
        if (c2 && c2.unit && c2.unit.faction === "ally" && !c2.unit.hasActed && c2.unit !== u) { this.mode = "select"; this.trySelect(x, y); return; }
        this.cancelMode(); return;
      }
      /* 原版：单位沿格子逐格走过去（不是瞬移）。先从地图算出逐格路径，
       * 播完走路动画后再由引擎落位（保证地图占用/事件只在终点触发一次）。 */
      const map = this.battle.map;
      const path = (map && map.pathTo)
        ? (map.pathTo(u.x, u.y, x, y, u.effectiveMov || 99, u) || null)
        : null;
      if (path && path.length && this.scene && this.scene.walkAlongPath) {
        this._moving = true;
        this.clearOverlay();
        this.updateHUD();
        try {
          await this.scene.walkAlongPath(u, path);
        } finally {
          this._moving = false;
        }
      }
      this.battle.move(u, x, y);
      u.hasMoved = true;
      this.clearOverlay();
      this.showCursor(x, y);
      this.updateHUD();
      if (this.scene && this.scene.refreshUnits) this.scene.refreshUnits();
      // 移动后弹出指令菜单
      this.mode = "select";
      this.showCommandMenu(x, y, u);
    }

    async tryTarget(x, y) {
      const cell = this.battle.map.get(x, y);
      if (!cell || !cell.unit) return;
      const u = this._moveUnit;
      if (!u) return;
      const target = cell.unit;
      if (target.faction === "ally" || target.faction === "friend") { this.cancelMode(); return; }
      await this.battle.attack(u, target);
      /* 攻击命令（0x43dada）：目标倒下且攻击者带 引导攻击(46) → 立刻链击射程内下一目标；
       * 之后带 连续攻击(90)（攻击者存活且非乱/怯/迷）→ 再选一次目标；取消则结束。 */
      if (u.isAlive && this.battle.hasGuidedAttack(u)) {
        let g = this.battle.nextGuidedTarget(u);
        while (g) {
          this.addLog(`${u.name} 引导攻击 → ${g.name}`, "sys");
          await this.battle.attack(u, g);
          if (!u.isAlive || !this.battle.hasGuidedAttack(u)) break;
          g = this.battle.nextGuidedTarget(u);
        }
      }
      if (u.isAlive && this.battle.canContinuousAttack(u)) {
        const res = this.battle.checkWin();
        if (res && res.result) { this.emitAction("battle-end", res); return; }
        /* 弹目标选择（简化为菜单列出射程内敌人） */
        const foes = this.battle.enemies.filter(e => e.isAlive && this.battle.inRange(u, e));
        if (foes.length) {
          const ok = await this.pickTargetMenu(u, foes, "连续攻击 · 选择目标");
          if (ok) await this.battle.attack(u, ok);
        }
      }
      this.finishAction(u);
    }

    /* 简易目标列表（连续攻击用） */
    pickTargetMenu(u, foes, title) {
      return new Promise(resolve => {
        const panel = document.createElement("div");
        panel.style.cssText = "position:absolute;z-index:95;left:40%;top:30%;background:#241a10;color:#e8d9b0;border:2px solid #8a6a30;padding:8px;min-width:160px;font-size:14px";
        panel.innerHTML = `<div style="margin-bottom:6px;opacity:.8">${title}</div>` +
          foes.map((f, i) => `<div class="jw-btn" data-i="${i}" style="padding:4px 10px;margin:4px 0">${f.name}（${f.hp}/${f.maxHp}）</div>`).join("") +
          `<div class="jw-btn" data-i="-1" style="padding:4px 10px;margin:6px 0 0;opacity:.75">取消</div>`;
        document.body.appendChild(panel);
        panel.addEventListener("click", (ev) => {
          const el = ev.target.closest("[data-i]");
          if (!el) return;
          const idx = +el.dataset.i;
          panel.remove();
          resolve(idx < 0 ? null : foes[idx]);
        });
      });
    }

    async trySkillTarget(x, y) {
      const cell = this.battle.map.get(x, y);
      if (!cell || !cell.unit) return;
      const target = cell.unit;
      const u = this._skillUnit;
      const sk = D.SKILLS[this._skillId];
      if (!u || !sk) return;
      // 检查施放范围（§6.1 形状）
      const castCells = this.battle.strategyCastRange(sk, u);
      if (!castCells.find(p => p.x === x && p.y === y)) { this.cancelMode(); return; }
      // 区域收集（§6.2）
      let targets = [];
      if (sk.area === "all" || sk.areaCode > 0) {
        const area = this.battle.strategyArea(sk, u, { x, y });
        targets = area.map(p => this.battle.map.get(p.x, p.y)?.unit).filter(Boolean)
          .filter(t => {
            if (sk.target === "allies" || sk.side === 1) return t.faction === u.faction;
            return t.faction !== u.faction && t.faction !== "neutral";
          });
      } else {
        targets = [target];
      }
      if (!targets.length) return;
      await this.battle.castSkill(u, this._skillId, targets);
      this.finishAction(u);
    }

    // ---- 道具面板 ----
    showItemPanel(unit, onSelect) {
      const panel = $("#item-panel", this.battleScreen);
      panel.classList.remove("hidden");
      const R = window.JW_REAL;
      /* 可用道具 = 单位包 + 共用仓库里的消耗品（原版道具店是共用堆叠） */
      const app = window.JW && window.JW.App ? window.JW.App : null;
      const cnt = new Map();
      for (const id of (unit.bag || [])) cnt.set(id, (cnt.get(id) || 0) + 1);
      if (app && Array.isArray(app.warehouse)) {
        for (const e of app.warehouse) {
          if (!e || !R || !R.items[e.id]) continue;
          if ((R.items[e.id].type || 0) < 71) continue;   // 只列消耗品
          cnt.set(e.id, (cnt.get(e.id) || 0) + (e.count || 1));
        }
      }
      const items = [...cnt.keys()];
      if (!items.length) {
        panel.innerHTML = `<div class="item-row">（无道具）</div>`;
        const close = document.createElement("div");
        close.className = "cmd-item";
        close.textContent = "关闭";
        close.style.cursor = "pointer";
        close.addEventListener("click", () => { panel.classList.add("hidden"); onSelect(null); });
        panel.appendChild(close);
        return;
      }
      let html = "";
      for (const id of items) {
        const it = R && R.items ? R.items[id] : null;
        const name = it ? it.name : "道具#" + id;
        const n = cnt.get(id) || 1;
        html += `<div class="cmd-item item-row" data-item="${id}">${name}<span style="opacity:.7"> ×${n}</span></div>`;
      }
      html += `<div class="cmd-item item-row" data-item="close">关闭</div>`;
      panel.innerHTML = html;
      panel.querySelectorAll(".item-row").forEach(el => {
        el.addEventListener("click", () => {
          if (el.dataset.item === "close") { panel.classList.add("hidden"); onSelect(null); return; }
          panel.classList.add("hidden");
          onSelect(parseInt(el.dataset.item, 10));
        });
      });
      // 定位到单位附近
      this._positionPanel(panel, unit.x, unit.y);
    }
    closeItemPanel() { $("#item-panel", this.battleScreen).classList.add("hidden"); }
    beginItemTarget(unit, itemId, onTarget) {
      // 目标选择：己方单位在范围内（默认相邻 1）
      this.mode = "item";
      this._itemUnit = unit;
      this._itemId = itemId;
      this._itemCb = onTarget;
      const range = this.battle.itemUsableRange(itemId, unit);
      const cells = [];
      for (let dx = -range; dx <= range; dx++) for (let dy = -range; dy <= range; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= range && this.battle.map.inBounds(unit.x+dx, unit.y+dy)) {
          cells.push({ x: unit.x+dx, y: unit.y+dy });
        }
      }
      // 只显示己方单位格
      const own = cells.filter(c => { const u = this.battle.map.get(c.x, c.y)?.unit; return u && u.faction === unit.faction; });
      this.showAttackRange(cells);
      this.updateHUD();
    }
    _positionPanel(panel, x, y) {
      const cp = this.scene ? this.scene.cellPx : this.cellPx;
      const ox = this.scene ? this.scene.originX : this.offsetX;
      const oy = this.scene ? this.scene.originY : this.offsetY;
      panel.style.left = Math.min(ox + (x+1) * cp + 6, this.battleScreen.clientWidth - 200) + "px";
      panel.style.top = Math.max(50, oy + y * cp + 4) + "px";
      panel.style.position = "absolute";
    }
    // 道具目标点击
    _handleItemTarget(x, y) {
      const cell = this.battle.map.get(x, y);
      if (!cell || !cell.unit) return;
      const u = this._itemUnit;
      const itemId = this._itemId;
      const target = cell.unit;
      if (target.faction !== u.faction) { this.addLog("这是敌军部队。", "sys"); return; }
      if (this._itemCb) this._itemCb(target);
    }

    // 取消当前操作模式（ESC/点击空白），返回 select
    cancelMode() {
      if (this.mode === "move" || this.mode === "skill" || this.mode === "target" || this.mode === "item") {
        this.mode = "select";
        this.clearOverlay();
        if (this.selectedUnit) {
          this.showAttackRange(this.battle.attackRange(this.selectedUnit, this.selectedUnit.x, this.selectedUnit.y));
          this.showCommandMenu(this.selectedUnit.x, this.selectedUnit.y, this.selectedUnit);
        }
        this.updateHUD();
      }
    }

    /* 缩放控制 */
    zoomBy(factor) {
      if (!this.scene || !this.scene.zoomAt) return;
      const cv = this.scene.game && this.scene.game.canvas;
      const r = cv.getBoundingClientRect();
      const mx = r.width / 2, my = r.height / 2;
      this.scene.zoomAt(factor, mx, my);
    }
    resetZoom() {
      if (!this.scene) return;
      this.scene.zoom = 1;
      this.scene.panX = 0; this.scene.panY = 0;
      this.scene.recalcLayout();
      this.scene.redrawAll();
      this.scene.refreshUnits();
    }

    /* 战场对话立绘窗口（op 0x15 unit_say，原版在立绘窗口显示）*/
    showBattleSay(text, unit) {
      const battleScreen = $("#battle-screen");
      if (!battleScreen) return;
      let box = battleScreen.querySelector("#battle-say-box");
      if (!box) {
        box = document.createElement("div");
        box.id = "battle-say-box";
        box.className = "battle-say";     /* 样式在 theme.css：与剧情屏同款白气泡 */
        battleScreen.appendChild(box);
      }
      /* 原版战场对话同样是白底气泡：人名黑色加粗 + 黑色正文，不再用深色宣纸面板。
       * 第 10 轮定论：气泡左侧图 = Tou.dll 120×120 对话立绘（figure），不是 Face.e5
       * 小头像——FUN_0042cb6d→FUN_00407657(unitRec)→FUN_0040698d→LoadImageA(
       * figure+0x12d, DAT_00500ef5=Tou.dll)；武将情报窗 0x44cbf2 同源。 */
      const portrait = unit ? (this.figureFor(unit.pid != null ? unit.pid : unit.name) || this.faceFor(unit.name)) : "";
      const portraitHtml = portrait
        ? `<div class="bs-face">${portrait}</div>` : "";
      box.innerHTML = portraitHtml
        + `<div class="bs-body"><div class="bs-name">${unit ? unit.name : ""}</div>`
        + `<div class="bs-text">${String(text).replace(/\n/g, "<br>")}</div></div>`;
      box.style.opacity = "1";
      clearTimeout(this._sayTimer);
      this._sayTimer = setTimeout(() => { if (box) box.style.opacity = "0"; }, 3500);
    }

    /* ---- 决斗 UI ---- */
    showDuel(d) {
      this._duel = d;              // 决斗状态供 duelActions/duelResult 使用（之前未赋值 → 玩家恒为后手）
      this.showScreen("duel");
      const f1 = $("#duel-f1");
      const f2 = $("#duel-f2");
      f1.querySelector(".duel-name").textContent = d.u1.name;
      f2.querySelector(".duel-name").textContent = d.u2.name;
      this.duelUpdate(d);
      this.duelSay(`${d.u1.name} 对 ${d.u2.name}！`, null);
      this.duelActions();
    }
    duelUpdate(d) {
      const f1 = $("#duel-f1"), f2 = $("#duel-f2");
      const fill1 = f1.querySelector(".duel-hp-fill");
      const fill2 = f2.querySelector(".duel-hp-fill");
      fill1.style.width = (d.hp1 / d.u1.maxHp * 100) + "%";
      fill2.style.width = (d.hp2 / d.u2.maxHp * 100) + "%";
      f1.querySelector(".duel-hp-text").textContent = `HP ${d.hp1}/${d.u1.maxHp}`;
      f2.querySelector(".duel-hp-text").textContent = `HP ${d.hp2}/${d.u2.maxHp}`;
    }
    duelSay(text, unit) {
      const el = $("#duel-dialogue");
      if (el) el.innerHTML = `<b style="color:var(--gold-bright)">${unit ? unit.name : ""}</b>：${text}`;
    }
    duelActions() {
      const el = $("#duel-actions");
      if (!el) return;
      el.innerHTML = `
        <button class="jw-btn" data-duel="0">攻击</button>
        <button class="jw-btn" data-duel="1">防御</button>
        <button class="jw-btn" data-duel="2">绝技</button>
        <button class="jw-btn" data-duel="3">撤退</button>
      `;
      el.querySelectorAll("[data-duel]").forEach(btn => {
        btn.addEventListener("click", () => {
          const v = parseInt(btn.dataset.duel, 10);
          if (v === 3) { this.hideDuel(); return; }
          const side = this._duel && this._duel.turn === 1 ? 0 : 1;
          if (window.JW.App.duelAction) window.JW.App.duelAction(side, v);
        });
      });
    }
    duelNextTurn(turn) {
      const el = $("#duel-actions");
      if (el) el.innerHTML = `<div style="color:var(--gold-bright);text-align:center;padding:8px">${turn === 1 ? "先手" : "后手"}回合</div>`;
      setTimeout(() => this.duelActions(), 800);
    }
    duelResult(result, winnerSide) {
      const el = $("#duel-result");
      if (el) {
        const w = this._duel && (winnerSide === 0 ? this._duel.u1 : this._duel.u2);
        el.textContent = `${result}！${w ? w.name : ""} 获胜！`;
      }
      const acts = $("#duel-actions");
      if (acts) acts.innerHTML = `<button class="jw-btn jw-btn--primary" id="duel-close">结束</button>`;
      const btn = document.getElementById("duel-close");
      if (btn) btn.addEventListener("click", () => { if (window.JW.App.duelEnd) window.JW.App.duelEnd(); });
    }
    hideDuel() {
      const el = $("#duel-screen");
      if (el) el.classList.add("hidden");
      this.showScreen("battle");
    }

    // ---- 决斗演出（1:1 自动回放，无操作按钮）----
    duelCinematicBegin(u1, u2) {
      this.showScreen("duel");
      const f1 = $("#duel-f1"), f2 = $("#duel-f2");
      f1.querySelector(".duel-name").textContent = u1.name;
      f2.querySelector(".duel-name").textContent = u2.name;
      // 第 10 轮定论：原版决斗屏两侧图 = Tou.dll 120×120 对话立绘
      // （FUN_00443a0d 两侧各一缓存槽 DAT_00500f13/f27 → FUN_0040690c →
      //  FUN_0040698d LoadImageA(立绘号+0x12d, Tou.dll)），非 Face.e5 小头像。
      for (const [node, unit] of [[f1, u1], [f2, u2]]) {
        if (!node || !unit) continue;
        let pv = node.querySelector(".duel-portrait");
        if (!pv) {
          pv = document.createElement("div");
          pv.className = "duel-portrait";
          pv.style.cssText = "width:96px;height:120px;margin:0 auto 6px;display:flex;align-items:flex-end;justify-content:center";
          node.insertBefore(pv, node.firstChild);
        }
        pv.innerHTML = this.figureFor(unit.pid != null ? unit.pid : unit.name) || this.faceFor(unit.name) || "";
      }
      this._dcHp = [u1.maxHp, u2.maxHp];
      f1.querySelector(".duel-hp-fill").style.width = "100%";
      f2.querySelector(".duel-hp-fill").style.width = "100%";
      f1.querySelector(".duel-hp-text").textContent = "单挑";
      f2.querySelector(".duel-hp-text").textContent = "单挑";
      const el = $("#duel-dialogue");
      if (el) el.innerHTML = `<b style="color:var(--gold-bright)">${u1.name} VS ${u2.name}</b>`;
      const acts = $("#duel-actions");
      if (acts) acts.innerHTML = "";
      const res = $("#duel-result");
      if (res) res.textContent = "";
    }
    duelCinematicSay(text, unit) {
      const el = $("#duel-dialogue");
      if (el) el.innerHTML = `<b style="color:var(--gold-bright)">${unit ? unit.name : ""}</b>：${String(text).replace(/\n/g, "<br>")}`;
    }
    /* 决斗动作：用原版 Unit_atk 图集（12 帧 × 64×64）在角色框内逐帧播放。
     * 加载失败时静默跳过，不影响决斗流程。 */
    _duelAtkCache = null;

    async duelPlayAtk(side, unit) {
      const host = side === 0 ? document.querySelector("#duel-f2") : document.querySelector("#duel-f1");
      if (!host || !unit || unit.spriteIdx == null) return;
      const idx = unit.spriteIdx;
      this._duelAtkCache = this._duelAtkCache || {};
      const url = `assets/units/atk_${idx}.png`;
      let img = this._duelAtkCache[url];
      if (!img) {
        img = await new Promise((res) => {
          const im = new Image();
          im.onload = () => res(im); im.onerror = () => res(null);
          im.src = url;
        });
        if (!img) return;
        this._duelAtkCache[url] = img;
      }
      let cv = host.querySelector(".duel-anim");
      if (!cv) {
        cv = document.createElement("canvas");
        cv.className = "duel-anim";
        cv.width = 64; cv.height = 64;
        cv.style.cssText = "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:128px;height:128px;image-rendering:pixelated;pointer-events:none";
        host.style.position = "relative";
        host.appendChild(cv);
      }
      const g = cv.getContext("2d");
      cv.style.display = "block";
      for (let f = 0; f < 12; f++) {
        if (!cv.isConnected) break;
        g.clearRect(0, 0, 64, 64);
        g.drawImage(img, 0, f * 64, 64, 64, 0, 0, 64, 64);
        await new Promise(r => setTimeout(r, 70));
      }
      if (cv.isConnected) cv.style.display = "none";
    }

    duelCinematicHit(side, dmg, hp1, hp2) {
      const f1 = $("#duel-f1"), f2 = $("#duel-f2");
      const w1 = Math.max(0, hp1 / this._dcHp[0] * 100), w2 = Math.max(0, hp2 / this._dcHp[1] * 100);
      f1.querySelector(".duel-hp-fill").style.width = w1 + "%";
      f2.querySelector(".duel-hp-fill").style.width = w2 + "%";
      const el = side === 0 ? f2 : f1;
      el.style.transition = "none"; el.style.filter = "brightness(2.2) saturate(2)";
      setTimeout(() => { el.style.transition = "filter .3s"; el.style.filter = ""; }, 60);
      const el2 = $("#duel-dialogue");
      if (el2) el2.innerHTML = `<span style="color:#e8d5a3">⚔ 命中 <b style="color:#c86a5a">-${dmg}</b></span>`;
    }
    duelCinematicFlash(side) {
      const el = side === 0 ? $("#duel-f2") : $("#duel-f1");
      if (el) { el.style.filter = "brightness(3)"; setTimeout(() => { el.style.filter = ""; }, 300); }
    }
    duelCinematicEnd() {
      this.hideDuel();
    }
    /* 中断演出：只收起决斗层，不切换当前屏幕。
     * 战斗已结束（结果界面/下一章已接管）时不能用 hideDuel，那会强切回 battle。 */
    duelCinematicAbort() {
      const el = $("#duel-screen");
      if (el) el.classList.add("hidden");
      const acts = $("#duel-actions");
      if (acts) acts.innerHTML = "";
    }

    /* ---- 战前准备 UI ---- */
    showPreBattlePrep(chapter, onConfirm) {
      const screen = this.root;
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;inset:0;z-index:90;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center";
      const heroes = window.JW_HEROES || [];
      const party = heroes.filter(h => h.faction !== "enemy").slice(0, 10);
      panel.innerHTML = `
        <div class="jw-panel" style="padding:20px;min-width:400px;max-width:600px">
          <div style="font-size:20px;color:var(--gold-bright);margin-bottom:16px;text-align:center">战前准备 · 选择出场武将</div>
          <div class="prep-list" style="max-height:300px;overflow-y:auto"></div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="jw-btn jw-btn--primary" id="prep-confirm">出征</button>
            <button class="jw-btn" id="prep-cancel">取消</button>
          </div>
        </div>
      `;
      const list = panel.querySelector(".prep-list");
      for (const h of party) {
        const row = document.createElement("div");
        row.style.cssText = "padding:8px;border-bottom:1px dashed rgba(184,134,11,0.2);cursor:pointer;display:flex;justify-content:space-between";
        row.innerHTML = `<span>${h.name} <span style="font-size:12px;color:var(--ink-faint)">Lv${h.lv||1}</span></span><span style="font-size:12px;color:var(--ink-faint)">HP ${h.hp||0} ATK ${h.atk||0}</span>`;
        row.addEventListener("click", () => { row.style.background = row.style.background ? "" : "rgba(184,134,11,0.15)"; });
        list.appendChild(row);
      }
      screen.appendChild(panel);
      panel.querySelector("#prep-cancel").addEventListener("click", () => panel.remove());
      panel.querySelector("#prep-confirm").addEventListener("click", () => {
        panel.remove();
        if (onConfirm) onConfirm([]);
      });
    }

    /* ---- 战场缩小图 ---- */
    showMinimap() {
      if (!this.scene || !this.battle) return;
      const b = this.battle;
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:55;border:1px solid var(--gold);background:rgba(20,14,8,0.9);padding:4px;border-radius:4px";
      const scale = Math.min(120 / b.map.w, 80 / b.map.h);
      const mw = b.map.w * scale, mh = b.map.h * scale;
      panel.innerHTML = `<canvas width="${mw}" height="${mh}" style="image-rendering:pixelated"></canvas>`;
      const cv = panel.querySelector("canvas");
      const ctx = cv.getContext("2d");
      for (let y = 0; y < b.map.h; y++) {
        for (let x = 0; x < b.map.w; x++) {
          ctx.fillStyle = b.map.terrain(x, y)?.color || "#999";
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
      for (const u of b.units) {
        if (!u.isAlive) continue;
        ctx.fillStyle = u.faction === "ally" ? "#2f6b46" : u.faction === "friend" ? "#2f5a6b" : "#6b2f2f";
        ctx.fillRect(u.x * scale, u.y * scale, scale, scale);
      }
      this.root.appendChild(panel);
      this._minimap = panel;
    }
    hideMinimap() {
      if (this._minimap) { this._minimap.remove(); this._minimap = null; }
    }
    toggleMinimap() {
      if (this._minimap) this.hideMinimap();
      else this.showMinimap();
    }

    /* ---- 出阵界面（原版手动选人；仅在该战没有固定我方名单时出现）---- */
    showSortie(app, onConfirm) {
      const R = window.JW_REAL;
      const old = document.getElementById("sortie-panel");
      if (old) old.remove();
      const picks = new Set((app._autoDeployed || []).slice(0, 6));
      const roster = Object.keys(app.roster || {}).map(k => ({ pid: parseInt(k, 10), ...(app.roster[k] || {}) }));
      // 姜维恒在列；其余按等级降序
      const persons = (R && R.persons) || [];
      const list = roster
        .map(r => ({ pid: r.pid, lvl: r.lvl || 1, name: (persons[r.pid] || {}).name || ("人物" + r.pid) }))
        .sort((a, b) => (a.pid === 0 ? -1 : b.pid === 0 ? 1 : b.lvl - a.lvl))
        .slice(0, 40);
      const panel = document.createElement("div");
      panel.id = "sortie-panel";
      panel.style.cssText = "position:fixed;inset:0;z-index:112;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center";
      const render = () => {
        panel.innerHTML = `
          <div class="jw-panel" style="padding:16px;min-width:620px;max-height:84vh;overflow:auto;background:linear-gradient(180deg,#241708,#1a0f06);border:2px solid var(--gold);color:#e8d5a3">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="font-size:20px;color:var(--gold-bright)">出 阵</div>
              <div style="color:#9a8a6a;font-size:13px">选择出阵武将（最多 6 名，已选 ${picks.size}）</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              ${list.map(r => `
                <div class="sortie-card" data-pid="${r.pid}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border:1px solid ${picks.has(r.pid) ? "var(--gold-bright)" : "rgba(224,180,82,.3)"};border-radius:4px;${picks.has(r.pid) ? "background:rgba(224,180,82,.14)" : ""}">
                  <div style="width:34px;height:42px;overflow:hidden;flex:none">${this.faceFor(r.name) || ""}</div>
                  <div style="min-width:0">
                    <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
                    <div style="font-size:11px;color:#9a8a6a">Lv ${r.lvl}</div>
                  </div>
                </div>`).join("")}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
              <button class="jw-btn" data-cancel="1">取消</button>
              <button class="jw-btn jw-btn--primary" data-ok="1" ${picks.size ? "" : "disabled"}>出 征</button>
            </div>
          </div>`;
        panel.querySelectorAll(".sortie-card").forEach(el => el.addEventListener("click", () => {
          const pid = parseInt(el.dataset.pid, 10);
          if (picks.has(pid)) picks.delete(pid);
          else if (picks.size < 6) picks.add(pid);
          render();
        }));
        panel.querySelector("[data-cancel]").addEventListener("click", () => panel.remove());
        panel.querySelector("[data-ok]").addEventListener("click", () => {
          panel.remove();
          if (onConfirm) onConfirm([...picks]);
        });
      };
      render();
      document.body.appendChild(panel);
    }

    /* ---- 多槽存档/读档界面（原版多存档位；3 槽，显示章节/回合/时间/金币）---- */
    showSaveLoad(app, mode) {
      const old = document.getElementById("save-panel");
      if (old) old.remove();
      const panel = document.createElement("div");
      panel.id = "save-panel";
      panel.style.cssText = "position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center";
      const slots = app.listSaveSlots();
      const fmt = (t) => {
        if (!t) return "";
        const d = new Date(t);
        const p2 = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
      };
      const title = mode === "save" ? "存 档" : "读 档";
      panel.innerHTML = `
        <div class="jw-panel" style="padding:18px;min-width:520px;background:linear-gradient(180deg,#241708,#1a0f06);border:2px solid var(--gold);color:#e8d5a3">
          <div style="font-size:20px;color:var(--gold-bright);margin-bottom:12px">${title}</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${slots.map(s => `
              <div class="save-slot" data-slot="${s.slot}" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(224,180,82,.45);border-radius:4px;cursor:pointer;${s.empty ? "opacity:.62" : ""}">
                <div style="width:34px;text-align:center;font-size:18px;color:var(--gold-bright)">${s.slot}</div>
                <div style="flex:1;font-size:14px;line-height:1.4">
                  ${s.empty
                    ? `<div style="color:#9a8a6a">— 空 —</div>`
                    : `<div>${s.chapterTitle || "（未知章节）"}${s.round ? ` · 第 ${s.round} 回合` : ""}</div>
                       <div style="font-size:12px;color:#9a8a6a">${fmt(s.time)} · 金 ${s.gold}</div>`}
                </div>
                ${(!s.empty && mode === "save") ? `<button class="jw-btn jw-btn--sm" data-del="${s.slot}">删除</button>` : ""}
              </div>`).join("")}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
            <button class="jw-btn" data-close="1">返回</button>
          </div>
        </div>`;
      document.body.appendChild(panel);

      panel.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => panel.remove()));
      panel.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        app.deleteSaveSlot(parseInt(b.dataset.del, 10));
        panel.remove();
        this.showSaveLoad(app, mode);
      }));
      panel.querySelectorAll(".save-slot").forEach(el => el.addEventListener("click", () => {
        const slot = parseInt(el.dataset.slot, 10);
        if (mode === "save") {
          if (!app.saveGameTo(slot)) { this.addLog("存档失败（存储已满或被禁用）", "sys"); panel.remove(); return; }
          this.addLog(`已存入 ${slot} 号存档`, "sys");
          panel.remove();
          this.showSaveLoad(app, "save");
        } else {
          const list = app.listSaveSlots();
          const rec = list.find(x => x.slot === slot);
          if (!rec || rec.empty) { this.addLog(`${slot} 号存档为空`, "sys"); return; }
          panel.remove();
          if (app.loadGameFrom(slot)) this.addLog(`已读取 ${slot} 号存档`, "sys");
        }
      }));
    }

    /* ---- 商店 UI（1:1 §13.2：商人窗 456×120 + 买进/卖出 + 武器店/道具店页签 + 列 + 数量输入）---- */
    showTown(app, onSortie) {
      // 城镇工具栏：卖出(329) 买进(327) 装备(328) 出征 —— 原版从右往左排
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center";
      panel.innerHTML = `
        <div class="jw-panel" style="padding:18px;width:min(760px,calc(100vw - 20px));min-width:0;max-height:86vh;overflow:auto;background:linear-gradient(180deg,#241708,#1a0f06);border:2px solid var(--gold);color:#e8d5a3" id="town-root">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
            <div style="font-size:20px;color:var(--gold-bright)">战前准备 · ${app.merchantName()}的营帐</div>
            <div style="flex:1"></div>
            <div style="color:#e8d5a3;font-size:14px">现金 <b style="color:var(--gold-bright)">${app.gold}</b></div>
          </div>
          <div id="town-body"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
            <button class="jw-btn" data-t="sell">卖出</button>
            <button class="jw-btn" data-t="buy">买进</button>
            <button class="jw-btn" data-t="equip">装备</button>
            <button class="jw-btn jw-btn--primary" data-t="sortie">出 征</button>
          </div>
        </div>`;
      const body = panel.querySelector("#town-body");
      const render = (tab) => {
        if (tab === "buy") this._townBuyTab(app, body, panel);
        else if (tab === "sell") this._townSellTab(app, body, panel);
        else if (tab === "equip") this._townEquipTab(app, body, panel);
        else this._townIntro(app, body);
      };
      panel.querySelectorAll("[data-t]").forEach(btn => btn.addEventListener("click", () => {
        const t = btn.dataset.t;
        if (t === "sortie") { panel.remove(); if (onSortie) onSortie(); return; }
        render(t);
      }));
      render(null);
      document.body.appendChild(panel);
      this._townPanel = panel;
    }
    _townIntro(app, body) {
      const face = app.merchantName();
      body.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:120px;height:120px;background:rgba(0,0,0,.35);border:1px solid var(--gold);border-radius:4px;overflow:hidden;flex:none">${this.faceFor(face) || ""}</div>
          <div style="color:#e8d5a3;font-size:15px;line-height:1.8">
            <b style="color:var(--gold-bright)">${face}</b>：「要买点什么吗？现金不足的话，<br>也可以先把仓库里的东西卖给我。」<br>
            <span style="color:#b8a67e;font-size:13px">点下方按钮进入 买进 / 卖出 / 装备。</span>
          </div>
        </div>`;
    }
    _townBuyTab(app, body, panel) {
      const R = window.JW_REAL;
      const rec = app.shopRec();
      const rows = [...rec.wp.map(id => ({ id, tab: "武器店" })), ...rec.it.map(id => ({ id, tab: "道具店" }))];
      const goldEl = panel.querySelector("div b");
      body.innerHTML = `
        <div style="color:var(--gold);font-size:13px;margin-bottom:6px">${app.merchantName()}：「这些都是上好的货物。」（现金 <b class="town-gold">${app.gold}</b>）</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="color:var(--gold-bright);border-bottom:1px solid var(--gold)">
            <th style="text-align:left;padding:4px">名称</th><th style="padding:4px">属性</th><th style="padding:4px">库存</th><th style="padding:4px">价格</th><th style="padding:4px">买进</th>
          </tr>
          ${rows.map(r => {
            const it = R.items[r.id]; if (!it) return "";
            const price = app.buyPrice(it);
            const stock = it.type >= 71 ? (99 - app.whCount(it.id)) : (app.warehouse.length < 255 ? 1 : 0);
            return `<tr style="border-bottom:1px dashed rgba(184,134,11,.2)">
              <td style="padding:4px">${it.name}${it.uniq ? ' <span style="color:#c86a5a">秘宝</span>' : ""}</td>
              <td style="padding:4px;text-align:center">${r.tab}</td>
              <td style="padding:4px;text-align:center">${stock}</td>
              <td style="padding:4px;text-align:center;color:var(--gold-bright)">${price}</td>
              <td style="padding:4px;text-align:center">
                <button class="jw-btn jw-btn--sm" data-buy="${it.id}" data-n="1">×1</button>
                ${it.type >= 71 ? `<button class="jw-btn jw-btn--sm" data-buy="${it.id}" data-n="5">×5</button>
                <button class="jw-btn jw-btn--sm" data-buy="${it.id}" data-n="10">×10</button>
                <button class="jw-btn jw-btn--sm" data-buy="${it.id}" data-n="max">最大</button>` : ""}
              </td>
            </tr>`;
          }).join("")}
        </table>`;
      body.querySelectorAll("[data-buy]").forEach(btn => btn.addEventListener("click", () => {
        const id = +btn.dataset.buy;
        const it = R.items[id];
        const unit = app.buyPrice(it);
        const max = it.type >= 71 ? Math.min(99 - app.whCount(id), Math.floor(app.gold / unit)) : 1;
        let count = 1;
        if (it.type >= 71) {
          if (max <= 0) {
            app.ui.addLog(99 - app.whCount(id) <= 0 ? `仓库里还有很多${it.name}。\n没有必要再买。` : "金币不足。", "sys");
            return;
          }
          const want = btn.dataset.n;
          count = want === "max" ? max : Math.max(1, Math.min(max, parseInt(want, 10) || 1));
        }
        const res = app.buyItem(id, count);
        app.ui.addLog(res.msg, res.ok ? "heal" : "sys");
        this._townBuyTab(app, body, panel);
      }));
    }
    _townSellTab(app, body, panel) {
      const R = window.JW_REAL;
      body.innerHTML = `
        <div style="color:var(--gold);font-size:13px;margin-bottom:6px">${app.merchantName()}：「好东西我就收。」（现金 <b class="town-gold">${app.gold}</b>）</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="color:var(--gold-bright);border-bottom:1px solid var(--gold)">
            <th style="text-align:left;padding:4px">名称</th><th style="padding:4px">库存</th><th style="padding:4px">卖价</th><th style="padding:4px">卖出</th>
          </tr>
          ${(app.warehouse.length ? app.warehouse : []).map(e => {
            const it = R.items[e.id]; if (!it) return "";
            const sp = app.sellPrice(e);
            return `<tr style="border-bottom:1px dashed rgba(184,134,11,.2)">
              <td style="padding:4px">${it.name}${e.lv ? ' Lv.' + e.lv : ""}</td>
              <td style="padding:4px;text-align:center">${e.count}</td>
              <td style="padding:4px;text-align:center;color:var(--gold-bright)">${sp < 0 ? "---" : sp}</td>
              <td style="padding:4px;text-align:center"><button class="jw-btn jw-btn--sm" data-sell="${e.id}">卖</button></td>
            </tr>`;
          }).join("") || `<tr><td colspan="4" style="padding:14px;text-align:center;color:var(--ink-faint)">仓库是空的。</td></tr>`}
        </table>`;
      body.querySelectorAll("[data-sell]").forEach(btn => btn.addEventListener("click", () => {
        const id = +btn.dataset.sell;
        const res = app.sellItem(id, 1);
        app.ui.addLog(res.msg, res.ok ? "heal" : "sys");
        this._townSellTab(app, body, panel);
      }));
    }
    _townEquipTab(app, body, panel) {
      const R = window.JW_REAL;
      body.innerHTML = `
        <div style="color:var(--gold);font-size:13px;margin-bottom:6px">装备：点武将 → 从仓库三槽换装（与战场菜单「装备」同一面板）。</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${(app.battle ? app.battle.units.filter(u => u.faction !== "enemy" && u.x >= 0 && u.isAlive) : []).map(u =>
            `<button class="jw-btn" data-pick="${u.pid}">${u.name}<br><span style="font-size:11px;opacity:.8">武${u.weapon != null ? R.items[u.weapon].name : "空"}｜防${u.armor != null ? R.items[u.armor].name : "空"}</span></button>`
          ).join("") || '<span style="color:var(--ink-faint)">（战斗未开始：装备将在开战后可用）</span>'}
        </div>`;
      body.querySelectorAll("[data-pick]").forEach(btn => btn.addEventListener("click", () => {
        app._equipSel = +btn.dataset.pick;
        app.showEquipPanel();
      }));
    }
    closeTown() { if (this._townPanel) { this._townPanel.remove(); this._townPanel = null; } }

    /* ---- 战前准备 UI ---- */
    showPreBattlePrep(chapter, onConfirm) {
      const screen = this.root;
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;inset:0;z-index:90;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center";
      const heroes = window.JW_HEROES || [];
      const party = heroes.filter(h => h.faction !== "enemy").slice(0, 10);
      panel.innerHTML = `
        <div class="jw-panel" style="padding:20px;min-width:400px;max-width:600px">
          <div style="font-size:20px;color:var(--gold-bright);margin-bottom:16px;text-align:center">战前准备 · 选择出场武将</div>
          <div class="prep-list" style="max-height:300px;overflow-y:auto"></div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="jw-btn jw-btn--primary" id="prep-confirm">出征</button>
            <button class="jw-btn" id="prep-cancel">取消</button>
          </div>
        </div>
      `;
      const list = panel.querySelector(".prep-list");
      for (const h of party) {
        const row = document.createElement("div");
        row.style.cssText = "padding:8px;border-bottom:1px dashed rgba(184,134,11,0.2);cursor:pointer;display:flex;justify-content:space-between";
        row.innerHTML = `<span>${h.name} <span style="font-size:12px;color:var(--ink-faint)">Lv${h.lv||1}</span></span><span style="font-size:12px;color:var(--ink-faint)">HP ${h.hp||0} ATK ${h.atk||0}</span>`;
        row.addEventListener("click", () => { row.style.background = row.style.background ? "" : "rgba(184,134,11,0.15)"; });
        list.appendChild(row);
      }
      screen.appendChild(panel);
      panel.querySelector("#prep-cancel").addEventListener("click", () => panel.remove());
      panel.querySelector("#prep-confirm").addEventListener("click", () => {
        panel.remove();
        if (onConfirm) onConfirm([]);
      });
    }

    /* ---- 战场缩小图 ---- */
    showMinimap() {
      if (!this.scene || !this.battle) return;
      const b = this.battle;
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:55;border:1px solid var(--gold);background:rgba(20,14,8,0.9);padding:4px;border-radius:4px";
      const scale = Math.min(120 / b.map.w, 80 / b.map.h);
      const mw = b.map.w * scale, mh = b.map.h * scale;
      panel.innerHTML = `<canvas width="${mw}" height="${mh}" style="image-rendering:pixelated"></canvas>`;
      const cv = panel.querySelector("canvas");
      const ctx = cv.getContext("2d");
      for (let y = 0; y < b.map.h; y++) {
        for (let x = 0; x < b.map.w; x++) {
          ctx.fillStyle = b.map.terrain(x, y)?.color || "#999";
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
      for (const u of b.units) {
        if (!u.isAlive) continue;
        ctx.fillStyle = u.faction === "ally" ? "#2f6b46" : u.faction === "friend" ? "#2f5a6b" : "#6b2f2f";
        ctx.fillRect(u.x * scale, u.y * scale, scale, scale);
      }
      this.root.appendChild(panel);
      this._minimap = panel;
    }
    hideMinimap() {
      if (this._minimap) { this._minimap.remove(); this._minimap = null; }
    }
    toggleMinimap() {
      if (this._minimap) this.hideMinimap();
      else this.showMinimap();
    }

    /* ---- 商店 UI ---- */
    showShop(app, onAction) {
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;inset:0;z-index:95;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center";
      const R = window.JW_REAL;
      const items = (R && R.items ? R.items : []).filter(it => it.type >= 18 && it.type <= 80);
      panel.innerHTML = `
        <div class="jw-panel" style="padding:20px;width:min(700px,calc(100vw - 20px));min-width:0;max-height:80vh;overflow-y:auto">
          <div style="font-size:20px;color:var(--gold-bright);margin-bottom:16px;text-align:center">商店</div>
          <div style="margin-bottom:8px">金币: <b style="color:var(--gold-bright)">${app.gold}</b></div>
          <div class="shop-list" style="max-height:400px;overflow-y:auto"></div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="jw-btn jw-btn--primary" id="shop-close">关闭</button>
            <button class="jw-btn" id="shop-warehouse">仓库</button>
          </div>
        </div>
      `;
      const list = panel.querySelector(".shop-list");
      for (const it of items) {
        const price = Math.floor((it.price || 0) * 1.0);
        const row = document.createElement("div");
        row.style.cssText = "padding:8px;border-bottom:1px dashed rgba(184,134,11,0.2);display:flex;justify-content:space-between;align-items:center";
        row.innerHTML = `<span>${it.name} <span style="font-size:12px;color:var(--ink-faint)">${it.type>=71?'消耗品':'装备'}</span></span><span style="font-size:12px;color:var(--gold-bright)">${price}金</span>`;
        const btn = document.createElement("button");
        btn.className = "jw-btn jw-btn--sm";
        btn.textContent = "买进";
        btn.style.marginLeft = "8px";
        btn.addEventListener("click", () => {
          const res = app.buyItem(it.id, price, 1);
          this.addLog(res.msg, res.ok ? "heal" : "sys");
          if (res.ok) this.showShop(app, onAction);
        });
        row.appendChild(btn);
        list.appendChild(row);
      }
      panel.querySelector("#shop-close").addEventListener("click", () => panel.remove());
      panel.querySelector("#shop-warehouse").addEventListener("click", () => {
        panel.remove();
        app.showWarehouse();
      });
      this.root.appendChild(panel);
    }
    showWarehouse(warehouse, onAction) {
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;inset:0;z-index:95;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center";
      const R = window.JW_REAL;
      panel.innerHTML = `
        <div class="jw-panel" style="padding:20px;min-width:400px;max-width:600px;max-height:80vh;overflow-y:auto">
          <div style="font-size:20px;color:var(--gold-bright);margin-bottom:16px;text-align:center">仓库 (${warehouse.length}/255)</div>
          <div class="wh-list" style="max-height:400px;overflow-y:auto"></div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="jw-btn jw-btn--primary" id="wh-close">关闭</button>
          </div>
        </div>
      `;
      const list = panel.querySelector(".wh-list");
      if (warehouse.length === 0) {
        list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--ink-faint)">仓库为空</div>`;
      } else {
        for (const id of warehouse) {
          const it = R && R.items ? R.items[id] : null;
          if (!it) continue;
          const row = document.createElement("div");
          row.style.cssText = "padding:8px;border-bottom:1px dashed rgba(184,134,11,0.2);display:flex;justify-content:space-between;align-items:center";
          row.innerHTML = `<span>${it.name}</span>`;
          const btn = document.createElement("button");
          btn.className = "jw-btn jw-btn--sm";
          btn.textContent = "卖出";
          btn.style.marginLeft = "8px";
          btn.addEventListener("click", () => {
            if (onAction) onAction("sell", { itemId: id });
          });
          row.appendChild(btn);
          list.appendChild(row);
        }
      }
      panel.querySelector("#wh-close").addEventListener("click", () => panel.remove());
      this.root.appendChild(panel);
    }

    /* ---- 环境设定 UI ---- */
    showSettings(settings, onChange) {
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;inset:0;z-index:95;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center";
      panel.innerHTML = `
        <div class="jw-panel" style="padding:20px;min-width:400px">
          <div style="font-size:20px;color:var(--gold-bright);margin-bottom:16px;text-align:center">环境设定</div>
          <div class="setting-row" style="padding:6px 0;display:flex;justify-content:space-between;align-items:center">
            <span>背景音乐</span>
            <input type="checkbox" data-key="bgm" ${settings.bgm?"checked":""}>
          </div>
          <div class="setting-row" style="padding:6px 0;display:flex;justify-content:space-between;align-items:center">
            <span>音效</span>
            <input type="checkbox" data-key="se" ${settings.se?"checked":""}>
          </div>
          <div class="setting-row" style="padding:6px 0;display:flex;justify-content:space-between;align-items:center">
            <span>自动显示战场缩小图</span>
            <input type="checkbox" data-key="minimap" ${settings.minimap?"checked":""}>
          </div>
          <div class="setting-row" style="padding:6px 0;display:flex;justify-content:space-between;align-items:center">
            <span>讯息显示速度</span>
            <select data-key="msgSpeed">
              <option value="0" ${settings.msgSpeed===0?"selected":""}>快</option>
              <option value="1" ${settings.msgSpeed===1?"selected":""}>普通</option>
              <option value="2" ${settings.msgSpeed===2?"selected":""}>慢</option>
            </select>
          </div>
          <div class="setting-row" style="padding:6px 0;display:flex;justify-content:space-between;align-items:center">
            <span>武将移动速度</span>
            <select data-key="moveSpeed">
              <option value="0" ${settings.moveSpeed===0?"selected":""}>快</option>
              <option value="1" ${settings.moveSpeed===1?"selected":""}>普通</option>
              <option value="2" ${settings.moveSpeed===2?"selected":""}>慢</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="jw-btn jw-btn--primary" id="set-close">确定</button>
          </div>
        </div>
      `;
      panel.querySelectorAll("[data-key]").forEach(el => {
        el.addEventListener("change", () => {
          const key = el.dataset.key;
          const val = el.type === "checkbox" ? el.checked : parseInt(el.value, 10);
          if (onChange) onChange(key, val);
        });
      });
      panel.querySelector("#set-close").addEventListener("click", () => panel.remove());
      this.root.appendChild(panel);
    }

    /* ---- 奖励 UI ---- */
    showRewards(gold, kills) {
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;inset:0;z-index:95;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center";
      panel.innerHTML = `
        <div class="jw-panel" style="padding:24px;min-width:300px;text-align:center">
          <div style="font-size:24px;color:var(--gold-bright);margin-bottom:16px">作战结束</div>
          <div class="reward-row" style="padding:6px 0">酬金: <b style="color:var(--gold-bright)">${gold}</b></div>
          <div class="reward-row" style="padding:6px 0">击杀敌军: <b>${kills}</b></div>
          <button class="jw-btn jw-btn--primary" id="reward-close" style="margin-top:16px">确定</button>
        </div>
      `;
      panel.querySelector("#reward-close").addEventListener("click", () => panel.remove());
      this.root.appendChild(panel);
    }

    finishAction(u) {
      u.hasActed = true;
      this.mode = "idle";
      this.selectedUnit = null;
      this.clearOverlay();
      this.updateHUD();
      // 检查胜利
      const res = this.battle.checkWin();
      if (res && res.result) {
        this.emitAction("battle-end", res);
        return;
      }
      /* 再移动（effect 82，0x4d27a0）：指令完成后清标记，可再移动一次。
       * 原版一次行动只触发一次再移动（再移动后的指令直接结束回合），用 _removed 防循环。 */
      if (!u._removed && this.battle.removable && this.battle.removable(u)) {
        u._removed = true;
        this.addLog(`${u.name}：再移动`, "sys");
        const moveCells = this.battle.moveRange(u);
        if (moveCells.length) {
          this._moveUnit = u;
          this.selectedUnit = u;
          this.engine && this.engine.markClicked && this.engine.markClicked(u);
          this.mode = "move";
          this.showMoveRange(moveCells);
          this.updateHUD();
        }
      }
    }

    // ---- 浮字特效 ----
    floatText(x, y, text, cls) {
      if (this.scene && this.scene.floatText) { this.scene.floatText(x, y, text, cls); return; }
      const layer = $("#fx-layer");
      const el = document.createElement("div");
      el.className = "fx-float " + cls;
      el.textContent = text;
      const cp = this.scene ? this.scene.cellPx : this.cellPx;
      const ox = this.scene ? this.scene.originX : this.offsetX;
      const oy = this.scene ? this.scene.originY : this.offsetY;
      const px = ox + x * cp + cp / 2;
      const py = oy + y * cp + cp / 2;
      el.style.left = px + "px"; el.style.top = py + "px";
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }

    /* 原版战斗界面**没有**日志面板（回合数在顶栏、战况靠画面与对话框表达）。
     * 旧实现把 engine 的 logEntry 直接铺在右上角，连「地形变化: (15,11) 23 → 26」
     * 这类内部事件都显示出来，遮住战场。这里保留日志数据（调试用），但不渲染。 */
    addLog(msg, type) {
      if (!this.battleLog) this.battleLog = [];
      this.battleLog.push({ msg, type: type || "sys" });
      if (this.battleLog.length > 200) this.battleLog.shift();
      const panel = document.getElementById("log-panel");
      if (panel) panel.style.display = "none";
    }

    // 终章结局演出（原版 screen_mode → GHAI #6 致谢画面）
    showEnding() {
      const el = document.createElement("div");
      el.id = "ending-screen";
      el.style.cssText = "position:fixed;inset:0;z-index:200;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;animation:tcIn 1.2s ease-out";
      el.innerHTML = `
        <div style="font-family:'KaiTi','STKaiti',serif;font-size:52px;letter-spacing:16px;color:#e8d5a3;text-shadow:0 0 30px rgba(224,180,82,.45)">汉室余晖</div>
        <div style="font-family:'KaiTi','STKaiti',serif;font-size:22px;letter-spacing:6px;color:#caa96a">—— 全 程 作 战 结 束 ——</div>
        <div style="font-family:'KaiTi','STKaiti',serif;font-size:18px;letter-spacing:4px;color:#b8a67e;margin-top:10px">恭 贺 您 实 现 统 一 大 业</div>
        <div style="margin-top:44px"><button class="jw-btn jw-btn--primary" id="ending-back">返回标题</button></div>`;
      document.body.appendChild(el);
      const back = el.querySelector("#ending-back");
      if (back) back.addEventListener("click", () => {
        el.remove();
        if (window.JW && window.JW.StoryAudio) window.JW.StoryAudio.stopMusic();
        location.reload();
      });
    }

    // ---- 结果 ----
    showResult(res, stats, reason) {
      this.showScreen("result");
      const title = $("#result-title");
      title.textContent = res === "win" ? "大 捷" : res === "lose" ? "败 北" : "完 成";
      title.className = "result-title " + (res === "win" ? "win" : "");
      const st = $("#result-stats");
      st.innerHTML = `
        ${reason ? `<div class="row"><span>原因</span><b>${reason}</b></div>` : ""}
        <div class="row"><span>战斗回合</span><b>${stats.round || 1}</b></div>
        <div class="row"><span>击杀敌军</span><b>${stats.kills || 0}</b></div>
        ${stats.reward ? `<div class="row"><span>酬金</span><b style="color:var(--gold-bright)">${String(stats.reward.gold).padStart(5, " ")}</b></div>` : ""}
        ${stats.reward && stats.reward.lootName ? `<div class="row"><span>战利品</span><b>${stats.reward.lootName}</b></div>` : ""}
      `;
      // 原版结算 BGM track 9
      if (window.JW.StoryAudio && res === "win") window.JW.StoryAudio.playMusic(9, 1);
      // 原版 0x6a：失败 → "再玩一次吗？"
      const nextBtn = document.querySelector('#result-screen [data-action="next"]');
      if (nextBtn) nextBtn.textContent = res === "win" ? "继续" : "再玩一次";
    }
  }

  window.JW.UI = UI;
})();
    /* 原版单挑自动触发（攻击结束后，持效果26）：建立 duel 状态并显示 UI，
       * 返回 Promise，在 duelEnd 时 resolve，攻击流程继续。 */
    async startAutoDuel(attacker, target) {
      if (!this.battle) return;
      this._duel = {
        u1: attacker, u2: target,
        hp1: attacker.hp, hp2: target.hp,
        turn: 1, resolved: false,
      };
      this.ui.showDuel(this._duel);
      return new Promise(resolve => {
        this._duelResolve = resolve;
      });
    }
    duelSetup(p1, p2) {
      // 两个单位都需要在地图上（state≠0）
      const u1 = this.battle ? this.battle.units.find(u => u.pid === p1) : null;
      const u2 = this.battle ? this.battle.units.find(u => u.pid === p2) : null;
      if (!u1 || !u2) { this.ui.addLog("决斗失败：单位不存在", "sys"); return; }
      this._duel = { p1, p2, u1, u2, hp1: u1.hp, hp2: u2.hp, turn: 1, resolved: false };
      this.ui.showDuel(this._duel);
    },
    duelAction(side, action) {
      // side 0=u1, 1=u2; action 0=攻击 1=防御 2=特殊
      if (!this._duel || this._duel.resolved) return;
      const d = this._duel;
      const attacker = side === 0 ? d.u1 : d.u2;
      const defender = side === 0 ? d.u2 : d.u1;
      const atk = side === 0 ? d.hp1 : d.hp2;
      const def = side === 0 ? d.hp2 : d.hp1;
      let dmg = 0;
      if (action === 0) {
        // 攻击：伤害 = attacker.atk - defender.def + 随机
        dmg = Math.max(1, attacker.atk - defender.def + Math.floor(Math.random() * 10) - 4);
        if (def - dmg <= 0) {
          // 击杀
          if (side === 0) { d.hp2 = 0; d.resolved = true; this.ui.duelResult("胜", 0); }
          else { d.hp1 = 0; d.resolved = true; this.ui.duelResult("胜", 1); }
        } else {
          if (side === 0) d.hp2 = def - dmg;
          else d.hp1 = atk - dmg;
          this.ui.duelUpdate(d);
          this.ui.duelSay(`${attacker.name} 攻击 ${defender.name}，造成 ${dmg} 伤害`, attacker);
        }
      } else if (action === 1) {
        // 防御：减少下次伤害
        this.ui.duelSay(`${attacker.name} 进入防御姿态`, attacker);
      } else if (action === 2) {
        // 特殊：大伤害
        dmg = Math.max(5, attacker.atk - defender.def + Math.floor(Math.random() * 20));
        if (def - dmg <= 0) {
          if (side === 0) { d.hp2 = 0; d.resolved = true; this.ui.duelResult("胜", 0); }
          else { d.hp1 = 0; d.resolved = true; this.ui.duelResult("胜", 1); }
        } else {
          if (side === 0) d.hp2 = def - dmg;
          else d.hp1 = atk - dmg;
          this.ui.duelUpdate(d);
          this.ui.duelSay(`${attacker.name} 发动绝技，造成 ${dmg} 伤害！`, attacker);
        }
      }
      // 回合结束
      if (!d.resolved) {
        d.turn = (d.turn % 2) + 1;
        this.ui.duelNextTurn(d.turn);
      }
    },
    duelEnd() {
      if (!this._duel) return;
      const d = this._duel;
      if (d.resolved) {
        const winner = d.hp1 > 0 ? d.u1 : d.u2;
        // 胜者获得经验
        if (this.battle && winner.faction !== "enemy") {
          winner.gainExp(50);
        }
      }
      this.ui.hideDuel();
      // 单挑结束，resolve 攻击流程中的等待
      if (this._duelResolve) { const r = this._duelResolve; this._duelResolve = null; r(); }
      this._duel = null;
      this.ui.addLog("决斗结束", "sys");
    },

    // ---- 战前准备（op 0x4a battle_prepare）----
    showPreBattlePrep(chapter) {
      this.ui.showPreBattlePrep(chapter, (units) => {
        // 选择出场武将后进入战斗
        this._sortieUnits = units;
        this.startBattle();
      });
    },

    // ---- 金库/商店（原版 §13.2：买入价=price×100（贾润甫20在队×4/5）；卖出价=price×75，武器防具×(Lv+1)>>1；金上限 9999999；消耗品堆叠 99）----
    gold: 0,
    warehouse: [],  // [{id, count}] 消耗品堆叠 + 装备单件（count=1）
    sceneNo: 0,     // 原版 GS+7：场景号，商店索引 = min(sceneNo>>1, 57)
    shopRec() {
      const S = window.JW_SHOPS || [];
      return S[Math.min(this.sceneNo >> 1, 57)] || { a: 1012, b: 1012, wp: [], it: [] };
    },
    merchantName() {
      const R = window.JW_REAL;
      const rec = this.shopRec();
      const p = R && R.persons ? R.persons[rec.b] : null;
      return p ? p.name : "军需官";
    },
    initGold() {
      // 原版：金 = party level × 100 + 700 + base
      const A = window.JW_HEROES || [];
      const party = A.filter(h => h.faction !== "enemy");
      const partyLv = party.length ? Math.floor(party.reduce((s,h) => s + (h.lv||1), 0) / party.length) : 1;
      this.gold = partyLv * 100 + 700;
    },
    /* 出阵换人：清掉自动兜底的我方单位，再按玩家选择重新部署（仅在部署阶段可用） */
    openSortiePanel() {
      const b = this.battle;
      if (!b || b.phase !== "deploy") { this.ui.addLog("只能在战前准备阶段出阵", "sys"); return; }
      this.ui.showSortie(this, (pids) => this.redeployWith(pids));
    },

    redeployWith(pids) {
      const b = this.battle;
      if (!b || !Array.isArray(pids) || !pids.length) return;
      // 移除现有我方（清格子指针后重建 side 数组）
      for (const u of b.units.filter(x => x.faction === "ally")) {
        const cell = b.map.get(u.x, u.y);
        if (cell && cell.unit === u) cell.unit = null;
      }
      b.units = b.units.filter(x => x.faction !== "ally");
      this._syncBattleSides(b);
      // 重新部署
      const R = window.JW_REAL;
      let placed = 0;
      for (const pid of pids.slice(0, 6)) {
        let spot = null;
        for (let y = b.map.h - 2; y >= 0 && !spot; y--) {
          for (let x = 0; x < b.map.w && !spot; x++) {
            const occupied = b.units.some(o => o.isAlive && o.x === x && o.y === y);
            if (b.map.get(x, y) && !occupied) spot = { x, y };
          }
        }
        if (!spot) continue;
        const rec = (this.roster || {})[pid];
        const made = R.mkUnit(pid, spot.x, spot.y, "ally", { lv: (rec && rec.lvl) || 1, leader: pid === pids[0] });
        const u = new window.JW.Unit(made.def, spot.x, spot.y, "ally", b);
        b.units.push(u);
        placed++;
      }
      this._syncBattleSides(b);
      this.applyRoster(b);
      /* 新上阵武将可能需要新的形象贴图，直接重建场景（会按新名单重新 preload） */
      if (this.ui.rebuildPhaserScene) this.ui.rebuildPhaserScene();
      else this.ui.refreshUnits();
      this.ui.updateHUD();
      this.ui.addLog(`出阵完成：${placed} 名武将`, "sys");
      this._autoDeployed = pids.slice(0, placed);
    },

    /* 下一章 id：优先按章节索引推导（_nextChapter 在某些路径会被清空） */
    _nextChapterId() {
      const cur = this.current && this.current.id;
      const idx = this.chapters.findIndex(c => c.id === cur);
      if (idx >= 0 && idx + 1 < this.chapters.length) return this.chapters[idx + 1].id;
      return this._nextChapter || null;
    },

    showTownIfNeeded() {
      if (!this._pendingTown || !this.battle) { this._pendingTown = false; return; }
      this._pendingTown = false;
      this.initGoldIfNeeded();
      this.ui.showTown(this, () => { /* 城镇关闭即开打，无部署横幅 */ });
    },
    initGoldIfNeeded() {
      if (!this._goldInit) { this._goldInit = true; this.initGold(); }
    },
    // 战场 unit 装备 → 仓库（卸下）/ 仓库 → unit（装上），与战场菜单共用面板
    equipFromWarehouse(unit, slotKey, entryIndex) {
      const R = window.JW_REAL;
      const e = this.warehouse[entryIndex];
      if (!e) return false;
      const it = R.items[e.id];
      const c = R.classes[unit.clsId];
      if (c && c.equip && c.equip[it.type] === 0) return false; // 兵种不可装
      const old = unit[slotKey];
      unit[slotKey] = e.id;
      // 消耗品堆叠扣 1；装备整件移出
      if (e.count > 1) e.count -= 1; else this.warehouse.splice(entryIndex, 1);
      if (old != null && old !== 255) {
        const oe = this.warehouse.find(x => x.id === old && x.lv === (unit.weaponLv || 1));
        if (oe && R.items[old] && R.items[old].type >= 71) oe.count += 1;
        else this.warehouse.push({ id: old, count: 1, lv: unit.weaponLv || 1 });
      }
      if (slotKey === "weapon") unit.atk = unit.unitDef.stats.atk + unit.itemBonus(e.id);
      if (slotKey === "armor") unit.def = unit.unitDef.stats.def + unit.itemBonus(e.id);
      return true;
    },
    buyPrice(it) {
      // 贾润甫（pid 20）市侩：采购八折
      const inParty = this.battle ? this.battle.units.some(u => u.pid === 20 && u.isAlive) : false;
      let p = (it.price || 0) * 100;
      if (inParty) p = Math.floor(p * 4 / 5);
      return p;
    },
    sellPrice(entry) {
      const R = window.JW_REAL;
      const it = R && R.items ? R.items[entry.id] : null;
      if (!it || it.price === 255 || it.price == null) return -1; // 非卖品 "---"
      // 原版 §13.2：卖价 = price×75；武器/防具再 × (Lv+1)>>1
      if (it.type < 71) return it.price * 75 * (((entry.lv || 1) + 1) >> 1);
      return it.price * 75;
    },
    whFind(itemId) { return this.warehouse.find(e => e.id === itemId); },
    whCount(itemId) { const e = this.whFind(itemId); return e ? e.count : 0; },
    buyItem(itemId, count) {
      const R = window.JW_REAL;
      const it = R && R.items ? R.items[itemId] : null;
      if (!it) return { ok: false, msg: "无此物品。" };
      const price = this.buyPrice(it);
      if (this.gold < price * count) return { ok: false, msg: "金币不足。" };
      if (it.type >= 71) { // 消耗品：堆叠上限 99
        const e = this.whFind(itemId);
        const room = e ? 99 - e.count : 99;
        if (room <= 0) return { ok: false, msg: `仓库里还有很多${it.name}。\n没有必要再买。` };
        count = Math.min(count, room);
        if (e) e.count += count; else this.warehouse.push({ id: itemId, count });
      } else { // 装备：单件，仓库满则不可买
        if (this.warehouse.length >= 255) return { ok: false, msg: "仓库已满。\n请卖掉一个道具。" };
        this.warehouse.push({ id: itemId, count: 1 });
      }
      this.gold = Math.min(9999999, this.gold - price * count);
      return { ok: true, msg: `${it.name}×${count} 花费 ${price * count} 金。` };
    },
    sellItem(itemId, count) {
      const R = window.JW_REAL;
      const it = R && R.items ? R.items[itemId] : null;
      if (!it) return { ok: false, msg: "无此物品。" };
      const e = this.whFind(itemId);
      if (!e) return { ok: false, msg: "仓库中没有该物品。" };
      const price = this.sellPrice(e);
      if (price < 0) return { ok: false, msg: "此物非卖品。" };
      count = Math.min(count || e.count, e.count);
      const gain = price * count;
      if (e.count > count) e.count -= count; else this.warehouse.splice(this.warehouse.indexOf(e), 1);
      this.gold = Math.min(9999999, this.gold + gain);
      return { ok: true, msg: `卖出 ${it.name}×${count}，获得 ${gain} 金。` };
    },
    showShop() {
      this.ui.showShop(this, (action, data) => {
        if (action === "buy") {
          const res = this.buyItem(data.itemId, data.price, data.count);
          this.ui.addLog(res.msg, res.ok ? "heal" : "sys");
        } else if (action === "sell") {
          const res = this.sellItem(data.itemId, data.count);
          this.ui.addLog(res.msg, res.ok ? "heal" : "sys");
        }
        this.ui.showShop(this);
      });
    },
    showWarehouse() {
      this.ui.showWarehouse(this.warehouse, (action, data) => {
        if (action === "use") {
          // 使用道具（非战斗时）
          this.ui.addLog(`使用了 ${data.name}`, "heal");
        } else if (action === "sell") {
          const res = this.sellItem(data.itemId, 1);
          this.ui.addLog(res.msg, res.ok ? "heal" : "sys");
          this.showWarehouse();
        }
      });
    },
    // 吃果（非战斗时）
    useFruit(unit, stat) {
      const res = unit.eatFruit(stat);
      this.ui.addLog(res.msg, res.ok ? "heal" : "sys");
    },
    // 升兵种（非战斗时）
    promoteUnit(unit, newClsId) {
      const res = unit.promoteClass(newClsId);
      this.ui.addLog(res.msg, res.ok ? "heal" : "sys");
    },

    // ---- 环境设定（GS+0 位）----
    settings: { bgm: true, se: true, autoMax: false, minimap: false, autoClose: false, msgSpeed: 1, moveSpeed: 1, showGrowth: true, skin: 3 },
    showSettings() {
      this.ui.showSettings(this.settings, (key, val) => {
        this.settings[key] = val;
        this.saveSettings();
        this.applySettings();
      });
    },

    /* 把设置真正作用到运行时（音频开关 / 小地图 / 速度） */
    applySettings() {
      const st = this.settings || {};
      const Au = window.JW.Audio;
      if (Au) {
        Au.bgmOn = st.bgm !== false;
        Au.seOn = st.se !== false;
        if (!Au.bgmOn) Au.stopMusic();
      }
      if (this.ui) {
        if (st.minimap) { if (this.battle && !this.ui._minimap) this.ui.showMinimap(); }
        else if (this.ui._minimap) this.ui.hideMinimap();
      }
    },

    /* 速度系数：msgSpeed 0/1/2 → 0.5/1/1.6（剧情文字）, moveSpeed 同理（单位移动） */
    msgFactor() { return [0.5, 1, 1.6][this.settings.msgSpeed | 0] || 1; },
    moveFactor() { return [0.5, 1, 1.6][this.settings.moveSpeed | 0] || 1; },
    saveSettings() {
      localStorage.setItem("jw_settings", JSON.stringify(this.settings));
    },
    loadSettings() {
      const raw = localStorage.getItem("jw_settings");
      if (raw) {
        try { this.settings = Object.assign(this.settings, JSON.parse(raw)); } catch(e) {}
      }
      this.applySettings();
    },
    // ---- 奖励系统（op 0x59）----
    showRewards(kills, goldBase) {
      const partyLv = Math.floor(this.gold / 100);
      const gold = partyLv * 100 + 700 + (goldBase || 0);
      this.gold += gold;
      this.ui.showRewards(gold, kills);
    },

    showHelp() {
      alert([
        "操作说明",
        "",
        "· 点击我方单位选中，再点格子移动；移动到敌人旁会自动出现攻击目标",
        "· 单位菜单：攻击 / 策略 / 围攻 / 交给 / 道具 / 情报 / 待机",
        "· 「围攻」：目标旁可出手的友军会一起攻击（无人可参战会提示）",
        "· 「交给」：与相邻友军交换武器/护具/辅助",
        "· 顶部可结束回合；剧情对话点一下或按回车都能推进",
        "",
        "胜利条件见顶部提示（各关不同，如击破敌将、占领城池、坚持 N 回合等）",
      ].join("\n"));
    }
  };

  window.JW.App = App;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => App.boot());
  else App.boot();
})();