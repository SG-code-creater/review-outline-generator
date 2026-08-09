// 轻量 Markdown → HTML 渲染器（零依赖）
// 用途：将 AI 输出的 **加粗**、#标题、[1]引用 等转为干净的富文本 HTML
// 安全：只转义 HTML 标签 + 有限模式匹配，不执行任意代码

/** 转义 HTML 特殊字符（防止 XSS） */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 将 Markdown 文本转为 HTML 字符串。
 * 支持：**bold**、*italic*、## 标题、- 列表、1. 有序列表、> 引用、[n] 引用标记清除、代码行内/块
 */
export function renderMarkdown(raw: string): string {
  if (!raw) return "";
  const lines = raw.split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  function closeLists() {
    if (inUl) { html.push("</ul>"); inUl = false; }
    if (inOl) { html.push("</ol>"); inOl = false; }
    if (inBlockquote) { html.push("</blockquote>"); inBlockquote = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      closeLists();
      html.push("<br/>");
      continue;
    }

    // ── 代码块（```）── 跳过格式化，原样显示 ──
    if (trimmed.startsWith("```")) {
      closeLists();
      let codeLines: string[] = [];
      if (trimmed.length > 3) codeLines.push(trimmed.slice(3));
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      html.push(`<pre style="background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;font-size:13px;overflow-x:auto;"><code>${codeLines.join("\n")}</code></pre>`);
      continue;
    }

    // ── 标题 ──
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      closeLists();
      const level = Math.min(hMatch[1].length, 6);
      const text = inlineFormat(esc(hMatch[2]));
      html.push(`<h${level} style="font-weight:700;margin:12px 0 6px;color:var(--text-primary)">${text}</h${level}>`);
      continue;
    }

    // ── 无序列表 ──
    if (/^[-*+]\s+/.test(trimmed)) {
      if (!inUl || inOl) { closeLists(); html.push("<ul style='margin:4px 0;padding-left:20px'>"); inUl = true; }
      const text = inlineFormat(esc(trimmed.replace(/^[-*+]\s+/, "")));
      html.push(`<li style='margin:2px 0'>${text}</li>`);
      continue;
    }

    // ── 有序列表 ──
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (inUl || !inOl) { closeLists(); html.push("<ol style='margin:4px 0;padding-left:20px'>"); inOl = true; }
      const text = inlineFormat(esc(olMatch[1]));
      html.push(`<li style='margin:2px 0'>${text}</li>`);
      continue;
    }

    // ── 引用块 ──
    if (trimmed.startsWith(">")) {
      if (!inBlockquote) { closeLists(); html.push("<blockquote style='border-left:3px solid var(--accent-teal);padding-left:12px;margin:6px 0;color:var(--text-secondary)'>"); inBlockquote = true; }
      const text = inlineFormat(esc(trimmed.replace(/^>\s?/, "")));
      html.push(`<p style='margin:4px 0'>${text}</p>`);
      continue;
    }

    // ── 普通段落 ──
    closeLists();
    const text = inlineFormat(esc(line));
    html.push(`<p style='margin:4px 0'>${text}</p>`);
  }

  closeLists();
  return html.join("\n");
}

/**
 * 行内格式化（在已转义的文本上操作）：
 * 1. [n] 引用标记 → 上标
 * 2. `code` → 行内代码
 * 3. **bold** → 加粗（支持中文/标点紧邻）
 * 4. *italic* → 斜体
 */
function inlineFormat(s: string): string {
  // ① [n] 或 [n-m] 引用标记 → 小上标（DeepSeek 带出处编号）
  s = s.replace(/\[(\d+(?:-\d+)?)\]/g,
    '<sup style="color:var(--accent-teal);font-size:10px;margin-left:1px">$1</sup>');

  // ② 行内反引号代码
  s = s.replace(/`([^`\n]+)`/g,
    '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:13px">$1</code>');

  // ③ **加粗** —— 匹配 **非星号内容**（支持中文/标点/空格）
  //    反复执行直到无匹配（处理同一行多组 **...**）
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, "<strong>$1</strong>");
  } while (s !== prev);

  // ④ *斜体*（排除已处理的 <strong> 内部，且不在单词边界处误匹配星号乘法符号）
  //    只匹配两侧有 Unicode 字母/汉字/标点的情况
  do {
    prev = s;
    s = s.replace(/(?<=[\u4e00-\u9fff\w（）《》\"\'\(])\*(?!\*)([^\s*]+)\*(?=[\u4e00-\u9fff\w（）《》\"\'\),.，。！？：；])/g,
      "<em>$1</em>");
  } while (s !== prev);

  return s;
}
