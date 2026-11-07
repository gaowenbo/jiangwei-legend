# Check 002: 存读档边界

| 字段 | 值 |
|------|-----|
| id | R5.1 |
| owner | 代理 |
| status | done |
| 依赖 | main.js saveGameTo/loadGameFrom/_applySaveData/serialize/deserialize；engine.js Battle.serialize/deserialize |
| verified-by | ego-browser 端到端 |

## 目的
验证存档读档边界：存档 saveOk=true；读档后 gold/flag/lvl/HP/phase/state 正确恢复。

## 验证步骤
1. 进入 S_00 战斗，等 intro 完成
2. 给姜维改状态：hp=maxHp/2, lvl=5, gold=12345, flags[999]=1, roster[0] 写入
3. 调用 `App.saveGameTo(1)`，记录 saveOk
4. 调用 `App.loadGameFrom(1)`，观察恢复结果

## 预期结果
| 字段 | 预期 |
|------|-----|
| saveOk | true |
| hpAfter | 140（maxHp，按 applyRoster 跨战斗满值） |
| lvlAfter | 5 |
| goldAfter | 12345 |
| flag999After | 1 |
| phase | "player" |
| state | "playing" |
| screen | "battle" |

## 实际结果（2026-11-06）
- saveOk: true
- hpAfter: 140
- lvlAfter: 5
- goldAfter: 12345
- flag999After: 1
- phase: "player"
- state: "playing"
- screen: "battle"

## 相关代码
- main.js saveGameTo(870-888)/loadGameFrom(908-913)/_applySaveData(947-990)/saveKey(868)
- engine.js serialize(4052-4075)/deserialize(4077-4110)

## 关联待办
- 无（已完成）
