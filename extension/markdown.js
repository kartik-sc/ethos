// HTML → Markdown for web clips. Small on purpose: headings, paragraphs, emphasis, links,
// images, lists (nested, with checkboxes), quotes, code and tables. Anything else keeps its text.

const SKIP = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "SVG", "CANVAS",
  "BUTTON", "FORM", "INPUT", "SELECT", "TEXTAREA", "NAV", "FOOTER", "ASIDE",
]);
const BLOCKS = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "MAIN", "HEADER", "FIGURE", "FIGCAPTION",
  "DL", "DT", "DD", "DETAILS", "SUMMARY", "ADDRESS",
]);

function absolute(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function escapeText(text) {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

function fence(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

function inlineCode(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${ticks}${pad}${text}${pad}${ticks}`;
}

function block(content) {
  const trimmed = content.trim();
  return trimmed ? `\n\n${trimmed}\n\n` : "";
}

function wrap(marker, content) {
  const trimmed = content.trim();
  return trimmed ? `${marker}${trimmed}${marker}` : "";
}

function children(node, ctx) {
  let out = "";
  for (const child of node.childNodes) out += convert(child, ctx);
  return out;
}

function list(node, ctx) {
  const ordered = node.tagName === "OL";
  let index = Number(node.getAttribute("start") ?? 1) || 1;
  const items = [];
  for (const item of node.children) {
    if (item.tagName !== "LI") continue;
    const box = item.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
    const check = box ? (box.checked || box.hasAttribute("checked") ? "[x] " : "[ ] ") : "";
    const marker = ordered ? `${index++}. ` : "- ";
    const body = children(item, ctx).replace(/\n{2,}/g, "\n").trim();
    const indent = " ".repeat(marker.length);
    const lines = body.split("\n");
    items.push(
      [marker + check + lines[0], ...lines.slice(1).map((line) => (line ? indent + line : line))].join(
        "\n",
      ),
    );
  }
  return `\n\n${items.join("\n")}\n\n`;
}

function cell(node, ctx) {
  return children(node, ctx).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

function table(node, ctx) {
  const rows = [...node.querySelectorAll("tr")].filter((row) => row.closest("table") === node);
  if (rows.length === 0) return "";
  const cells = rows.map((row) => [...row.children].map((c) => cell(c, ctx)));
  const width = Math.max(...cells.map((row) => row.length));
  const pad = (row) => [...row, ...Array(width - row.length).fill("")];
  const line = (row) => `| ${pad(row).join(" | ")} |`;
  const [head, ...body] = cells;
  return block([line(head), line(Array(width).fill("---")), ...body.map(line)].join("\n"));
}

function convert(node, ctx) {
  if (node.nodeType === 3) {
    return escapeText(node.textContent.replace(/\s+/g, " "));
  }
  if (node.nodeType !== 1 || SKIP.has(node.tagName.toUpperCase())) return "";
  const tag = node.tagName.toUpperCase();

  if (/^H[1-6]$/.test(tag)) {
    const text = children(node, ctx).replace(/\s+/g, " ").trim();
    return text ? block(`${"#".repeat(Number(tag[1]))} ${text}`) : "";
  }
  switch (tag) {
    case "BR":
      return "\n";
    case "HR":
      return block("---");
    case "STRONG":
    case "B":
      return wrap("**", children(node, ctx));
    case "EM":
    case "I":
      return wrap("*", children(node, ctx));
    case "DEL":
    case "S":
      return wrap("~~", children(node, ctx));
    case "CODE":
      return inlineCode(node.textContent);
    case "PRE": {
      const code = node.querySelector("code");
      const language = /language-([\w+-]+)/.exec(`${node.className} ${code?.className ?? ""}`);
      const text = node.textContent.replace(/\n$/, "");
      const ticks = fence(text);
      return block(`${ticks}${language ? language[1] : ""}\n${text}\n${ticks}`);
    }
    case "A": {
      const text = children(node, ctx).trim();
      const href = absolute(node.getAttribute("href") ?? "", ctx.baseUrl);
      if (!text) return "";
      return href ? `[${text}](${href})` : text;
    }
    case "IMG": {
      const src = absolute(node.getAttribute("src") ?? "", ctx.baseUrl);
      if (!src) return "";
      return `![${escapeText(node.getAttribute("alt") ?? "")}](${src})`;
    }
    case "UL":
    case "OL":
      return list(node, ctx);
    case "BLOCKQUOTE": {
      const inner = children(node, ctx).replace(/\n{3,}/g, "\n\n").trim();
      return block(inner.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n"));
    }
    case "TABLE":
      return table(node, ctx);
    default:
      return BLOCKS.has(tag) ? block(children(node, ctx)) : children(node, ctx);
  }
}

/** Markdown for everything inside `root`; links and images are made absolute against `baseUrl`. */
export function toMarkdown(root, baseUrl) {
  let fenced = false;
  const lines = children(root, { baseUrl })
    .split("\n")
    .map((line) => {
      if (/^`{3,}/.test(line)) fenced = !fenced;
      else if (fenced) return line;
      // Inline whitespace left at the edges of blocks; list indentation is two or more spaces.
      return line.replace(/[ \t]+$/, "").replace(/^ (?=\S)/, "");
    });
  const markdown = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return markdown ? `${markdown}\n` : "";
}
