# UI Registry

This file records reusable visual patterns that exist in the application.

Before creating a reusable component, check whether an equivalent pattern is
already documented here.

Only document implemented patterns. Do not document planned components.

## Components

### Chip

`components/form/Chip.tsx`

A visually-hidden native `radio` or `checkbox` input paired with a styled
`label`, used for single-select and multi-select option groups rendered as
pill-shaped controls. Selection state is shown with `has-checked:`, and
keyboard focus with `has-focus-visible:` on the label (since the input
itself is visually hidden). Chips intentionally use a full pill radius as
an exception to the 10px control radius in `context/ui-tokens.md`.

Used by `CategoryField.tsx` (radio, single-select pastry category) and
`ConstraintField.tsx` (checkbox, multi-select dietary constraints). Reuse
this instead of building a new chip-style control.

### FieldError

`components/form/FieldError.tsx`

Renders a `<p>` with the given `id` and validation message, or nothing when
the message is undefined. Pair its `id` with the control's
`aria-describedby` (or the enclosing `fieldset`'s, for chip groups) so
screen readers announce the error. Used by `CategoryField.tsx`,
`ConstraintField.tsx`, `BakeForm.tsx` (problem field), and
`RecipeDisclosure.tsx` (recipe field). Reuse this instead of writing a new
inline error paragraph.
