"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef } from "react";

import { StatusDot } from "@/components/system/status-dot";
import { SystemPill } from "@/components/system/system-pill";
import { useHealth } from "@/hooks/use-health";
import { type NavItem, primaryNav, settingsNav } from "@/lib/navigation";
import { summariseSystem } from "@/lib/system-status";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/stores/preferences";

import { EthosMark } from "./ethos-mark";
import { InboxCount } from "./inbox-count";
import { SidebarToggle } from "./sidebar-toggle";
import { ThemeToggle } from "./theme-toggle";
import { WithActive } from "./with-active";

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 280;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <WithActive href={item.href}>
      {(active) => <SidebarLinkView item={item} active={active} />}
    </WithActive>
  );
}

function SidebarLinkView({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-3 rounded-md px-3 text-[0.8125rem] font-medium outline-none",
        "text-sidebar-foreground transition-colors hover:text-sidebar-accent-foreground",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active && "text-sidebar-accent-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-md bg-sidebar-accent"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        >
          <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />
        </motion.span>
      )}
      <Icon
        aria-hidden="true"
        className={cn(
          "relative size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-faint group-hover:text-sidebar-accent-foreground",
        )}
      />
      <span className="relative truncate">{item.label}</span>
      {item.href === "/inbox" && <InboxCount />}
    </Link>
  );
}

/** Only shown while the sidebar floats: the way in, plus a warning dot when something is wrong. */
function Launcher({
  onOpen,
  onClose,
  onToggle,
  buttonRef,
}: {
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const open = usePreferences((state) => state.sidebarOpen);
  const summary = summariseSystem(useHealth());
  const alarming = summary.tone === "degraded" || summary.tone === "down";

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={alarming ? `Open navigation. ${summary.label}` : "Open navigation"}
      aria-controls="sidebar"
      aria-expanded={open}
      onClick={onToggle}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      className={cn(
        "fixed top-3 left-3 z-30 hidden size-9 items-center justify-center rounded-lg outline-none md:floating:inline-flex",
        "border border-transparent transition-colors hover:border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <EthosMark className="size-6" />
      {alarming && <StatusDot tone={summary.tone} className="absolute top-1 right-1" />}
    </button>
  );
}

function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(() => onNavigate(), [pathname, onNavigate]);
  return null;
}

export function Sidebar() {
  const docked = usePreferences((state) => state.sidebarDocked);
  const open = usePreferences((state) => state.sidebarOpen);
  const setOpen = usePreferences((state) => state.setSidebarOpen);
  const toggleDocked = usePreferences((state) => state.toggleSidebarDocked);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const asideRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const schedule = (next: boolean, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  };
  const cancel = () => clearTimeout(timer.current);
  const closeNow = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "[" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      toggleDocked();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleDocked]);

  useEffect(() => {
    if (docked || !open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (asideRef.current?.contains(target) || launcherRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [docked, open, setOpen]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const floatingHidden = !docked && !open;

  return (
    <>
      <div
        aria-hidden="true"
        onMouseEnter={() => schedule(true, OPEN_DELAY_MS)}
        onMouseLeave={cancel}
        className="fixed inset-y-0 left-0 z-30 hidden w-2 md:floating:block"
      />
      <Launcher
        buttonRef={launcherRef}
        onOpen={() => schedule(true, OPEN_DELAY_MS)}
        onClose={() => schedule(false, CLOSE_DELAY_MS)}
        onToggle={() => {
          cancel();
          setOpen(!open);
        }}
      />

      <aside
        id="sidebar"
        ref={asideRef}
        aria-label="Navigation"
        inert={floatingHidden}
        onMouseEnter={cancel}
        onMouseLeave={() => !docked && schedule(false, CLOSE_DELAY_MS)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || docked) return;
          setOpen(false);
          launcherRef.current?.focus();
        }}
        className={cn(
          "hidden w-58 shrink-0 flex-col overflow-hidden bg-sidebar md:flex",
          "docked:sticky docked:top-0 docked:h-dvh docked:border-r docked:border-sidebar-border",
          "floating:fixed floating:inset-y-2 floating:left-2 floating:z-40 floating:rounded-xl floating:border floating:border-sidebar-border floating:shadow-2xl floating:shadow-black/30",
          "transition-[translate,opacity] duration-300 ease-out-quint motion-reduce:transition-none",
          !open && "floating:-translate-x-[calc(100%+1rem)] floating:opacity-0",
        )}
      >
        <Suspense fallback={null}>
          <CloseOnNavigate onNavigate={closeNow} />
        </Suspense>
        <div className="flex h-14 items-center gap-2.5 px-4.5">
          <EthosMark className="shrink-0" />
          <span className="font-mono text-sm font-semibold tracking-tight">ethos</span>
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 px-2 pt-2">
          <p className="micro-label px-3 pb-2">Workspace</p>
          {primaryNav.map((item) => (
            <SidebarLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-2 py-2">
          <SidebarLink item={settingsNav} />
          <SystemPill />
          <div className="flex items-center gap-1 px-1 pt-1">
            <SidebarToggle />
            <ThemeToggle />
            <kbd className="ml-auto pr-2 font-mono text-[0.625rem] text-faint">[</kbd>
          </div>
        </div>
      </aside>
    </>
  );
}
