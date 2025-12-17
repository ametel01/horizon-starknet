Below are **production-grade GitBook best practices** for **user-facing DeFi docs** (non-dev audience). The goal is clarity, trust, and task completion, not protocol completeness.

---

## 1. Information Architecture (most important)

Design the sidebar for **user intent**, not protocol structure.

**Recommended top-level sections**

1. **What is <Protocol>**
2. **How it Works (Concepts)**
3. **Getting Started**
4. **Using <Protocol>**
5. **Risks & Safety**
6. **FAQs**
7. **Troubleshooting**
8. **Governance / Updates** (optional)

**Rules**

* Max **7–9 top-level pages**
* No page deeper than **3 levels**
* Each page answers **one user question**

Bad:
`YieldTokenization → SY → PT → YT → Settlement`
Good:
`How Yield Works → Principal vs Yield Tokens`

---

## 2. Page Design Rules

Every page should follow the same cognitive pattern.

**Mandatory structure**

1. **One-sentence summary at the top**
2. **What problem this solves**
3. **What the user can do**
4. **What can go wrong**
5. **Next action**

Example opening:

> *This page explains how Principal Tokens lock your capital while Yield Tokens capture variable yield.*

---

## 3. Language & Tone

* Write at **educated retail / power-user level**
* Avoid protocol jargon unless defined
* Prefer **examples over definitions**

**Rules**

* Never introduce more than **one new concept per paragraph**
* Define terms **before** using acronyms
* No “smart contract”, “Cairo”, “AMM math” unless unavoidable

---

## 4. Visuals (critical for DeFi)

User docs without visuals are incomplete.

**Best practice**

* One diagram per concept page
* Diagrams show **flows**, not architecture
* Use **time-based diagrams** for yield

Examples:

* “Deposit → Split → Hold → Redeem”
* Timeline showing PT fixed value vs YT variable payoff

Use:

* Excalidraw / Figma → PNG
* Consistent color semantics (e.g. PT = blue, YT = green)

---

## 5. Risk & Safety as First-Class Content

This is non-negotiable for production DeFi docs.

**Dedicated pages**

* “Risks Overview”
* “Smart Contract Risk”
* “Yield Risk”
* “Liquidity Risk”
* “What happens if…?”

**Rules**

* Risks are linked inline from usage pages
* No legalese, plain language
* Use concrete failure modes, not abstract warnings

Example:

> If YT demand drops, you may be unable to sell before maturity without taking a loss.

---

## 6. Task-Oriented “How-To” Pages

User docs should optimize for **completion**, not explanation.

**Pattern**

* Goal statement
* Preconditions (wallet, network, assets)
* Step-by-step (numbered)
* Visual per step if possible
* “Common mistakes” section

Avoid:

* Long scrolling pages
* Mixing concepts + how-to in the same page

---

## 7. Cross-Link Aggressively (but intentionally)

GitBook shines when used as a **graph**, not a tree.

**Rules**

* Every page links to:

  * One prerequisite page
  * One follow-up page
* Inline links on first mention of a concept
* Never rely on sidebar alone for navigation

---

## 8. Versioning & Accuracy

User trust depends on freshness.

**Best practices**

* Add **“Last updated”** note manually in critical pages
* Changelog / Updates page in plain English
* Explicitly mark deprecated flows or features

Avoid:

* Auto-generated “v1/v2” unless users actually experience versions

---

## 9. Content Governance

Treat docs like production code.

**Process**

* Single owner per section
* PR-style review even if using GitBook UI
* Checklist before publishing:

  * Is this still accurate on mainnet?
  * Does UI wording match the app?
  * Are screenshots current?

---

## 10. What NOT to Do

* Do not mirror your whitepaper
* Do not dump contract terminology
* Do not explain math unless payoff changes
* Do not hide risks in footnotes
* Do not exceed 800–1000 words per page
