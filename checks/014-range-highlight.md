# Check 014: 范围高亮 / 光标 / 闪烁（画面交互 1:1）

| 字段 | 值 |
|------|-----|
| id | R15.1 |
| owner | 代理 |
| status | done（2026-11-06 第68轮） |
| verified-by | capstone 光标对象 0x40eb54/0x40eb97/0x40ebd7 + ego 截图目视 |

## 原版光标/渲染对象（0x492f38 单例，攻击流程 0x4404bd 每回合设置）
- 0x40ebd7(x,y) = 0x40eb54(x) + 0x40eb97(y)：
  - 0x40eb54：`while(x >= width-(width-1)) x -= width` 取模环绕 → 写对象 +4（光标 X 格）
  - 0x40eb97：`y = clamp(y + +0x14, +0x18)` → 写对象 +8（光标 Y 钳制）
- 0x40ec84(0x12)/0x40ed0a(0)/0x40ed36(4)：攻击流程每回合把光标重置到 (0x12=18, 0) 并设闪烁模式 4
- 结论：原版光标是**键盘格子光标**（环绕+钳制），非鼠标跟随；我方用 Phaser Graphics 四角金框描格（0xffd873）等价呈现

## 我们的实现（battle_scene.js / ui.js）
| 元素 | 颜色/参数 | 原版语义 |
|------|-----------|----------|
| 移动范围 | 0xffe68c 浅黄 alpha .28 | 曹操传系浅黄可移动区 |
| 攻击范围 | 0xc8281c 红 alpha .25 | 红色可攻击区 |
| 光标 | 0xffd873 金 4 角描边 | 选中格高亮 |
| 闪烁 | 160ms/次 ×3 | 检索未执行部队/现身提示 |

## 实测（verify-highlight，4/4 PASS + 截图）
- 移动范围：47 格浅黄高亮（attachments/range-highlight-move.png，姜维光标金框可见）
- 攻击范围：4 格红色高亮（attachments/range-highlight-atk.png，帐篷格红/草地格黄褐）
- 光标 set + 闪烁启动 ✓

## 战斗对话气泡（objective 点名的「气泡」）
- showBattleSay → #battle-say-box.battle-say：白底 rgb(253,253,253) + 2px #8899aa 边框 + 8px 圆角 + 黑字 rgb(17,17,17) + Tou 120×120 对话立绘（.bs-face）
- opacity 0→1 有 .3s transition（淡入），实测过渡后 opacity=1 ✓（attachments/battle-say-bubble.png）
- 注：同步读 getComputedStyle 会拿到过渡起点 0，须等 ≥450ms 再断言（本检查踩过的坑）

构建 11431.5KB。
