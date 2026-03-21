# DB Schema

## Migration Files

- `V0__baseline.sql`
- `V1__core_schema.sql`
- `V2__preset_data.sql`
- `V3__indexes_and_constraints.sql`

## Domain Groups

### Identity

- `users`
- `refresh_tokens`

`users` stores auth identity, verification flags, and wallet balance. `refresh_tokens` stores hashed refresh sessions with rotation support.

### Catalog

- `companies`
- `categories`
- `products`
- `product_categories`
- `product_add_ons`
- `branches`
- `branch_operating_hours`
- `branch_products`

This split allows product definitions to stay company-level while branch availability, stock, recommendation flags, and price overrides remain branch-specific.

### Payments and Configuration

- `payment_methods`
- `company_payment_methods`
- `system_configs`

These tables drive which payment methods the frontend can show and which operational limits the backend enforces.

### Cart

- `carts`
- `cart_items`
- `cart_item_add_ons`

Each user has one cart. Each line is uniquely identified by cart, branch, product, and add-on signature.

### Transactions and Orders

- `transactions`
- `orders`
- `order_items`
- `order_item_add_ons`

Transactions represent payment state. Orders represent fulfillment state. Checkout copies cart lines into immutable order rows.

## Relationship Summary

- `users 1:n refresh_tokens`
- `companies 1:n categories`
- `companies 1:n products`
- `companies 1:n branches`
- `products n:n categories` through `product_categories`
- `products 1:n product_add_ons`
- `branches 1:n branch_operating_hours`
- `branches 1:n branch_products`
- `users 1:1 carts`
- `carts 1:n cart_items`
- `cart_items 1:n cart_item_add_ons`
- `users 1:n transactions`
- `transactions 1:1 orders`
- `orders 1:n order_items`
- `order_items 1:n order_item_add_ons`

## Constraints

Examples of enforced integrity:

- non-negative wallet balances
- unique auth identity by `(auth_provider, auth_subject)`
- unique case-insensitive emails
- unique phones
- unique cart variant lines by add-on signature
- transaction status constrained to `pending | accepted | rejected`
- order status constrained to `PENDING | PREPARE | DELIVERY | COMPLETED | REJECTED`
- non-negative stock and price values

## Preset Data

Preset migration `V2__preset_data.sql` inserts:

- system configuration limits
- wallet and QR payment methods
- one demo company
- demo categories/products/add-ons
- three demo branches with hours and inventory

## Indexes

Hot-path indexes cover:

- cart lookups
- transaction and order history
- product search with trigram search
- branch-product sorting and featured filters
- enabled company payment methods
