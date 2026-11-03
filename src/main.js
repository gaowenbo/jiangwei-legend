/* ============================================================
 * 三国志·姜维传 —— 游戏主入口
 * ============================================================ */
(function () {
  "use strict";
  const D = window.JW_DATA;
  const U = window.JW.U;
  const { GameMap, Unit, Battle } = window.JW;

  const App = {
    chapters: [],
    unlocked: [],
    current: null,
    ui: null,
    battle: null,
    story: null,
    state: {},
    save: null,
    flags: {},
    roster: {}, // 可用武将 {id: {level, exp, hp, ...}}

    boot() {
      this.chapters = (window.JW_CHAPTERS || []);
      this.ui = new window.JW.UI(document.getElementById("game-root"));
      this.ui.onAction = (a) => this.handleAction(a);
      this.ui.storyCb = () => { if (this.story) this.story.advance(); };
      this.unlocked = this.loadUnlock();
      this.loadRoster();
      // 无存档时解锁全部章节，便于体验完整剧情
      if (!this.unlocked || !this.unlocked.length) this.unlocked = this.chapters.map(c => c.id);
      // 键盘：回车/空格推进对话（原版支持，1:1 体验）
      this.bindKeys();
      this.showTitle();
    },

    bindKeys() {
      if (this._keysBound) return;
      this._keysBound = true;
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          // 剧情推进：仅当正在播放剧情时
          if (this.story && this.ui && this.ui.screen === "story") {
            e.preventDefault();
            this.story.advance();
          }
        } else if (/^[1-9]$/.test(e.key)) {
          // 数字键选择选项（1..9）
          if (this.story && this.ui && this.ui.screen === "story" && this.story.pendingChoice) {
            e.preventDefault();
            const idx = parseInt(e.key, 10) - 1;
            const btns = document.querySelectorAll(".choice-list .jw-btn");
            if (btns[idx]) btns[idx].click();
          }
        }
      });
    },

    handleAction(a) {
      switch (a.name) {
        case "start": this.startCampaign(); break;
        case "skip-intro": this.startCampaign(true); break;
        case "chapter": this.showChapters(); break;
        case "load": this.loadGame(); break;
        case "help": this.showHelp(); break;
        case "chapter-open": this.openChapter(a.el.chapter); break;
        case "menu": this.showBattleMenu(); break;
        case "sortie": this.ui.addLog("本作没有战前站位调整。", "sys"); break;
        case "cancel": this.ui.cancelMode(); break;   // HUD「取消」按钮：右键/Esc 等价
        case "endturn": this.endTurn(); break;
        case "zoom-in": this.ui.zoomBy(1.2); break;
        case "zoom-out": this.ui.zoomBy(1/1.2); break;
        case "zoom-reset": this.ui.resetZoom(); break;
        case "battle-end": this.finishBattle(a.el); break;
        case "deploy-done":
          if (this.battle && this.battle.deployDone()) { this.ui.setDeployBar(false); }
          break;
        case "next":
          // 原版顺序：战斗 → 战后剧情（阻塞的 battle_select_units 之后继续）→ 下一章
          if (this._afterBattle) {
            const resume = this._afterBattle;
            this._afterBattle = null;
            this.ui.clearOverlay();
            this.ui.showStory();   // 回到剧情屏继续播战后段落
            resume();              // 从下一 op 继续
            // 剧情播完后推进章节：不依赖播放器 onEnd（其在恢复路径上不总触发）
            const story = this.story;
            const nextId = this._nextChapterId();
            const tick = () => {
              const done = !story || (!story.running && story.pc >= (story.ops || []).length);
              if (!done) { setTimeout(tick, 300); return; }
              if (nextId && nextId !== (this.current && this.current.id)) this.openChapter(nextId);
              else this.showEnding();
            };
            setTimeout(tick, 600);
            break;
          }
          if (this._gotoScenarioId != null) {
            this.openChapter(this._gotoScenarioId);
            this._gotoScenarioId = null;
          } else if ((this._lastResult && (this._lastResult.result === "win" || this._lastResult.result === "story")) && (this._nextChapter || this._storyAdvance)) {
            this.openChapter(this._nextChapter || this._storyAdvance);
          } else if (this._lastResult && this._lastResult.result !== "win") {
            this.startBattle(); // 再玩一次：重开本战斗
          } else {
            this.showChapters();
          }
          break;
        case "item": this.useItem(a.el.unit); break;
      }
    },

    /* 全剧终：打完最后一章后的收尾画面（原版为 END.avi 片尾，这里用静态结算+staff） */
    showEnding() {
      const ui = this.ui;
      const old = document.getElementById("ending-panel");
      if (old) old.remove();
      const panel = document.createElement("div");
      panel.id = "ending-panel";
      panel.style.cssText = "position:fixed;inset:0;z-index:130;background:radial-gradient(circle at 50% 35%, #2a1c0c 0%, #0d0803 75%);display:flex;align-items:center;justify-content:center";
      const cleared = (this.unlocked || []).length;
      const battles = (this._battleCount || 0);
      panel.innerHTML = `
        <div style="text-align:center;color:#e8d5a3;max-width:640px;padding:24px">
          <div style="font-size:56px;letter-spacing:18px;color:var(--gold-bright);text-shadow:0 0 24px rgba(224,180,82,.45);margin-bottom:18px">全 剧 终</div>
          <div style="font-size:15px;line-height:2;color:#c9b58a">
            <div>丞相遗志，九伐中原；汉祚终尽，孤忠长存。</div>
            <div style="margin-top:10px;font-size:13px;color:#9a8a6a">
              已通章节 ${cleared} / ${this.chapters.length}　·　累计战斗 ${battles} 场　·　现金 ${this.gold}
            </div>
          </div>
          <div style="margin:26px 0 8px;height:1px;background:linear-gradient(90deg,transparent,rgba(224,180,82,.6),transparent)"></div>
          <div style="font-size:12px;color:#8a7a5a;line-height:1.9">
            原版《姜维传》By 无尽之海　·　HTML 重制版<br>
            剧本 / 地图 / 形象 / 立绘 / 音声 均取自原版素材
          </div>
          <div style="margin-top:22px;display:flex;gap:10px;justify-content:center">
            <button class="jw-btn jw-btn--primary" id="ending-title">回到标题</button>
            <button class="jw-btn" id="ending-chapters">章节选择</button>
          </div>
        </div>`;
      document.body.appendChild(panel);
      panel.querySelector("#ending-title").addEventListener("click", () => { panel.remove(); this.showTitle(); });
      panel.querySelector("#ending-chapters").addEventListener("click", () => { panel.remove(); this.showChapters(); });
    },

    showTitle() {
      this.ui.showScreen("title");
    },

    showChapters() {
      this.ui.renderChapters(this.chapters, this.unlocked);
    },

    startCampaign(skipIntro) {
      // 从第一章开始（若已解锁）；skipIntro = 跳过开场剧情直接进入首战
      if (this.chapters.length) this.openChapter(this.chapters[0].id, skipIntro);
      else this.showChapters();
    },

    openChapter(id, skipIntro) {
      const ch = this.chapters.find(c => c.id === id);
      if (!ch) return;
      this.current = ch;
      this.initGoldIfNeeded(); // 剧情前初始化资金（序章 set_resource 休闲级 +30000 在此基础上加）
      // 原版 GS+7：场景号随章节推进，商店索引 = min(sceneNo>>1, 57) → 每章换货
      this.sceneNo = Math.max(0, this.chapters.indexOf(ch) * 2);
      // 章节开场剧情（1:1 原版全屏演出场景，可跳过）
      const intro = ch.intro && (ch.intro.script || ch.intro.nodes) ? ch.intro : null;
      this._storyBattleStarted = false;
      this._sortieConstraint = null; // 出阵约束逐章重新由 battle_select_units 设定，防跨章残留
      if (!skipIntro && intro) {
        // 剧情播完（含战后段落）→ 结算已存在则推进下一章
        this.playStory(intro, () => {
          /* 章节剧情播完：有下一章就推进；已是最后一章（如终章 汉室余晖 无战斗）
           * 则进入「全剧终」收尾。中途章节若没打仗（跳过等）回章节列表。 */
          const curId = this.current && this.current.id;
          const nid = this._nextChapterId();
          if (nid && nid !== curId) { this.openChapter(nid); return; }
          if (!this._storyBattleStarted && nid === curId) { this.showChapters(); return; }
          this.showEnding();
        });
      } else if (ch.battles && ch.battles.length) {
        this.startBattle(ch.battles[0]);
        this.showTownIfNeeded();
      } else {
        this.showChapters(); // 终章等无战斗章节：跳过剧情后回章节列表
      }
    },

    // 1:1 剧情场景播放器（op 流 → 全屏演出：背景/立绘/字幕带/横幅/标题卡/淡入淡出/BGM/SE）
    _storyHooks(onBattleCb) {
      const ui = this.ui;
      return {
        /* 持久旗存储（原版 GS flag >255 持久、随存档保存）：StoryPlayer 构造时
         * 抄回 >255 旗，set_flag 写回，实现跨章分支（难度/随机器/成长选择等） */
        flagStore: this.flags,
        onFlag: (id, v) => { this.flags[id] = v; },
        onSay: (ln, narr) => {
          ui.storySayOverlay({ text: ln.text, who: ln.who }, narr);
          ui.storyHighlight && ui.storyHighlight(ln.who);
        },
        onChoice: (node, cb) => { ui.storyChoiceOverlay(node, cb); },
        /* 剧情脚本读取资源值（test_resource，原版 0x37）：
         * kind 0=金 / 1=GS+6 / 2=GS+0x12（0..100，状态窗口第三栏）。
         * 旧实现只认 kind 0，其余恒 0 → ch04/ch38/ch39 的民心分支两侧都执行。 */
        getResource: (kind) => (kind === 0 ? (this.gold || 0) : kind === 1 ? (this.res1 || 0) : (this.res2 || 0)),
        /* test_random 用引擎同一随机源（原版 0x47fb32 走引擎 RNG） */
        rand100: () => Math.random() * 100,
        /* 原版 change_scene 不驱散人物（只有 0x2f/0x11/战斗初始化/读档才清），
         * 之前每次换场景都把人物清空，剧情里人物会莫名消失。 */
        onScene: (mode, a, c) => { ui.storyScene(mode, a, c); },
        onCaption: (text, nl) => ui.storyCaption(text, nl),
        onCaptionClear: () => ui.storyCaptionClear(),
        onBanner: (text, kind) => ui.storyBanner(text, kind),
        onTitleCard: (text) => ui.storyTitleCard(text),
        onTitleCardClear: () => ui.storyTitleCardClear(),
        onFade: (dir) => ui.storyFade(dir),
        onActor: (kind, args) => ui.storyActor(kind, args),
        /* 原版 0x11 goto_scenario：跳转后清空剧情角色表 */
        onGotoScenario: (nextId) => {
          if (ui.storyActorsClear) ui.storyActorsClear();
          this._gotoScenarioId = nextId;
        },
        actorPos: (pid) => ui.actorPos(pid),
        onResource: (kind, mode, val) => {
          if (kind === 0) this.gold = Math.min(9999999, Math.max(0, (this.gold || 0) + val)); // 休闲级开局 +30000
          else {
            /* 原版 0x3A kind1/2：0..100 资源（民心等，状态窗口第三栏）；
             * mode 0=设定 1=加 2=减（0x40d2a9 / 0x40d3ae）。旧实现忽略 kind≠0。 */
            const key = kind === 1 ? 'res1' : 'res2';
            const cur = this[key] | 0;
            let v = mode === 1 ? cur + val : mode === 2 ? cur - val : val;
            v = Math.min(100, Math.max(0, v));
            this[key] = v;
          }
        },
        onItem: (itemId) => {
          const R = window.JW_REAL;
          const it = R && R.items ? R.items[itemId] : null;
          if (it) {
            const e = this.whFind(itemId);
            if (it.type >= 71) { if (e && e.count < 99) e.count += 1; else if (!e) this.warehouse.push({ id: itemId, count: 1 }); }
            else if (this.warehouse.length < 255) this.warehouse.push({ id: itemId, count: 1 });
            ui.addLog && ui.addLog(`获得道具：${it.name}`, "heal");
          }
        },
        /* 原版 0x06 battle_select_units：args=[result, max(0→1), 强制人员×5, flags×5]。
         * 出阵上限/强制出场记录到 _sortieConstraint，由 startBattle 应用。 */
        onSortie: async (a) => { this._sortieConstraint = this._parseSortie(a); await onBattleCb(); },
        onBattle: async () => { await onBattleCb(); },
        onEnd: async () => { await onBattleCb(); },
        // 终章 screen_mode 结局演出（原版 GHAI #6 致谢 → 程序结束回标题）
        onEnding: (v) => {
          ui.clearStoryOverlay();
          ui.showEnding();
        },
      };
    },

    playStoryOverlay(script) {
      // 兼容旧接口：剧情以全屏演出模式播放（原版剧情是独立场景，非战场叠加）
      this.playStory(script);
    },

    playStory(script, endCb) {
      const ui = this.ui;
      /* 原版 battle_select_units 是阻塞 op：开战 → 等战斗结束 → 剧情继续。
       * 因此这里 await 一个在结算「继续」时 resolve 的 Promise，
       * 其后的 op 就是战后剧情（无需按位置切分，分支顺序天然正确）。 */
      const intoBattle = async () => {
        if (this._storyBattleStarted) return; // 原版末尾多个 battle_select_units：只入战一次
        this._storyBattleStarted = true;
        ui.clearStoryOverlay();
        const ch = this.current;
        if (ch && ch.battles && ch.battles.length) {
          this.startBattle(ch.battles[0]);
          this.showTownIfNeeded();
          // 阻塞：结算界面点「继续」/回车时 resolve，剧情从下一 op 继续
          await new Promise(r => { this._afterBattle = r; });
        } else if (endCb) endCb("normal");
        else this.showChapters();
      };
      const hooks = this._storyHooks(intoBattle);
      // 剧情播完（含战后段落）→ endCb（推进下一章）；之前未接上导致章节不推进
      if (typeof endCb === "function") hooks.onEnd = (why) => { try { endCb(why); } catch (e) {} };
      const story = new window.JW.StoryPlayer(ui.storyScreen, script, hooks);
      this.story = story;
      if (this.battle) { this.battle._abort = true; this.battle = null; } // 剧情独立场景：清除上一场战斗残留
      ui.showStory();
      ui.storyFade("out"); // 黑场开场，首个 fade_out 淡入
      story.start();
    },

    useItem(unit) {
      if (!unit || !unit.isAlive) return;
      const b = this.battle;
      if (!b) return;
      // 打开道具面板
      this.ui.showItemPanel(unit, (itemId) => {
        // 选择道具后进入目标选择
        if (itemId == null) { this.ui.closeItemPanel(); return; }
        this.ui.beginItemTarget(unit, itemId, (target) => {
          this.ui.closeItemPanel();
          const res = b.useItem(unit, itemId, target);
          this.ui.addLog(res.msg || "使用道具", res.ok ? "heal" : "sys");
          if (res.ok) {
            this.ui.finishAction(unit);
          } else {
            // 失败不消耗回合
            unit.hasActed = false;
          }
        });
      });
    },

    startBattle(battleCfg) {
      if (!this.current) return;
      const cfg = battleCfg || (this.current.battles && this.current.battles[0]);
      if (this.battle) this.battle._abort = true;
      this._storyAdvance = null;
      this._lastResult = null; // 防上一场结果缓存被 readResult 误读为"秒胜"
      /* 原版 change_scene 补充（rules_ref）：剧情角色表只在 0x2f、goto_scenario、
       * 战斗初始化、载入时清除；切场景本身不清，立绘跨场景保留。 */
      if (this.ui && this.ui.storyActorsClear) this.ui.storyActorsClear();
      const battle = new Battle(this.current, cfg ? (cfg.index || 0) : 0);
      this.battle = battle;
      battle.init();
      // 原版：武将等级/经验/HP/MP 跨战斗延续（从 roster 恢复）
      this.applyRoster(battle);
      // 无固定我方名单的战斗（S_13/S_19/S_20/S_28/S_42/S_55）：原版由出阵界面选人，
      // 这里从存档队伍自动出阵，避免整场 0 兵直接判负。
      if (!battle.sideUnits.length) {
        const pids = this.deployRosterFallback(battle);
        this._autoDeployed = pids || [];
        this._sortieAvailable = this._autoDeployed.length > 0;
        /* 原版没有"战前调整站位"这一步：出阵人员与坐标完全由战斗数据决定。
         * 这里只做兜底补人，不再进入部署阶段，也不提供出阵按钮。 */
      } else {
        this._sortieAvailable = false;
        this._autoDeployed = [];
      }
      /* 直接进入我方回合：原版开战即行动，没有部署/调整站位环节。 */
      if (battle.phase === "deploy") battle.deployDone();
      this.ui.enterBattle(battle);
      /* 城镇（据点）仍保留：它是原版的出战前菜单，不是站位调整。 */
      this._pendingTown = true;
      this.ui.setDeployBar(false);
      // 事件绑定
      battle.onEvent = (evt) => this.handleBattleEvent(evt);
      /* 剧情旗传入战斗脚本：原版战斗 poll 大量依赖章节剧情里 set_flag 的结果，
       * 之前战斗侧 _scriptFlags 是空的，导致所有旗条件「通过」→ poll 乱触发。 */
      try {
        const sf = (this.story && this.story.flags) ? this.story.flags : (this.flags || {});
        for (const k of Object.keys(sf || {})) battle._scriptFlags[k] = sf[k];
      } catch (e) { /* 旗复制失败不影响开战 */ }
      // 结束回合按钮（通过菜单）
    },

    /* Battle 的 allies/friends/enemies/sideUnits 是 init 时快照的数组，
     * 运行期新增单位必须同步，否则回合制与胜负判定看不到它们。 */
    _syncBattleSides(b) {
      b.allies = b.units.filter(u => u.faction === "ally");
      b.friends = b.units.filter(u => u.faction === "friend");
      b.enemies = b.units.filter(u => u.faction === "enemy");
      b.sideUnits = b.allies.concat(b.friends);
      if (b.phase === "player" || b.phase === "deploy") {
        if (b.allies.some(u => u.isAlive)) b.phase = b.phase === "deploy" ? "deploy" : "player";
      }
    },

    /* 原版 0x06（0x415b45）参数排布：args[1]=max（0→1，写 0x4b09ec），
     * args[2..6]=强制人员 person×5（写 0x4b09f0），args[7..11]=flags×5（0x4b0a04）。
     * 实测数据里 tag39 列表同样装的是人物 id（如 ch10 的 16/22/36 与 ch09 强制名单同组），
     * 而 rules_ref §13.6 只把「arg 11」定为真正的排除项 —— 语义未完全收敛，
     * 因此这里只应用 max 与强制人员（与原版「强制先占满出阵名额」一致），
     * flags 列表不解释，避免按半截文档把人错误排除。 */
    _parseSortie(a) {
      if (!Array.isArray(a) || a.length < 7) return null;
      let max = a[1] | 0;
      if (max === 0) max = 1;
      const forced = [];
      for (let i = 2; i <= 6 && i < a.length; i++) {
        const v = a[i] | 0;
        if (v !== 65535 && v >= 0) forced.push(v);
      }
      if (max <= 1 && !forced.length) return null;
      return { max, forced };
    },

    /* 兜底出阵：从 roster（原版队伍）挑人，出阵上限/强制出场由 battle_select_units 决定，
     * 无约束时按等级降序最多 8 人，落在地图下缘空地。姜维恒为主将。
     * 仅在该战没有任何我方单位时调用。 */
    deployRosterFallback(battle) {
      const R = window.JW_REAL;
      if (!R || !R.mkUnit) return 0;
      const cand = [];
      const seen = new Set();
      const push = (pid, lv) => {
        if (pid == null || pid === 65535 || seen.has(pid)) return;
        const rec = this.roster && this.roster[pid];
        seen.add(pid);
        cand.push({ pid, lv: (rec && rec.lvl) || lv || 1 });
      };
      /* 强制出场人员最先入选（原版 0x4b09f0；不在 roster 也出场，等级兜底 1） */
      const sc = this._sortieConstraint;
      if (sc && sc.forced && sc.forced.length) for (const pid of sc.forced) push(pid, 1);
      push(0, 1);                       // 姜维
      for (const k of Object.keys(this.roster || {})) push(parseInt(k, 10), 1);
      cand.sort((a, b) => {
        if (sc && sc.forced) {
          const fa = sc.forced.indexOf(a.pid) >= 0 ? 0 : 1;
          const fb = sc.forced.indexOf(b.pid) >= 0 ? 0 : 1;
          if (fa !== fb) return fa - fb;
        }
        return (a.pid === 0 ? -1 : b.pid === 0 ? 1 : b.lv - a.lv);
      });
      /* 出阵上限（原版 0x4b09ec）：max>1 时钳制人数，否则保持旧 8 人默认 */
      const cap = sc && sc.max > 1 ? Math.max(1, Math.min(sc.max, 8)) : 8;
      const pick = cand.slice(0, cap);
      const b = battle;
      const place = () => {
        let n = 0;
        for (const c of pick) {
          const spot = this.findFreeCellNear
            ? this.findFreeCellNear(b, Math.floor(b.map.w / 2), b.map.h - 2)
            : null;
          const x = spot ? spot.x : Math.floor(b.map.w / 2) + n - pick.length / 2;
          const y = spot ? spot.y : b.map.h - 2;
          const made = R.mkUnit(c.pid, Math.round(x), Math.round(y), "ally", { lv: c.lv, leader: c.pid === 0 });
          const u = new window.JW.Unit(made.def, Math.round(x), Math.round(y), "ally", battle);
          u.dir = 0;
          b.units.push(u);
          n++;
        }
        this._syncBattleSides(b);
        return pick.map(c => c.pid);
      };
      // findFreeCellNear 定义在 Battle 上；无则用简单扫描
      if (!this.findFreeCellNear) {
        let placed = 0;
        for (const c of pick) {
          let done = false;
          for (let y = b.map.h - 2; y >= 0 && !done; y--) {
            for (let x = Math.floor(b.map.w / 2); x < b.map.w && !done; x++) {
              if (b.map.get(x, y) && !b.units.some(u => u.isAlive && u.x === x && u.y === y)) {
                const made = R.mkUnit(c.pid, x, y, "ally", { lv: c.lv, leader: c.pid === 0 });
                const u = new window.JW.Unit(made.def, x, y, "ally", battle);
                b.units.push(u);
                placed++; done = true;
              }
            }
          }
        }
        this._syncBattleSides(b);
        return pick.map(c => c.pid);
      }
      return place();
    },

    // 原版：武将状态跨战斗延续（等级/经验/HP/MP/装备等级）
    applyRoster(battle) {
      for (const u of battle.units) {
        const rec = this.roster[u.pid];
        if (!rec) continue;
        if (rec.lvl && rec.lvl > u.lvl) {
          while (u.lvl < rec.lvl) { const up = u.levelUp(); if (!up) break; }
          u.exp = rec.exp || 0;
        }
        // 原版：HP/MP 每场战斗开始满值（不跨战斗继承）；战斗中存档读档才恢复中间状态
        u.hp = u.maxHp;
        u.mp = u.maxMp;
        if (rec.weaponLv) { u.weaponLv = rec.weaponLv; u.weaponExp = rec.weaponExp || 0; }
        if (rec.armorLv) { u.armorLv = rec.armorLv; u.armorExp = rec.armorExp || 0; }
        // 装备等级按 §1.2 影响攻防（base+grow×(装Lv-1)）→ 恢复后重算
        if (u.unitDef && u.unitDef.stats) {
          u.atk = u.unitDef.stats.atk + u.itemBonus(u.weapon);
          u.def = u.unitDef.stats.def + u.itemBonus(u.armor);
        }
      }
    },
    saveRoster() {
      const b = this.battle;
      if (!b) return;
      for (const u of b.units) {
        if (u.faction === "enemy" || u.pid == null) continue;
        this.roster[u.pid] = {
          name: u.name, lvl: u.lvl, exp: u.exp,
          hp: u.isAlive ? u.hp : 1, mp: u.mp,
          weaponLv: u.weaponLv, weaponExp: u.weaponExp,
          armorLv: u.armorLv, armorExp: u.armorExp
        };
      }
      localStorage.setItem("jw_roster", JSON.stringify({ roster: this.roster, gold: this.gold || 0, warehouse: this.warehouse || [] }));
    },
    loadRoster() {
      try {
        const raw = localStorage.getItem("jw_roster");
        if (raw) {
          const d = JSON.parse(raw);
          if (d.roster) this.roster = d.roster;
          if (typeof d.gold === "number") this.gold = d.gold;
          if (Array.isArray(d.warehouse)) {
            // 旧存档：裸 id 数组 → 堆叠条目 {id, count}
            this.warehouse = d.warehouse.map(e => typeof e === "number" ? { id: e, count: 1 } : e).filter(e => e && typeof e.id === "number");
          }
        }
      } catch (e) {}
    },

    handleBattleEvent(evt) {
      const b = this.battle;
      if (!b) return;
      const u = (id) => b.units.find(x => x.id === id);
      if (evt.type === "duelCinematic") return this.playDuelCinematic(evt);
      switch (evt.type) {
        case "log":
          this.ui.addLog(evt.entry.msg, evt.entry.type);
          break;
        case "hit": {
          const a = u(evt.attacker), t = u(evt.target);
          if (a && t) this.ui.floatText(t.x, t.y, "-" + evt.dmg + (evt.crit ? "!" : ""), evt.crit ? "crit" : "dmg");
          // 原版动作：攻击方播放 Unit_atk 图集（12 帧），并朝目标方向翻转
          if (a && this.ui.scene && this.ui.scene.playUnitAction) this.ui.scene.playUnitAction(a.id, "atk", t.x - a.x, t.y - a.y);
          // 挨打方播放受击动画（原版显示挨打帧）
          if (t && this.ui.scene && this.ui.scene.playUnitAnim) this.ui.scene.playUnitAnim(t.id, 3);
          break;
        }
        case "se": {
          try { if (window.JW.Audio) window.JW.Audio.playSE(evt.id | 0); } catch (e) {}
          break;
        }
        /* 原版 0x5A：战斗开场「开始战斗」字幕（压暗化地图 ~20 tick） */
        case "battleCaption":
          if (this.ui && this.ui.showBattleCaption) this.ui.showBattleCaption(evt.text || "开 始 战 斗");
          break;
        /* 原版 0x5B/0x5C/0x55：地图居中到该格（可带闪烁） */
        case "centerOn":
          if (this.ui && this.ui.scene) {
            const sc = this.ui.scene;
            if (sc.centerOnCell) sc.centerOnCell(evt.x, evt.y, evt.blink ? 3 : 0);
            else if (sc.blinkCells && evt.blink) sc.blinkCells(evt.blink, 3);
          }
          break;
        /* 原版 0x58：地形改变/撤销 */
        case "terrain":
          if (this.ui && this.ui.scene && this.ui.scene.redrawAll) this.ui.scene.redrawAll();
          break;
        /* 原版 0x3B join / 0x6C 等：记录以便排查 */
        case "join":
          this.ui.addLog(`人物 ${evt.person} ${evt.mode === 1 ? "加入" : "离队"}`, "sys");
          break;
        case "scriptNoop":
          break;
        case "scriptBattleOver": {
          // 原版 ui_49/ui_0e：剧本显式宣告战斗结束
          setTimeout(() => {
            if (!this.battle || this.battle.state !== "playing") return;
            this.finishBattle({ result: evt.win ? "win" : "lose", reason: evt.win ? "战斗结束" : "战斗失利" });
          }, 400);
          break;
        }
        case "victoryText":
          if (evt.text) this.ui.addLog(`【胜利条件】${evt.text}`, "sys");
          break;
        case "goalText":
          if (evt.text) this.ui.addLog(`【战斗目标】${evt.text}`, "sys");
          break;
        case "cast": {
          // 原版施法动作：Unit_spc 图集（5 帧）
          const a = u(evt.attacker);
          if (a && this.ui.scene && this.ui.scene.playUnitAction) this.ui.scene.playUnitAction(a.id, "spc");
          // 法术命中特效：目标播放受击闪烁
          const t = u(evt.target);
          if (t && this.ui.scene && this.ui.scene.playUnitAnim) this.ui.scene.playUnitAnim(t.id, 3);
          break;
        }
        case "heal": {
          const t = u(evt.target);
          if (t) this.ui.floatText(t.x, t.y, "+", "heal");
          break;
        }
        case "equipLevelUp": {
          // 原版 0x4083ef：240×96 面板「武器等级上升！」
          const t = u(evt.unit);
          const slotName = evt.slot === "weapon" ? "武器" : "护具";
          this.ui.addLog(`${t ? t.name : ""} ${slotName}等级上升！Lv.${evt.lv}`, "heal");
          if (t) this.ui.floatText(t.x, t.y, slotName + "Lv↑", "heal");
          break;
        }
        case "miss": {
          const t = u(evt.target);
          if (t) this.ui.floatText(t.x, t.y, "未中", "miss");
          break;
        }
        case "death": {
          const d = u(evt.unit);
          if (d) {
            this.ui.floatText(d.x, d.y, "亡", "dmg");
            if (this.ui.scene && this.ui.scene.playDeathAnim) this.ui.scene.playDeathAnim(d.id);
          }
          // 立即检查胜负
          const res = b.checkWin();
          // 绑定发起结算的 battle 实例：重试后 this.battle 已换代，旧回调必须作废
          if (res && res.result) setTimeout(() => { if (this.battle === b) this.finishBattle(res); }, 600);
          break;
        }
        case "terrain":
          this.ui.refreshUnits();
          this.ui.renderBattleMap();
          break;
        case "unitAction":
          this.ui.refreshUnits();
          break;
        case "unitTurn":
          this.ui.refreshUnits();
          break;
        case "unitSay":
          this.ui.showBattleSay(evt.text, u(evt.unit));
          break;
        case "unitAnim":
          if (this.ui.scene && this.ui.scene.playUnitAnim) this.ui.scene.playUnitAnim(evt.unit, evt.action);
          break;
        case "scriptStatus":
          this.ui.refreshUnits();
          break;
        case "scriptForceWin":
          // 撤退链（S_00 单挑→全员撤离）达成作战目的：以胜利结算
          setTimeout(() => {
            if (!this.battle || this.battle.state !== "playing") return;
            this.finishBattle({ result: "win", reason: evt.reason || "达成作战目的" });
          }, 600);
          break;
        case "scriptStoryEnd": {
          // 原版剧情结算（冀城中计）：以败北画面结束但推进章节
          setTimeout(() => {
            if (!this.battle || this.battle.state !== "playing") return;
            this.battle.state = "end";
            this._lastResult = { result: "story", reason: "孤立无援的姜维军被包围了" };
            // 下一章：本关胜利同样规则（ch 顺序 +1），剧情败北也要推进
            const idx = this.chapters.findIndex(c => this.current && c.id === this.current.id);
            this._nextChapter = (idx >= 0 && idx + 1 < this.chapters.length) ? this.chapters[idx + 1].id : null;
            this._storyAdvance = this._nextChapter || null;
            this.unlockNext();
            this.saveGame();
            this.ui.showResult("lose", {}, this._lastResult.reason);
            // 剧情推进关：按钮语义为"继续"（原版冀城中计后进入下一章）
            const nb = document.querySelector('#result-screen [data-action="next"]');
            if (nb) nb.textContent = "继续";
          }, 600);
          break;
        }
        case "scriptDialog": {
          // 对话显示在左侧任务/回合面板下方的立绘窗口，不写入战场信息
          const who = evt.who || "";
          this.ui.showBattleSay(evt.text, who ? { name: who } : null);
          break;
        }
        case "scriptItem": {
          this.ui.addLog(`【事件】获得道具 ${evt.name}`, "heal");
          const R = window.JW_REAL;
          const it = R && R.items ? R.items[evt.item] : null;
          if (it && it.type >= 71) { // 消耗品堆叠
            const e = this.whFind(evt.item);
            if (e && e.count < 99) e.count += 1; else if (!e) this.warehouse.push({ id: evt.item, count: 1 });
          } else if (this.warehouse.length < 255) {
            this.warehouse.push({ id: evt.item, count: 1 });
          }
          break;
        }
        case "scriptRetreat":
          this.ui.refreshUnits();
          break;
        case "scriptRestore":
          this.ui.refreshUnits();
          this.ui.updateHUD();
          break;
        case "scriptReward": {
          // 原版 0x59 结算（0x41688b）：酬金 = 队伍等级×100+700+base；等级取我方最高15人平均（缺失取姜维等级）
          const allies = b.units.filter(u => u.faction !== "enemy" && u.x >= 0 && u.isAlive);
          const lvs = allies.map(u => u.lvl || 1).sort((x, y) => y - x).slice(0, 15);
          const partyLv = lvs.length ? Math.floor(lvs.reduce((s, v) => s + v, 0) / lvs.length) : (b.units.find(u => u.pid === 0) || { lvl: 1 }).lvl || 1;
          const gold = partyLv * 100 + 700 + (evt.base || 0);
          this.gold = Math.min(9999999, this.gold + gold);
          const R = window.JW_REAL;
          let lootName = null;
          if (evt.loot != null && R && R.items && R.items[evt.loot]) {
            const it = R.items[evt.loot];
            const e2 = this.whFind(evt.loot);
            if (it.type >= 71) { if (e2 && e2.count < 99) e2.count += 1; else if (!e2) this.warehouse.push({ id: evt.loot, count: 1 }); }
            else if (this.warehouse.length < 255) this.warehouse.push({ id: evt.loot, count: 1 });
            lootName = it.name;
          }
          this._lastReward = { gold, lootName, partyLv };
          this.ui.addLog(`【结算】酬金 ${gold} 金${lootName ? "，获得战利品 " + lootName : ""}`, "heal");
          break;
        }
        case "scriptIntroDone":
          this.ui.addLog("—— 作战开始 ——", "sys");
          break;
        case "phase": break;
        case "unitDone":
          if (b.pollScriptEvents) b.pollScriptEvents();
          break;
        default: break;
      }
      // 重绘
      setTimeout(() => { this.ui.clearOverlay(); this.ui.updateHUD(); }, 50);
    },

    endTurn() {
      const b = this.battle;
      if (!b || b.phase !== "player") return;
      // 我方回合结束 → 友军行动 → 敌军行动
      Promise.resolve()
        .then(() => b.runFriendTurn())
        .then(() => b.runEnemyTurn())
        .then(async () => {
        // 剧情演出（单挑/撤退链）本就会冻结战场数十秒：等它真正结束再结算本回合，
        // 不能用短超时丢弃回合（否则 round 永不递增）。上限 120s 仅防御性兜底。
        for (let i = 0; i < 600 && b._scriptPause && b.state === "playing"; i++) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (b.state !== "playing") return;
        // 敌方回合结束后：检查胜负 + 进入下一轮
        const res = b.checkWin();
        if (res && res.result) { this.finishBattle(res); return; }
        b.nextRound();
        this.ui.clearOverlay();
        this.ui.updateHUD();
        this.ui.addLog(`→ 第 ${b.round} 回合，我方行动`, "sys");
        if (b.pollScriptEvents) b.pollScriptEvents();
      });
    },

    showBattleMenu() {
      const menu = document.createElement("div");
      menu.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100";
      menu.innerHTML = `<div class="jw-panel" style="padding:20px;min-width:260px">
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="jw-btn jw-btn--primary" data-m="endturn">结束回合</button>
          <button class="jw-btn" data-m="equip">装备</button>
          <button class="jw-btn" data-m="save">存档</button>
          <button class="jw-btn" data-m="load">读档</button>
          <button class="jw-btn" data-m="settings">设置</button>
          <button class="jw-btn" data-m="close">关闭</button>
        </div></div>`;
      document.body.appendChild(menu);
      menu.querySelectorAll("[data-m]").forEach(btn => {
        btn.addEventListener("click", () => {
          const m = btn.dataset.m;
          menu.remove();
          if (m === "endturn") this.endTurn();
          else if (m === "equip") this.showEquipPanel();
          else if (m === "save") this.ui.showSaveLoad(this, "save");
          else if (m === "load") this.ui.showSaveLoad(this, "load");
          else if (m === "settings") this.showSettings();
        });
      });
    },

    // 装备面板：1:1 原版三槽（武器 wp / 防具 ar / 辅助 ac），仓库换装、旧装回仓、数值实时预览
    showEquipPanel() {
      const A = this, b = A.battle;
      if (!b) return;
      const R = window.JW_REAL;
      const allies = b.units.filter(u => u.faction !== "enemy" && u.x >= 0 && u.isAlive);
      if (!allies.length) return;
      let cur = A._equipSel || allies[0].pid;
      const SLOT = [["weapon", "武器"], ["armor", "防具"], ["acc", "辅助"]];
      const itemName = (id) => (id != null && R.items[id]) ? R.items[id].name : "（空）";
      const panel = document.createElement("div");
      panel.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:110";
      const render = () => {
        const u = allies.find(x => x.pid === cur) || allies[0]; cur = u.pid;
        const rows = SLOT.map(([k, label]) => {
          const curId = u[k];
          const opts = [`<div class="jw-btn" data-un="${k}" style="text-align:left;padding:4px 10px">卸下</div>`];
          A.warehouse.forEach((e, idx) => {
            const it = R.items[e.id];
            if (!it || it.type >= 71) return; // 仓库消耗品不可装备
            /* 物品类型分段（实测物品表）：0..19 武器、20..25 甲胄、26..70 辅助、71+ 消耗品。
             * 兵种适性数组恰好 26 项 = 0..25（武器+甲胄），辅助不查适性。 */
            const slotOf = it.type < 20 ? "weapon" : (it.type < 26 ? "armor" : "acc");
            if (slotOf !== k) return;                    // 只列本槽位可放的物品
            /* 原版 CanEquip(0x407907)：兵种记录 +9+type 的适性字节为 0 就不能装 */
            const ok = R.classes[u.clsId] && R.classes[u.clsId].equip ? R.classes[u.clsId].equip[it.type] !== 0 : true;
            opts.push(`<div class="jw-btn" data-eq="${k}:${idx}" style="text-align:left;padding:4px 10px;${ok ? "" : "opacity:.45"}">${it.name}（+${it.base}）${ok ? "" : "，不可装"}</div>`);
          });
          return `<div style="margin:6px 0">
            <div style="color:#caa96a;font-size:13px">${label}：${itemName(curId)} <span style="opacity:.7">+${u.itemBonus(curId)}</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;max-width:420px">${opts.join("")}</div>
          </div>`;
        }).join("");
        panel.innerHTML = `<div class="jw-panel" style="padding:18px;min-width:460px;max-height:80vh;overflow:auto;background:linear-gradient(180deg,#241708,#1a0f06);border:2px solid var(--gold);color:#e8d5a3">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="color:#e8d5a3;font-size:16px;font-weight:bold">${u.name} 的装备</div>
            <select id="eq-who" style="background:#2a2118;color:#e8d5a3;border:1px solid #6a5636;padding:2px 6px">
              ${allies.map(x => `<option value="${x.pid}" ${x.pid === cur ? "selected" : ""}>${x.name}</option>`).join("")}
            </select>
            <div style="flex:1"></div>
            <div style="color:#caa96a;font-size:13px">攻击 ${u.atk} ｜ 防御 ${u.def}</div>
          </div>
          ${rows}
          <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="jw-btn jw-btn--primary" id="eq-close">关闭</button></div>
        </div>`;
        panel.querySelector("#eq-who").addEventListener("change", (ev) => { cur = +ev.target.value; render(); });
        panel.querySelector("#eq-close").addEventListener("click", () => panel.remove());
        panel.querySelectorAll("[data-eq]").forEach(el => el.addEventListener("click", () => {
          const [k, idxS] = el.dataset.eq.split(":");
          A.equipFromWarehouse(u, k, +idxS);
          render();
        }));
        panel.querySelectorAll("[data-un]").forEach(el => el.addEventListener("click", () => {
          const k = el.dataset.un;
          const old = u[k];
          if (old == null) return;
          u[k] = undefined;
          const it = R.items[old];
          const oe = A.whFind(old);
          if (it && it.type >= 71 && oe) oe.count += 1;
          else A.warehouse.push({ id: old, count: 1, lv: u.weaponLv || 1 });
          if (k === "weapon") u.atk = u.unitDef.stats.atk;
          if (k === "armor") u.def = u.unitDef.stats.def;
          render();
        }));
      };
      render();
      document.body.appendChild(panel);
    },

    finishBattle(res) {
      // 幂等：排队中的旧结算（如敌回合期间多个 600ms 延迟回调）只生效一次
      if (this.battle && this.battle.state === "end") return;
      if (this.battle) {
        this.battle.state = "end";
        this.battle._abort = true; // 中止残留的敌方回合循环，防止二次结算
      }
      const b = this.battle;
      // 原版战后演出（outro：set_result/音效）在结算面板之前跑完
      if (b && b.runOutroEvents) {
        try { b.runOutroEvents(); } catch (e) { /* outro 失败不阻断结算 */ }
      }
      this._battleCount = (this._battleCount || 0) + 1;
      const stats = { round: b.round, kills: b.enemies.filter(e => !e.isAlive).length, exp: 0, reward: this._lastReward || null };
      this._lastReward = null;
      this.saveRoster(); // 武将状态写回（原版跨战斗延续）
      this._lastResult = res;
      this._lastResult = res;
      this.ui.showResult(res.result, stats, res.reason);
      if (res.result === "win") {
        this.unlockNext();
        this.saveGame();
        // 原版流转：继续 → 下一章剧情 → 战斗
        const idx = this.chapters.findIndex(c => c.id === this.current.id);
        this._nextChapter = (idx >= 0 && idx + 1 < this.chapters.length) ? this.chapters[idx + 1].id : null;
      } else {
        this._nextChapter = null;
      }
    },

    unlockNext() {
      // 解锁下一章
      const idx = this.chapters.findIndex(c => c.id === this.current.id);
      if (idx >= 0 && idx + 1 < this.chapters.length) {
        const next = this.chapters[idx + 1].id;
        if (!this.unlocked.includes(next)) this.unlocked.push(next);
        localStorage.setItem("jw_unlocked", JSON.stringify(this.unlocked));
      }
    },

    /* ---- 多槽存档（原版多存档位）：slot 1..3，键 jw_save_N ---- */
    saveKey(slot) { return "jw_save_" + (slot | 0); },

    saveGameTo(slot) {
      const data = {
        v: 2,
        time: Date.now(),
        chapter: this.current ? this.current.id : null,
        chapterTitle: this.current ? this.current.title : "",
        round: this.battle ? this.battle.round : null,
        unlocked: this.unlocked,
        battle: this.battle ? this.battle.serialize() : null,
        flags: this.flags || {},
        gold: this.gold || 0,
        res1: this.res1 || 0, res2: this.res2 || 0,
        warehouse: this.warehouse || [],
        sceneNo: this.sceneNo || 0,
        roster: this.roster || {},
      };
      try { localStorage.setItem(this.saveKey(slot), JSON.stringify(data)); return true; }
      catch (e) { return false; }
    },

    listSaveSlots() {
      const out = [];
      for (let i = 1; i <= 3; i++) {
        const raw = localStorage.getItem(this.saveKey(i));
        if (!raw) { out.push({ slot: i, empty: true }); continue; }
        try {
          const d = JSON.parse(raw);
          out.push({ slot: i, empty: false, chapterTitle: d.chapterTitle || d.chapter || "",
                     round: d.round, time: d.time || 0, gold: d.gold || 0 });
        } catch (e) { out.push({ slot: i, empty: true, broken: true }); }
      }
      return out;
    },

    deleteSaveSlot(slot) {
      localStorage.removeItem(this.saveKey(slot));
    },

    loadGameFrom(slot) {
      const raw = localStorage.getItem(this.saveKey(slot));
      if (!raw) return false;
      let d;
      try { d = JSON.parse(raw); } catch (e) { return false; }
      this._applySaveData(d);
      return true;
    },

    saveGame() {
      const data = {
        unlocked: this.unlocked,
        chapter: this.current?.id,
        battle: this.battle ? this.battle.serialize() : null,
        flags: this.flags || {},
        gold: this.gold || 0,
        res1: this.res1 || 0, res2: this.res2 || 0,
        warehouse: this.warehouse || [],
        sceneNo: this.sceneNo || 0,
        roster: this.roster || {},
      };
      try { localStorage.setItem(this.saveKey(1), JSON.stringify(data)); } catch (e) {}
      this.ui.addLog("已存档", "sys");
    },

    /* 旧单槽存档（jw_save）兼容：读档时若只有旧键则迁移到 1 号槽 */
    _migrateLegacySave() {
      const legacy = localStorage.getItem("jw_save");
      if (!legacy) return;
      if (!localStorage.getItem(this.saveKey(1))) localStorage.setItem(this.saveKey(1), legacy);
      localStorage.removeItem("jw_save");
    },

    loadGame() {
      this._migrateLegacySave();
      this.ui.showSaveLoad(this, "load");
    },

    /* 真正应用存档数据（供多槽读档复用） */
    _applySaveData(data) {
      /* 载入：原版清空剧情角色表（rules_ref：仅 0x2f/goto_scenario/战斗初始化/载入） */
      if (this.ui && this.ui.storyActorsClear) this.ui.storyActorsClear();
      this.unlocked = data.unlocked || this.unlocked;
      this.flags = data.flags || {};
      localStorage.setItem("jw_unlocked", JSON.stringify(this.unlocked));
      // 经济/武将状态恢复（原版跨战斗延续）
      if (typeof data.gold === "number") this.gold = data.gold;
      this.res1 = typeof data.res1 === "number" ? data.res1 : 0;
      this.res2 = typeof data.res2 === "number" ? data.res2 : 0;
      if (Array.isArray(data.warehouse)) this.warehouse = data.warehouse.map(e => typeof e === "number" ? { id: e, count: 1 } : e).filter(e => e && typeof e.id === "number");
      if (typeof data.sceneNo === "number") this.sceneNo = data.sceneNo;
      if (data.roster) this.roster = data.roster;
      // 恢复战斗
      if (data.chapter && data.battle) {
        const ch = this.chapters.find(c => c.id === data.chapter);
        if (ch) {
          this.current = ch;
          const battle = new Battle(ch, 0);
          battle.init();
          battle.deserialize(data.battle);
          this.battle = battle;
          this.applyRoster(battle);
          battle.onEvent = (evt) => this.handleBattleEvent(evt);
          this.ui.enterBattle(battle);
          this._pendingTown = false;
          this.ui.setDeployBar(battle.phase === "deploy");
          this.ui.addLog("读档成功，战斗已恢复", "sys");
          return;
        }
      }
      this.showChapters();
    },

    loadUnlock() {
      try {
        const raw = localStorage.getItem("jw_unlocked");
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length) return arr;
        }
      } catch (e) {}
      // 默认解锁第一章
      return this.chapters.length ? [this.chapters[0].id] : [];
    },

    /* 跳过正在播放的决斗演出：令牌自增让 setTimeout 链静默退出，并收掉界面层 */
    /* 跳过当前决斗：既要收掉自动演出（setTimeout 链），也要收掉等待玩家点击的交互式单挑，
     * 否则剧情跑完后屏幕会一直停在 duel 上，章节不推进（ch40 卡死即此）。 */
    abortDuel() {
      this._duelSeq = (this._duelSeq || 0) + 1;
      if (this._duelTimer) { clearTimeout(this._duelTimer); this._duelTimer = null; }
      if (this.ui && this.ui.duelCinematicAbort) this.ui.duelCinematicAbort();
      if (this._duel && !this._duel.resolved) {
        this._duel.resolved = true;
        try { this.duelEnd(); } catch (e) {}
      }
      const r = this._duelResolve;
      this._duelResolve = null;
      if (r) r();
      /* 自动演出的 duelCinematicAbort() 只隐藏决斗层，不改 ui.screen；
       * 不补这一步，跳过决斗后屏幕会永远停在 duel（ch27 章节链卡死即此）。 */
      if (this.ui && this.ui.screen === "duel") {
        if (this.battle && this.battle.state === "playing") this.ui.showScreen("battle");
        else if (this.story) this.ui.showStory();
        else this.ui.showChapters();
      }
    },

    // ---- 决斗演出回放（1:1：脚本 duel_* 序列自动播放，非玩家操作）----
    playDuelCinematic(evt) {
      return new Promise((resolve) => {
        const { u1, u2, seq } = evt;
        const ui = this.ui;
        // 演出令牌：新演出开始或战斗结束/换屏后，旧演出的 setTimeout 链必须静默退出，
        // 否则它会在结果界面/下一章之上把屏幕切回 duel（ch47 章节链卡死的根因）。
        const token = (this._duelSeq = (this._duelSeq || 0) + 1);
        /* 保存 resolver 与当前定时器：abortDuel() 需要能立刻结束演出，
         * 否则最长为 2.5s 的 delay 定时器还会继续跑，章节链等 1.5s 就先放弃了。 */
        this._duelResolve = resolve;
        this._duelTimer = null;
        /* 演出总时长上限：ch47 等长脚本有上百步，按 1.6s/步会跑 2~3 分钟，
         * 章节链/玩家都会被卡住。按估算总时长压到 ≤14s，步间延时同比缩放。 */
        let est = 0;
        for (const op of seq) {
          const nm = op.name;
          est += (nm === "duel_say" || nm === "duel_say2") ? 1600
               : nm === "delay" ? ((op.args && (op.args[0] | 0)) || 1) * 50
               : nm === "duel_action" ? 700 : 400;
        }
        const pace = est > 14000 ? 14000 / est : 1;
        /* 下限不能太高：ch47 这类脚本有 300+ 步，若每步保底 240ms 仍要跑 70s+，
         * 章节链照样超时（实测偶发 48/59）。放到 40ms 级，长脚本约 12s 走完。 */
        const sayMs = Math.max(40, Math.round(1600 * pace));
        const actMs = Math.max(30, Math.round(700 * pace));
        const tickMs = Math.max(20, Math.round(400 * pace));
        ui.duelCinematicBegin(u1, u2);
        let i = 0, hp1 = u1.hp, hp2 = u2.hp;
        const step = () => {
          if (token !== this._duelSeq || ui.screen !== "duel") {
            if (ui.screen === "duel") ui.duelCinematicAbort();
            resolve();
            return;
          }
          if (i >= seq.length) { ui.duelCinematicEnd(); resolve(); return; }
          const op = seq[i++];
          const a = op.args || [];
          // 原版 side 编号与 duel_setup 参数反序：side 0 = setup[1] = u2，side 1 = setup[0] = u1
          switch (op.name) {
            case "duel_say": case "duel_say2":
              ui.duelCinematicSay(a[1] != null ? String(a[1]) : String(a[0] || ""), (a[0] | 0) === 0 ? u2 : u1);
              this._duelTimer = setTimeout(step, sayMs);
              break;
            case "duel_action": case "duel_action2": case "duel_action3": {
              const side = (a[0] | 0); // 0=u2 赵云方行动, 1=u1 姜维方行动
              const code = (a[1] | 0);
              const atkr = side === 0 ? u2 : u1, dfdr = side === 0 ? u1 : u2;
              // 演出化伤害（剧情平手，不改战场 HP）：1 连击 / 2 绝技 / 13 大招 / 12 受击反应
              const dmg = code === 1 ? 4 + Math.floor(Math.random() * 7) : code === 2 ? 12 + Math.floor(Math.random() * 9) : code === 13 ? 20 + Math.floor(Math.random() * 13) : 0;
              if (code === 12) { ui.duelCinematicFlash(side); this._duelTimer = setTimeout(step, tickMs); break; }
              if (!dmg) { this._duelTimer = setTimeout(step, Math.max(20, Math.round(300 * pace))); break; }
              if (side === 0) hp1 = Math.max(1, hp1 - dmg); else hp2 = Math.max(1, hp2 - dmg);
              // 原版动作帧：攻击方 12 帧 Unit_atk
              if (ui.duelPlayAtk) ui.duelPlayAtk(side, atkr);
              ui.duelCinematicHit(side, dmg, hp1, hp2);
              this._duelTimer = setTimeout(step, actMs);
              break;
            }
            case "delay":
              this._duelTimer = setTimeout(step, Math.min((a[0] | 0) * 120, 2500));
              break;
            default:
              this._duelTimer = setTimeout(step, 50);
          }
        };
        this._duelTimer = setTimeout(step, 400);
      });
    },

    // ---- 决斗系统（op 60-68）----
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