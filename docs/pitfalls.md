# Pitfalls

三国志·姜维传 — HTML 重制版：做过的错误、代价和预防规则。
仿照 craft-anything pitfalls.md：条目短小精悍，what happened → the rule。
读完再动第一处代码；每犯一次值得不重复的错误，补一条。

## 源码重建类

**main.js 对象字面量结构被 startAutoDuel 插入破坏（缺少开头 {）。** 从 git 恢复失败（pathspec not found）；从 HTML 构建产物提取也带了之前的错误代码，导致整个第二个 script 标签执行失败，window.JW.App 始终 undefined，构建无法通过。
- 重建 main.js 时，从 main_restored.js 提取 UI IIFE + App IIFE 尾部，手动补全 boot()/bindKeys/handleAction 等前半部分（用提供的完整原始 main.js 为真源），并在 duelSetup 前插入 startAutoDuel。语法用 `new Function()` 逐块验证。
- 规则：重建对象字面量时，先确认首个 `{` 存在；每插入一个方法块，检查前一个块末尾是否缺少逗号；写完后必须用 `new Function()` 过语法，再构建，再 ego-browser 确认 `window.JW.App` 就绪。

**两个 IIFE 相连缺少分号。** `})();(function () {` 虽然语法合法，但某些压缩/解析场景下容易误判；更大隐患是 startAutoDuel 被错误插入到两个 IIFE 之间。
- 规则：两个 IIFE 之间保留空行分隔，不依赖隐式分号；插入新代码块前，先确认周围 IIFE 边界完整。

**App 对象字面量中重复 `};`。** appBody 已包含 App 对象结尾 `};`，appTail 再加一次，导致语法错误。
- 规则：拼接代码块时，明确标注哪一块负责 `const App = {` 和哪一块负责 `};`，避免重复。

**模板字面量在 run_code 里写含反引号/${ 的 JS 文件失败。** 模板字面量转义 ` 和 ${ 会产出字面反斜杠，导致语法错误。
- 规则：在 run_code 里写含反引号/${ 的 JS 文件，用单引号逐行数组 join 写入，不要用模板字面量。

**ego-browser evaluate 有 15s 硬超时。** 页面侧异步操作（intro 完成、pollScriptEvents）不能在单个 evaluate 里等待，否则 PageEvaluationTimeoutError。
- 规则：把长耗时操作拆成多个快速 evaluate，中间用 `page.waitForFunction()` 轮询页面侧状态；每个 evaluate 快速返回，不做阻塞等待。

**startAutoDuel 被重复插入。** main_restored.js 中发现两处 startAutoDuel 块（第 1-14 行和第 2638-2650 行），说明之前的修复操作产生了重复代码。
- 规则：修复前先搜索全文是否已有同名代码；只保留一份，移除重复块，再语法验证。

**从 HTML 构建产物提取 main.js 时，产物本身可能已包含错误代码。** 之前用损坏的 main.js 构建，HTML 也包含错误代码，提取后仍损坏。
- 规则：优先从独立源文件（main_restored.js 的干净部分 + 提供的完整原始）重建；若必须从 HTML 提取，先确认该 HTML 是由已验证通过的源代码构建的。

**duelAction HP 计算 Bug：`d.hp1 = atk - dmg`。** `atk` 是攻击者当前 HP，不是防御者 HP，导致防御后 HP 反增（zyDmg2=0, finalHp1=142>140）。
- 规则：duelAction 里防御者剩余 HP 必须用 `def - dmg`（def 为防御者当前 HP），不要用 `atk - dmg`；改完后必须跑防御减伤实战验证（普通攻击后防御，再攻击，伤害应减半）。

**防御标记方向错误。** 防御时把 `_defend` 标记在 defender（被攻击方）而非 attacker（选防御的一方），导致减伤未生效。
- 规则：防御动作标记的是“下次受伤减半”的一方，即执行防御动作的 attacker，不是被攻击的 defender。

**单挑 _duelResolve 未调用。** duelEnd 隐藏界面但没 resolve 攻击流程中的等待 Promise，导致攻击流程永远挂起。
- 规则：duelEnd 必须在 hideDuel 后调用 `this._duelResolve()`（如有），把等待中的攻击流程释放，再 `this._duel = null`。

## 构建与验证类

**构建前未验证源文件语法。** 直接 `node build.mjs` 出错后才发现某个模块有语法错误，浪费构建时间。
- 规则：构建前对 src/*.js 逐个用 `new Function()` 做语法检查，全部通过再构建。

**verify-*.mjs 零散脚本未清理。** 多轮验证留下大量临时 .mjs，干扰项目结构。
- 规则：每轮验证结束后删除临时 verify-*.mjs；结构化验证集统一放在 checks/ 目录。

## 逆向类

**EEX 解码器 4 处修正（op0x05 非tagged / op1 IF / op3 ELSE / op46/47 循环数）未及时文档化。** 导致后续部署真值与解码结果对不上。
- 规则：每处逆向修正立即记入 S_00_scene0_true.txt 或逆向笔记，并注明 EXE 直证地址（如 FUN_0047fab5、FUN_00449b27）。

**strategyUsable null 守卫缺失。** 某些策略对象为 null 时直接访问属性导致崩溃。
- 规则：所有访问策略/物品对象属性的地方，先加 null 守卫（如 `strategyUsable && strategyUsable.xxx`）。

## 结算链类（2026-11-06 R6）

**双路径死锁：交互单挑 vs 脚本单挑电影。** 攻击驱动 startAutoDuel 弹交互 duel 屏挂起 attack()，同时脚本 duel_setup 弹电影等 duelEnd resolve；poll 只在行动检查点跑，attack() 未返回=检查点永不到→双双卡死 80s+。
- 规则：startAutoDuel 先扫描当前场景是否有条件满足的匹配 duel_setup 段，有则让位脚本链（await pollEexEvents()），不开交互决斗。

**poll 并发重入。** 自锁旗在长链末尾（sec10: flag0 在 idx48），链 await 期间每个 unitDone 检查点重选同段从头再跑 → scriptBattleOver 洪泛 10+ 次、_eexScene 过冲。
- 规则：pollEexEvents 入口 `if (this._scriptPause || this.state !== "playing") return true;`——原版事件循环是串行的，演出中/结算后不得重入。

**旗名不匹配断链。** actor_select 写 zhaoRemoved，联动检查读 zhaoRetreated，event5 永不置位，sec10 永不触发。验证结算链必须打印 flags 键集合对照。
- 规则：跨模块用字符串键传状态时，写入点和读取点必须同轮 grep 对齐；改一处必查另一处。

**Windows 下 ego 脚本输出走 stdout 管道会丢。** execSync 超时/非零退出时 stdout 半截。
- 规则：ego 输出统一重定向到文件（`cmd /c "ego ... > _out.txt 2>&1"`）再 fs.readFileSync 读。

## 真值提取类（2026-11-06 R7）

**表类数据不必走 Ghidra**：PE 段表 VA→FO 换算直接 fs 读字节，10 秒出全表；Ghidra 反汇编用来找表地址和读取指令，数值以 PE 直取为准。
**单处 replace 命中同文本多处**：`eng.replace(old,neu)` 只改第一处且可能不是目标处——跨函数同名片段必须先 grep 计数（split/join 全量替换或带行号定位）。
**数组改对象后访问点回归**：`OBJ[sid] != null` 对数组同样成立（越界=undefined→0），无需改访问点；但 `Object.keys` 遍历会断，改表时全局搜表名。

## 回归方法类（2026-11-06 R9）

**覆盖扫描用源码字符串包含判断 op 名**：`b._runActions.toString().includes('"popup"')` 静态判定 + 功能级 `_runActions([{name:op,...}])` 注入实测，比逐章打剧情快两个量级。
**并发脚本会覆盖气泡文本**：验证 popup/dialog 链路要查持久侧（ui.battleLog 数组），不能查瞬时 DOM（会被 intro 的 unitSay 覆盖）。
**battle choice 等待必须置 _scriptPause**：否则 poll 检查点会在等待用户点选期间重入选段（R6 重入洪泛同族问题）；60s 超时默认第一项防卡死。

## 逆向判定类（2026-11-06 第65轮）

**引擎功能开关必须先证写入点再实现。** 序章 NPC 台词宣称的功能（方向加成/地形利用）对应开关 [0x505f88] 全 EXE 扫描无任何写入、数据初值 0 —— 恒关闭，台词是引擎模板残留。看到文案就实现功能=反 1:1。判定法：A3/C6 05/88 0D 三种写入形态 + 数据段初值 全扫。
**往章节 intro 数组中间插 op 会打乱 if/end 索引。** 我们的 EEX IF 用 end=绝对索引 跳转，插一条全体偏移；改 intro 只能尾部追加或整表重算。本轮 ch00 落旗 3000 即此因回退。
**同一替换文本可能命中多处同名片段。** R7 把 physicalDamage 里的 defender.tid 也"顺手"改成了 target.tid（该函数参数名是 defender），雪天分支必 ReferenceError；跨函数同名语句先按函数体切段再替换，或替换后立即 grep 语义核对参数名。
**PE 反汇编优先本地 capstone（disasm_at.py），不要等 Ghidra。** analyzeHeadless 对本 exe 常超时，capstone 秒级出全函数；调用图用 e8 rel32 全段扫描自建（本 mod 代码段在 .text + .data2 两处）。

## 渲染链类（2026-11-06 第66轮）

**Phaser loader 在运行时场景内不可依赖**：本项目的 BattleScene 是 create 同步构建、无 preload 批次；场景中途 this.load.spritesheet+load.once("complete") 的回调可能永不触发（loader 空闲态 start 后 complete 事件时序不稳）→ umov/atk/spc 全部静默失败，战场单位不显示、动画不播。规则：运行时贴图一律 new Image().onload + textures.addSpriteSheet/addImage（地面贴图同款已验证路径）。
**贴图未就绪创建的精灵必须回填**：textures.exists 为 false 时 img=null 直接 return，之后没有任何路径会补建 → 单位永久隐形但逻辑正常（点击/攻击都能命中，最难查的视觉 bug）。规则：异步纹理就绪回调里检查 rec.img 仍为空则补 add.image 并同步 alpha/flip/displaySize。
**验证动画时序前必须先证明贴图加载成功**：texExists=false 时 playUnitAction 静默早退，测得 ms=0 会误判成"RAF 节流"。规则：探针顺序 = 贴图 exists → 帧数 → 墙钟耗时 → 截图目视。
**引擎事件必须有消费端**：unitAppear/unitReenter 在 engine 发了多年，main.handleBattleEvent 从未接 → 现身单位隐形但可点可打（逻辑与渲染两套账）。规则：新增 onEvent type 时全局 grep 该字符串确认 main/ui 有 case；回归加"场上单位数==精灵数"计数断言。

## 音源/数据格式类（2026-11-06 第67轮）

**原版 wav 不全是 PCM**：Se52.WAV 是 IMA ADPCM（codec=2、4-bit、blockAlign 2048），Chromium <audio> 直接 onerror（原版靠 DirectSound 硬解）。规则：音源入库时逐个查 fmt chunk 的 codec 字段，非 1(PCM) 的必须离线转码；转码器固化为幂等脚本 tools/se-adpcm-fix.cjs。
**大写 .WAV 扩展名**：拷贝到 assets 时统一成 .wav，但 playSE 拼的是小写路径——转码/拷贝脚本要 .WAV→.wav 归一，否则 file:// 大小写敏感平台 404。
**地形防御系数有 tid 别名**：0x43f7c3 把浅滩/沼泽归到池塘、雪原/大河归到小河同一系数，直接按 tid 索引会算错水/雪系地形防御。规则：查 person 地形表时对照 EXE 的 cmp/jmp 归并分支，别假设 tid 一一对应。

**剧本 op 语义必须逐 handler 破译，不能靠单章侥幸归纳。** op_4b 在 S_00 表现「隐藏+等 4c 现身」是因为该章恰有 unit_op_4c[0,0,0]；原版 handler 0x415e36 实际是「在场单位直接挪位」。按一章归纳实现导致 47 章主将开局隐形。规则：给 op 下语义前，扫全数据该 op 的 person/参数分布 + 找 handler 反汇编逐行核对，并统计「依赖该 op 后续动作」的章数。

**兜底条件要按不变量写。** 「sideUnits 全空才兜底入场」漏掉了「非空但主将缺席」的章；原版不变量是「姜维恒在场」，条件应写成不变量的否定（!some(pid===0)）。
