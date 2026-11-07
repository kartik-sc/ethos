"""Pure helpers for note text: wiki-links and tags. No I/O."""

import re

from app.notes.models import LinkKind

WIKI_LINK = re.compile(r"\[\[([^\[\]\n]{1,220})\]\]")
PREFIXES = {f"{kind.value}:": kind for kind in (LinkKind.TASK, LinkKind.PROJECT, LinkKind.GOAL)}
TAG_INVALID = re.compile(r"[^a-z0-9_/-]+")
TAG_MAX = 48


def parse_links(content: str) -> list[str]:
    """Labels of `[[...]]` links in order of first appearance. `[[Title|shown]]` keeps the title."""
    labels: list[str] = []
    for match in WIKI_LINK.finditer(content):
        label = match.group(1).split("|", 1)[0].strip()
        if label and label not in labels:
            labels.append(label)
    return labels


def split_label(label: str) -> tuple[LinkKind, str]:
    """`task:Renew passport` → (task, "Renew passport"); anything else links to a note."""
    lowered = label.lower()
    for prefix, kind in PREFIXES.items():
        if lowered.startswith(prefix):
            name = label[len(prefix) :].strip()
            if name:
                return kind, name
    return LinkKind.NOTE, label


def normalize_tag(raw: str) -> str | None:
    """Lowercase, `#` dropped, spaces to hyphens, only [a-z0-9_/-]. None when nothing is left."""
    tag = TAG_INVALID.sub("", raw.strip().lstrip("#").lower().replace(" ", "-")).strip("-/")
    return tag[:TAG_MAX] or None


def normalize_tags(raw: list[str]) -> list[str]:
    tags: list[str] = []
    for value in raw:
        tag = normalize_tag(value)
        if tag and tag not in tags:
            tags.append(tag)
    return sorted(tags)
