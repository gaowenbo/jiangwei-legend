// 把 assets_data.js 里的 base64 data URI 拆成外部 PNG + 一个轻量索引脚本
// 目的：HTML 本体只留代码与文本，美术资源走 assets/ 目录，可缓存、可按需加载
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const SRC = path.join(ROOT, "src");
const OUT_ASSETS = path.join(ROOT, "assets");
const OUT_JS = path.join(SRC, "assets_data.js");

const raw = fs.readFileSync(OUT_JS, "utf8");

// 逐数组拆解：window.JW_XXX = [...]
const NAMES = ["JW_FACES", "JW_UNIT_MOV", "JW_UNIT_ATK", "JW_ITEM_ICONS", "JW_TERRAIN_PALS"];

function dirFor(name) {
  return {
    JW_FACES: "faces_b64",
    JW_UNIT_MOV: "unitmov_b64",
    JW_UNIT_ATK: "unitatk_b64",
    JW_ITEM_ICONS: "itemicon_b64",
    JW_TERRAIN_PALS: "terrainpal_b64",
  }[name];
}

let out = `/* ===== 原版素材索引（逆向自 Ekd5.exe / *.e5）：图片改为外部文件，见 assets/ ===== */
/* 生成器：tools/split_assets.mjs。每项是相对 assets/ 的路径，加载器负责转成可用 URL。 */
`;

let totalSaved = 0;
for (const name of NAMES) {
  const at = raw.indexOf("window." + name + " =");
  if (at < 0) continue;
  const eq = raw.indexOf("[", at);
  // 找到配对的本数组结束 ]（这些数组元素都是字符串，用引号计数即可安全定位）
  let i = eq, depth = 0, inStr = false, esc = false;
  for (; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { i++; break; } }
  }
  const body = raw.slice(eq, i);
  const urls = body.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g) || [];
  const dir = dirFor(name);
  const outDir = path.join(OUT_ASSETS, dir);
  if (urls.length) fs.mkdirSync(outDir, { recursive: true });

  // 非 data URI 的（如 JW_TERRAIN_PALS 的调色板数字数组）原样保留
  if (!urls.length) {
    out += `window.${name} = ${body};\n`;
    continue;
  }

  const paths = [];
  let saved = 0;
  urls.forEach((uri, k) => {
    const b64 = uri.slice("data:image/png;base64,".length);
    const buf = Buffer.from(b64, "base64");
    const fn = `${String(k).padStart(4, "0")}.png`;
    fs.writeFileSync(path.join(outDir, fn), buf);
    paths.push(`assets/${dir}/${fn}`);
    saved += b64.length;
  });
  totalSaved += saved;
  out += `window.${name} = ${JSON.stringify(paths)};\n`;
  console.log(`${name}: ${urls.length} 张 → assets/${dir}/ (原 base64 ${(saved / 1048576).toFixed(2)} MB)`);
}

fs.writeFileSync(OUT_JS, out);
console.log(`\nassets_data.js: ${(raw.length / 1048576).toFixed(2)} MB → ${(out.length / 1024).toFixed(1)} KB`);
console.log(`已拆出 base64 共 ${(totalSaved / 1048576).toFixed(2)} MB`);
