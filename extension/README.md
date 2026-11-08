# Ethos Clipper

A Chrome/Edge (Manifest V3) extension that saves the current page, or the selected part of
it, to Ethos Notes as Markdown. No build step and no dependencies.

## Install

1. In Ethos, Settings → Capture → create a token (e.g. "Browser").
2. Open `chrome://extensions` (or `edge://extensions`), turn on *Developer mode*, choose
   *Load unpacked* and pick this `extension/` folder.
3. Click the toolbar button (or press `Alt+Shift+E`), enter the Ethos address and the token,
   and allow access to that address when asked.

## Use

The popup reads the page's title, URL and metadata (site name, author, published date,
description). Choose *Selection* or *Whole page*, a folder (the `Clippings` folder by default,
created on first use) and an optional note, then *Clip*. The note lands in Notes, never the
Inbox, tagged `clipping`, with the source and metadata quoted at the top. A title that is
already taken gets " (2)".

## How it works

- `popup.js` injects a read-only function into the active tab (`activeTab` + `scripting`), so
  the extension can read a page only when you open it there. It takes the selection, or the
  page's `<article>` / `<main>` / `<body>` without scripts, forms, navigation and footers.
- `markdown.js` converts that HTML to Markdown inside an inert `DOMParser` document. Links and
  images become absolute; `javascript:` and `data:` URLs are dropped.
- Requests go to `POST /api/v1/clip` and `GET /api/v1/clip/folders` with
  `Authorization: Bearer <token>`. Host access is requested only for the Ethos address you
  enter. The token is kept in the extension's local storage. Revoke it in Ethos to cut access.

## Test

```sh
node --test extension/markdown.test.mjs   # needs `pnpm install` in frontend/ (uses its jsdom)
```

The converter and the API are covered by tests. The popup itself has not yet been exercised in
a real browser profile; try it once against the local stack (`http://127.0.0.1:8080`).
