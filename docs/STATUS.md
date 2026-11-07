# Status

三国志·姜维传 — HTML 重制版：什么能工作，以及如何验证。
本项目按 craft-anything 方法论（Study → Build → Check → Ready，证据驱动、逐项对齐、干净室重构）推进。
最后更新：2026-11-06。基准审计在 main 上，构建产物 jiangwei-legend.html 11.4 MB，ego-browser 端到端验证。

## 什么能工作，以及如何验证

| Area | State | Verified by |
|------|-------|-------------|
| 主入口 / 标题屏 / 章节列表 | boot/bindKeys/handleAction 全可调，59 章加载，标题屏可见 | ego-browser：page.goto → window.JW.App.boot 自动执行 → chapters.length===59 → #title-screen 未 hidden |
| 移动 + 攻击（经典流程） | 点单位→mode=move+showMoveRange→点目标→行走→菜单→攻击→伤害 | ego-browser round-33：24/24 全过；实证点选 47 可达格→行走→菜单→攻击→伤害 19→hasActed |
| 攻击驱动单挑触发（op 0x60） | 攻击结束后攻击者持效果 26（凤凰羽衣）且目标存活 → 立即进入单挑，非回合结束 | ego-browser：姜维装凤凰羽衣(item 72, special=26)，传送到赵云旁攻击 → duelSeen=true → duelEnd → Promise resolve → 回 battle 屏，duelCleared=true |
| 单挑操作层（duel屏） | 立绘（Tou.dll 120×120）/VS/HP条百分比+血量文本/对话框/攻防绝退四选一菜单/攻击动画/命中闪烁/胜负结果/撤退 | ego-browser：duelSetup(0,25) → duelAction(0/1/2) 防御减伤 ×0.5（生效一次清除），修复 atk-dmg→def-dmg Bug（曾导致防御后 HP 反增） |
| 单挑剧情回放（op 0x63 duel_say2） | 第三个参数 person 作说话人，文本中 * 替换人物名（FUN_004179a5），自动回放至 duel_start | engine.js playDuelCinematic 已实现；duel_say/duel_say2 case 已增加 person 参数和 * 替换 |
| 部署 AI（敌军回合） | ai_mode 0-6（被动/主动/坚守/攻击武将/到达地点/跟随/逃至），aiStepToward/aiChoosePosition/aiPhysScore | ego-browser：结束我方回合 → 敌军从 (-1,-1) 入场移动到 (12,7) 等坐标，round 1→2，phase 回到 player |
| 等级缩放 | lv = min(脚本lv + max(1, 基准), cap)，敌方 cap=110、我方 99；基准 = 我方全队等级降序前 min(4,n) 人均值 | EXE 直证 FUN_0047fab5 / FUN_0041885a；S_00 开场姜维+尹赏 lv1 → 基准 1 → 赵云 lv4+1=5 |
| dir→flags 位 | 0→0x20、1→8、2→0x40、3→0x10 | EXE 直证 FUN_00449b27 |
| spriteIndex 公式 | ov!=0 → ov<0x21 ? (ov-1)*3+0x50+(spr%3) : ov+0x8f；ov==0 → base=cls（兵种） | real.js 修正（轻骑兵 idx27、步兵 idx9、弓兵 idx18、赵云 408、邓芝 489、尹赏 361、姜维 0） |
| 战斗脚本解码器（EEX） | op0x05 test_flags 非tagged（tag35列表×2）；op1 IF/op3 ELSE；op46/47 循环数取 params.repeat | S_00 scene0 解 124 条存 reverse/S00_scene0_true.txt；4 处修正 |
| 部署真值（变体 A/B） | 尹赏+姜维入场坐标/方向；敌方 18 条 b2=1 隐藏；演出 op_4c 现身 7 人 + 11 援军隐藏 | S_00.eex 解码验证；flag1001 来自 ch00 R_00 对话 '使用策略/不用什么小手段' 选 1 set_flag[1001,1] |
| 存读档边界 | 存档 saveOk=true；读档后 gold/flag/lvl/HP/phase/state 正确恢复（HP 按 applyRoster 跨战斗满值） | ego-browser：saveGameTo(1) → loadGameFrom(1) → gold=12345/flag999=1/lvl=5/HP=140（maxHp） |
| itemUsableRange | 物品表无 range 字段（全部 undefined），固定返回 1（相邻）正确 | game_data.json items 表检查；engine.js itemUsableRange() 固定返回 1 |
| 胜负判定 | 敌军全灭/脚本 forceWin/我方全灭/主将阵亡/回合上限/目标区域/survive；S_00 完整结算链贯通 | ego-browser：duelCinematic→scriptRemove→event5→scriptBattleOver(1次)→result 屏「大 捷」→nextChapter=ch01→unlocked=ch00,ch01（reports/R6-s00-settle.txt） |
| 商店/仓库 UI | 库存按 JW_SHOPS[shopRec] 过滤；买=price×100（贾逵在队×0.8）、卖=price×75；仓库条目按下标定位 | ego-browser 点击级：3/3 行匹配 rec、买 100 金入仓、卖 +75 金清格、八折 ratio=0.8、面板打开（checks/007，5/5 PASS） |
| 回归测试 | round-33 24/24、battle-events 8/8、story-scene 4/4、round-31 7/7、round-30 6/6 | 构建后 ego-browser 逐关验证 |
| 入场部署语义 | op_4b（0x415e36）=在场单位直接设坐标朝向（非隐藏登记）；姜维由 allies 65535 空位+出阵名单入场；47 章「op_4b 无 4c 现身」主将隐形已根治（跨章抽查 ch02/06/16/28/42/55 6/6 落位） | ego：S_01 姜维 (23,18)dir3 落位+21/21 精灵可见+剧情败北 scriptStoryEnd→ch02 解锁；S_00 回归 (12,11) 不变（checks/012） |
| 范围高亮/光标 | 原版光标是键盘格子光标（0x40eb54 取模环绕 + 0x40eb97 钳制，攻击流程每回合重置到 (18,0)）；移动范围浅黄 0xffe68c、攻击范围红 0xc8281c、光标金框 0xffd873、闪烁 160ms×3 | ego 截图：移动 47 格浅黄/攻击 4 格红/姜维金框光标全可见（checks/014，4/4 PASS） |
| 顶栏系统菜单 | 原版 12 项标签（结束游戏/保存/读取/环境设定/武将一览/持有道具一览/地形情报一览/宝物图鉴/胜利条件/检索未执行部队/战场缩小图/结束回合，PE 0x48e8c4..0x48e94c 直取；分发器 0x475140）；此前顶栏纯装饰 | ego 点击级 9/9：三下拉项名逐字匹配、武将/地形/检索/保存/结束游戏全响应（checks/013） |
| 全章回归 | 59/59 章 startBattle 无异常、无页面 error；65 种脚本 opcode 全被引擎处理（popup/info/play_music/set_resource/battle_prepare/choice+test_choice 6 种本轮接入） | ego-browser Tier1/Tier2 + 功能级注入实测（checks/008） |
| 策略伤害 | STRAT_POWER[73]@0x43c31e 真值数组（原 7 处错位）、整数 DIV3 截断、天气地形表 0x48e100 逐字节一致 | PE 直取 + ego 对照：姜维vs赵云 sid0/1/2/3/4/5/9/20/22 九项 engine=manual 全 match（checks/006） |
| 动画时序 | 原版公式 时长(tick)=帧数×128/速度系数(基准64)：atk 12帧=24tick=960ms、spc 5帧=400ms、行走 160ms/格；贴图加载改手动 Image+addSpriteSheet（Phaser loader 在本场景从不触发是历史根因）；单位精灵异步回填 | ego 墙钟：atk 989ms/spc 416ms/walk 3格612ms；4 处渲染链 Bug 修复（贴图手动加载/精灵回填/现身建精灵），onfield=9/withImg=9 截图实证（checks/010） |
| 地形防御系数 | 0x43f7c3：A/D 合成读 person[tid]，浅滩9/沼泽10→池塘11、雪原7/大河13→小河12 别名映射（此前缺失，已补）；效果42/0x403a6f 减1 分支本 mod 无物品=死码 | ego 别名断言 雪原7==小河12/浅滩9==池塘11/沼泽10==池塘11/大河13==小河12 全 PASS（checks/011） |
| SE/BGM 音效 | 音源 104 wav+123 mp3 与原版逐一同源；编号映射 0-64/91-99/100-136 规则一致；Se52 系 IMA ADPCM 浏览器不可解，已转 16-bit PCM（tools/se-adpcm-fix.cjs 幂等） | 浏览器 oncanplaythrough：Se00/19/52(879ms)/91/100/134、BGM track02 全 ok；越界编号静默（checks/011） |
| 构建产物 | 单文件 HTML，离线可打开，Phaser 3 内联 | node build.mjs → jiangwei-legend.html 11.4 MB |

## 攻击流程深度逆向（2026-11-06 第65轮，checks/009）

| 项 | 证据 | 结论 |
|---|---|---|
| 命中/会心/双击曲线 | 0x43b50c/0x405d0a/0x405d5b capstone 全函数 | attr3 速度三段 +90/60/30、attr4 运气会心，与实现一致 ✓ |
| 物理伤害 12 段 | 0x43bc62 全函数逐行 | lvl+25、(A-D)>>1、相克表、×3/4、保底1、上限HP 全对齐 ✓ |
| 方向加成 | [0x505f88] 全扫描零写入、初值 0 | 恒关闭，不实现才是 1:1（序章台词=引擎残留）✓ |
| 伪随机 | [0x505fb4] 零写入、初值 2 | 恒真随机，Math.random 等价 ✓ |

## 未验证（待办）

| Area | 缺失 | 计划 |
|------|------|------|
