# Check 007: 商店/仓库/存读档 UI 交互（R8）

| 字段 | 值 |
|------|-----|
| id | R8.1-R8.3 |
| owner | 代理 |
| status | done（2026-11-06） |
| verified-by | ego-browser DOM 点击级验证 |

## 本轮修复的 4 处 UI 真 Bug
1. showShop 卖全物品表 → 改为按 `shopRec()`（JW_SHOPS[min(sceneNo>>1,57)].wp+it）过滤
2. main.showShop 买回调 `buyItem(id, price, 1)` 三参错位 → `buyItem(data.itemId, data.count||1)`（price 参数被当 count）
3. showShop 回调买后再 `ui.showShop(this)` → 与 UI 自身刷新叠加双重面板；删回调刷新
4. 仓库 `for (const id of warehouse)` 丢弃条目对象 → `forEach((entry, wi))` 按下标定位；sellItem 增 byIndex 形参（装备同 id 多格场景）

## 实际结果（2026-11-06）
- 商店(sceneNo=2)：rec={wp:[],it:[87,92,94]} → 3 行（豆/解毒散/活血草），买进 100 金（price1×100），仓入 {id:87,count:1}
- 仓库卖出：+75 金（price×75），格清空
- 贾逵(pid20)在队：buyPrice 100→80（×4/5 八折）
- 存读档面板 showSaveLoad 打开成功
- 5/5 PASS
