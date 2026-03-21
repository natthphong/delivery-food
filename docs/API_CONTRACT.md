# API Contract

## Envelope

Every response uses:

```json
{
  "code": "OK",
  "message": "success",
  "body": {}
}
```

Errors keep the same envelope shape with an error `code` and `message`.
Frontend maps stable `code` values first, then known `message` strings, into shared localized UI copy.
Raw backend messages should not be shown directly in normal user flows.

Validation failures may return structured `body.fieldErrors` data:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "validation failed",
  "body": {
    "fieldErrors": {
      "name": "Branch name is required",
      "copyFromBranchId": "Select a source branch before copying menu items"
    }
  }
}
```

## Customer Auth

### `POST /v1/auth/login`

Request:

- Firebase: `{ "idToken": "..." }`
- LINE: `{ "lineProfile": { "userId": "...", "displayName": "...", "email": "..." } }`

Response body:

- `accessToken`
- `refreshToken`
- `user`

### `POST /v1/auth/refresh`

Request:

```json
{ "refreshToken": "..." }
```

### `GET /v1/auth/me`

Bearer auth required.

## Customer App

### `GET /v1/bootstrap`

Returns:

- `user`
- `config`
- `cart`

### `PATCH /v1/account/profile`

Patchable fields:

- `displayName`
- `email`
- `phone`
- `isEmailVerified`
- `isPhoneVerified`

### `POST /v1/account/email/verification`

Bearer auth required.

Request:

```json
{ "locale": "th" }
```

Response body:

- `sent`

### `POST /v1/account/email/verify`

Public endpoint used by the verification-link landing page.

Request:

```json
{ "token": "..." }
```

Response body:

- `verified`
- `user`

### `GET /v1/account/transactions`

### `GET /v1/account/orders`

## Catalog

### `GET /v1/catalog/search`

Query params:

- `q`
- `categoryId`
- `lat`
- `lng`

Returns:

- `branches`
- `categories`

### `GET /v1/catalog/branches/{id}/menu`

Query params:

- `q`
- `page`
- `size`

Returns:

- `branch`
- `menu`
- `page`
- `size`
- `total`

### `GET /v1/catalog/branches/{id}/featured`

### `GET /v1/payment-methods?companyId={id}&scope={checkout|deposit}`

Returns normalized payment methods including:

- `methodType`
- `providerCode`
- `providerMethodCode`
- `checkoutFlow`
- `metadata`

Behavior notes:

- `scope=checkout` hides legacy manual-slip methods from the active customer checkout flow
- `scope=deposit` keeps deposit-specific methods available

## Cart

### `GET /v1/cart`

Contract notes:

- cart `groups` is always an array
- cart item `addOns` is always an array, never `null`

### `POST /v1/cart/items`

```json
{
  "branchId": 1,
  "productId": 7,
  "quantity": 2,
  "addOnIds": [6]
}
```

### `PATCH /v1/cart/items/{id}`

```json
{ "quantity": 3 }
```

### `DELETE /v1/cart/items/{id}`

### `DELETE /v1/cart/branches/{branchId}`

## Checkout and Payments

### `POST /v1/checkout`

```json
{
  "branchId": 1,
  "paymentMethodId": 3,
  "selectedItemIds": [10, 11],
  "fulfillmentMode": "rider_delivery",
  "customerNote": "Call on arrival",
  "deliveryLat": 13.7464,
  "deliveryLng": 100.5349,
  "deliveryDistanceKm": 2.4
}
```

Response body:

- `method`
- `transaction`
- `order`
- `cart`
- `user` when balance changed

Contract notes:

- checkout returns normalized `cart`
- when `order` is present, `order.items` and each item `addOns` are always arrays

### `POST /v1/deposits`

```json
{
  "companyId": 1,
  "paymentMethodId": 1,
  "amount": 300
}
```

### `GET /v1/transactions/{id}`

Returns:

- `transaction`
- `order`
- optional `user`

`transaction.status` is normalized for the frontend and may be:

- `pending`
- `accepted`
- `rejected`
- `expired`

Important transaction fields:

- `expiresAt`
- `providerStatus`
- `paidAt`
- `failedReason`
- `paymentAction.qrImageUrl`
- `paymentAction.authorizeUri`
- `paymentAction.sourceId`
- `paymentAction.chargeId`
- `paymentAction.failureCode`
- `paymentAction.failureMessage`

### `POST /v1/transactions/{id}/slip`

Legacy/manual QR endpoint. Backend still supports it, but the active customer checkout flow no longer exposes it.

### `POST /v1/transactions/{id}/retry`

Bearer auth required.

Creates a new payment attempt for an expired or rejected order-linked payment transaction.

Request:

```json
{ "paymentMethodId": 9 }
```

Response body:

- `transaction`
- `order`
- optional `user`

### `POST /v1/payments/webhooks/omise`

Webhook endpoint for Omise events.

## Admin Auth

### `POST /v1/admin/auth/login`

```json
{
  "username": "owner",
  "password": "secret"
}
```

Response:

- `accessToken`
- `refreshToken`
- `session`

### `POST /v1/admin/auth/refresh`

### `GET /v1/admin/auth/session`

Returns normalized admin session:

- `sessionType`
- `actorType`
- `actorLabel`
- `roles`
- `permissions`
- `branchIds`

## Admin Operations

### Dashboard

- `GET /v1/admin/dashboard`

### Employees

- `GET /v1/admin/employees`
- `POST /v1/admin/employees`
- `PATCH /v1/admin/employees/{id}`

### Attendance

- `GET /v1/admin/attendance`
- `POST /v1/admin/attendance/clock-in`
- `POST /v1/admin/attendance/clock-out`
- `PATCH /v1/admin/attendance/{id}`

### OT / Payroll

- `GET /v1/admin/ot-requests`
- `POST /v1/admin/ot-requests`
- `PATCH /v1/admin/ot-requests/{id}`
- `GET /v1/admin/payroll/settings`
- `PATCH /v1/admin/payroll/settings`
- `GET /v1/admin/payroll/periods`
- `POST /v1/admin/payroll/periods`
- `GET /v1/admin/payroll/periods/{id}`
- `POST /v1/admin/payroll/periods/{id}/generate`

### Branches / Stock

- `GET /v1/admin/branches`
- `POST /v1/admin/branches`
- `PATCH /v1/admin/branches/{id}`
- `GET /v1/admin/branches/{id}/products`
- `PATCH /v1/admin/branches/{id}/products/{productId}`
- `POST /v1/admin/branches/{id}/stock`

`POST /v1/admin/branches` supports:

- base branch fields: `name`, `slug`, `description`, `imageUrl`, `addressLine`, `lat`, `lng`
- operational fields: `acceptingOrders`, `isForceClosed`, `supportsPickup`, `supportsRiderDelivery`, `riderDeliveryFee`, `operationalNote`
- optional menu copy workflow:
  - `copyMode: "none" | "all" | "selected"`
  - `copyFromBranchId`
  - `categoryIds`
  - `productIds`

`PATCH /v1/admin/branches/{id}/products/{productId}` supports:

- `isEnabled`
- `isTemporarilyClosed`
- `stockQty`
- `reorderLevel`
- `availabilityNote`

`POST /v1/admin/branches/{id}/stock` request:

```json
{
  "productId": 7,
  "deltaQty": 10,
  "reason": "restock",
  "note": "morning refill"
}
```

### Orders / Riders / Payments

- `GET /v1/admin/orders`
- `GET /v1/admin/orders/{id}`
- `PATCH /v1/admin/orders/{id}/status`
- `GET /v1/admin/rider/jobs`
- `POST /v1/admin/rider/jobs/{id}/claim`
- `PATCH /v1/admin/rider/jobs/{id}/status`
- `GET /v1/admin/payments`
- `GET /v1/admin/payments/providers`
- `GET /v1/admin/payments/webhooks`

Admin order responses are normalized for safe rendering:

- `items` is always an array
- each order item `addOns` collection is always an array
- `allowedStatuses` lists valid next actions for the current actor and order state

Current operational order states:

- `PENDING`
- `PREPARE`
- `READY`
- `DELIVERY`
- `COMPLETED`
- `REJECTED`

## Health

### `GET /healthz`

Returns:

```json
{ "status": "ok" }
```
