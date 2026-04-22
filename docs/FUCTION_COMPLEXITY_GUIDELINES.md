Excessive function complexity is usually a symptom of one (or more) problems: mixed responsibilities, hidden state coupling, or implicit control flow (nested conditionals / early returns / async branching). In TS frontend code, I treat it less as a “style violation” and more as a maintainability + defect-risk signal.

## How to tackle it (practical patterns)

### 1) Split by responsibility, not by line count

If a function does **UI orchestration + domain rules + data shaping + side effects**, it will get complex no matter how “clean” it looks.

* **Domain / decision logic** → pure functions (easy to test)
* **Data shaping** (DTO ↔ view model) → mappers
* **Side effects** (network, storage, analytics) → thin wrappers
* **UI orchestration** → small glue function calling the above

Rule of thumb: the UI layer should read like a “script” of named operations.

### 2) Turn nested conditionals into “decision tables” or guards

Common in frontend: permission gating, feature flags, “if X and Y but not Z” logic.

* Prefer **early guard returns** for invalid states
* If there are many combinations, create a **lookup table** (object map) or a small state machine instead of branching.

### 3) Make state transitions explicit

A lot of complexity comes from “what state are we in?” being implicit.

* For reducers / flows: encode states as a **discriminated union** and move transitions into a reducer-like function.
* For async sequences: model as `idle | loading | success | error`, etc., and push branching to a central place.

### 4) Extract “verbs” with names that encode intent

If a block takes mental effort to understand, extract it into a function whose name states *why*, not *what*.
Bad: `compute()` / `handle()` / `process()`
Good: `deriveCheckoutTotals`, `validateSwapInputs`, `shouldShowKycWall`

### 5) Stabilize types to reduce control-flow noise

Complex functions often have lots of `?.`, `as`, null checks, and “maybe” values.

* Normalize input early: parse/validate once, then operate on a stable shape.
* Use `asserts` helpers or schema validation (e.g., zod) at boundaries.
* Prefer discriminated unions over ad-hoc optional fields.

### 6) Separate “render complexity” from “logic complexity”

In React, don’t let JSX conditionals become the decision engine.

* Compute a `viewModel` (or `uiState`) object first
* Render becomes mostly declarative: `uiState.showFoo`, `uiState.ctaLabel`

### 7) Add tests at the seams, not everywhere

When you extract pure logic, you can test the behavior without DOM/render harness overhead. That’s often the biggest ROI of refactoring.

## Should it always be fixed?

No. “Complex” isn’t automatically “bad,” and refactors have cost/risk.

Fix it when:

* It changes often (high churn area)
* Bugs keep coming from it
* Onboarding/PR review time is high
* It’s hard to test (logic intertwined with effects)
* It blocks parallel work (everyone touches the same monster function)

Maybe leave it (or do minimal work) when:

* It’s stable, rarely touched, and well-covered by tests
* It’s complex because the *problem* is complex, and the code reflects that cleanly (explicit state machine, clear names)
* You’re near a deadline and the refactor risk is higher than the maintenance risk

## A good “good enough” heuristic

If you can’t summarize what the function does in **one sentence**, or it has multiple reasons to change, it’s a refactor candidate. Otherwise, consider adding a couple of tests and leaving it.

If you paste a representative function (or describe the kind of complexity: async flow, permission gating, data transforms, JSX branching), I can suggest a concrete refactor shape for that pattern.
