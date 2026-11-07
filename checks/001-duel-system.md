# Check 001: 单挑系统（op0x60/0x63/0x68/0x61/0x62）

| 字段 | 值 |
|------|-----|
| id | R3.1 |
| owner | 代理 |
| status | done |
| 依赖 | engine.js attackOnce 结尾 hasEffect(26)→startAutoDuel；main.js duelSetup/duelAction/duelEnd/playDuelCinematic；ui.js duel 屏 UI |
| verified-by | ego-browser 端到端（验证脚本已清理） |

## 目的
验证原版单挑系统 1:1 还原：攻击结束后攻击者持效果 26（凤凰羽衣 special=26）且目标存活 → 立即进入单挑（不是回合结束）；单挑结束返回原攻击流程。

## 前置条件
- 构建产物 `jiangwei-legend.html` 已生成（`node build.mjs`）
- 页面地址 `http://127.0.0.1:8090/jiangwei-legend.html` 可访问
- ego-browser 可用

## 验证步骤
1. 打开页面，等待 `window.JW.App.boot` 自动执行，59 章加载，标题屏可见
2. 进入 S_00 战斗（`App.current = App.chapters[0]; App.startBattle()`），等 intro 完成（`battle._eexScene >= 1`）
3. 给姜维（pid 0）装备凤凰羽衣（item id 72, special=26）：`jw.weapon = 72`
4. 将姜维传送到赵云（pid 25）相邻格子：`b.teleportUnit(jw, zy.x + 1, zy.y)`
5. 姜维攻击赵云：`b.attack(jw, zy, null, false)`
6. 观察：页面应切换到 duel 屏（`App.ui.screen === "duel"`），`App._duel` 建立
7. 调用 `App.duelEnd()`，观察：duel 屏隐藏，回到 battle 屏，攻击流程继续（Promise resolve）

## 预期结果
| 步骤 | 预期 |
|------|-----|
| 步骤 6 | `duelSeen === true`，`App.ui.screen === "duel"` |
| 步骤 7 | `App._duel === null`（duelCleared），`App.ui.screen === "battle"` |

## 实际结果（2026-11-06）
- duelSeen: true
- postAttack: true
- screenNow: "battle"
- duelCleared: true
- eexScene: 1

## 相关代码
- engine.js:1664-1669 攻击结束后 `attacker.hasEffect(26)` → `H.startAutoDuel(attacker, target)`
- main.js duelSetup/duelAction/duelEnd（duelEnd 中 `this._duelResolve()` resolve）
- ui.js showDuel/duelUpdate/duelSay/duelActions/duelResult/hideDuel/duelCinematic*

## 关联待办
- 无（已完成）
