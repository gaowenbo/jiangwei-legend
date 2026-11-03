// 把 battle_events_data.js 压缩成紧凑格式：
//   {"op":N,"name":"x","args":[...]}  →  ["x", [...]]   （op 编号由 opcodes.json 反查）
// 体积可省约 0.8 MB，且不改变任何语义。解码器见 src/battle_events_data.js 末尾的补丁。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const FILE = path.join(ROOT, "src", "battle_events_data.js");
const raw = fs.readFileSync(FILE, "utf8");

const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
const data = JSON.parse(raw.slice(start, end + 1));

// op 名 → 编号（供解码器还原 op 字段）
const OPCODES = path.join(ROOT, "eex_parsed", "opcodes.json");
const ops = JSON.parse(fs.readFileSync(OPCODES, "utf8"));
const nameToOp = {};
for (const k of Object.keys(ops)) {
  const v = ops[k];
  if (v && v.name) nameToOp[v.name] = Number.parseInt(String(v.hex).replace("0x", ""), 16);
}

function packNode(o) {
  if (Array.isArray(o)) return o.map(packNode);
  if (o && typeof o === "object") {
    if (typeof o.name === "string" && Array.isArray(o.args)) return [o.name, o.args];
    const out = {};
    for (const k of Object.keys(o)) out[k] = packNode(o[k]);
    return out;
  }
  return o;
}

const packed = packNode(data);

const out = `// 自动生成：原版战斗事件层（来源 eex_parsed/S_XX.json，1:1 提取）
// 紧凑格式：动作 = ["op名", [参数...]]，解码器在文件末尾还原成 {op, name, args}
window.JW_BATTLE_EVENTS_PACKED = ${JSON.stringify(packed)};
window.JW_OPNAME_TO_OP = ${JSON.stringify(nameToOp)};
/* 解码：把紧凑动作还原成引擎期望的 {op, name, args} */
(function () {
  const N2O = window.JW_OPNAME_TO_OP || {};
  const fix = (a) => {
    if (Array.isArray(a) && typeof a[0] === "string" && Array.isArray(a[1]) && a.length === 2) {
      return { op: N2O[a[0]] !== undefined ? N2O[a[0]] : -1, name: a[0], args: a[1] };
    }
    return a;
  };
  const walk = (o) => {
    if (Array.isArray(o)) {
      if (typeof o[0] === "string" && Array.isArray(o[1]) && o.length === 2) return fix(o);
      return o.map(walk);
    }
    if (o && typeof o === "object") {
      const r = {};
      for (const k of Object.keys(o)) r[k] = walk(o[k]);
      return r;
    }
    return o;
  };
  const src = window.JW_BATTLE_EVENTS_PACKED || {};
  const out = {};
  for (const key of Object.keys(src)) {
    const ev = src[key];
    out[key] = {
      intro: (ev.intro || []).map(s => ({ conds: (s.conds || []).map(walk), actions: (s.actions || []).map(walk), sec: s.sec })),
      polls: (ev.polls || []).map(s => ({ conds: (s.conds || []).map(walk), actions: (s.actions || []).map(walk), sec: s.sec })),
      outro: (ev.outro || []).map(s => ({ conds: (s.conds || []).map(walk), actions: (s.actions || []).map(walk), sec: s.sec })),
    };
  }
  window.JW_BATTLE_EVENTS = out;
  window.JW_BATTLE_EVENTS_PACKED = null;
})();
`;

fs.writeFileSync(FILE, out);
console.log(`battle_events_data.js: ${(raw.length / 1048576).toFixed(2)} MB → ${(out.length / 1048576).toFixed(2)} MB`);
