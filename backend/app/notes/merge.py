"""Three-way merge for notes. Pure functions, no I/O.

Content merges line by line against the version both sides started from: a region changed on
one side only takes that side; a region changed identically on both is taken once; a region
changed differently on both is a conflict. Conflicts are never resolved automatically.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from difflib import SequenceMatcher

MINE_MARKER = "<<<<<<< yours"
SPLIT_MARKER = "======="
THEIRS_MARKER = ">>>>>>> other version"


@dataclass(frozen=True)
class TextMerge:
    text: str
    conflicts: int
    # The same merge with conflicting regions written out between markers, for review by hand.
    with_markers: str


def _intersect(a: tuple[int, int], b: tuple[int, int]) -> tuple[int, int] | None:
    start, end = max(a[0], b[0]), min(a[1], b[1])
    return (start, end) if start < end else None


def _sync_regions(
    base: Sequence[str], mine: Sequence[str], theirs: Sequence[str]
) -> list[tuple[int, int, int, int, int, int]]:
    """Base ranges that both sides left untouched, with where they sit in each side."""
    mine_blocks = SequenceMatcher(None, base, mine, autojunk=False).get_matching_blocks()
    their_blocks = SequenceMatcher(None, base, theirs, autojunk=False).get_matching_blocks()
    regions = []
    i = j = 0
    while i < len(mine_blocks) and j < len(their_blocks):
        m_base, m_side, m_len = mine_blocks[i]
        t_base, t_side, t_len = their_blocks[j]
        overlap = _intersect((m_base, m_base + m_len), (t_base, t_base + t_len))
        if overlap:
            start, end = overlap
            m_start = m_side + (start - m_base)
            t_start = t_side + (start - t_base)
            regions.append(
                (start, end, m_start, m_start + end - start, t_start, t_start + end - start)
            )
        if m_base + m_len < t_base + t_len:
            i += 1
        else:
            j += 1
    regions.append((len(base), len(base), len(mine), len(mine), len(theirs), len(theirs)))
    return regions


def merge_text(base: str, mine: str, theirs: str) -> TextMerge:
    base_lines = base.splitlines(keepends=True)
    mine_lines = mine.splitlines(keepends=True)
    their_lines = theirs.splitlines(keepends=True)

    merged: list[str] = []
    marked: list[str] = []
    conflicts = 0
    z = a = b = 0
    for z_start, z_end, a_start, a_end, b_start, b_end in _sync_regions(
        base_lines, mine_lines, their_lines
    ):
        base_chunk = base_lines[z:z_start]
        mine_chunk = mine_lines[a:a_start]
        their_chunk = their_lines[b:b_start]
        if mine_chunk == their_chunk or their_chunk == base_chunk:
            merged += mine_chunk
            marked += mine_chunk
        elif mine_chunk == base_chunk:
            merged += their_chunk
            marked += their_chunk
        else:
            conflicts += 1
            merged += mine_chunk
            marked += [
                f"{MINE_MARKER}\n",
                *_terminated(mine_chunk),
                f"{SPLIT_MARKER}\n",
                *_terminated(their_chunk),
                f"{THEIRS_MARKER}\n",
            ]
        unchanged = base_lines[z_start:z_end]
        merged += unchanged
        marked += unchanged
        z, a, b = z_end, a_end, b_end

    return TextMerge(text="".join(merged), conflicts=conflicts, with_markers="".join(marked))


def _terminated(lines: list[str]) -> list[str]:
    """Markers must start on their own line even when a chunk ends without a newline."""
    if lines and not lines[-1].endswith("\n"):
        return [*lines[:-1], lines[-1] + "\n"]
    return lines


def merge_value[T](base: T, mine: T, theirs: T) -> tuple[T, bool]:
    """A single field: (merged value, conflicted)."""
    if mine == theirs or theirs == base:
        return mine, False
    if mine == base:
        return theirs, False
    return mine, True


def merge_tags(base: Sequence[str], mine: Sequence[str], theirs: Sequence[str]) -> list[str]:
    """Keeps tags on both sides plus tags either side added; a removal on either side wins."""
    base_set, mine_set, their_set = set(base), set(mine), set(theirs)
    kept = (mine_set & their_set) | (mine_set - base_set) | (their_set - base_set)
    removed = (base_set - mine_set) | (base_set - their_set)
    return sorted(kept - removed)
