from app.notes.merge import merge_tags, merge_text, merge_value

BASE = "# Plan\n\n- one\n- two\n- three\n\nFooter\n"


def test_separate_edits_merge_cleanly() -> None:
    mine = BASE.replace("- one", "- one (mine)")
    theirs = BASE.replace("Footer", "Footer (theirs)")
    result = merge_text(BASE, mine, theirs)
    assert result.conflicts == 0
    assert result.text == "# Plan\n\n- one (mine)\n- two\n- three\n\nFooter (theirs)\n"


def test_additions_at_different_places_both_survive() -> None:
    mine = BASE + "Added at the end\n"
    theirs = "Added at the top\n" + BASE
    result = merge_text(BASE, mine, theirs)
    assert result.conflicts == 0
    assert result.text.startswith("Added at the top\n")
    assert result.text.endswith("Added at the end\n")


def test_the_same_change_on_both_sides_is_taken_once() -> None:
    edited = BASE.replace("- two", "- 2")
    result = merge_text(BASE, edited, edited)
    assert (result.conflicts, result.text) == (0, edited)


def test_a_deletion_on_one_side_is_kept() -> None:
    mine = BASE.replace("- two\n", "")
    result = merge_text(BASE, mine, BASE)
    assert (result.conflicts, result.text) == (0, mine)


def test_overlapping_edits_conflict_and_are_marked_for_review() -> None:
    mine = BASE.replace("- two", "- two (mine)")
    theirs = BASE.replace("- two", "- two (theirs)")
    result = merge_text(BASE, mine, theirs)
    assert result.conflicts == 1
    assert (
        "<<<<<<< yours\n- two (mine)\n=======\n- two (theirs)\n>>>>>>> other version\n"
        in result.with_markers
    )
    assert result.with_markers.startswith("# Plan\n") and result.with_markers.endswith("Footer\n")


def test_markers_start_on_their_own_line_without_trailing_newline() -> None:
    result = merge_text("a", "mine", "theirs")
    assert result.conflicts == 1
    assert result.with_markers == ("<<<<<<< yours\nmine\n=======\ntheirs\n>>>>>>> other version\n")


def test_field_merge() -> None:
    assert merge_value("Old", "Old", "New") == ("New", False)
    assert merge_value("Old", "Mine", "Old") == ("Mine", False)
    assert merge_value("Old", "Same", "Same") == ("Same", False)
    assert merge_value("Old", "Mine", "Theirs") == ("Mine", True)


def test_tag_merge_keeps_additions_and_honours_removals() -> None:
    assert merge_tags(["a", "b"], ["a", "b", "mine"], ["b", "theirs"]) == ["b", "mine", "theirs"]
