# Preset Data

## Purpose

Local and demo environments use deterministic preset catalog data so the customer and admin surfaces are usable immediately after migrations.

## Current Source

`sql/V9__baan_json_preset_seed.sql` refreshes the demo catalog from the committed BAAN source inputs:

- `tmp/baan-branch.json`
- `tmp/baan-menu.json`

The app does not scrape the live site at runtime.
Instead, `scripts/generate-baan-seed.js` reads the two JSON inputs, infers practical categories/add-ons, and writes the deterministic SQL snapshot committed under `sql/`.

## What V9 Seeds

- BAAN Phuket branch presets from `tmp/baan-branch.json`
- full BAAN menu coverage from `tmp/baan-menu.json`
- inferred product categories and practical optional add-ons
- representative product images
- per-branch `branch_products` availability, stock, reorder levels, and recommendations
- sample `branch_product_add_ons` overrides for branch-level add-on pricing and sellability
- `V8__branch_add_on_controls.sql` support for branch add-on operations

## Update Workflow

When preset catalog data needs to change:

1. update `tmp/baan-branch.json` and/or `tmp/baan-menu.json`
2. regenerate the committed seed SQL:

```bash
node scripts/generate-baan-seed.js --write sql/V9__baan_json_preset_seed.sql
```

3. if the schema changed, add a new versioned migration under `sql/`
4. keep image URLs, heuristics, and seed IDs intentional and reproducible
5. update `AGENTS.md`, `README.md`, and the schema/feature docs
6. rerun `npm run backend:migrate`

## Rules

- do not hand-edit local databases as the source of truth
- do not replace deterministic seed flow with one-off scripts unless the script itself becomes part of the documented seed pipeline
- if the preset catalog shape changes, also review admin branch-copy and stock-management flows against the new data
