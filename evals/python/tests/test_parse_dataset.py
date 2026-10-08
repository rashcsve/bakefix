from bakefix_evals.parse_dataset import (
    detect_constraints,
    html_to_text,
    join_title_and_body,
    load_curated,
    map_category,
    parse_dataset,
    parse_record,
    truncate_at_sentence,
)


def raw(title: str, body: str, **overrides: object) -> dict[str, object]:
    return {
        "question_id": 1,
        "title": title,
        "body": body,
        "tags": ["baking"],
        "fetched_tags": ["cake"],
        "score": 5,
        "link": "https://cooking.stackexchange.com/q/1",
        "content_license": "CC BY-SA 4.0",
        "author": "someone",
    } | overrides


def test_html_to_text_strips_tags_entities_and_whitespace() -> None:
    html = (
        '<p>I made   a <a href="x">cake</a> &amp; it sank.</p>\n'
        "<ul><li>2 eggs</li></ul>"
    )
    assert html_to_text(html) == "I made a cake & it sank. 2 eggs"


def test_truncate_prefers_sentence_boundary() -> None:
    text = "First sentence here. Second sentence goes on and on without end"
    assert truncate_at_sentence(text, 30) == "First sentence here."
    assert truncate_at_sentence("short", 40) == "short"


def test_map_category_prefers_choux_text_then_tags() -> None:
    assert map_category(["cake"], "my eclairs collapsed") == "Choux"
    assert map_category(["cookies"], "they spread") == "Cookies"
    assert map_category(["pastry"], "my tart shrank") == "Other"


def test_detect_constraints() -> None:
    assert detect_constraints("an eggless, gluten free loaf") == [
        "Egg-free",
        "Gluten-free",
    ]
    assert detect_constraints("vegan brownies") == ["Egg-free", "Dairy-free"]
    assert detect_constraints("plain butter cake") == []


def test_keeps_a_real_failure_and_builds_api_payload() -> None:
    case, reason = parse_record(
        raw("Why did my pound cake turn out dry?", "<p>I baked it for an hour.</p>")
    )
    assert reason is None and case is not None
    assert case["input"] == {
        "category": "Cake",
        "problem": "Why did my pound cake turn out dry? I baked it for an hour.",
        "constraints": [],
    }
    assert case["source"]["license"] == "CC BY-SA 4.0"  # type: ignore[index]


def test_rejects_missing_license() -> None:
    _, reason = parse_record(raw("My cake sank", "I baked it.", content_license=None))
    assert reason == "missing_license"


def test_rejects_conceptual_and_howto_questions() -> None:
    _, reason = parse_record(raw("Can I use cornstarch here?", "I made it."))
    assert reason == "conceptual_title"
    _, reason = parse_record(raw("Best way to store my cake", "I baked a dry cake."))
    assert reason == "not_a_problem_question"


def test_rejects_text_without_bake_event_or_symptom() -> None:
    _, reason = parse_record(raw("Why my bread is special", "It tastes nice."))
    assert reason == "no_failure_signal"


def test_dedupes_titles_and_caps_per_category() -> None:
    records = [
        raw(f"My cake{n} sank", "I baked it and it sank flat.", question_id=n, score=n)
        for n in range(1, 4)
    ] + [raw("My cake1 sank", "I baked it and it sank flat.", question_id=99, score=0)]
    cases, rejects = parse_dataset(records, max_per_category=2)
    assert [c["id"] for c in cases] == ["se-3", "se-2"]
    assert {r.reason for r in rejects} == {"duplicate_title", "category_cap"}
    assert all(r.title for r in rejects)


def test_join_title_and_body_avoids_double_punctuation() -> None:
    assert join_title_and_body("Dry?", "I baked.") == "Dry? I baked."
    assert join_title_and_body("It sank", "I baked.") == "It sank. I baked."
    assert join_title_and_body("It sank", "") == "It sank"


def test_curated_cases_are_valid_and_cover_every_constraint() -> None:
    cases = load_curated()
    covered = {c for case in cases for c in case["input"]["constraints"]}
    assert covered == {"Egg-free", "Dairy-free", "Gluten-free"}
    assert all(case["source"]["license"] == "original" for case in cases)
    assert len({case["id"] for case in cases}) == len(cases)
