# Check 013: 顶栏系统菜单（画面交互 1:1）

| 字段 | 值 |
|------|-----|
| id | R14.1 |
| owner | 代理 |
| status | done（2026-11-06 第68轮） |
| verified-by | PE 直取 .data 字符串区 0x48e8c4..0x48e94c + 分发器 0x475140 jump table + ego 点击级验证 |

## 原版真值（capstone + 字符串 xref）
- 菜单标签 12 项（.data VA）：结束游戏 0x48e8c4 / 保存 0x48e8d0 / 读取 0x48e8d8 / 环境设定 0x48e8e0 / 武将一览 0x48e8ec / 持有道具一览 0x48e8f8 / 地形情报一览 0x48e908 / 宝物图鉴 0x48e918 / 胜利条件 0x48e924 / 检索未执行部队 0x48e930 / 战场缩小图 0x48e940 / 结束回合 0x48e94c
- 分发器 0x475140：jump table 0x47523c case 0..9 → 写对象 +0xc 标签指针（每项恰好 1 个 push 引用，位于 0x475181-0x475205 同一函数）
- 顶栏三段菜单（文件/功能/情报）+ APPMENU 模板 0x48e980；0x48e9b4.. 键表 h/e/f/k/i + 3 个 GBK 字符（訙譁=单字标签）
- 面板标签真值（0x485cb0..0x485efc）：武将名/部队属性/攻击力/防御力/精神力/爆发力/士气/名称/属性/功效/效果/价格/卖价/库存/总数/特殊效果/持有者/装备/策略名/地形/地形效果/消耗机动力/武器∶%s/护具∶%s/辅助∶%s/无

## 实现（此前顶栏是纯装饰，无点击）
- ui.js：`.otb-menu span[data-menu]` 委托拦截 → showTopMenu/closeTopMenu/handleTopMenu（三组下拉：文件 3 项 / 功能 4 项 / 情报 5 项）
- 动作映射：保存→showSaveLoad(save)、读取→showSaveLoad(load)、结束游戏→App.showTitle、环境设定→App.showSettings、战场缩小图→toggleMinimap、结束回合→App.endTurn、检索未执行部队→_highlightIdle（日志+blinkCells+centerOnCell）、武将一览/持有道具一览/地形情报一览/宝物图鉴/胜利条件→_panel 只读面板
- 教训：class body 方法间不能加逗号（对象字面量风格误用导致 4 处语法错误）；TOP_MENUS 常量必须放方法内（class 字段语法 `NAME: {}` 会报错）

## 实测（verify-topmenu / verify-topmenu2，9/9 PASS）
| 项 | 结果 |
|----|------|
| 功能下拉 4 项 + 名称逐字匹配原版 | ✓ 环境设定,战场缩小图,结束回合,检索未执行部队 |
| 情报下拉 5 项 | ✓ |
| 武将一览面板 | ✓ 2 行（尹赏 Lv1 HP100/100 攻36 防70 精72 暴70 士82） |
| 检索未执行部队 | ✓ 日志「未执行部队：尹赏、姜维」 |
| 地形情报一览 | ✓ 30 行（0 平原…） |
| 文件下拉 3 项 | ✓ 保存,读取,结束游戏 |
| 保存面板 | ✓ 3 槽 |
| 结束游戏 | ✓ 回 title 屏 |

构建 11431.5KB。
