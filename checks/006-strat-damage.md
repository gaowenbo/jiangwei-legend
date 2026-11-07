# Check 006: 策略伤害真值（R7）

| 字段 | 值 |
|------|-----|
| id | R7.1-R7.3 |
| owner | 代理 |
| status | done（2026-11-06） |
| 依赖 | engine.js stratDamage/stratHitRate；real.js STRAT_HIT_CAT/STRAT_FAM_MOD |
| verified-by | PE 直接字节提取（VA→FO 段表换算）+ ego-browser 公式对照 |

## 真值来源（EXE 直证，无需 Ghidra）
- STRAT_POWER[73] @0x43c31e：FUN_0043c00f `MOVZX ECX,byte ptr [EAX+0x43c31e]`（sid≤0x48 才读，>0x48=0）
- STRAT_CLASS_MOD/FAM_MOD[40] @0x4d21b0：`MOV AL,byte ptr [EAX+0x4d21b0]`（目标族<0x27）
- STRAT_HIT_CAT[73] @0x43ba07、WEATHER_TERRAIN_MOD 6×6 @0x48e100（逐字节一致）

## 修复
1. STRAT_POWER 原对象表 7 处错位（21/22、33-38、64-66 段），替换为 73 项真值数组
2. (I-J)/3 原浮点 → 原版整数 DIV 截断（Math.floor）
3. stratDamage 内 `defender.tid` ReferenceError → `target.tid`（顺带修 physicalDamage 同名误写）

## 实际结果（2026-11-06，姜维 lv1 mag93 vs 赵云 mag104）
sid0 焦热=16、sid1 烈焰=20、sid2 炎雷=11、sid3 炼狱=16、sid4 赤链=20、sid5 浊流=16、sid9 狂澜=6、sid20 暗算=16、sid22 =11 —— engine 与手工真值公式 **9/9 match**。
