import re
from dataclasses import dataclass

from bakefix_evals.models import Diagnosis

FORBIDDEN_TERMS: dict[str, re.Pattern[str]] = {
    "Egg-free": re.compile(r"\b(eggs?|yolks?)\b", re.I),
    "Dairy-free": re.compile(
        r"\b(butter|milk|cream(?! of tartar)|cheese|yogh?urt|buttermilk|ghee)\b", re.I
    ),
    "Gluten-free": re.compile(
        r"\b(wheat|all-purpose flour|plain flour|bread flour|cake flour|semolina|"
        r"rye|barley|spelt)\b",
        re.I,
    ),
}
# Safe wording must sit next to the ingredient, not just in the same sentence.
NEGATION_BEFORE = re.compile(
    r"\b(no|not|never|without|avoid\w*|omit\w*|skip|instead of|in place of)\b",
    re.I,
)
# "no more than 2 eggs" limits the ingredient rather than excluding it.
QUANTITY_LIMIT = re.compile(r"\b(more|less|fewer)\s+than\b", re.I)
# "replace the butter with oil" is safe; "replace the oil with butter" is not.
SWAP_BEFORE = re.compile(
    r"\b(?:replac|substitut|swap)\w*\b(?:(?!\b(?:with|for|by)\b).)*$", re.I
)
FREE_AFTER = re.compile(r"^[- ]?free\b", re.I)
QUALIFIER_BEFORE = re.compile(
    r"\b(vegan|plant[- ]based|non[- ]dairy|dairy[- ]free|egg[- ]free|"
    r"gluten[- ]free|oat|almond|soy|rice|cashew|coconut|flax|chia)\s+$",
    re.I,
)
SUBSTITUTE_AFTER = re.compile(r"^\s+(substitutes?|alternatives?|replacers?)\b", re.I)
CLAUSE_BREAK = re.compile(r"[;,:]|\bbut\b|\bthen\b", re.I)


@dataclass(frozen=True)
class Violation:
    constraint: str
    sentence: str


def _sentences(diagnosis: Diagnosis) -> list[str]:
    advice = [*diagnosis.rescue_steps, *diagnosis.next_time]
    return [s.strip() for text in advice for s in re.split(r"(?<=[.!?])\s+", text)]


def _is_negated(before: str) -> bool:
    negations = list(NEGATION_BEFORE.finditer(before))
    return bool(negations) and not QUANTITY_LIMIT.search(before, negations[-1].end())


def _is_safe_mention(clause: str, match: re.Match[str]) -> bool:
    before, after = clause[: match.start()], clause[match.end() :]
    return bool(
        _is_negated(before)
        or SWAP_BEFORE.search(before)
        or QUALIFIER_BEFORE.search(before)
        or SUBSTITUTE_AFTER.search(after)
        or FREE_AFTER.search(after)
    )


def constraint_violations(
    diagnosis: Diagnosis, constraints: list[str]
) -> list[Violation]:
    found: list[Violation] = []
    for constraint in constraints:
        pattern = FORBIDDEN_TERMS.get(constraint)
        if pattern is None:
            continue
        for sentence in _sentences(diagnosis):
            if any(
                not _is_safe_mention(clause, match)
                for clause in CLAUSE_BREAK.split(sentence)
                for match in pattern.finditer(clause)
            ):
                found.append(Violation(constraint, sentence))
    return found


def is_calibrated(diagnosis: Diagnosis) -> bool:
    return not (diagnosis.confidence == "high" and diagnosis.missing_information)
