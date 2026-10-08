"""Pydantic mirror of lib/ai/schema.ts; tests/test_models.py fails on drift."""

from typing import Annotated, Literal, get_args

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

PastryCategory = Literal["Cake", "Cookies", "Bread", "Choux", "Cream", "Other"]
DietaryConstraint = Literal["Egg-free", "Dairy-free", "Gluten-free"]

PASTRY_CATEGORIES: tuple[str, ...] = get_args(PastryCategory)
DIETARY_CONSTRAINTS: tuple[str, ...] = get_args(DietaryConstraint)

NonEmptyStr = Annotated[str, StringConstraints(min_length=1)]


class DiagnosisInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    category: PastryCategory
    problem: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=1000)
    ]
    recipe: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None
    ) = None
    technical_details: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None
    ) = Field(default=None, alias="technicalDetails")
    constraints: list[DietaryConstraint] = Field(max_length=3)

    def to_api_payload(self) -> dict[str, object]:
        return self.model_dump(by_alias=True, exclude_none=True)


class Diagnosis(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    headline: NonEmptyStr
    explanation: NonEmptyStr
    confidence: Literal["high", "medium", "low"]
    causes: list[NonEmptyStr] = Field(min_length=1, max_length=3)
    rescue_steps: list[NonEmptyStr] = Field(max_length=4, alias="rescueSteps")
    next_time: list[NonEmptyStr] = Field(min_length=1, max_length=5, alias="nextTime")
    missing_information: list[NonEmptyStr] = Field(
        max_length=3, alias="missingInformation"
    )
    safety_note: NonEmptyStr | None = Field(alias="safetyNote")
