"""Download raw questions from Seasoned Advice via the public Stack Exchange API.

Posts are CC BY-SA, so each record keeps its link, author and license.

uv run python -m bakefix_evals.fetch_raw
"""

import json
import time
from pathlib import Path

import httpx

API = "https://api.stackexchange.com/2.3/search/advanced"
TAGS = ["cake", "cookies", "bread", "pastry", "frosting", "whipped-cream"]
PAGES_PER_TAG = 2
OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "seasoned_advice.json"


def fetch_tag(client: httpx.Client, tag: str) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for page in range(1, PAGES_PER_TAG + 1):
        response = client.get(
            API,
            params={
                "order": "desc",
                "sort": "votes",
                "tagged": tag,
                "site": "cooking",
                "pagesize": 100,
                "page": page,
                "filter": "withbody",
            },
        )
        response.raise_for_status()
        data = response.json()
        items.extend(data["items"])
        # The API requires clients to wait `backoff` seconds when it is set.
        time.sleep(float(data.get("backoff", 0)) + 0.5)
        if not data.get("has_more"):
            break
    return items


def main() -> None:
    records: dict[int, dict[str, object]] = {}
    with httpx.Client(timeout=30, headers={"Accept-Encoding": "gzip"}) as client:
        for tag in TAGS:
            fetched = fetch_tag(client, tag)
            print(f"{tag}: {len(fetched)} questions")
            for item in fetched:
                record = records.setdefault(item["question_id"], item)  # type: ignore[arg-type]
                record.setdefault("fetched_tags", []).append(tag)  # type: ignore[union-attr]
    keep = [
        "question_id",
        "title",
        "body",
        "tags",
        "score",
        "is_answered",
        "link",
        "content_license",
        "fetched_tags",
    ]
    rows = [
        {k: r.get(k) for k in keep}
        | {"author": (r.get("owner") or {}).get("display_name")}
        for r in records.values()
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} unique questions to {OUT}")


if __name__ == "__main__":
    main()
