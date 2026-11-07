import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { primaryNav } from "@/lib/navigation";

// Stand-in for modules not built yet. Each page swaps this out as its slice lands.
const modules = {
  goals: {
    description: "Long-term objectives with progress derived from linked work and habits.",
    empty: "Goals arrive with the Phase 1 workspace.",
  },
  habits: {
    description: "Recurring commitments, occurrences and weekly consistency.",
    empty: "Habit tracking arrives with the Phase 1 workspace.",
  },
  notes: {
    description: "Raw Markdown notes with folders, tags, wiki-links and backlinks.",
    empty: "The Notes library arrives with the Phase 1 workspace.",
  },
  analytics: {
    description: "Weekly and monthly numbers, comparisons and factual observations.",
    empty: "Analytics arrive once tasks and habits are recording history.",
  },
  inbox: {
    description: "Unprocessed captures, oldest first.",
    empty: "Inbox capture and processing arrive with the Phase 1 workspace.",
  },
} as const;

export type ModuleKey = keyof typeof modules;

export function moduleTitle(key: ModuleKey): string {
  return primaryNav.find((item) => item.href === `/${key}`)?.label ?? key;
}

export function ModulePlaceholder({ module }: { module: ModuleKey }) {
  const item = primaryNav.find((navItem) => navItem.href === `/${module}`);
  if (!item) throw new Error(`No navigation entry for module "${module}"`);
  const { description, empty } = modules[module];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader title={item.label} description={description} />
      <EmptyState icon={item.icon} title="Not built yet">
        {empty}
      </EmptyState>
    </div>
  );
}
