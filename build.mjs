#!/usr/bin/env node
/* ============================================================
 * 构建脚本：把 src/ 模块 + chapters/ 章节 + characters.json 逆向角色表
 * 合并成单个可离线打开游玩的 HTML 文件
 * 用法: node build.mjs [--minify]
 * ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src");
const CH = path.join(__dirname, "chapters");
const OUT = path.join(__dirname, "jiangwei-legend.html");
const HEROES_JSON = path.join(__dirname, "heroes.json");
const GAME_DATA_JSON = path.join(__dirname, "game_data.json");

// 模块加载顺序（依赖关系）
// 注：JW_FACES 由 assets_data.js 提供（旧 faces_data.js 不再注入，避免覆盖）
const JS_ORDER = ["data.js", "shops_data.js", "battle_events_data.js", "battle_events_v2.js", "real.js", "rules.js", "assets_data.js", "chars_adapter.js", "battle_scene.js", "engine.js", "story.js", "ui.js", "main.js"];

// Phaser 3（渲染引擎，离线内联）
const PHASER_JS = path.join(__dirname, "node_modules", "phaser", "dist", "phaser.min.js");
const phaser = fs.existsSync(PHASER_JS)
  ? `/* ===== Phaser 3.90.0 (MIT) ===== */\n${read(PHASER_JS)}\n`
  : `/* Phaser 缺失：${PHASER_JS} */\n`;

function read(p) { return fs.readFileSync(p, "utf8"); }

function buildChapters() {
  if (!fs.existsSync(CH)) return { code: "", names: [] };
  const files = fs.readdirSync(CH).filter(f => f.endsWith(".js")).sort();
  let code = "";
  const names = [];
  for (const f of files) {
    code += `/* ===== chapters/${f} ===== */\n${read(path.join(CH, f))}\n`;
    names.push(f);
  }
  return { code, names };
}

// 加载逆向得到的角色表（Data.e5 → characters.json）
function buildChars() {
  if (!fs.existsSync(HEROES_JSON)) return "";
  const heroes = JSON.parse(fs.readFileSync(HEROES_JSON, "utf8")).heroes || [];
  return `/* ===== 逆向自 Data.e5 段0：姜维传 1024 条标准武将（权威） ===== */\nwindow.JW_HEROES = ${JSON.stringify(heroes)};`;
}

const css = read(path.join(SRC, "theme.css"));
const gameData = fs.existsSync(GAME_DATA_JSON) ? read(GAME_DATA_JSON) : "{}";
const gameBlock = "/* ===== 1:1 真实数据表 (Data.e5/Hexzmap.e5/EEX) ===== */\n"
  + "window.JW_GAME = " + gameData + ";";
const chapters = buildChapters();
const chars = buildChars();
const js = JS_ORDER.map(f => read(path.join(SRC, f))).join("\n");

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1a0d04">
<title>三国志·姜维传 — HTML 重制版</title>
<style>
${css}
</style>
<script>
${phaser}
</script>
</head>
<body>
<div id="game-root"></div>
<script>
/* ============================================================
 * 三国志·姜维传 — HTML 重制版（单文件构建）
 * 数据：1:1 逆向自原版 Data.e5（Ls12 格式）
 * 引擎：Phaser 3 渲染 + 曹操传式战棋逻辑（1:1 复刻原版数值）
 * ============================================================ */
${gameBlock}
${chars}
${chapters.code}
${js}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, "utf8");
const size = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`构建完成: ${path.relative(__dirname, OUT)} (${size} KB)`);
console.log(`  逆向武将: ${fs.existsSync(HEROES_JSON) ? ((JSON.parse(fs.readFileSync(HEROES_JSON, "utf8")).heroes || []).length) + " 条" : "(无)"}`);
console.log(`  章节数据: ${chapters.names.join(", ") || "(无)"}`);