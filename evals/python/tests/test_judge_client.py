import json

import httpx
import pytest

from bakefix_evals import judge as judge_module
from bakefix_evals.judge import (
    CRITERIA,
    DEFAULT_JUDGE_BASE_URL,
    DEFAULT_JUDGE_MODEL,
    JUDGE_MAX_RETRIES,
    JUDGE_SKIP_MESSAGE,
    JUDGE_SYSTEM_PROMPT,
    JUDGE_TIMEOUT_S,
    JudgeConfig,
    JudgeError,
    JudgeVerdict,
    build_judge_message,
    judge,
    judge_config_from_env,
)
from bakefix_evals.models import Diagnosis, DiagnosisInput

CASE = DiagnosisInput(
    category="Cake",
    problem="My sponge sank in the middle after baking",
    constraints=[],
)

DIAGNOSIS = Diagnosis(
    headline="Underbaked centre",
    explanation="The middle set after the edges.",
    confidence="medium",
    causes=["Oven too cool"],
    rescueSteps=[],
    nextTime=["Check the oven temperature"],
    missingInformation=[],
    safetyNote=None,
)

CONFIG = JudgeConfig(
    api_key="test-key", base_url="https://judge.test/v1", model="judge-model"
)

VERDICT = {name: {"score": 4, "reason": "Fine."} for name in CRITERIA}


def _completion(content: str) -> httpx.Response:
    return httpx.Response(
        200, json={"choices": [{"message": {"role": "assistant", "content": content}}]}
    )


def _run(handler, monkeypatch) -> tuple[JudgeVerdict | JudgeError, list[float]]:
    sleeps: list[float] = []
    monkeypatch.setattr(judge_module.time, "sleep", sleeps.append)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        return judge(client, CONFIG, CASE, DIAGNOSIS), sleeps


# Config


def test_config_is_none_without_api_key() -> None:
    assert judge_config_from_env({}) is None
    assert judge_config_from_env({"JUDGE_API_KEY": "  "}) is None


def test_skip_message_names_the_key() -> None:
    assert "JUDGE_API_KEY" in JUDGE_SKIP_MESSAGE


def test_config_defaults_to_free_tier_provider() -> None:
    config = judge_config_from_env({"JUDGE_API_KEY": "k"})
    assert config == JudgeConfig(
        api_key="k", base_url=DEFAULT_JUDGE_BASE_URL, model=DEFAULT_JUDGE_MODEL
    )


def test_config_reads_overrides_from_env() -> None:
    config = judge_config_from_env(
        {
            "JUDGE_API_KEY": "k",
            "JUDGE_BASE_URL": "https://other.test/v1/",
            "JUDGE_MODEL": "other-model",
        }
    )
    assert config == JudgeConfig(
        api_key="k", base_url="https://other.test/v1", model="other-model"
    )


def test_default_model_is_outside_the_judged_families() -> None:
    model = DEFAULT_JUDGE_MODEL.lower()
    assert "gemini" not in model
    assert "gpt-oss" not in model


def test_config_repr_hides_the_key() -> None:
    assert "test-key" not in repr(CONFIG)


# Client


def test_success_sends_the_expected_request(monkeypatch) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _completion(json.dumps(VERDICT))

    result, sleeps = _run(handler, monkeypatch)

    assert result == JudgeVerdict.model_validate(VERDICT)
    assert sleeps == []
    [request] = requests
    assert request.method == "POST"
    assert str(request.url) == "https://judge.test/v1/chat/completions"
    assert request.headers["Authorization"] == "Bearer test-key"
    assert request.extensions["timeout"]["read"] == JUDGE_TIMEOUT_S
    body = json.loads(request.content)
    assert body["model"] == "judge-model"
    assert body["temperature"] == 0
    assert body["response_format"] == {"type": "json_object"}
    assert body["messages"] == [
        {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
        {"role": "user", "content": build_judge_message(CASE, DIAGNOSIS)},
    ]


def test_retries_429_then_succeeds(monkeypatch) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(429, json={"error": "slow down"})
        return _completion(json.dumps(VERDICT))

    result, sleeps = _run(handler, monkeypatch)

    assert isinstance(result, JudgeVerdict)
    assert calls == 2
    assert len(sleeps) == 1
    assert sleeps[0] > 0


def test_backoff_grows_and_gives_up_after_max_retries(monkeypatch) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(429)

    result, sleeps = _run(handler, monkeypatch)

    assert result == JudgeError(code="rate_limited", detail="HTTP 429")
    assert calls == JUDGE_MAX_RETRIES + 1
    assert len(sleeps) == JUDGE_MAX_RETRIES
    assert sleeps == sorted(sleeps)
    assert sleeps[0] < sleeps[-1]


def test_timeout_returns_error(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    result, _ = _run(handler, monkeypatch)

    assert isinstance(result, JudgeError)
    assert result.code == "timeout"


def test_network_error_returns_error(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    result, _ = _run(handler, monkeypatch)

    assert isinstance(result, JudgeError)
    assert result.code == "network_error"


def test_other_http_status_is_not_retried(monkeypatch) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(401, json={"error": "bad key"})

    result, sleeps = _run(handler, monkeypatch)

    assert result == JudgeError(code="http_error", detail="HTTP 401")
    assert calls == 1
    assert sleeps == []


@pytest.mark.parametrize(
    "response",
    [
        _completion("not json at all"),
        _completion(json.dumps({**VERDICT, "calibration": {"score": 9}})),
        httpx.Response(200, text="<html>oops</html>"),
        httpx.Response(200, json={"choices": []}),
    ],
    ids=["content-not-json", "out-of-range", "body-not-json", "no-choices"],
)
def test_invalid_output_returns_error(monkeypatch, response: httpx.Response) -> None:
    result, _ = _run(lambda _: response, monkeypatch)

    assert isinstance(result, JudgeError)
    assert result.code == "invalid_output"


def test_error_detail_never_contains_the_key(monkeypatch) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid key test-key"})

    result, _ = _run(handler, monkeypatch)

    assert isinstance(result, JudgeError)
    assert "test-key" not in result.detail
