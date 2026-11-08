// node --test extension/   (uses jsdom from the frontend's dev dependencies)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { toMarkdown } from "./markdown.js";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { JSDOM } = require("jsdom");

const BASE = "https://example.com/blog/post";

function md(html) {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  return toMarkdown(document.body, BASE);
}

test("headings, paragraphs and emphasis", () => {
  assert.equal(
    md("<h1>Title</h1><p>Some <strong>bold</strong> and <em>soft</em>   text.</p><h3> Sub </h3>"),
    "# Title\n\nSome **bold** and *soft* text.\n\n### Sub\n",
  );
});

test("links and images become absolute; unsafe ones keep only their text", () => {
  assert.equal(
    md('<p><a href="../about">About</a> <a href="javascript:void(0)">click</a> <img src="/a.png" alt="A"></p>'),
    "[About](https://example.com/about) click ![A](https://example.com/a.png)\n",
  );
});

test("markdown characters in text are escaped", () => {
  assert.equal(md("<p>snake_case and *stars* [x]</p>"), String.raw`snake\_case and \*stars\* \[x\]` + "\n");
});

test("nested and ordered lists, with checkboxes", () => {
  const html = `
    <ul>
      <li>One
        <ol start="3"><li>Three</li><li>Four</li></ol>
      </li>
      <li><input type="checkbox" checked> Done</li>
      <li><input type="checkbox"> Todo</li>
    </ul>`;
  assert.equal(md(html), "- One\n  3. Three\n  4. Four\n- [x] Done\n- [ ] Todo\n");
});

test("code keeps its whitespace and language", () => {
  const html = '<p>Run <code>ls -la</code>:</p><pre><code class="language-py">def f():\n    return 1\n</code></pre>';
  assert.equal(md(html), "Run `ls -la`:\n\n```py\ndef f():\n    return 1\n```\n");
});

test("code containing backticks gets a longer fence", () => {
  assert.equal(md("<pre>a ``` b</pre>"), "````\na ``` b\n````\n");
  assert.equal(md("<p><code>a`b</code></p>"), "``a`b``\n");
});

test("blockquotes and rules", () => {
  assert.equal(md("<blockquote><p>One</p><p>Two</p></blockquote><hr>"), "> One\n>\n> Two\n\n---\n");
});

test("tables become GFM tables", () => {
  const html = "<table><tr><th>Name</th><th>Score</th></tr><tr><td>A|B</td><td>9</td></tr></table>";
  assert.equal(md(html), "| Name | Score |\n| --- | --- |\n" + String.raw`| A\|B | 9 |` + "\n");
});

test("scripts, forms and navigation are dropped", () => {
  assert.equal(
    md("<nav>Menu</nav><script>alert(1)</script><form><input></form><p>Body</p><footer>©</footer>"),
    "Body\n",
  );
});

test("empty input gives an empty string", () => {
  assert.equal(md("   "), "");
});
