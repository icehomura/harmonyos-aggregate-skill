/**
 * tokenize.mjs — 中英文预分词（索引与查询共用）
 *
 * ⚠️ 建索引与查询**必须使用同一份分词逻辑**，否则索引与查询串不匹配、检索失效。
 * 因此单独抽出为共享模块，不要在任何脚本里复制粘贴此逻辑。
 *
 * 为什么需要预分词：
 *   FTS5 内置 tokenizer 对中文的处理都不适用 ——
 *     - unicode61 / porter / ascii：完全不切中文，中文查询 0 命中
 *     - trigram：只支持 ≥3 字符查询，「材质」「页签」这类 2 字词查不到
 *   实测 bigram（相邻两字）对 2 字词、多字词、中英混排全部正确命中。
 */

/** CJK 统一表意文字 + 扩展 A 区 */
const CJK_RANGE = /[一-鿿㐀-䶿]/;

/** 英文单词、数字、含点划线的 API 符号（barFloatingStyle、arkts-apis-uimaterial、26.0.0） */
const WORD_LIKE = /[A-Za-z][A-Za-z0-9_.-]*|\d+/g;
const CJK_SEGMENT = /[一-鿿㐀-䶿]+/g;

/**
 * 把文本切成空格分隔的 token 串，供 FTS5 索引/查询。
 * @param {string} text
 * @returns {string}
 */
export function tokenize(text) {
  if (!text) return '';
  const out = [];
  for (const m of text.matchAll(WORD_LIKE)) out.push(m[0].toLowerCase());
  for (const m of text.matchAll(CJK_SEGMENT)) {
    const seg = m[0];
    if (seg.length === 1) { out.push(seg); continue; }
    for (let i = 0; i < seg.length - 1; i++) out.push(seg.slice(i, i + 2));
  }
  return out.join(' ');
}

/**
 * 把关键词切成分词数组（供构造 MATCH 表达式用）。
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeList(text) {
  const s = tokenize(text);
  return s ? s.split(' ') : [];
}

/**
 * 构造 FTS5 MATCH 查询串。
 * 每个 token 用双引号包裹以避免特殊字符被当作语法。
 * @param {string[]} keywords 原始关键词（未分词）
 * @param {boolean} any true=OR，false=AND
 * @returns {string}
 */
export function buildMatch(keywords, any = false) {
  const parts = keywords
    .map((k) => tokenizeList(k).map((t) => `"${t.replace(/"/g, '""')}"`).join(' AND '))
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((p) => `(${p})`).join(any ? ' OR ' : ' AND ');
}

/** 文本是否含 CJK 字符 */
export function hasCJK(text) {
  return CJK_RANGE.test(text || '');
}
