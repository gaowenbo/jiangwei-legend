# Check 003: 部署 AI（敌军回合）

| 字段 | 值 |
|------|-----|
| id | R4.1 |
| owner | 代理 |
| status | done |
| 依赖 | engine.js runEnemyTurn/actEnemy/aiStepToward/aiChoosePosition/aiPhysScore |
| verified-by | ego-browser 端到端 |

## 目的
验证敌军 AI 6 种模式（0 被动/1 主动/2 坚守/3 攻击武将/4 到达地点/5 跟随/6 逃至），敌军回合移动攻击。

## 验证步骤
1. 进入 S_00 战斗，等 intro 完成（敌军初始在 -1,-1）
2. 结束我方回合：`App.endTurn()`
3. 观察敌军回合完成：round 1→2，phase 回到 player
4. 检查敌军单位是否从 (-1,-1) 移动到有效坐标

## 预期结果
| 字段 | 预期 |
|------|-----|
| phase 变化 | player → enemy → player |
| round | 1 → 2 |
| 敌军位置 | 从 (-1,-1) 变为有效坐标（如赵云 (12,7)） |

## 实际结果（2026-11-06）
- phase: player → enemy → player
- round: 1 → 2
- 赵云: (-1,-1) → (12,7)
- 轻骑兵/步兵/弓兵: 从 (-1,-1) 移动到 (11-13, 5-6)

## 相关代码
- engine.js runEnemyTurn(3826-3842)/actEnemy(3893-4012)/aiStepToward(2441)/aiChoosePosition(2456)/aiPhysScore(2404)

## 关联待办
- 无（已完成）
