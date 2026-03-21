# Preset Data

## Purpose

Local and demo environments use deterministic preset catalog data so the customer and admin surfaces are usable immediately after migrations.

## Current Source

`sql/V7__admin_workflows_and_baan_seed.sql` refreshes the demo catalog with a BAAN-menu-inspired set based on:

- [Baan Food menu](https://baan-food.com/menu/)

The migration stores a curated, deterministic snapshot for development. The app does not scrape the live site at runtime.

## What V7 Seeds

- refreshed food categories
- richer product coverage
- representative product images
- add-on presets
- per-branch `branch_products` availability, stock, reorder levels, and recommendations
- `READY` support in the order status constraint

## Update Workflow

When preset catalog data needs to change:

1. review the current source menu and decide the curated product/category set for local development
2. add a new versioned SQL migration under `sql/`
3. update `categories`, `products`, `product_categories`, `product_add_ons`, and `branch_products` deterministically
4. keep image URLs and seed IDs intentional and reproducible
5. update `AGENTS.md`, `README.md`, and the schema/feature docs
6. rerun `npm run backend:migrate`

## Rules

- do not hand-edit local databases as the source of truth
- do not replace deterministic seed flow with one-off scripts unless the script itself becomes part of the documented seed pipeline
- if the preset catalog shape changes, also review admin branch-copy and stock-management flows against the new data
