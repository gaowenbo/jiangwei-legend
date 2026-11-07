# Check 008: 全章回归 + 6 op 战斗层接入（R9）

| 字段 | 值 |
|------|-----|
| id | R9.1-R9.2 |
| owner | 代理 |
| status | done（2026-11-06） |
| verified-by | ego-browser：59 章逐章 boot + 静态 op 覆盖扫描 + 6 op 功能级实测 |

## Tier1 逐章启动检查（59/59）
- 每章 `startBattle()`：units>0、_eexFile 有值、无异常、页面 0 error
- 全部章节战斗均有 V2 结构化脚本数据
- 唯一 warn：名牌绘制失败（视觉回退，非功能问题）

## Tier2 静态 op 覆盖
- 全 59 章 V2 脚本共 65 种 opcode（含 cond: 前缀），修复前 6 种未处理：
  battle_prepare(9)/play_music(232)/popup(8)/info(46)/choice(1,S_19)/set_resource(2,S_44)
- 修复后：未处理=0

## 6 op 接入实现（engine.js _runActions 战斗层）
| op | 语义 | 实现 | 实测 |
|----|------|------|------|
| popup/info | 战场弹窗/情报（S_01 战斗失败。/S_25 转职） | onEvent scriptInfo → main showBattleSay+addLog | addLog 含唯一标记 PASS |
| play_music | 战场 BGM 切轨（232 处） | window.JW.StoryAudio.playMusic | 无异常 PASS |
| set_resource | 战场金/民心增减（S_44） | 写 App.gold/res1/res2（clamp，mode 0=设 1=加 2=减） | 5000+10000=15000、民心50-20=30 PASS |
| battle_prepare | 出场选择 0x4a（S_00 等） | App._parseSortie → _sortieConstraint | max=8 PASS |
| choice | 战场选项（S_19 就此撤退/引出敌军） | ui.showBattleChoice 挂 battle-screen，等待置 _scriptPause，超时60s默认第一项 | 显示+点选第二项 lastChoice=2、pause 释放 PASS |
| test_choice | 消费选项结果 | _lastChoice===(a[0]) | (2)=true/(1)=false PASS |
- bindKeys 数字键 1-9 同时支持战场选项。

## 已知边界（不视为缺陷）
- popup 气泡会被并发剧情对白覆盖（原版同队列语义，日志持久可查）。
- S_19 选项段需打到 t1 触发点才出现，功能级注入已实证链路全通。
