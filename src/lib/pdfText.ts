// PDF / 文本工具：浏览器端抽文 + 切片 + 中文词重叠检索（零成本 RAG-lite，无需向量库/embedding）

/** 浏览器端用 pdfjs 从 PDF 抽取纯文本（不依赖后端，免费） */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // 固定版本 CDN，避免动态版本导致 _renderPageChunk 崩溃
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out +=
      content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  return out;
}

/** 把长文本切成带重叠的片段，便于检索与分块喂给模型 */
export function chunkText(text: string, size = 600, overlap = 80): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ─── 中文友好的词重叠检索 ──────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s，。、；：？！“”‘’（）()\[\]【】《》<>«»"'/`~@#$%^&*\-_=+\\|.,?!;:]/g, "");
}

// 生成特征单元：CJK 字符二元组 + 拉丁单词（英文/数字按词）
function tokens(s: string): Set<string> {
  const norm = normalize(s);
  const set = new Set<string>();
  // 拉丁连续字母数字 → 作为整体词
  const latin = norm.match(/[a-z0-9]+/g) || [];
  for (const w of latin) set.add("w:" + w);
  // 去除拉丁后剩下的 CJK 字符，取相邻二元组
  const cjk = norm.replace(/[a-z0-9]/g, "");
  for (let i = 0; i < cjk.length - 1; i++) {
    set.add("b:" + cjk.slice(i, i + 2));
  }
  if (cjk.length === 1) set.add("b:" + cjk);
  return set;
}

/**
 * 从 chunks 中按与 query 的词重叠相似度取 top-k，结果按原文顺序返回（便于阅读上下文）。
 * 相似度用 Jaccard 变体（命中数 / 几何平均），对中文短语效果稳定。
 */
export function retrieveTopChunks(chunks: string[], query: string, k = 4): string[] {
  const qt = tokens(query);
  if (qt.size === 0) return chunks.slice(0, k);
  const scored = chunks.map((c, i) => {
    const ct = tokens(c);
    let hit = 0;
    for (const g of qt) if (ct.has(g)) hit++;
    const score = hit / Math.sqrt(qt.size) / Math.sqrt(ct.size || 1);
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, k)
    .sort((a, b) => a.i - b.i)
    .map((s) => chunks[s.i]);
}
