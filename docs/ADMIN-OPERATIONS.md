# BitSooq admin and operations guide

This guide covers the merchant console, manager permissions, admin APIs, local setup and the current production boundary. The dashboard uses the existing dark cyan storefront visual language and is available at `/admin`.

## What is implemented

- Overview with order, inventory, store and confirmed order value summaries.
- Order queue with status filters, cursor paging, customer shipping details, payment state and shipment timelines.
- Product catalog with create/edit, category assignment, optimistic stock changes, archive and category creation.
- Mini-store onboarding with seller records, owner/contact/legal details, pending review and guarded status transitions.
- Delivery zone and service-rate configuration, including address coverage, delivery estimates and COD availability.
- Super Admin analytics for the last 14 days, order status distribution, payment-method state and confirmed order value.
- Customer directory and team assignment for scoped Product, Store and Fulfillment Managers.
- Firebase email/password sign-in with ID-token refresh and sign-out.
- Read-only sample data when the UI runs with `VITE_USE_MOCK=true`; admin writes stay disabled in this mode.

## Workspaces and permission roles

`USER` is retained on every Firebase account. API gateway authorization is authoritative; hiding a navigation item in React is not a security boundary.

| Role | Workspace access |
| --- | --- |
| `USER` | Customer storefront and own account data |
| `PRODUCT_MANAGER` | Product listings, categories and stock adjustments |
| `STORE_MANAGER` | Seller/store applications and store status |
| `FULFILLMENT_MANAGER` | Admin orders, shipping details, shipment tracking, COD collection and delivery rates |
| `STAFF` | Product, store and fulfillment workspaces |
| `SUPER_ADMIN` | All workspaces, analytics and Firebase user/role administration |

A Super Admin can assign those roles in **Team & access**. A Super Admin cannot remove their own Super Admin role. Manager roles are additive; an account may have more than one. Grant `STAFF` only when broad day-to-day operational access is intended.

## Run a local preview

The low-resource demo runs only Vite and uses sample PKR data. It does not contact the backend or a payment provider.

```powershell
cd bitsooq-ui
npm ci
npm run dev:demo
```

Open the Vite URL and add `/admin` to preview the workspaces. The preview banner marks the sample data and all mutation handlers are read-only. The demo does not need Firebase credentials, MySQL, Redis, Kafka or Java services.

## Run the live local stack

1. Create the local development environment:

   ```powershell
   .\backend\scripts\new-local-env.ps1
   ```

2. Set `FIREBASE_PROJECT_ID` in `backend/.env` and `VITE_FIREBASE_PROJECT_ID` plus `VITE_FIREBASE_API_KEY` in `bitsooq-ui/.env.local`. Use the same Firebase project in both files. The Firebase Auth project must have the Email/Password provider enabled.

3. Start the single-node development stack from the repository root:

   ```powershell
   docker compose up --build --wait
   ```

   The frontend is served on `http://localhost:3000`; the API gateway is on `http://localhost:8080`. The frontend build embeds the Firebase web API key and API base URL. The Firebase web key is public client configuration; never put a Firebase service-account key in Vite variables.

4. Create or use a Firebase Authentication account. Sign in at `/login`. A customer account can browse the storefront but cannot open `/admin` until an operator assigns it a manager role.

5. Bootstrap the first Super Admin once, from a trusted machine with Google Application Default Credentials for the intended Firebase project:

   ```powershell
   mvn -f backend/services/user-service/pom.xml org.codehaus.mojo:exec-maven-plugin:3.5.0:java `
     "-Dexec.mainClass=com.acme.commerce.user.infrastructure.BootstrapSuperAdmin" `
     "-Dexec.args=YOUR_FIREBASE_PROJECT_ID YOUR_EXISTING_FIREBASE_UID"
   ```

   The bootstrap command only changes roles for an existing Firebase UID. Sign out and back in so Firebase issues a token containing the new claim. Do not create a public bootstrap endpoint or ship this operator capability in the browser.

6. To enable team listing and role writes, use the optional Firebase Admin overlay with a service-account key stored outside the repository:

   ```powershell
   $env:FIREBASE_ADMIN_CREDENTIALS_FILE = 'C:\secure\firebase-admin.json'
   docker compose -f docker-compose.yml -f docker-compose.firebase-admin.yml up --build --wait
   ```

   Restrict that identity to the minimum Firebase Auth administration permissions. The key is mounted read-only into `user-service`; it is not a browser credential. Clear the environment variable when finished.

To run only the live frontend against an already-running gateway, copy `bitsooq-ui/.env.example` to `.env.local`, set the Firebase web key, then use `npm run dev`. Vite proxies `/api` to `http://localhost:8080`.

## Admin API reference

All live calls go through the API gateway. Use a Firebase ID token in `Authorization: Bearer <token>`. Admin writes validate the signed internal identity and roles again in the owning service.

| Route | Purpose | Required role |
| --- | --- | --- |
| `GET /api/admin/orders?size=20&after=&status=` | Cursor-paged order queue; supported filters are `PENDING`, `RESERVED`, `CONFIRMED`, `CANCELLED` | Fulfillment Manager, Staff or Super Admin |
| `GET /api/admin/orders/{orderId}` | Order lines, payment state, ship-to address and current shipment timeline | Fulfillment Manager, Staff or Super Admin |
| `PATCH /api/admin/shipments/{shipmentId}` | Change shipment milestone and carrier/tracking metadata; writes a timeline event | Fulfillment Manager, Staff or Super Admin |
| `POST /api/admin/orders/{orderId}/cod-collection` | Record a COD collection with an idempotency key | Fulfillment Manager, Staff or Super Admin |
| `GET /api/admin/analytics/orders` | Aggregate order, daily trend, order status and payment status metrics | Super Admin |
| `GET /api/admin/products?size=100&after={sku}` | Product listing, including archived rows for catalog administration | Product Manager, Staff or Super Admin |
| `GET /api/admin/products/{sku}` | Read one product and its optimistic version | Product Manager, Staff or Super Admin |
| `POST /api/products` | Create a catalog product | Product Manager, Staff or Super Admin |
| `PUT /api/products/{sku}` | Update name, price and category; requires `expectedVersion` | Product Manager, Staff or Super Admin |
| `POST /api/products/{sku}/stock` | Append an idempotent inventory adjustment; requires `Idempotency-Key`, `expectedVersion` and a reason | Product Manager, Staff or Super Admin |
| `DELETE /api/products/{sku}?expectedVersion={n}` | Soft-archive a listing | Product Manager, Staff or Super Admin |
| `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/{id}` | Read/manage catalog categories | GET is public; writes require Product Manager, Staff or Super Admin |
| `GET /api/admin/sellers?size=100` | List merchant stores | Store Manager, Staff or Super Admin |
| `POST /api/admin/sellers` | Create a Pending seller application | Store Manager, Staff or Super Admin |
| `PATCH /api/admin/sellers/{sellerId}/status` | Status transition with `expectedStatus` and `expectedVersion` | Store Manager, Staff or Super Admin |
| `GET /api/admin/delivery/zones`, `GET /api/admin/delivery/rates` | Read delivery coverage and rates | Fulfillment Manager, Staff or Super Admin |
| `POST /api/admin/delivery/zones`, `POST /api/admin/delivery/zones/{zoneId}/rates` | Add a service area or shipping rate | Fulfillment Manager, Staff or Super Admin |
| `PATCH /api/admin/delivery/zones/{id}/active`, `PATCH /api/admin/delivery/rates/{id}/active` | Pause/enable coverage or a rate | Fulfillment Manager, Staff or Super Admin |
| `GET /api/admin/users?size=50&cursor=` | List Firebase accounts | Super Admin |
| `GET /api/admin/users/{uid}/roles`, `PUT /api/admin/users/{uid}/roles` | Inspect/assign Firebase roles. The PUT requires `Idempotency-Key`. | Super Admin |

Product and order amounts are integer minor units. The live catalog and delivery schemas currently constrain currency to USD; the PKR products and rates in demo mode are illustrative only. Product mutations use optimistic versions, stock updates use idempotency keys, order pages use opaque cursors, and seller status writes keep a status-history row with the acting user.

## Analytics meaning

- **Total / status counts** are orders recorded in the order service.
- **Confirmed order value** sums `total_minor` for orders whose lifecycle status is `CONFIRMED`.
- **Daily trend** covers the most recent 14 calendar days available in the database.
- **Payment mix** groups order count/value by the order's payment method and payment status.

These are order analytics, not a settlement ledger. Provider settlement, refunds, disputes, chargebacks and seller payouts are not represented as available balances. A payment method appearing in checkout code does not prove its production credentials or merchant account have been configured.

## Production deployment boundary

The dashboard routes and scoped admin APIs are implemented, but the whole commerce platform is not a turn-key production deployment. Before serving customers, follow [`../backend/docs/operations.md`](../backend/docs/operations.md). In particular, choose and test HA MySQL/Kafka/Redis, secure secrets and TLS, use a trusted Firebase Admin identity, configure real Moyasar credentials/webhooks, connect a courier account, validate recovery and load, and deploy monitoring/backup/restore procedures. The repository does not currently provide automatic carrier label purchase, Pakistan tax filing, refunds/payout reconciliation or JazzCash/Easypaisa integrations.

The browser stores the Firebase ID and refresh tokens in tab-scoped `sessionStorage`. Production must use HTTPS, a strict Content Security Policy, dependency scanning, and tested XSS controls. For applications with stricter token-isolation requirements, move browser sessions behind a backend-for-frontend using Secure, HttpOnly, SameSite cookies before launch.
