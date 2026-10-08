---
nomi: 1
type: {{type}}
---
# {{project}} — plan

<!-- The plan is a contract scripts test. `plan check` lints it; `observe <target> --flow .nomi/plan.md` runs its flows;
     `review` compares the result with it. Keep it under 80 lines. -->

## Read
<!-- One line, also the first line of your reply:
     Reading this as: <product type> for <who uses it, and when>, whose job here is <the task>, constrained by <limits that override taste>.
     If the request could mean two different products, add the other read on a second line. -->

## Flows
<!-- The 1–7 jobs this product must do, written before any interface file, as steps a script can run.
     Each flow: "name", "screen" (a name from Screens), optional "covers" (an id from the type's list) and "start" (a page path).
     Find a control by "name" (its visible label, placeholder or button text) or by "target" (a CSS selector).
     Steps: click · type ("text") · select ("value") · press-key ("key") · hover · focus · scroll · wait ("ms") ·
     expect ("text", add "state": "hidden" for text that must be gone | "name"/"target" with "state" | "url").
     Every flow ends with an expect: the state on screen that proves the job is done. Include one flow for what goes wrong. -->
```json
[
  {"name": "", "screen": "", "covers": "", "steps": [
    {"do": "type", "name": "", "text": ""},
    {"do": "click", "name": ""},
    {"do": "expect", "text": ""}
  ]}
]
```

## Screens
<!-- One line per screen:
     - <name>: what the person decides or does there; its states (empty, loading, error, done). -->

## Done
<!-- What must be true to ship, one checkable line each. Start with: every flow above completes.
     Add the type's questions you chose to answer, and any flow of the type you left out, with the reason. -->
