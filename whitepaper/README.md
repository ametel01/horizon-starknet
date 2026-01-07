# Horizon Protocol Whitepaper

This directory contains the complete Horizon Protocol whitepaper in LaTeX format.

## Structure

```
whitepaper/
├── main.tex                    # LaTeX entry point
├── main.pdf                    # Compiled PDF (46 pages)
├── sections/                   # All section files
│   ├── 01_motivation.tex              # 1. Motivation & Problem Statement
│   ├── 02_system_overview.tex         # 2. System Overview
│   ├── 03_formal_model.tex            # 3. Formal Model & Notation
│   ├── 04_mechanism_design.tex        # 4. Core Mechanism Design
│   ├── 05_economic_analysis.tex       # 5. Economic Analysis & Incentives
│   ├── 06_risk_analysis.tex           # 6. Risk Analysis & Threat Model
│   ├── 07_governance.tex              # 7. Governance & Upgrade Model
│   ├── 08_related_work.tex            # 8. Related Work
│   ├── 09_conclusion.tex              # 9. Conclusion
│   ├── A_proofs.tex                   # Appendix A: Mathematical Proofs
│   ├── B_examples.tex                 # Appendix B: Numerical Examples
│   ├── C_interfaces.tex               # Appendix C: Contract Interfaces
│   └── D_glossary.tex                 # Appendix D: Glossary
└── README.md                   # This file
```

## Building the PDF

### Requirements
- XeLaTeX (TeX Live 2025 or newer)
- LaTeX packages: booktabs, newunicodechar, hyperref, amsmath, amssymb, setspace

### Quick Build

```bash
cd whitepaper
export PATH="/usr/local/texlive/2025basic/bin/universal-darwin:$PATH"
xelatex -interaction=nonstopmode main.tex
```

### Output
- **main.pdf** - Final compiled whitepaper (46 pages, ~157 KB)
- **main.aux, main.log, main.toc** - Build artifacts (can be deleted)

## Content Summary

### Main Sections (1-9)
1. **Motivation & Problem Statement** - Why yield tokenization matters
2. **System Overview** - Protocol architecture and token flows
3. **Formal Model & Notation** - Mathematical definitions and equations
4. **Core Mechanism Design** - Token operations and AMM details
5. **Economic Analysis & Incentives** - Game theory and actor incentives
6. **Risk Analysis & Threat Model** - Security considerations
7. **Governance & Upgrade Model** - Admin powers and upgrade procedures
8. **Related Work** - Comparison with Pendle, Element, and others
9. **Conclusion** - Summary and future considerations

### Appendices
- **A: Mathematical Proofs** - PT price convergence, conservation invariant, arbitrage-free pricing
- **B: Numerical Examples** - PT purchase flow, LP operations, YT interest claiming
- **C: Contract Interfaces** - Solidity interface specifications for SY, PT, YT, Market
- **D: Glossary** - Definition of key terms and abbreviations

## Key Features

- **High Precision Mathematics**: WAD (10^18) fixed-point + cubit 64.64 binary fixed-point
- **Logit-Based AMM**: Same curve as Pendle for proven efficiency
- **Starknet Native**: Cairo language with optimized math library
- **Complete Specification**: Formal model with invariants and proofs
- **Professional Formatting**: XeLaTeX with proper typography (1.15x line spacing, booktabs styling)

## Source Markdown

The original Markdown source is maintained in:
```
../WHITEPAPER.md
```

This LaTeX version is the canonical formatted PDF document intended for:
- Auditors and security reviewers
- Academic researchers
- Investors and stakeholders
- Protocol documentation

## License

BUSL-1.1 (converts to GPL-3.0 on 2028-12-19)
