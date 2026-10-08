"""Turn raw Seasoned Advice questions into validated BakeFix eval cases.

uv run python -m bakefix_evals.parse_dataset
"""

import argparse
import json
import re
from collections import Counter
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

from pydantic import ValidationError

from bakefix_evals.models import DiagnosisInput

DATA = Path(__file__).resolve().parents[2] / "data"
RAW_PATH = DATA / "raw" / "seasoned_advice.json"
CASES_PATH = DATA / "cases.json"
CURATED_PATH = DATA / "curated_cases.json"
REJECTS_PATH = DATA / "rejects.json"

MAX_PROBLEM_CHARS = 1000

# A failed bake = something the author did + a concrete symptom.
BAKE_EVENT = re.compile(
    r"\bI(?:'ve| have)?\s+(?:just\s+|recently\s+|accidentally\s+)?"
    r"(?:made|baked|tried|used|followed|whipped|added|put|took|pulled|left|mixed|"
    r"cooked|bought|beat|folded|piped|proofed|kneaded|let)\b|"
    r"\bmy\s+\w+(?:\s+\w+)?\s+(?:came out|turned out|ended up|was|were|is|are|"
    r"keeps?|always|never|won'?t|didn'?t|doesn'?t|sank|collapsed|split)\b",
    re.I,
)
SYMPTOM = re.compile(
    r"\b(dense|sank|sunk|sinks?|collapse[ds]?|flat|spread(?:s|ing)?|curdl\w*|"
    r"split(?:s|ting)?|gummy|soggy|dry|tough|rubbery|crack\w*|burn\w*|raw|hollow|"
    r"greasy|grainy|lumpy|runny|bitter|gooey|crumbl\w*|deflat\w*|ruin\w*|fail\w*|"
    r"(?:didn'?t|won'?t|doesn'?t|never|not)\s+"
    r"(?:rise|set|whip|brown|bake|hold|work|thicken|stiffen|puff|crisp)\w*|"
    r"too\s+(?:dry|flat|dense|runny|sweet|salty|soft|hard|thin|thick|wet|sticky|"
    r"crumbly|chewy|brown|pale))\b",
    re.I,
)
NOT_A_PROBLEM = re.compile(
    r"\b(difference between|what is the purpose|recommend\w*|best way to|"
    r"how (should|do|can) (i|you) (clean|store|care|freeze|substitute|make|get)|"
    r"which (is|one|type)|brand|equipment|worth it)\b",
    re.I,
)

CONCEPTUAL_TITLE = re.compile(
    r"^(can|could|should|would|will|is|are|does|do|did you|what (is|are|does|do|kind|"
    r"kinds|type|types)|which|how (to|do i|can i|should i) (make|get|keep|use|"
    r"substitute|colou?r|attach|cut|stuff|portion|veganize|change|eat|trim|proof)|"
    r"why (is|are|do|does) (the|a|an|you|milk|butter|egg|sugar|salt)\b)",
    re.I,
)

CHOUX = re.compile(
    r"\b(choux|[eé]clairs?|cream puffs?|profiteroles?|gougeres?)\b", re.I
)
TAG_TO_CATEGORY = {
    "cookies": "Cookies",
    "cake": "Cake",
    "bread": "Bread",
    "whipped-cream": "Cream",
    "frosting": "Cream",
}
CONSTRAINT_PATTERNS = {
    "Egg-free": re.compile(r"\b(egg[- ]?free|eggless|without eggs?|vegan)\b", re.I),
    "Dairy-free": re.compile(
        r"\b(dairy[- ]?free|lactose[- ]?free|non[- ]?dairy|vegan)\b", re.I
    ),
    "Gluten-free": re.compile(r"\b(gluten[- ]?free|coeliac|celiac)\b", re.I),
}


class _TextExtractor(HTMLParser):
    BLOCKS = {"p", "li", "br", "div", "h1", "h2", "h3", "blockquote", "pre"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.BLOCKS:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def html_to_text(html: str) -> str:
    extractor = _TextExtractor()
    extractor.feed(html)
    text = unescape("".join(extractor.parts))
    return re.sub(r"\s+", " ", text).strip()


def truncate_at_sentence(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
    return cut[: end + 1] if end > limit // 2 else cut.rstrip()


def join_title_and_body(title: str, body: str) -> str:
    if not body:
        return title
    separator = " " if title.endswith((".", "?", "!")) else ". "
    return f"{title}{separator}{body}"


def map_category(tags: list[str], text: str) -> str:
    if CHOUX.search(text):
        return "Choux"
    for tag in tags:
        if tag in TAG_TO_CATEGORY:
            return TAG_TO_CATEGORY[tag]
    return "Other"


def detect_constraints(text: str) -> list[str]:
    return [
        name for name, pattern in CONSTRAINT_PATTERNS.items() if pattern.search(text)
    ]


@dataclass
class Rejection:
    question_id: int
    title: str
    reason: str


def parse_record(raw: dict[str, object]) -> tuple[dict[str, object] | None, str | None]:
    if not raw.get("content_license"):
        return None, "missing_license"
    title = html_to_text(str(raw["title"]))
    body = html_to_text(str(raw.get("body") or ""))
    text = join_title_and_body(title, body)

    if NOT_A_PROBLEM.search(title):
        return None, "not_a_problem_question"
    if CONCEPTUAL_TITLE.search(title):
        return None, "conceptual_title"
    symptoms = {m.group(0).lower() for m in SYMPTOM.finditer(text)}
    if not BAKE_EVENT.search(text) or not (SYMPTOM.search(title) or len(symptoms) >= 2):
        return None, "no_failure_signal"

    problem = truncate_at_sentence(text, MAX_PROBLEM_CHARS)
    tags = [str(t) for t in (raw.get("tags") or [])] + [
        str(t) for t in (raw.get("fetched_tags") or [])
    ]
    try:
        model = DiagnosisInput(
            category=map_category(tags, text),
            problem=problem,
            constraints=detect_constraints(text),
        )
    except ValidationError:
        return None, "invalid_input"

    return {
        "id": f"se-{raw['question_id']}",
        "input": model.to_api_payload(),
        "source": {
            "url": raw["link"],
            "author": raw.get("author"),
            "license": raw["content_license"],
            "score": raw.get("score", 0),
            "truncated": len(text) > MAX_PROBLEM_CHARS,
        },
    }, None


def parse_dataset(
    raw_records: list[dict[str, object]], max_per_category: int
) -> tuple[list[dict[str, object]], list[Rejection]]:
    kept: list[tuple[dict[str, object], str]] = []
    rejects: list[Rejection] = []
    seen_titles: set[str] = set()
    # Highest-voted first, so the per-category cap keeps the best questions.
    for raw in sorted(raw_records, key=lambda r: -int(r.get("score") or 0)):
        qid, title = int(raw["question_id"]), html_to_text(str(raw["title"]))  # type: ignore[arg-type]
        key = re.sub(r"\W+", " ", title.lower()).strip()
        if key in seen_titles:
            rejects.append(Rejection(qid, title, "duplicate_title"))
            continue
        case, reason = parse_record(raw)
        if case is None:
            rejects.append(Rejection(qid, title, reason or "unknown"))
            continue
        seen_titles.add(key)
        kept.append((case, title))

    per_category: Counter[str] = Counter()
    selected: list[dict[str, object]] = []
    for case, title in kept:
        category = str(case["input"]["category"])  # type: ignore[index]
        if per_category[category] >= max_per_category:
            rejects.append(Rejection(int(str(case["id"])[3:]), title, "category_cap"))
            continue
        per_category[category] += 1
        selected.append(case)
    return selected, rejects


def load_curated(path: Path = CURATED_PATH) -> list[dict[str, object]]:
    cases = json.loads(path.read_text())
    for case in cases:
        case["input"] = DiagnosisInput.model_validate(case["input"]).to_api_payload()
    return cases


def main() -> None:
    argument_parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    argument_parser.add_argument("--max-per-category", type=int, default=12)
    args = argument_parser.parse_args()

    raw_records = json.loads(RAW_PATH.read_text())
    cases, rejects = parse_dataset(raw_records, args.max_per_category)
    cases += load_curated()

    CASES_PATH.write_text(json.dumps(cases, indent=2, ensure_ascii=False) + "\n")
    REJECTS_PATH.write_text(
        json.dumps([r.__dict__ for r in rejects], indent=2, ensure_ascii=False) + "\n"
    )
    print(f"raw: {len(raw_records)}  kept: {len(cases)}  rejected: {len(rejects)}")
    print("rejected by reason:", dict(Counter(r.reason for r in rejects)))
    print(
        "kept by category:",
        dict(Counter(str(c["input"]["category"]) for c in cases)),  # type: ignore[index]
    )


if __name__ == "__main__":
    main()
