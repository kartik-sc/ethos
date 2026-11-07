import { type NavItem, primaryNav, settingsNav } from "./navigation";
import type { CommandResult, RecordKind } from "./types/commands";

export interface CommandSpec {
  name: string;
  syntax: string;
  description: string;
}

/** What the palette offers after "/". The backend parser is the source of truth. */
export const COMMANDS: readonly CommandSpec[] = [
  {
    name: "task",
    syntax: "/task <title> [by <date>] [!high] [#area] [@project] [45m]",
    description: "Create a task",
  },
  {
    name: "deadline",
    syntax: "/deadline <title> <date>",
    description: "Task that must have a due date",
  },
  { name: "capture", syntax: "/capture <anything>", description: "Put it in the Inbox for later" },
  {
    name: "habit",
    syntax: "/habit <name> [amount | 23:30-07:00]",
    description: "Log a habit for today",
  },
  { name: "note", syntax: "/note <title>", description: "Create a note and open it" },
  {
    name: "project",
    syntax: "/project <title> [by <date>] [#area]",
    description: "Create a project",
  },
  { name: "goal", syntax: "/goal <title> [by <date>] [#area]", description: "Create a goal" },
  { name: "search", syntax: "/search <words>", description: "Search everything" },
];

export type PaletteItem =
  | { type: "command"; command: CommandSpec }
  | { type: "navigate"; item: NavItem }
  | { type: "capture"; text: string }
  | { type: "search"; text: string };

const DESTINATIONS: readonly NavItem[] = [...primaryNav, settingsNav];

/** Suggestions while there is nothing to preview yet: no command, or a command name being typed. */
export function suggestions(input: string): PaletteItem[] {
  const text = input.trim();
  if (text === "") {
    return [
      ...COMMANDS.map((command) => ({ type: "command" as const, command })),
      ...DESTINATIONS.map((item) => ({ type: "navigate" as const, item })),
    ];
  }
  if (text.startsWith("/")) {
    const typed = text.slice(1).toLowerCase();
    return COMMANDS.filter((command) => command.name.startsWith(typed)).map((command) => ({
      type: "command" as const,
      command,
    }));
  }
  const lowered = text.toLowerCase();
  const pages = DESTINATIONS.filter((item) => item.label.toLowerCase().includes(lowered));
  return [
    { type: "capture", text },
    { type: "search", text },
    ...pages.map((item) => ({ type: "navigate" as const, item })),
  ];
}

/** True once a slash command has its arguments, so the server can preview it. */
export function wantsPreview(input: string): boolean {
  return /^\/\S+\s+\S/.test(input.trim());
}

export function recordHref(kind: RecordKind, id: string): string {
  switch (kind) {
    case "task":
      return "/tasks";
    case "habit":
      return "/habits";
    case "inbox":
      return "/inbox";
    case "note":
      return `/notes/${id}`;
    default:
      return `/${kind}s/${id}`;
  }
}

export function resultHref(result: CommandResult): string | null {
  if (result.kind === "search" && result.query)
    return `/search?q=${encodeURIComponent(result.query)}`;
  return result.record_kind && result.record_id
    ? recordHref(result.record_kind, result.record_id)
    : null;
}

/** Notes and searches open straight away; everything else confirms in place. */
export function opensAfterRun(result: CommandResult): boolean {
  return result.kind === "note" || result.kind === "search";
}
