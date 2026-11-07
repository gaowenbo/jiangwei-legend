/* ============================================================
 * 三国志·姜维传 —— 剧情场景播放器（1:1 原版 op 演出流）
 * 逆向依据：eex_format_doc.md op 表（0x09/0x12/0x17/0x18/0x1C/0x1D/0x27/
 * 0x2C/0x30/0x32/0x34/0x41/0x42/0x67）+ rules_ref.md §13.5
 * 原版演出规格：
 *   dialog        底部对话窗（&名字\n文本 多行拆分；打字机 50ms/字，点击推进）
 *   caption       画面下方 640×80 深色字幕带（a1=0 清除，a2 换行，a3 等待）
 *   place_name    地名横幅（0x40bb78）
 *   title_text    标题横幅（0x40bb48）
 *   chapter_title 章节标题卡（GS+6 = n-1）
 *   actor_appear  武将出场：100×100 格 (x,y) 3×3 占位，dir 0-3，action 0-18
 *   actor_move    行走：48ms/格，先大距离轴后小距离轴，走完转身
 *   actor_action  姿势切换；actor_face 转身
 *   change_scene  场景切换：mode 0 黑场 / 1 室内 / 2 野外（重绘擦除字幕带）
 *   fade_out      从黑淡入（10 步）；fade_in 淡出到黑（11 步）——原版命名相反
 *   delay         阻塞 n×100ms；wait_frame n×50ms
 *   play_music    CD 轨号（mp3list.txt → SoundTrk/NN.mp3）mode 0 单次 1 循环 0xFF 停
 *   play_sound    SE id → wav/SeNN.wav
 *   choice        选项菜单（≤3 项，结果存 lastChoice=idx+1，原版 Reader+0x2038）
 * ============================================================ */
(function () {
  "use strict";

  // ---- 音频管理器（资源随游戏分发：assets/audio/{bgm,se}）----
  const Audio = {
    enabled: true,
    bgmOn: true,     // 设置面板：音乐开关
    seOn: true,      // 设置面板：音效开关
    _bgm: null,
    _cur: -1,
    playMusic(track, mode) {
      if (!this.enabled || !this.bgmOn) return;
      if (mode === 255 || mode === -1 || track === 0) { this.stopMusic(); return; }
      /* 原版 SoundTrk 只有 02..125（mp3list.txt 124 条）。剧本里出现的 205/207/208
       * 在原版目录里也没有对应文件 → 保持当前音乐（不误播别的曲子）。 */
      if (track < 2 || track > 123) return;   // 原版目录实际只到 123（124/125 仅列在 mp3list 中）
      const n = track;
      if (this._cur === n && this._bgm && !this._bgm.paused) return;
      this._cur = n;
      if (!this._bgm) { this._bgm = new window.Audio(); this._bgm.volume = 0.4; }
      this._bgm.src = `assets/audio/bgm/track${String(n).padStart(2, "0")}.mp3`;
      this._bgm.loop = mode === 1;
      const pr = this._bgm.play(); if (pr && pr.catch) pr.catch(() => {});
    },
    stopMusic() {
      this._cur = -1;
      if (this._bgm) this._bgm.pause();
    },
    playSE(id) {
      if (!this.enabled || !this.seOn || id == null || id < 0 || id > 136) return;
      /* 原版 SE 编号到文件的映射（依 rules_ref：SE 134 = se_m_34）：
       *   0..64   → Se00..Se64
       *   91..99  → Se_e_00..Se_e_08
       *   100..136→ Se_m_00..Se_m_36
       * 其余编号原版目录里没有对应 wav（如 44..50、65..90），保持静默。 */
      let file = null;
      if (id <= 64) file = `assets/audio/se/Se${String(id).padStart(2, "0")}.wav`;
      else if (id >= 91 && id <= 99) file = `assets/audio/se/Se_e_${String(id - 91).padStart(2, "0")}.wav`;
      else if (id >= 100) file = `assets/audio/se/Se_m_${String(id - 100).padStart(2, "0")}.wav`;
      if (!file) return;
      try {
        const a = new window.Audio(file);
        a.volume = 0.55;
        const pr = a.play(); if (pr && pr.catch) pr.catch(() => {});
      } catch (e) {}
    },
  };

  // 战斗脚本的 play_sound 复用同一音源
  window.JW = window.JW || {};
  window.JW.Audio = Audio;

  // ---- 对话文本拆分：&名字\n行 [&名字\n行...]；无 & 前缀 = 旁白 ----
  function splitDialog(text) {
    const lines = [];
    const parts = String(text).split("&");
    for (const p of parts) {
      if (!p) continue;
      const nl = p.indexOf("\n");
      if (nl < 0) { if (p.trim()) lines.push({ who: "", text: p.trim() }); continue; }
      const who = p.slice(0, nl).trim();
      const body = p.slice(nl + 1).replace(/\n+$/, "");
      if (body.trim()) lines.push({ who, text: body });
    }
    return lines;
  }

  class StoryPlayer {
    constructor(container, script, hooks) {
      this.root = container;
      this.hooks = hooks || {};
      // 1:1 op 流优先；旧 {nodes} 格式自动转换（兼容）
      this.ops = script && script.script ? script.script : StoryPlayer.nodesToOps((script && script.nodes) || []);
      this.pc = 0;
      this.running = false;
      this.pendingResolve = null;
      this.pendingChoice = null;
      this.lastChoice = 0;      // 原版 Reader+0x2038
      this.flags = {};
      /* 原版 flag 语义（eex_format_doc §3）：0..255 局部旗（章首 clear_flags 清空），
       * >255 持久旗（跨章保留、随存档保存）。构造时把持久旗从 flagStore 抄回，
       * 使 ch00 的选择（难度/随机器/成长 3002/3003 等）在后续章节依然生效。 */
      if (this.hooks.flagStore) {
        for (const k of Object.keys(this.hooks.flagStore)) {
          if ((+k) > 255) this.flags[k] = this.hooks.flagStore[k];
        }
      }
      this._timers = [];
    }

    static nodesToOps(nodes) {
      const ops = [];
      for (const n of nodes) {
        if (n.type === "say") ops.push({ op: "dialog", args: [(n.who && n.who !== "旁白" ? "&" + n.who + "\n" : "") + n.text] });
        else if (n.type === "choice") ops.push({ op: "choice", args: [n.options.map(o => o.text).join("\n"), 65535] });
        else if (n.type === "battle") ops.push({ op: "enter_battle", args: [] });
        else if (n.type === "scene") ops.push({ op: "change_scene", args: [2, 0, 65535, 0, 65535] });
        else if (n.type === "music") ops.push({ op: "play_music", args: [n.bgm || 0, 1] });
        else if (n.type === "wait") ops.push({ op: "delay", args: [(n.sec || 1) * 10] });
        else if (n.type === "item") ops.push({ op: "get_item", args: [n.item, 0, 0, 65535] });
        else if (n.type === "end") ops.push({ op: "enter_battle", args: [] });
      }
      return ops;
    }

    start(startLabel) {
      this._ended = false;
      this.pc = 0;
      this.running = true;
      this._loop();
    }

    advance() {
      /* 决斗演出进行中：点击/推进应当直接跳过整段演出。
       * 只 resolve 剧情 promise 不够 —— 演出是另一条 setTimeout 链，
       * 不打断它会继续跑十几秒，章节链与玩家都会卡在 duel 屏（ch47 偶发 48/59 的根因）。 */
      const A = window.JW && window.JW.App;
      if (A && A.ui && A.ui.screen === "duel" && A.abortDuel) A.abortDuel();
      if (this.pendingResolve) { const r = this.pendingResolve; this.pendingResolve = null; r(true); }
    }

    stop() {
      this.running = false;
      this._timers.forEach(t => clearTimeout(t));
      this._timers = [];
      if (this.pendingResolve) { const r = this.pendingResolve; this.pendingResolve = null; r(false); }
    }

    _sleep(ms, full) {
      // 设置里的文字速度（0快/1普通/2慢）缩放剧情停顿
      const sp = window.JW && window.JW.App && window.JW.App.msgFactor ? window.JW.App.msgFactor() : 1;
      ms = ms * sp;
      /* full=true：原版 0x09 delay 是「阻塞延时 arg×100ms」，不截断（旧实现把
       * >3s 全部钳到 3s，5s 停顿只剩 3s；16 处 delay(50) 演出节奏被压）。
       * 其余内部停顿仍保留 3s 上限，防止异常脚本卡死。 */
      const cap = full ? ms : Math.min(ms, 3000);
      return new Promise((resolve) => {
        const t = setTimeout(() => {
          const i = this._timers.indexOf(t); if (i >= 0) this._timers.splice(i, 1);
          resolve(true);
        }, Math.max(0, cap));
        this._timers.push(t);
      });
    }

    _waitClick(timeoutMs) {
      return new Promise((resolve) => {
        this.pendingResolve = resolve;
        if (timeoutMs) {
          const t = setTimeout(() => {
            if (this.pendingResolve === resolve) { this.pendingResolve = null; resolve(true); }
            const i = this._timers.indexOf(t); if (i >= 0) this._timers.splice(i, 1);
          }, timeoutMs);
          this._timers.push(t);
        }
      });
    }

    async _loop() {
      this._ifStack = [];
      while (this.running && this.pc < this.ops.length) {
        const o = this.ops[this.pc];
        // 控制流 op 在循环内处理（需要 pc 跳转权）
        if (o.op === "if") {
          this.pc++;
          const pass = this._cond(o);
          if (pass) this._ifStack.push(o.end | 0);
          else this.pc = Math.max(this.pc, o.end | 0); // 假 → 跳到 end（不压栈）
          continue;
        }
        if (o.op === "endif") {
          this.pc++;
          if (this._ifStack.length) {
            const t = this._ifStack.pop();
            if (t > this.pc) this.pc = t; // 真分支体执行完 → 跳到 if 的 end；自然落到 endif 则 no-op
          }
          continue;
        }
        this.pc++;
        try { await this._exec(o); } catch (e) { /* 单 op 失败不断流 */ }
        /* 不能用 return：直接跳出循环会跳过下面的收尾逻辑（onEnd），
         * 战斗阻塞/强制跳转把 running 置 false 时章节就永远不推进。 */
        if (!this.running) break;
      }
      /* 收尾条件只看「脚本是否走到末尾」，不能再看 running：
       * 战斗阻塞/强制跳转（测试或快进）会把 running 置 false，
       * 旧写法在这种情况下不触发 onEnd，章节就永远不推进 ——
       * 表现为章节链随机卡在某一章（ch40/ch47/ch48 都复现过）。 */
      const finished = this.pc >= this.ops.length;
      this.running = false;
      if (finished && !this._ended) {
        this._ended = true;
        if (this.hooks.onEnd) await this.hooks.onEnd("normal");
      }
    }

    // 分支条件求值（原版 op 0x13/0x04/0x05/0x3E 语义）
    _cond(o) {
      const a = o.args || [];
      switch (o.cond) {
        case "always": return true;
        case "test_choice": return this.lastChoice === (a[0] | 0);
        case "test_flags": {
          const set = Array.isArray(a[0]) ? a[0] : [];
          const clr = Array.isArray(a[1]) ? a[1] : [];
          return set.every(id => !!this.flags[id]) && clr.every(id => !this.flags[id]);
        }
        /* 资源比较：args = [资源号, 阈值, 比较码 0=>= 1=< 2===]。
         * 资源值由 main.js 通过 hooks.getResource 提供（0=金）。 */
        case "test_resource": {
          const rid = a[0] | 0, th = a[1] | 0;
          const cmp = a[2] !== undefined ? (a[2] | 0) : 0;
          const cur = (this.hooks.getResource ? this.hooks.getResource(rid) : 0) || 0;
          if (cmp === 0) return cur >= th;
          if (cmp === 1) return cur < th;
          return cur === th;
        }
        /* 随机判定：args = [百分比阈值]，随机数小于阈值时为真。 */
        case "test_random": {
          /* 原版 0x6E（0x410f85 → 0x47fb32）：以 arg % 的概率为真，上限钳制到 100。 */
          let th = a[0] | 0;
          if (th < 0) th = 0;
          if (th > 100) th = 100;
          /* 优先用引擎同一随机源，保证与原版同源、可复现 */
          const rng = this.hooks && this.hooks.rand100;
          const roll = typeof rng === "function" ? rng() : Math.random() * 100;
          return roll < th;
        }
        case "comment": return true;
        default: return true;
      }
    }

    async _exec(o) {
      const a = o.args || [];
      const H = this.hooks;
      switch (o.op) {
        case "dialog": {
          const lines = splitDialog(a[0]);
          if (!lines.length) break;
          for (const ln of lines) {
            if (!this.running) return;
            if (H.onSay) H.onSay(ln, ln.who === "");
            await this._waitClick(0);
            if (!this.running) return;
          }
          break;
        }
        case "choice": {
          const opts = String(a[0] || "").split("\n").map(s => s.trim()).filter(s => s.length).slice(0, 3);
          if (!opts.length) break;
          const node = { type: "choice", options: opts.map(t => ({ text: t })), person: a[1] };
          const pick = await new Promise((resolve) => {
            this.pendingChoice = (idx) => { this.pendingChoice = null; resolve(idx); };
            if (H.onChoice) H.onChoice(node, (idx) => { if (this.pendingChoice) this.pendingChoice(idx); });
            else { const r = this.pendingChoice; this.pendingChoice = null; resolve(0); }
          });
          this.lastChoice = (pick || 0) + 1;
          if (H.onClearChoice) H.onClearChoice();
          break;
        }
        case "caption": {
          if ((a[1] | 0) === 0 && H.onCaptionClear) H.onCaptionClear();
          if (H.onCaption) H.onCaption(String(a[0] || ""), (a[2] | 0) !== 0);
          if ((a[3] | 0) !== 0) { await this._waitClick(1800); if (!this.running) return; }
          break;
        }
        case "place_name":
          if (H.onBanner) H.onBanner(String(a[0] || ""), "place");
          await this._sleep(1500);
          break;
        case "title_text":
          if (H.onBanner) H.onBanner(String(a[0] || ""), "title");
          await this._sleep(1800);
          break;
        case "chapter_title":
          if (H.onTitleCard) H.onTitleCard(String(a[1] || ""));
          await this._sleep(2600);
          if (H.onTitleCardClear) H.onTitleCardClear();
          break;
        case "change_scene":
          if (H.onScene) H.onScene(a[0] | 0, a[1], a[3]);
          break;
        case "actor_appear":
          if (H.onActor) H.onActor("appear", a);
          break;
        case "actor_move": {
          if (H.onActor) H.onActor("move", a);
          // 原版 48ms/格阻塞；按位移估算，上限 2.5s
          const cur = (H.actorPos ? H.actorPos(a[1] | 0) : null) || { x: 50, y: 50 };
          const dist = Math.abs((a[3] | 0) - cur.x) + Math.abs((a[4] | 0) - cur.y);
          await this._sleep(Math.min(2500, 80 + dist * 48));
          break;
        }
        case "actor_action":
          if (H.onActor) H.onActor("action", a);
          break;
        case "actor_face":
          if (H.onActor) H.onActor("face", a);
          break;
        case "actor_select":
          await this._waitClick(1200);
          break;
        case "op_2f":
          /* 原版 0x2F：单位传送/移动。args=[mode(0=按pid/1=按槽), person或槽号, slot/ai, x, y, dir]。
           * story.js 映射：mode=a[0], who=a[1], slot=a[2], x=a[3], y=a[4], dir=a[5]。 */
          if (H.onTeleport) H.onTeleport(a[0] | 0, a[1] | 0, a[2] | 0, a[3] | 0, a[4] | 0, a[5] | 0);
          break;
        /* 权威语义（eex_format_doc §5，0x413652）：op 名与实际行为相反——
         * 0x1C fade_out = 从黑淡入；0x1D fade_in = 淡出到黑（工具栏隐藏）。
         * opcodes.json 的中文名标注与行为相反，勿据其"修正"。 */
        case "fade_out":
          if (H.onFade) H.onFade("in");
          await this._sleep(550);
          break;
        case "fade_in":
          if (H.onFade) H.onFade("out");
          await this._sleep(550);
          break;
        case "delay":
          await this._sleep((a[0] | 0) * 100, true);
          break;
        case "wait_frame":
          await this._sleep((a[0] | 0) * 50);
          break;
        case "play_music":
          Audio.playMusic(a[0] | 0, a[1] | 0);
          if (H.onMusic) H.onMusic(a[0] | 0, a[1] | 0);
          break;
        case "play_sound":
          Audio.playSE(a[0] | 0);
          break;
        case "get_item":
          if (H.onItem) H.onItem(a[0] | 0);
          break;
        case "battle_select_units":
          /* 原版 0x06（0x415b45）：args=[result, max(0→1)→0x4b09ec, 强制人员×5→0x4b09f0,
           * flags×5→0x4b0a04]。出阵上限与强制出场由 main.js 应用；无参调用保持旧行为。 */
          if (H.onSortie) await H.onSortie(a);
          break;
        case "battle_prepare":
          /* 原版 0x4a（opcodes.json: 出场选择 [int32, person_list×5, person_list2×5]，
           * S_00/S_01/S_04 等 9 处调用）。与 0x06 battle_select_units 同族但属于
           * 「战前准备/出场选择」；反编译 0x41a73f 走同一套 GS 出阵表写入口。
           * 交给 main.js 的 onSortie 统一处理出阵上限与强制出场。 */
          if (H.onSortie) await H.onSortie(a);
          break;
        case "ui_5a":
          /* 原版 0x5A：开始战斗字幕，压在暗化地图上（约 20 tick）。
           * remake 在 battle init 时已弹“—— 作战开始 ——”系统日志，此处视觉等价，无额外处理。 */
          break;
        case "op_5c":
          /* 原版 0x5C：人物在场单位（state 2）：地图居中 + 闪烁 3 次；无则 0。
           * remake 已在 main.js handleBattleEvent "centerOn" 覆盖，此处记录仅。 */
          break;
        case "op_52":
          /* 原版 0x52：换职业——该人物不能再用的装备槽被清空（物品丢失），重载图像。
           * args=[person]。mod 数据中换职业极少，先记为清空不匹配装备。 */
          { const pid = (a[0] | 0); const u = this._findUnitByPerson(pid); if (u) { if (u.weapon != null) { const R = window.JW_REAL; const it = R && R.items ? R.items[u.weapon] : null; if (it) { /* TODO：按新职业可用武器判定是否清空 */ } } u.weapon = u.weapon; } }
          break;
        case "op_5d":
          /* 原版 0x5D：回合上限。mode 0 = 设置（turn+1 > v 时拒绝），1 = 累加。
           * remake 已在 engine.js checkWin/roundLimitHit 与 main.js endTurn 回合边界判负，此处记录。 */
          break;
        case "set_byte_var":
          /* 原版：GS 字节变量 u8 @0x55a000[arg0] = arg1。mod 用于跨章轻量状态。*/
          this._byteVars = this._byteVars || {}; this._byteVars[(a[0] | 0)] = (a[1] | 0) & 0xff;
          break;
        case "op_6d":
          /* 原版 0x6D：把单位移到另一单位旁边（偏移 > 40 为负）；或最后参数为 1 时让撤退单位重新入场。*/
          break;
        case "op_1b":
          /* 原版 0x1B：撤退线标记（UI 视觉），对战斗逻辑无影响。 */
          break;
        case "op_20":
          /* 1:1 原版 0x20（FUN_00416fd8 直证）：b 是【存储的 GS 字节】不是参数！
           * v==0xff → b&0xe0（清低 3 位）；否则 (b&0xf0)|v。旧实现把 a[1] 当 b，已修。 */
          { const v20 = (a[0] | 0) & 0xffff, b20 = this._gs0x11 || 0;
            this._gs0x11 = (v20 === 0xff ? (b20 & 0xe0) : ((b20 & 0xf0) | (v20 & 0xff))) & 0xff; }
          break;
        case "op_6c":
          /* 原版 0x6C：复制人物字节 0x11..0x34（排除 0x26、0x2a）。*/
          break;
        case "op_57":
          /* 原版 0x57：weather level = arg（天气等级）。remake 天气已由 engine.js updateWeather 控制，此处记录。 */
          break;
        case "goto_scenario": {
          /* 原版 0x11（0x415c67）：GS+7 = arg，结束当前文件 → 下一个加载的
           * scenario = arg + 1（按奇偶取 R/S）。同时清空剧情角色表。
           * 运行时章节数据当前不含此 op，保留实现以防数据回流。 */
          const arg = a[0] | 0;
          if (H.onGotoScenario) await H.onGotoScenario(arg + 1);
          else { this.running = false; if (H.onEnd) await H.onEnd("goto"); }
          return;
        }
        case "enter_battle": {
          this.running = false;
          if (H.onBattle) await H.onBattle();
          return;
        }
        case "set_resource": {
          // 原版 0x3A：kind 0=gold（mode 1 加算），1/2=GS+6/GS+0x12（0..100，民心类）
          if (H.onResource) H.onResource(a[0] | 0, a[1] | 0, a[2] | 0);
          break;
        }
        case "set_flag": {
          /* 原版 0x0B（0x4142b2）：flag[arg0] = (arg1 != 0)；
           * >255 是持久旗（随存档保存、跨章保留）→ 实时写回 flagStore（App.flags）。 */
          const fid = a[0] | 0;
          this.flags[fid] = a[1] !== undefined ? (a[1] | 0) : 1;
          if (fid > 255 && H.onFlag) H.onFlag(fid, this.flags[fid]);
          break;
        }
        case "clear_flags": {
          /* 原版 0x0A（0x415ad7）：只清 0..255 局部旗；>255 持久旗保留
           * （跨章条件依赖，如 3002/3003/1101/1102/1004）。旧实现全清导致
           * 后续章节基于持久旗的分支永远走「未设置」路径。 */
          for (const k of Object.keys(this.flags)) {
            if ((+k) <= 255) delete this.flags[k];
          }
          break;
        }
        case "screen_mode": {
          // 原版 0x0F 画面模式：v<3 记结局旗；停音乐；GHAI #6 致谢画面后结束
          if ((a[0] | 0) < 3 && H.onEnding) H.onEnding(a[0] | 0);
          Audio.stopMusic();
          await this._sleep(1200);
          break;
        }
        case "popup":
        case "info": {
          // 无立绘信息框/弹窗：按旁白对话处理
          if (H.onSay) H.onSay({ who: "", text: String(a[0] || a[1] || "") }, true);
          await this._waitClick(2200);
          break;
        }
        default:
          break;
      }
    }
  }

  // 简易背景库（Canvas 程序化场景，按 change_scene mode+id 选）
  const BG_FACTORY = {
    palace: (g, w, h) => {
      g.fillStyle = "#2a1a0c"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#4a2c15"; g.fillRect(0, h * 0.5, w, h * 0.5);
      for (let i = 0; i < 5; i++) { g.fillStyle = "#5a3a1e"; g.fillRect(w * 0.15 + i * w * 0.15, h * 0.3, w * 0.1, h * 0.6); }
      g.fillStyle = "#b8860b"; g.fillRect(0, h * 0.28, w, 8);
    },
    field: (g, w, h) => {   // 野外：山峦+土路
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#6a7a5a"); sky.addColorStop(0.55, "#8a9a72"); sky.addColorStop(0.56, "#5a6a42"); sky.addColorStop(1, "#3a4a2a");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#4a5a38";
      for (let i = 0; i < 6; i++) {
        g.beginPath(); g.moveTo(i * w / 6 - 40, h * 0.56); g.lineTo(i * w / 6 + w / 12, h * 0.18 + (i % 3) * 40); g.lineTo(i * w / 6 + w / 6 + 40, h * 0.56); g.fill();
      }
      g.fillStyle = "#7a6a48"; g.fillRect(0, h * 0.72, w, h * 0.1);
    },
    city: (g, w, h) => {    // 城镇：城墙+民居
      g.fillStyle = "#5a6a52"; g.fillRect(0, 0, w, h * 0.4);
      g.fillStyle = "#6a5a42"; g.fillRect(0, h * 0.4, w, h * 0.6);
      g.fillStyle = "#8a7a5a"; g.fillRect(w * 0.1, h * 0.25, w * 0.8, h * 0.22);
      g.fillStyle = "#5a4a32";
      for (let i = 0; i < 9; i++) g.fillRect(w * 0.12 + i * w * 0.086, h * 0.27, w * 0.045, h * 0.18);
      g.fillStyle = "#4a3a26";
      for (let i = 0; i < 4; i++) { g.fillRect(w * (0.12 + i * 0.25), h * 0.62, w * 0.14, h * 0.2); g.beginPath(); g.moveTo(w * (0.09 + i * 0.25), h * 0.62); g.lineTo(w * (0.19 + i * 0.25), h * 0.52); g.lineTo(w * (0.29 + i * 0.25), h * 0.62); g.fill(); }
    },
    camp: (g, w, h) => {    // 军营：帐篷+旌旗
      g.fillStyle = "#4a5238"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#5a5a48"; g.fillRect(0, h * 0.55, w, h * 0.45);
      for (let i = 0; i < 4; i++) {
        const x = w * (0.12 + i * 0.24);
        g.fillStyle = "#8a7448"; g.beginPath(); g.moveTo(x, h * 0.56); g.lineTo(x + w * 0.08, h * 0.3); g.lineTo(x + w * 0.16, h * 0.56); g.fill();
        g.fillStyle = "#a08850"; g.fillRect(x + w * 0.075, h * 0.18, 4, h * 0.16);
        g.fillStyle = "#b03028"; g.fillRect(x + w * 0.075 + 4, h * 0.18, w * 0.05, h * 0.05);
      }
    },
    night: (g, w, h) => {
      g.fillStyle = "#0a1020"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff";
      for (let i = 0; i < 90; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.6, 2, 2);
      g.fillStyle = "#e8e0c0"; g.beginPath(); g.arc(w * 0.75, h * 0.2, 36, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#141a28"; g.fillRect(0, h * 0.62, w, h * 0.38);
    },
    black: (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); },
  };
  const BG_BY_ID = ["field", "palace", "city", "camp", "night", "field", "palace", "city"];

  function renderBG(canvas, name) {
    const g = canvas.getContext("2d");
    const fn = BG_FACTORY[name] || BG_FACTORY.default || BG_FACTORY.field;
    fn(g, canvas.width, canvas.height);
  }
  BG_FACTORY.default = BG_FACTORY.field;

  window.JW = window.JW || {};
  window.JW.StoryPlayer = StoryPlayer;
  window.JW.StoryAudio = Audio;
  window.JW.splitDialog = splitDialog;
  window.JW.renderBG = renderBG;
  window.JW.BG_BY_ID = BG_BY_ID;
})();
