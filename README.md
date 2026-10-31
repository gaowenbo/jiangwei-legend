# 三国志·姜维传 — HTML 重制版

原版《姜维传》（简体中文 5.9）的 **1:1 HTML 重制版**。

- 剧情：59 章完整章节链，原版 CG 背景、半身立绘、气泡对话
- 战斗：58 场战棋，1:1 复刻原版数值（属性/策略/装备/地形/状态）
- 数据：全部逆向自原版 `Data.e5` / `Hexzmap.e5` / `EEX` 剧本文件

## 在线试玩

<https://gaowenbo.gitee.io/jiangwei-legend/>

或直接打开 `index.html`（需联网加载 `assets/` 资源）。

## 运行要求

- 现代浏览器（Chrome / Edge / Firefox）
- 需联网加载 `assets/` 下的图片与音频资源

## 目录结构

```
index.html              单文件构建产物（Phaser 3 + 全部数据表已内联）
assets/
  maps/     hm00..hm57.png   战场地形图（原版 HmNN.e5 解码，Spalet BGR 调色板）
  story/    mm_000..mm_114.png 剧情 CG（原版 Mmap.e5 解码）
  figures/  fig_NNN.png     武将头像（原版 Face.e5）
  figures_t/fig_NNN.png    透明底立绘
  units/    atk_*.png spc_*.png 战斗单位精灵（原版 Unit_atk/Unit_spc）
  faces_b64/ unitmov_b64/ itemicon_b64/  base64 内联图集
  icons/                决斗指令 / 法术 / 道具图标
  audio/se/  bgm/        音效与背景音乐
```

## 构建

源码在 `jiangwei-legend/`：

```bash
cd jiangwei-legend
node build.mjs      # 生成 jiangwei-legend.html
```

## 逆向工具

逆向脚本与权威分析文档在 `tools/`：

| 文件 | 内容 |
|---|---|
| `eex_format_doc.md` | **EEX 剧本格式权威文档**：122 项 opcode 的实际行为与原版地址 |
| `rules_ref.md` | 战斗规则逆向笔记（属性/策略/装备/地形/AI） |
| `dis4.py` | Ekd5.exe 反汇编工具（capstone） |

## 版权

原版《姜维传》© KOEI。本项目为技术研究性质的 1:1 重制，不用于商业用途；
美术与音频素材版权归 KOEI 所有。
