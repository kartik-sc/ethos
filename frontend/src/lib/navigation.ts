import {
  ChartNoAxesColumn,
  CircleCheck,
  Inbox,
  Layers,
  type LucideIcon,
  NotebookPen,
  Repeat2,
  Settings2,
  SquareTerminal,
  Target,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the iPhone bottom bar. */
  mobile: boolean;
}

export const primaryNav: readonly NavItem[] = [
  { href: "/", label: "Command Centre", icon: SquareTerminal, mobile: true },
  { href: "/tasks", label: "Tasks", icon: CircleCheck, mobile: true },
  { href: "/projects", label: "Projects", icon: Layers, mobile: false },
  { href: "/goals", label: "Goals", icon: Target, mobile: false },
  { href: "/habits", label: "Habits", icon: Repeat2, mobile: true },
  { href: "/notes", label: "Notes", icon: NotebookPen, mobile: true },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumn, mobile: false },
  { href: "/inbox", label: "Inbox", icon: Inbox, mobile: true },
];

export const settingsNav: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings2,
  mobile: false,
};

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
