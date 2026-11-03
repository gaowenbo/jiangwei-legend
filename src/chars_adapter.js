/* ============================================================
 * 角色适配层（权威版）：用逆向的 heroes.json（Data.e5 段0，1024 条标准武将）
 * 字段：force 武力 / command 统率 / intellect 智力 / politics 政治 / charisma 魅力
 * 战斗映射：武力→攻击 统率→防御 智力→精神 政治→速度 魅力→命中
 * ============================================================ */
(function () {
  "use strict";
  const HEROES = (window.JW_HEROES || []).filter(
    h => h && h.name && h.name !== "空" && String(h.name).trim() !== ""
  );

  function inferClass(h) {
    if (h.intellect >= 85 && h.force <= 55) return "tactician";   // 军师（高智低武）
    if (h.intellect >= 78 && h.force < 72) return "strategist";   // 参谋
    if (h.force >= 86 && h.politics >= 86) return "dragoon";      // 龙骑
    if (h.force >= 85 && h.command >= 86) return "general";       // 将军
    if (h.force >= 86 && h.charisma >= 85) return "cavalry";      // 骑兵
    if (h.force >= 82 && h.command >= 82) return "halberdier";    // 长枪
    if (h.force >= 80) return "infantry";                         // 步兵
    if (h.politics >= 84) return "archer";                        // 弓兵
    if (h.command >= 80) return "guard";                          // 卫兵
    return "officer";                                             // 文官/通用
  }

  const STORE = {};
  // 立绘索引：heroes.json 的 index 是 persons 表的 pid，
  // 而原版头像索引是 persons[pid].face —— 两者不同，必须用 face。
  const PERSONS = (window.JW_GAME && window.JW_GAME.persons) || [];
  const faceIndexOf = (pid) => {
    const p = PERSONS[pid];
    return p && p.face != null ? p.face : null;
  };
  for (const h of HEROES) {
    const faceIdx = faceIndexOf(h.index);
    STORE[h.name] = {
      id: "hero_" + h.index,
      index: h.index,
      faceIndex: faceIdx,
      name: h.name,
      class: inferClass(h),
      stats: { atk: h.force, def: h.command, mag: h.intellect, spd: h.politics, hit: h.charisma },
      level: 1,
      skills: [],
      portrait: (faceIdx != null && window.JW_FACES) ? (window.JW_FACES[faceIdx] || null) : null,
      heroId: h.heroId,
    };
  }

  window.JW = window.JW || {};
  window.JW_ROLESTORE = STORE;
  window.JW_CHAR_COUNT = HEROES.length;
  window.JW.inferClass = inferClass;
  console.log(`[角色表] 已加载逆向武将 ${HEROES.length} 人（Data.e5 段0 权威表）`);
})();