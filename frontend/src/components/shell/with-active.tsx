"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import { isActive } from "@/lib/navigation";

type RenderActive = (active: boolean) => ReactNode;

function ActiveReader({ href, children }: { href: string; children: RenderActive }) {
  return children(isActive(href, usePathname()));
}

/**
 * Reads the pathname in the smallest possible leaf. Under Cache Components the pathname of a
 * dynamic route is unknown while the static shell prerenders, so the link renders inactive
 * there and picks up its active state at request time.
 */
export function WithActive({ href, children }: { href: string; children: RenderActive }) {
  return (
    <Suspense fallback={children(false)}>
      <ActiveReader href={href}>{children}</ActiveReader>
    </Suspense>
  );
}
