import { describe, expect, it } from "vitest";

import { highlight, hitHref, searchParams } from "./search";

describe("searchParams", () => {
  it("repeats kind and omits empty filters", () => {
    const params = searchParams(" dbms ", { kinds: ["task", "goal"], area: null, status: "open" });
    expect(params.toString()).toBe("q=dbms&kind=task&kind=goal&status=open");
  });
});

describe("highlight", () => {
  it("marks every case-insensitive occurrence", () => {
    expect(highlight("DBMS and dbms", "dbms")).toEqual([
      { text: "DBMS", match: true },
      { text: " and ", match: false },
      { text: "dbms", match: true },
    ]);
  });

  it("returns the text unchanged without a query", () => {
    expect(highlight("plain", "  ")).toEqual([{ text: "plain", match: false }]);
  });
});

describe("hitHref", () => {
  it("opens detail pages where they exist", () => {
    expect(hitHref({ kind: "goal", id: "g1" })).toBe("/goals/g1");
    expect(hitHref({ kind: "inbox", id: "i1" })).toBe("/inbox");
  });
});
