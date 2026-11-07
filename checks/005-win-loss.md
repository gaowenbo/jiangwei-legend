# Check 005: 胜负判定（S_00 完整结算链）

| 字段 | 值 |
|------|-----|
| id | R6.1 |
| owner | 代理 |
| status | done（2026-11-06） |
| 依赖 | engine.js checkWin/pollEexEvents/actor_select/set_flag；main.js startAutoDuel/scriptBattleOver/finishBattle |
| verified-by | ego-browser 端到端（reports/R6-s00-settle.txt） |

## 目的
验证 S_00 天水之战完整过关流程：攻击触发单挑电影 → 赵云剧本移除 → event5 联动 → sec10 援军演出 → ui_49 胜利结算 → 章节推进。

## 验证步骤（变体 A：flag1001=1）
1. startBattle(ch00)，等 intro 完成（_eexScene>=1、姜维入场）
2. 设 flag1001=1、姜维装凤凰羽衣(72)、传送到赵云旁
3. 姜维攻击赵云 → 触发单挑
4. 单挑电影自动回放（sec1 duel_setup..duel_start 序列）
5. 攻击完成后 endTurn 推进检查点 → sec10 结算链

## 实际结果（2026-11-06 第59轮）
- 事件流：duelCinematic → scriptRemove(赵云) → scriptItem → 敌军回合(unitDone×14) → scriptRemove×2 → scriptBattleOver → scriptScenarioDone（各 1 次，无洪泛）
- 旗位：flag3=true、flag0=true、event5=true、zhaoRemoved=true
- 结算：screen=result、state=end、lastResult={win,战斗结束}、resultTitle=大 捷
- 推进：nextChapter=ch01、unlocked=ch00,ch01
- PASS：boot+59章/结算链贯通/event5联动/胜利结算/章节推进/无事件洪泛

## 本轮修复的两处引擎缺陷
1. **双路径死锁**（main.js startAutoDuel）：攻击触发的交互单挑挂起 attack()，脚本 poll 只在行动检查点跑永远等不到 duel_setup 电影。修：startAutoDuel 先查当前场景是否有条件满足的匹配 duel_setup 段，有则直接 await b.pollEexEvents() 走脚本电影链。
2. **poll 并发重入洪泛**（engine.js pollEexEvents）：sec10 自锁旗在链尾，链执行期间每个 unitDone 检查点从头重跑 51-op 长链 → scriptBattleOver 10+ 次、_eexScene 过冲到 10。修：入口加 `if (this._scriptPause || this.state !== "playing") return true;`（原版事件循环串行）。
3. **event5 断链**（engine.js actor_select）：赵云剧本移除设 zhaoRemoved 键，联动检查读 zhaoRetreated 键，永不匹配 → sec10 永不触发。修：zhaoRemoved 时同步置 event5，联动检查兼容两键。
