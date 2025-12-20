Below is an **industry-grade playbook** for DeFi whitepapers, based on what auditors, serious integrators, and sophisticated users actually read. This focuses on **content selection, structure, and format**, not marketing.

---

## First: what a DeFi whitepaper is (and is not)

**Whitepaper**

* Technical + economic specification
* Defines *what the protocol guarantees*
* Becomes a long-lived reference (audits, governance, disputes)

**Not**

* A pitch deck
* A README
* A roadmap blog post

If something may change frequently, it does **not** belong in the whitepaper.

---

## Do you need both a whitepaper and a litepaper?

**Yes — for most serious protocols.**

They serve different audiences and should not be merged.

| Document       | Audience                          | Purpose                             |
| -------------- | --------------------------------- | ----------------------------------- |
| **Litepaper**  | Users, partners, investors        | Explain *why* and *how it works*    |
| **Whitepaper** | Auditors, integrators, governance | Define *exact rules and invariants* |

Best practice:

* Litepaper: 5–10 pages
* Whitepaper: 20–40 pages (sometimes more)

---

## Whitepaper: industry-grade content organisation

### 1. Abstract (½–1 page)

* What problem is solved
* What is novel
* What guarantees the protocol provides
* No marketing language

A reader should know if they must continue reading.

---

### 2. Motivation & problem statement

* Precise description of the inefficiency or limitation
* Why existing protocols fail *structurally*
* Explicit assumptions (liquidity, oracle availability, user behavior)

Avoid “DeFi is broken” clichés.

---

### 3. System overview

* High-level model of the protocol
* Actors and their incentives
* Assets and flows
* Trust boundaries

This is conceptual, not implementation-specific.

---

### 4. Formal model & notation

Define:

* State variables
* Functions / transitions
* Time assumptions (block-based, continuous, epochal)
* Precision/rounding model

Use math *only where it adds clarity*.

---

### 5. Core mechanism design (most important section)

This should be **the densest and clearest part**.

Include:

* Step-by-step protocol flows
* State transitions
* Invariants (what must always hold)
* Failure modes and recovery

If applicable:

* Auction mechanics
* AMM math
* Yield decomposition
* Liquidation mechanics
* Fee distribution

Every mechanism should answer:

> “Why is this stable under adversarial conditions?”

---

### 6. Economic analysis & incentives

* Who is incentivized to act honestly
* What happens under stress
* Attack surfaces (MEV, griefing, oracle lag, liquidity shocks)
* Equilibrium assumptions (and when they break)

If incentives rely on “rational actors”, say so explicitly.

---

### 7. Risk analysis & threat model

Mandatory in serious DeFi.

Include:

* Smart contract risk
* Oracle risk
* Governance risk
* Liquidity risk
* Dependency risk (bridges, L2s, sequencers)

State *what the protocol does NOT protect against*.

---

### 8. Governance & upgrade model

* Upgradeability assumptions
* Admin powers (exactly what can be changed)
* Emergency procedures
* Governance attack surface

Avoid hand-waving. This section is often used by auditors.

---

### 9. Protocol parameters & bounds

* Parameters that are fixed
* Parameters that are governance-controlled
* Safe ranges and rationale

Do **not** include current values if they’re expected to change — put them in docs instead.

---

### 10. Implementation notes (non-normative)

* Mapping from spec → smart contracts
* Known deviations due to EVM/Cairo constraints
* Gas / performance trade-offs

Clearly mark this section as *non-normative*.

---

### 11. Related work

* Compare directly to relevant protocols
* Explain *why* yours differs, not just *that* it differs

No marketing comparisons.

---

### 12. Conclusion

Short, factual summary.

---

## Litepaper: what to include (and exclude)

### Include

* Intuition-first explanation
* Diagrams
* Example flows
* High-level economics
* Clear user risks

### Exclude

* Formal proofs
* Full math derivations
* Deep governance minutiae

Structure:

1. Problem
2. Solution intuition
3. How it works (visual)
4. Why it’s better
5. Risks & limitations
6. Where to learn more

---

## Content selection rules (hard rules)

### Include only if:

* It defines protocol behavior
* It affects security or economics
* It constrains future changes

### Exclude if:

* It’s marketing
* It’s a roadmap
* It’s a current parameter value
* It’s UI/UX specific

---

## Document format best practices

### File format

* **PDF** for canonical whitepaper
* **LaTeX** or Markdown → PDF for source
* Versioned and checksum’d

### Versioning

* Semantic versioning (`v1.0`, `v1.1`)
* Changelog at the front
* Git tag matching contract releases

### Diagrams

* Vector (SVG/PDF)
* Black-and-white printable
* No screenshots

### Citations

* Academic style or numbered references
* Link to protocol code where relevant

---

## Tone and writing style

* Precise, neutral, non-promotional
* Short paragraphs
* Explicit assumptions
* No “we believe”, “will”, or “intend” unless governance-bound

---

## Common professional mistakes

* Mixing litepaper and whitepaper content
* Including mutable parameters
* Hiding admin powers
* Overusing math without defining assumptions
* Treating the whitepaper as a launch blog post

---

## Recommended doc stack (best-in-class)

| Document      | Purpose               |
| ------------- | --------------------- |
| README        | Entry point           |
| Litepaper     | Narrative explanation |
| Whitepaper    | Normative spec        |
| Docs site     | Living documentation  |
| Audit reports | Security validation   |

---

## Bottom line

* **Yes, you should have both a whitepaper and a litepaper**
* Whitepaper = **specification**
* Litepaper = **intuition**
* Mixing them degrades credibility

If you want, I can:

* Produce a **whitepaper outline tailored to your protocol type** (AMM, yield, lending, bridge)
* Review a draft and mark **what should be removed or moved to docs**
* Help you decide **what belongs in the whitepaper vs spec vs code comments**
