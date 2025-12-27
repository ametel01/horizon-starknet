**Context.**
UI/UX “laws” are empirical regularities from psychology, HCI, and ergonomics. They are not axioms; each describes a dominant cost function (time, error, memory, effort) that designers can trade against others. Below is a consolidated, practitioner-oriented map: *law → what it predicts → how to design*.

---

## 1. Laws of Speed, Effort, and Motor Control

### **Fitts’s Law**

**Predicts:** Target acquisition time
**Design implications:**

* Make primary actions large and close
* Use screen edges/corners for critical controls
* Increase hit areas beyond visual bounds
* Avoid moving targets during interaction

---

### **Steering Law**

**Predicts:** Time to navigate constrained paths
**Design implications:**

* Wider menus > narrow ones
* Avoid long, thin interaction tunnels (e.g. sliders, nested flyouts)
* Radial menus outperform linear menus under pressure

---

### **Doherty Threshold**

**Predicts:** Perceived productivity vs latency
**Design implications:**

* Respond visually <400 ms
* Use optimistic UI
* Acknowledge input immediately, even if work continues
* Control tail latency, not just averages

---

## 2. Laws of Decision Making

### **Hick’s Law**

**Predicts:** Decision time vs number of choices
**Design implications:**

* Reduce visible options
* Chunk choices into stages
* Use progressive disclosure
* Prefer defaults over menus

---

### **Miller’s Law**

**Predicts:** Short-term memory limits (~7±2, practically 4–5)
**Design implications:**

* Avoid long lists without grouping
* Keep forms short or multi-step
* Externalize memory (labels, previews, history)

---

### **Paradox of Choice**

**Predicts:** Too many options reduce satisfaction and conversion
**Design implications:**

* Curate instead of enumerate
* Highlight “recommended” paths
* Collapse advanced options

---

## 3. Laws of Visual Perception & Hierarchy

### **Gestalt Principles**

(Proximity, Similarity, Continuity, Closure, Common Region)
**Predict:** How users group elements
**Design implications:**

* Use spacing to indicate relationships
* Use color and shape consistently
* Avoid accidental groupings
* Prefer whitespace over borders

---

### **Figure–Ground**

**Predicts:** Ability to distinguish focus from background
**Design implications:**

* Strong contrast for active content
* Avoid noisy backgrounds
* Use overlays and elevation sparingly but clearly

---

### **Von Restorff Effect**

**Predicts:** Distinct items are remembered
**Design implications:**

* Make CTAs visually unique
* Use accent colors sparingly
* Do not overuse highlights (they cancel out)

---

### **Serial Position Effect**

**Predicts:** First and last items remembered best
**Design implications:**

* Put key actions first/last in lists
* Critical settings at top or bottom, not middle

---

### **60–30–10 Color Rule**

**Predicts:** Balanced visual dominance
**Design implications:**

* 60% base/background
* 30% supporting structure
* 10% high-contrast action/attention

---

## 4. Laws of Attention and Scanning

### **F-Pattern / Z-Pattern**

**Predicts:** How users scan screens
**Design implications:**

* Place key info top-left/top-center
* Align important text left
* Use clear visual anchors

---

### **Banner Blindness**

**Predicts:** Users ignore content that looks like ads
**Design implications:**

* Avoid CTA designs that mimic ads
* Integrate actions into content flow
* Use native styling over loud graphics

---

### **Change Blindness**

**Predicts:** Users miss changes without cues
**Design implications:**

* Animate state changes
* Highlight updates
* Never rely on silent content swaps

---

## 5. Laws of Learning and Familiarity

### **Jakob’s Law**

**Predicts:** Users prefer familiar patterns
**Design implications:**

* Follow platform conventions
* Innovate only where value is clear
* Reuse mental models from dominant apps

---

### **Law of Prägnanz (Simplicity)**

**Predicts:** Users perceive simplest structure
**Design implications:**

* Reduce visual clutter
* Favor simple shapes and layouts
* Avoid decorative complexity without function

---

### **Tesler’s Law (Conservation of Complexity)**

**Predicts:** Complexity cannot be removed, only shifted
**Design implications:**

* Push complexity to the system, not the user
* Automate decisions
* Use smart defaults and inference

---

## 6. Laws of Error and Recovery

### **Occam’s Razor (Applied UX)**

**Predicts:** Simpler explanations/interactions fail less
**Design implications:**

* One primary action per screen
* Avoid hidden modes
* Reduce conditional logic exposed to users

---

### **Error Prevention Principle**

**Predicts:** Preventing errors is cheaper than fixing them
**Design implications:**

* Disable invalid actions
* Validate early
* Use constraints, not warnings

---

### **Peak–End Rule**

**Predicts:** Users judge experiences by peak and end
**Design implications:**

* Make completion delightful
* Reduce frustration at the end
* Fix the worst moment first

---

## 7. Laws of Trust and Feedback

### **Feedback Principle**

**Predicts:** Users need confirmation of action
**Design implications:**

* Every action → immediate feedback
* Visual > textual feedback
* Progress indicators for >1s tasks

---

### **Aesthetic–Usability Effect**

**Predicts:** Attractive designs feel easier to use
**Design implications:**

* Visual polish improves tolerance
* Clean design increases perceived performance
* Do not rely on aesthetics to fix broken UX

---

## Practical Meta-Rules

* **No law acts alone**: optimize for the dominant bottleneck (decision, motion, memory, latency).
* **Perceived performance > raw performance**.
* **Constraints beat instructions**.
* **Consistency beats cleverness**.
* **Break laws intentionally, not accidentally**.

This set forms a usable mental checklist for evaluating almost any UI:
*How fast can users decide, reach, understand, trust, and recover?*
