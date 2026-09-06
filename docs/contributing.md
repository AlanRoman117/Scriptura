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
- **口語訳聖書 / Kougo (1954/55)** — US copyright until 2049–2050 (URAA restoration). Japan Bible Society now calls its copyright expired, which is true in Japan and irrelevant in the US — see [`translations-status.md`](translations-status.md#the-kougo-trap) before arguing otherwise. Scanned collections often bundle Kougo with the permissible 文語訳; that does not make the bundle usable.

## Improving TypeScript packages

- All code under `packages/` must maintain strict TypeScript (no implicit `any`)
- Run `npm run lint` to type-check before submitting (that is `tsc --build`; plain `tsc --noEmit` fails with TS6310 because the packages are composite project references)
- Add tests in `tests/unit/` or `tests/integration/` as appropriate
- Run `npm test` to confirm all tests pass

## Submitting a PR

1. Fork the repo and create a feature branch
2. Make your changes (Node 24 — see `.nvmrc`)
3. Run `npm run lint`, `npm test`, and `python scripts/validate.py --strict`
4. Open a PR with a clear description of what you changed and why

> CI runs all three on every PR. `validate.py --strict` is stricter than CI
> (which tolerates warnings) — the data currently passes it with zero errors and
> zero warnings, so keep it that way.
