/* tools/se-adpcm-fix.cjs — 把原版 wav 里的 IMA ADPCM（codec=2）转成浏览器可用的 16bit PCM。
 * 背景（2026-11-06 第67轮）：Se52.WAV 是 codec=2 4-bit IMA ADPCM，Chromium 无法解码（onerror），
 * 而 Se52 被剧本 play_sound[52] 使用。原版走 DirectSound 硬解。本脚本离线转码一次即可。
 * 用法：node tools/se-adpcm-fix.cjs [源wav目录] [目标目录]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = process.argv[2] || 'G:/file/yingpan/\u7b80\u4f53\u59dc\u7ef4\u4f205.9/\u7b80\u4f53\u59dc\u7ef4\u4f205.9/wav';
const DST = process.argv[3] || path.join(__dirname, '..', 'assets', 'audio', 'se');
const stepTable = [7,8,16,21,23,32,34,37,39,42,44,46,48,50,52,55,57,58,59,61,63,64,66,68,69,70,71,73,75,76,77,78,79,81,83,84,86,87,89,90,92,93,95,96,98,100,101,102,104,106,107,108,110,111,113,114,116,117,119,120,121,123,125,126,127,129,131,132,133,135,137,138,139,141,142,144,145,147,149,150,151,153,155,157,158,159,161,163];
const idxTable = [-1,-1,-1,-1,2,4,6,8,-1,-1,-1,-1,2,4,6,8];
function decodeIma(buf) {
  const fi = buf.indexOf('fmt ');
  const blockAlign = buf.readUInt16LE(fi + 20);
  const nch = buf.readUInt16LE(fi + 10);
  const rate = buf.readUInt32LE(fi + 12);
  const di = buf.indexOf('data');
  const dlen = buf.readUInt32LE(di + 4);
  const data = buf.slice(di + 8, di + 8 + dlen);
  const nblocks = Math.floor(data.length / blockAlign);
  const spc = ((blockAlign - 4 * nch) * 2) / nch;
  const out = new Int16Array(nblocks * spc * nch);
  let ow = 0;
  for (let b = 0; b < nblocks; b++) {
    const bo = b * blockAlign;
    const pred = [], idx = [];
    for (let c = 0; c < nch; c++) { pred.push(data.readInt16LE(bo + c * 4)); idx.push(data[bo + c * 4 + 2]); }
    const chanStart = bo + 4 * nch;
    const chanBytes = (blockAlign - 4 * nch) / nch;
    for (let s = 0; s < spc; s++) {
      for (let c = 0; c < nch; c++) {
        const pos = chanStart + c * chanBytes + (s >> 1);
        let nib = data[pos];
        nib = (s & 1) ? ((nib >> 4) & 0xf) : (nib & 0xf);
        const step = stepTable[Math.max(0, Math.min(88, idx[c]))];
        let diff = step >> 3;
        if (nib & 1) diff += step >> 2;
        if (nib & 2) diff += step >> 1;
        if (nib & 4) diff += step;
        if (nib & 8) diff = -diff;
        let pv = pred[c] + diff;
        if (pv > 32767) pv = 32767; if (pv < -32768) pv = -32768;
        pred[c] = pv;
        idx[c] = Math.max(0, Math.min(88, idx[c] + idxTable[nib]));
        out[ow++] = pv;
      }
    }
  }
  return { pcm: out.subarray(0, ow), nch, rate };
}
function wavHeader(len, nch, rate) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + len, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(nch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * nch * 2, 28); b.writeUInt16LE(nch * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(len, 40);
  return b;
}
let fixed = 0, scanned = 0;
for (const f of fs.readdirSync(SRC)) {
  if (!/\.wav$/i.test(f)) continue;
  scanned++;
  const buf = fs.readFileSync(path.join(SRC, f));
  const fi = buf.indexOf('fmt ');
  if (fi < 0) continue;
  const codec = buf.readUInt16LE(fi + 8);
  if (codec === 1) continue; // 已是 PCM
  if (codec !== 2) { console.log('跳过（未知 codec ' + codec + '）:', f); continue; }
  const { pcm, nch, rate } = decodeIma(buf);
  const pcmBuf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) pcmBuf.writeInt16LE(pcm[i], i * 2);
  const out = Buffer.concat([wavHeader(pcmBuf.length, nch, rate), pcmBuf]);
  fs.writeFileSync(path.join(DST, f.replace(/\.WAV$/i, '.wav')), out);
  console.log('转码:', f, '->', (pcm.length / nch / rate).toFixed(2) + 's', nch + 'ch', rate + 'Hz');
  fixed++;
}
console.log('扫描', scanned, '个 wav，转码', fixed, '个非 PCM。');
