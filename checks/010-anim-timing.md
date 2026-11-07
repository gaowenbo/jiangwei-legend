# Check 010: 画面动画时序与精灵渲染（移动/攻击动画 1:1）

| 字段 | 值 |
|------|-----|
| id | R11.1 |
| owner | 代理 |
| status | done（2026-11-06 第66轮） |
| verified-by | capstone 0x450bde/0x407263/0x40728a + ego 墙钟计时 + 截图 |

## 原版动画时序公式（0x450bde 逐行破译）
```
时长(tick) = 帧数 × 128 / 速度系数
速度系数 = min(装备属性5/6, unit+0x1c)（0x407263/0x40728a，基准 64）
tick = 40ms → 基准下每帧 2 tick = 80ms
```
- atk（Unit_atk 12帧64×64）：12×128/64 = 24 tick = **960ms** → 80ms/帧
- spc（Unit_spc 5帧48×48）：5×128/64 = 10 tick = **400ms** → 80ms/帧
- 行走：每格 4 tick = **160ms**（既有实证，本轮维持）
- mode 3（受击）=255 冻结帧、mode≥4=100 特例分支已注释在案

## 修复的 4 处渲染链真 Bug（截图实证单位此前完全不显示）
1. **ensureAnimSheet 用 textures.addSpriteSheet(HTMLImageElement)** → Phaser 该 API 不吃 Image 元素，静默失败 → texExists=false → atk/spc 动画从不播放。改手动 Image.onload + addSpriteSheet（地面贴图同款路径，实测 13 帧 OK）
2. **ensureUnitTexture 依赖 this.load.spritesheet + loadcomplete 回调** → 本场景 loader 从未 start/complete（create 同步跑）→ umov 永远不就绪 → createUnitSprite 的 textures.exists 恒 false → **战场单位全部不显示**（shot1 截图实证：只有帐篷没有武将）。改 _loadSheet 手动加载
3. **createUnitSprite 无回填**：贴图未就绪时 img=null 且永不补建 → 加 ensureUnitTexture 异步回调补建精灵

## 实测结果（verify-anim5，修复后）
| 项 | 期望 | 实测 |
|----|------|------|
| 精灵回填 | withImg==total | 2/2 ✓（截图姜维/尹赏武将形象可见） |
| atk 动画 | ≈960ms | 989ms ✓ |
| spc 动画 | ≈400ms | 416ms ✓ |
| 行走 | ≈160ms/格 | 3格612ms ✓，落位正确 |
4. **main.js 无 unitAppear/unitReenter 分支**：engine 发了事件（op_4c 现身/援军再入场）但没人建精灵 → buildScene 后登场的单位（S_00 敌方 9 人、各章援军）永远隐形。补 createUnitSprite+refreshUnits 分支

## 最终实测（verify-final66）
- 单位精灵与场上数一致：onfield=9 / withImg=9 / sprites=9 ✓（截图赵云/姜维/尹赏形象可见，attachments/units-visible-after-fix.png）
- R6 结算链仍通：duelCinematic→scriptRemove→scriptBattleOver→result win→ch01 ✓
- boot59 ✓。构建 11423.6KB。
