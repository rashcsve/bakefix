# UI Registry

This file records reusable visual patterns that exist in the application.

Before creating a reusable component, check whether an equivalent pattern is
already documented here.

Only document implemented patterns. Do not document planned components.

## Components

### Chip

`components/bakefix/Chip.tsx`

A visually-hidden native `radio` or `checkbox` input paired with a styled
`label`, used for single-select and multi-select option groups rendered as
pill-shaped controls. Selection state is shown with `has-checked:`, and
keyboard focus with `has-focus-visible:` on the label (since the input
itself is visually hidden). Chips intentionally use a full pill radius as
an exception to the 10px control radius in `context/ui-tokens.md`.

Used by `CategoryField.tsx` (radio, single-select pastry category) and
`ConstraintField.tsx` (checkbox, multi-select dietary constraints). Reuse
this instead of building a new chip-style control.
