# Roadmap

三国志·姜维传 — HTML 重制版：1:1 逆向还原的共享计划。
仿照 craft-anything ROADMAP.md：每个 change 有 id（R<里程碑>.<n>）、owner、status 和 pending changes。
ids 永不复用或重编号；commit、代码注释和 PR 引用 id。

## 使用方法
- **Claiming：** 开始前，把 `— claimed: <姓名>, 分支 <分支>` 写在 pending change 上，并尽早 push 分支（或开 draft PR），让别人看到。不要接别人已 claim 的 change。`— in PR #n` 标记一个 PR 已覆盖：review 该 PR 而不要重新开始。
- **Finishing：** 在原处打勾（`[x]`），加上 commit 或 PR，如有变化更新 `docs/STATUS.md`，并在 `log/devlog.md`（若有）加一行。维护者把打勾的行移到 `roadmap-history.md`。
- **New work：** 在所属条目下加 `- [ ]` 行；新条目取下一个空闲 id。
- **Status：** `todo` · `in progress` · `blocked (<原因>)` · `done`。
- 遵守 `AGENTS.md`（分层、不崩溃、一切皆工具，外部程序走 `platform::process`）和架构规则。

## 架构规则
1. **Traits plus a registry, not enums。** 目标种类、检查项、构建器、资源提供器、外部引擎走 trait + registry，内置实现。新增一个 = 加一个文件 + 一条注册行（如工具已工作）。
2. **Data over code for catalogues。** 栈、游戏引擎构建配方、模型 id 和价格、引擎安装 pin 存为类型化表（或嵌入的 TOML），不写进字符串匹配或提示文本。
3. **Headless first；flows 是工具。** 所有东西在无 GUI 时都能工作。人能从 UI 启动的（重建、后续、回答问题、引擎安装、启动结果）都能通过 `Engine::call` 和 CLI 到达，所以 MCP、代理、脚本和其他前端都能免费得到。编排、持久化和进程控制永远不在 GUI 或 apps/* 里。
4. **Versioned files。** 我们写并读回的每个文件都有版本号、有 JSON schema、有迁移路径。
5. **Structured results。** 诸如“构建是否通过”的决定读类型化字段，永不读英文文本前缀。

## 里程碑一览
| 里程碑 | 目标 | Owner | 状态（2026-11-06） |
|--------|------|-------|-------------------|
| R0 基础 | 源文件语法通过，构建产物 jiangwei-legend.html 能离线打开，App.boot 自动执行 | 代理 | done |
| R1 核心战棋 | 移动/攻击/围攻/交给/道具/情报/待机菜单，1:1 数值（姜维 cls0=fig0 十字，赵云 cls68=fig1 八向，弓兵2 cls6=fig2 射程2） | 代理 | done |
| R2 剧情脚本 | EEX 场景解码器（op0x05/0x1/0x3/0x46/0x47），S_00 scene0 124 条指令，部署真值变体 A/B | 代理 | done |
| R3 单挑系统 | op0x60/0x63/0x68/0x61/0x62，攻击结束后持效果 26 触发，duel 屏操作+显示，防御减伤，duel_say2 person 参数，* 替换 | 代理 | done |
| R4 部署 AI | ai_mode 0-6，aiStepToward/aiChoosePosition/aiPhysScore，敌军回合移动攻击 | 代理 | done |
| R5 存读档 | saveGameTo/loadGameFrom/_applySaveData/serialize/deserialize，边界验证通过 | 代理 | done |
| R6 胜负细节 | S_00 完整过关流程（单挑→赵云移除→event5→sec10 结算→ui_49 胜利→推进 ch01），双路径死锁+poll重入+event5断链 3 处修复 | 代理 | done |
| R7 策略伤害真值 | PE 直取四表（0x43c31e/0x4d21b0/0x43ba07/0x48e100），POWER 7 处错位修正+整数截断+defender.tid 修复，9/9 对照 PASS | 代理 | done |
| R8 驻地/商店/读档 UI | 4 处 UI 真 Bug 修复（库存过滤/回调参数/双重面板/仓库下标），5/5 点击级 PASS | 代理 | done |
| R9 回归完整 | Tier1 59/59 boot 无异常、Tier2 65 op 全覆盖（6 op 战斗层接入 popup/music/set_resource/prepare/choice/test_choice） | 代理 | done |

## 追加里程碑（深度逆向大目标）
| 里程碑 | 目标 | Owner | 状态（2026-11-06） |
|--------|------|-------|-------------------|
| R10 攻击流程深挖 | 命中/伤害/会心/双击/反击链逐函数核对；方向加成/伪随机开关证伪（恒关） | 代理 | done |
| R11 动画时序 | 0x450bde 公式(帧数×128/速度系数)；atk 960ms/spc 400ms/行走 160ms/格；4 处渲染链 Bug 修复（单位不显示根治） | 代理 | done |
| R12 地形防御+SE | 0x43f7c3 tid 别名映射修复（雪原/浅滩防御算错）；Se52 IMA ADPCM 转码；音源 104+123 与原版一致 | 代理 | done |
| R13 入场语义 | op_4b handler 0x415e36 破译=在场直接挪位（非隐藏）；修 47 章主将隐形；S_01 剧情败北链贯通 | 代理 | done |
| R14 顶栏系统菜单 | 12 项标签真值（0x48e8c4..0x48e94c）+ 分发器 0x475140；文件/功能/情报三下拉接入既有能力，9/9 点击级 PASS | 代理 | done |
| R15 范围高亮/光标 | 光标对象 0x40eb54/0x40eb97 环绕+钳制破译；移动浅黄/攻击红/金框光标/160ms闪烁截图实证 4/4 | 代理 | done |

## Pending changes（可独立合并的最小单元）

### R6 胜负细节
- [x] R6.1 走完 S_00 intro 剧情，设置 flag3，验证单挑后赵云撤退 → event5 → ui_49 → finishBattle(win) —— 2026-11-06 完成，见 checks/005 + reports/R6-s00-settle.txt
- [x] R6.2 验证 finishBattle → unlockNext → saveGame → openChapter 下一章 —— 2026-11-06 同轮验证：nextChapter=ch01、unlocked=ch00,ch01
- [x] R6.3 scriptStoryEnd 实战贯通：S_01 冀城 t12 → op_59[100] → 剧情败北 → ch02 解锁（checks/012）—— 2026-11-06 第67轮

### R7 策略伤害真值
- [x] R7.1 STRAT_POWER 表真值提取（PE VA→FO 直取 0x43c31e[73]，比 Ghidra 更快）—— 2026-11-06 完成
- [x] R7.2 STRAT_HIT_CAT@0x43ba07/FAM_MOD@0x4d21b0/WEATHER@0x48e100 直取核对，与代码一致 —— 2026-11-06 完成
- [x] R7.3 stratDamage 对齐：POWER 真值数组、整数 DIV 截断、defender.tid 修复；9/9 公式对照 PASS —— 2026-11-06

### R8 驻地/商店/读档 UI
- [x] R8.1 showShop 验证：库存按 shopRec 过滤、买进扣金入仓、八折 0.8 —— 2026-11-06 完成（checks/007）
- [x] R8.2 showWarehouse 验证：卖出加金清格、条目按下标定位 —— 2026-11-06 完成
- [x] R8.3 showSaveLoad 面板打开验证（多槽逻辑已在 check 002 数据层验证）—— 2026-11-06 完成

### R9 回归完整
- [x] R9.1 checks/001-008 结构化验证集建成（name/steps/expect/verified-by 格式）—— 2026-11-06
- [x] R9.2 全 59 章 Tier1 boot 检查 + Tier2 op 覆盖扫描 + 6 op 功能级实测，checks/008 —— 2026-11-06
