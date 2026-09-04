# Contributing to Scriptura

Thank you for your interest in contributing! This guide covers how to add translations, improve packages, and submit changes.

## Adding a new translation

This is the most impactful way to contribute. Every translation must meet these requirements:

1. **Verified license** — The translation must be public domain, CC BY-SA 4.0, CC0, or another explicitly open license. No exceptions.
2. **Primary source link** — Your PR must include a link to the authoritative source confirming the license status.
3. **Canonical format** — Data must follow the schema in `data/schemas/` (see below).
4. **Validation passes** — Run `python scripts/validate.py` and ensure zero errors before submitting.

### Translation data format

```
data/{translation-id}/
├── metadata.json       # See data/schemas/metadata.schema.json
└── books/
    ├── 01-genesis.json # See data/schemas/book.schema.json
    ├── 02-exodus.json
    └── ...             # All 66 books, zero-padded
```

### Forbidden translations

These will **never** be accepted, regardless of how they are packaged:

- **Reina Valera 1960 (RV1960)** — Copyrighted by Sociedades Bíblicas Unidas, renewed 1988
- **口語訳聖書 (1954/55)** — US copyright until 2049–2050 (URAA restoration)

## Improving TypeScript packages

- All code under `packages/` must maintain strict TypeScript (no implicit `any`)
- Run `tsc --noEmit` to type-check before submitting
- Add tests in `tests/unit/` or `tests/integration/` as appropriate
- Run `npm test` to confirm all tests pass

## Submitting a PR

1. Fork the repo and create a feature branch
2. Make your changes
3. Run `npm test` and `npm run validate`
4. Open a PR with a clear description of what you changed and why
