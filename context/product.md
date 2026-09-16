# BakeFix

## Product

BakeFix is an AI-powered pastry troubleshooting web application.

Users describe a baking failure and receive a structured diagnosis with
likely causes, possible rescue steps and changes for their next attempt.

## Target user

Home bakers and pastry enthusiasts who know what happened but do not know why.

## Core user flow

1. Select a pastry category.
2. Describe what went wrong.
3. Optionally provide the recipe and technical details.
4. Select dietary constraints.
5. Submit the problem.
6. Receive a structured diagnosis.

## MVP

- One responsive page
- Pastry category selection
- Problem description
- Optional recipe
- Optional technical details
- Dietary constraints
- Structured AI diagnosis
- Loading, success and error states
- Accessible keyboard interaction
- Mobile and desktop layouts

## Diagnosis result

- Headline
- Short explanation
- Confidence level
- One to three likely causes
- Rescue steps
- Recommendations for next time
- Missing information
- Food-safety note when relevant

## Out of scope

- Authentication
- Database
- Saved history
- Image uploads
- Recipe generation
- Autonomous web research
- RAG or vector search
- Multiple AI agents
- Payments
- Analytics dashboard

## Success criteria

- A user can submit a problem without creating an account.
- A useful result is returned in under 30 seconds under normal conditions.
- Every result conforms to the defined output schema.
- Missing information and uncertainty are communicated honestly.
- API errors do not erase the user's input.
- The page works at 390px and 1440px widths.
- All controls are usable with a keyboard.
- No API secret is exposed to the browser.
