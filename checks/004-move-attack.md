# Check 004: 移动 + 攻击（经典流程）

| 字段 | 值 |
|------|-----|
| id | R1.1 |
| owner | 代理 |
| status | done |
| 依赖 | ui.js trySelect/tryMove/handleCellClick；engine.js attack/attackOnce |
| verified-by | ego-browser round-33，实证 |

## 目的
验证经典移动流程：点单位→mode=move+showMoveRange→点目标→行走→菜单→攻击→伤害→hasActed。

## 预期结果
| 字段 | 预期 |
|------|-----|
| 移动 | 点选 47 可达格 → 行走 |
| 攻击 | 行走 → 菜单 → 攻击 → 伤害 19 |
| 状态 | hasActed = true |

## 实际结果（2026-11-05 第16轮）
- 点选 47 可达格 → 行走 → 菜单 → 攻击 → 伤害 19 → hasActed
- round-33 24/24 全过

## 相关代码
- ui.js trySelect/tryMove/handleCellClick（加 _scriptPause 守卫）
- engine.js attack(1450-1522)/attackOnce(1524-1670)

## 关联待办
- 无（已完成）
