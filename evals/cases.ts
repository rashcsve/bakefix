import type { DiagnosisInput } from "@/lib/ai/schema";

export type EvalCase = {
  name: string;
  input: DiagnosisInput;
  expectedConcepts: string[];
  expectMissingInformation?: boolean;
};

export const evalCases: EvalCase[] = [
  {
    name: "cookies spread from nearly melted butter",
    input: {
      category: "Cookies",
      problem:
        "I made chocolate chip cookies but the butter was almost fully melted when I creamed it with the sugar. They spread into thin, flat puddles and ran into each other on the sheet.",
      constraints: [],
    },
    expectedConcepts: ["butter", "spread"],
  },
  {
    name: "choux collapses after leaving the oven",
    input: {
      category: "Choux",
      problem:
        "My choux buns puffed up nicely in the oven but collapsed into flat, wrinkled shells within a minute of taking them out.",
      constraints: [],
    },
    expectedConcepts: ["steam", "underbaked", "moisture", "dry"],
  },
  {
    name: "buttercream splits after adding cold ingredients",
    input: {
      category: "Cream",
      problem:
        "I was making Swiss meringue buttercream and it looked smooth until I added the last of the butter, which had come straight from the fridge. Now it looks curdled and split, almost like cottage cheese.",
      constraints: [],
    },
    expectedConcepts: ["temperature", "cold", "emulsif"],
  },
  {
    name: "bread is dense with weak fermentation evidence",
    input: {
      category: "Bread",
      problem:
        "My sourdough loaf came out dense and tight-crumbed. The dough barely seemed to grow during bulk fermentation, and I don't remember seeing many bubbles on the surface before shaping.",
      constraints: [],
    },
    expectedConcepts: ["ferment", "rise", "yeast", "starter"],
  },
  {
    name: "insufficient information from the user",
    input: {
      category: "Cake",
      problem: "My cake didn't turn out right this time, not sure why.",
      constraints: [],
    },
    expectedConcepts: [],
    expectMissingInformation: true,
  },
];
