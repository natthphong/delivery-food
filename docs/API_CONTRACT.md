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

Error responses keep the same envelope with `body: null`.

## Auth

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

Response body:

- `accessToken`
- `refreshToken`
- `user`

### `GET /v1/auth/me`

Bearer auth required. Returns the current user.

## App Bootstrap and Account

### `GET /v1/bootstrap`

Bearer auth required.

Response body:

- `user`
- `config`
- `cart`

### `PATCH /v1/account/profile`

Bearer auth required.

Patch fields:

- `displayName`
- `email`
- `phone`
- `isEmailVerified`
- `isPhoneVerified`

### `GET /v1/account/transactions`

Bearer auth required. Returns recent transactions.

### `GET /v1/account/orders`

Bearer auth required. Returns recent orders.

## Catalog

### `GET /v1/catalog/search`

Query params:

- `q`
- `categoryId`
- `lat`
- `lng`

Response body:

- `branches`
- `categories`

### `GET /v1/catalog/branches/{id}/menu`

Query params:

- `q`
- `page`
- `size`

Response body:

- `branch`
- `menu`
- `page`
- `size`
- `total`

### `GET /v1/catalog/branches/{id}/featured`

Returns recommended items for a branch.

### `GET /v1/payment-methods?companyId={id}`

Returns enabled payment methods for the company.

## Cart

### `GET /v1/cart`

Bearer auth required. Returns grouped cart state.

### `POST /v1/cart/items`

```json
{
  "branchId": 1,
  "productId": 7,
  "quantity": 2,
  "addOnIds": [6]
}
```

Returns the full updated cart.

### `PATCH /v1/cart/items/{id}`

```json
{ "quantity": 3 }
```

Returns the full updated cart. Quantity `<= 0` removes the item.

### `DELETE /v1/cart/items/{id}`

Returns the full updated cart.

### `DELETE /v1/cart/branches/{branchId}`

Clears all cart items for one branch and returns the full updated cart.

## Checkout and Payments

### `POST /v1/checkout`

```json
{
  "branchId": 1,
  "paymentMethodId": 2,
  "selectedItemIds": [10, 11],
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
- `user` when wallet balance changes

### `POST /v1/deposits`

```json
{
  "companyId": 1,
  "paymentMethodId": 1,
  "amount": 300
}
```

Returns the created pending deposit transaction.

### `GET /v1/transactions/{id}`

Returns:

- `transaction`
- `order`
- optional `user`

### `POST /v1/transactions/{id}/slip`

Multipart upload with `file`.

Used to verify a payment or deposit slip and update the transaction.

## Health

### `GET /healthz`

Returns `{ "status": "ok" }`.
