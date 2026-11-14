# BitSooq (بيت سوق) — Project Master Documentation

> **Commerce platform architecture and implementation notes**
> This document began as a platform proposal. Some provider and scaling sections describe intended architecture, not completed production capabilities. For the current lightweight run mode and verified implementation boundaries, see [`README.md`](README.md), [`docs/ecommerce-domain.md`](docs/ecommerce-domain.md), and [`backend/docs/operations.md`](backend/docs/operations.md).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Request Flow](#3-request-flow)
4. [Frontend Architecture — `bitsooq-ui`](#4-frontend-architecture--bitsooq-ui)
5. [Backend Microservices Deep-Dive](#5-backend-microservices-deep-dive)
6. [Database Schema (MySQL & Redis)](#6-database-schema-mysql--redis)
7. [Messaging: Kafka Saga Choreography](#7-messaging-kafka-saga-choreography)
8. [Security Model](#8-security-model)
9. [DevOps: Docker Compose Run Guide](#9-devops-docker-compose-run-guide)
10. [Environment Variables](#10-environment-variables-envexample)
11. [API & Swagger Reference](#11-api--swagger-reference)
12. [Kubernetes Deployment Strategy (Ubuntu VPS)](#12-kubernetes-deployment-strategy-ubuntu-vps)
13. [Repository Layout](#13-repository-layout)

---

## 1. Executive Summary

**BitSooq** is an evolving commerce foundation: a React storefront, Spring Boot services, and MySQL migrations for common marketplace workflows. It is not production-ready as deployed. The low-resource storefront remains usable with demo data, while the live backend has a growing checkout and fulfillment path. Current capabilities and boundaries:

| Capability | Implementation |
|---|---|
| Storefront | Marketplace-style browsing with search, categories, sort, cart, bilingual EN/AR interface, customer address checkout, coverage quotes, COD/card/crypto choices, and order tracking. Demo checkout uses sample PKR rates for five Pakistani cities and stores simulated orders in the browser only. |
| Catalog data | Existing SKU/stock API plus new schema for variants, attributes, sellers, brands, images, pricing, reviews, and tax classes. The expanded schema is not yet exposed by the API. |
| Orders and operations | Order snapshots, saved customer addresses, staff delivery-zone/rate management, shipping fee/ETA, shipment lifecycle/events, carrier tracking details, COD due/collection, and owned-order tracking are implemented. Carrier booking, label purchase, automatic carrier updates, tax calculation, and customer return/refund flows are not configured. |
| Payments | Moyasar hosted intent flow requires credentials and callback setup; crypto verification is disabled by default. Generic payment-attempt/refund tables are not fully wired. No Pakistan-specific gateway or tax-filing adapter is configured. |
| Local development | Run the storefront alone with sample data; optionally use one MySQL server with separate logical service databases. The full microservice stack remains optional. |

**Ports map:**

| Service | Port |
|---|---|
| bitsooq-ui (nginx) | 3000 → container 8080 |
| api-gateway | 8080 |
| user-service | 8081 |
| product-service | 8082 |
| order-service | 8083 |
| moyasar-payment-service | 8084 |
| payment-service (legacy sandbox) | 8084 |
| notification-service | 8085 |
| crypto-gateway-service | 8087 |
| config-server | 8888 |
| discovery-server (Eureka) | 8761 |

---

## 2. System Architecture

```
                              ┌──────────────────────────────┐
                              │        bitsooq-ui (SPA)      │
                              │  React + Vite + TS + Tailwind│
                              │  i18next EN/AR · dir switch  │
                              │  MetaMask / WalletConnect    │
                              └──────────────┬───────────────┘
                                             │ /api/** (nginx reverse-proxies → :8080)
                              ┌──────────────▼───────────────┐
                              │         api-gateway          │
                              │  Spring Cloud Gateway        │
                              │  · Firebase JWT (RS256)      │
                              │  · RBAC route guards         │
                              │  · Redis rate limiter        │
                              │  · Circuit breakers + retry  │
                              │  · /docs/{svc}/swagger-ui    │
                              └──┬────┬────┬────┬────┬────┬──┘
        ┌────────────┬───────────┘    │    │    │    └──────────┐
        ▼            ▼                ▼    │    ▼    ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────────────────┐
│ user-service │ │   product-   │ │ order-service │ │ moyasar-payment-service  │
│ :8081        │ │ service :8082│ │ :8083         │ │ :8084 (fiat)             │
│ profiles+RBAC│ │ bilingual    │ │ lifecycle     │ │ Mada·Visa·MC·ApplePay    │
│ Firebase dir │ │ catalog      │ │ MOYASAR/CRYPTO│ │ webhook → verify → PAID  │
└──────┬───────┘ └──────┬───────┘ └──────┬────────┘ └─────────┬────────────────┘
   user-db          product-db       order-db             moyasar-db
                                                            (Basic Auth over HTTPS)
                                        ▲                   │ PaymentAuthorized
                                        │   Kafka saga      │
                              ┌─────────┴───────────────────▼──────────┐
                              │  crypto-gateway-service :8087          │
                              │  eth_getTransactionReceipt via public  │
                              │  RPC (Alchemy/Infura) — NO contracts   │
                              │  status==1 · to=merchant · value match │
                              └──────────────┬─────────────────────────┘
                                          crypto-db

 Cross-cutting: config-server :8888 · discovery-server :8761 (Eureka)
                edge-redis + product-redis (rate limiting & catalog cache)
                Kafka (KRaft, 12-partition `commerce.saga.v1` + DLTs)
```

### Saga choreography (order placement)

```
order-service ──OrderPlaced──▶ product-service (reserve stock, row-locked)
        ▲                              │
        └───── InventoryRejected ──────┘
                 InventoryReserved
                                │
                                ▼
        ┌──── MOYASAR path ─────┴──── CRYPTO path ────────┐
        │ initiate → webhook(paid)        verify(txHash)  │
        │            PaymentAuthorized                    │
        └──────────────────┬──────────────────────────────┘
                           ▼
              order-service CONFIRMED → notification-service (in-app)
```

All cross-service events go through the transactional **outbox → Kafka → inbox** pattern: a service writes its domain change and the event in one local transaction; a relay publishes pending outbox rows; consumers deduplicate via the `inbox` table. Failures land in per-consumer DLTs (`commerce.saga.v1.<service>.DLT`).

---

## 3. Request Flow

1. Browser loads SPA from `bitsooq-ui` nginx (`:3000`).
2. SPA calls same-origin `/api/**`; nginx proxies to `api-gateway:8080`.
3. Gateway validates the Firebase ID token (RS256 against Google's public JWK set), maps `admin`/`roles` claims to `ROLE_USER/ROLE_STAFF/ROLE_SUPER_ADMIN`, applies per-user Redis rate limiting, and load-balances via Eureka (`lb://service-name`).
4. The service performs domain work; events are emitted through the outbox.
5. Payment confirmation (either provider) eventually emits `PaymentAuthorized` → order-service transitions the order to `CONFIRMED`/`PAID`, stores `paymentReferenceId` (Moyasar id) or `txHash` (crypto), and notification-service records an in-app notification.

Unauthenticated callers only see: `GET /api/products*`, `GET /api/categories*`, `POST /api/payments/moyasar/webhook` (verified downstream by authoritative re-fetch), and `/docs/**` Swagger metadata.

---

## 4. Frontend Architecture — `bitsooq-ui`

### Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 6 (`@vitejs/plugin-react`) |
| Styling | Tailwind CSS 3.4 with a custom design-token theme |
| Routing | react-router-dom v6 (`/`, `/cart`, `/checkout`, `/dashboard`) |
| State | React Context (`CartProvider`) + `localStorage` persistence |
| Icons | lucide-react |
| i18n | i18next + react-i18next, in-file EN/AR resource bundles |
| Web3 | Browser EIP-1193 provider (`window.ethereum`) for MetaMask/WalletConnect |

### Design system

- Current storefront: warm white and cream surfaces, marketplace orange accents, clear category navigation, responsive product cards, and accessible focus/keyboard states.
- Fonts: **Plus Jakarta Sans / Inter** (LTR) and **Cairo / Tajawal** (RTL) via Google Fonts.
- Reusable classes in `src/styles.css`: `.glass-card`, `.neon-button`, `.ghost-button`, `.field`, `.pill`, `.beta-badge`, status badges (`.status-PAID`, `.status-PENDING`, …), and the slide-over `.cart-drawer`.

### Key modules & routes

| Route | File | Responsibility |
|---|---|---|
| `/` | `pages/Storefront.tsx` + `components/Hero.tsx`, `components/ProductGrid.tsx` | Marketplace landing, category navigation, product search/sort, optional ratings/deal prices, stock availability, quick-add to cart |
| (slide-over) | `components/CartDrawer.tsx` | Real-time qty ±, per-line totals, subtotal, clear/checkout; slides from the **inline-end** side so it mirrors automatically in RTL |
| `/checkout` | `pages/Checkout.tsx` | Order creation, then dual-tab payment: **Tab 1 Moyasar** (initiates payment → redirects to Moyasar hosted form) / **Tab 2 Crypto** (merchant address + copy button, network selector, txHash input, wallet connect, verify) |
| `/admin/*` | `components/AdminGate.tsx` + `pages/Dashboard.tsx` | Staff catalog/order dashboard behind Firebase role checks; `/dashboard` currently redirects to storefront. |

### The RTL/LTR engine (`src/i18n/index.ts`)

```ts
export function applyDirection(lang: Language) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;   // flips the entire layout
  document.documentElement.lang = lang;
  document.documentElement.classList.toggle('font-arabic', lang === 'ar');
  document.documentElement.classList.toggle('font-sans', lang === 'en');
}
```

- One top-bar button calls `toggleLanguage()` → `i18n.changeLanguage`, persists to `localStorage['bitsooq.lang']`, and applies direction.
- All layouts are built with logical CSS properties (`ms-auto`, `me-2`, `text-end`, `border-inline-start`, `inset-inline-end`), so **no component needs a separate Arabic variant** — the browser mirrors everything once `<html dir>` flips.
- The cart drawer animation direction is driven by a `[dir='rtl'] { --slide-from: -100% }` CSS variable.
- Language detection order: saved preference → `navigator.language` → `en` fallback.

### API client (`src/lib/api.ts`)

Central `request<T>()` wrapper that:
- prefixes `VITE_API_BASE_URL` (empty in production — same-origin through nginx/gateway),
- attaches `Authorization: Bearer <firebase-id-token>` from `sessionStorage['bitsooq.token']` when present,
- raises typed `ApiError(status, message)` for non-2xx.

Exposed calls: `getProducts`, `getCategories`, `getOrders`, `getOrder`, `createOrder`, `adminCreateProduct`, `adminUpdateProduct`, `initiateMoyasarPayment`, `verifyCryptoPayment`.

---

## 5. Backend Microservices Deep-Dive

All services: Java 25, Spring Boot 4.1.2, Spring Cloud 2025.1.2, Flyway migrations, Micrometer/Prometheus, Eureka registration, Config-Server bootstrap, structured logstash JSON logs, health-only actuator exposure, virtual threads where applicable.

### 5.1 `api-gateway` (:8080)

**Responsibility:** the only ingress. Route table (from `RoutingConfiguration`):

| Route id | Paths | Target |
|---|---|---|
| admin-users | `/api/admin/users/**` | `lb://user-service` |
| users | `/api/users/**` | `lb://user-service` |
| products | `/api/products/**`, `/api/cart/**`, `/api/categories/**`, `/api/admin/products/**`, `/api/admin/categories/**` | `lb://product-service` |
| orders | `/api/orders/**`, `/api/admin/orders/**`, `/api/admin/analytics/orders` | `lb://order-service` |
| notifications | `/api/notifications/**` | `lb://notification-service` |
| payments | `/api/payments/orders/**` | `lb://payment-service` |
| moyasar-payments | `/api/payments/moyasar/**` | `lb://moyasar-payment-service` |
| crypto-payments | `/api/payments/crypto/**` | `lb://crypto-gateway-service` |
| docs-product … docs-notification | `/docs/{svc}/**` → rewritten to `/${seg}` | respective services |

Every route gets: Redis rate limiter (fail-closed `FailClosedRedisRateLimiter`, 20 req/s burst 40), Resilience4j circuit breaker + 1-retry GET backoff, keyed by `user:<uid>` (authenticated) or `anonymous:<socket-ip>` — **never** client-supplied `X-Forwarded-For`.

**Security (`SecurityConfiguration`):** Nimbus JWT decoder against `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`, custom `FirebaseTokenValidator` (issuer + audience + expiry). Claim mapping: `admin:true → ROLE_STAFF`; `roles` claim filtered to `SUPER_ADMIN|STAFF|USER`. CORS allow-list via `security.cors.allowed-origins`. `POST /api/payments/moyasar/webhook` and `/docs/**` are the only non-JWT API paths.

### 5.2 `user-service` (:8081) — identity, profiles, RBAC

- **`Profile` / `ProfileService` / `ProfileController`**: profile rows keyed by Firebase UID (`user_id` PK), optimistic-locking via `version` column.
- **`FirebaseUserDirectory`**: optional Firebase Admin SDK integration (`FIREBASE_ADMIN_ENABLED=true`, service-account mounted as a read-only secret — never baked into images) to set custom `admin`/`roles` claims.
- **`AdminUserController` + `AdminRoleService` + `RolePolicy`**: SUPER_ADMIN-only endpoints to grant/revoke STAFF roles. Role policy: `ADMIN` legacy claim maps to `STAFF`; only explicit `SUPER_ADMIN` grants super powers.
- **`BootstrapSuperAdmin`**: bootstraps the first SUPER_ADMIN from env config on startup.
- **`InternalContextFilter`**: verifies the gateway's HMAC-signed internal headers (`X-User-Id`, `X-User-Roles`, HMAC via `INTERNAL_HMAC_SECRET`) so services trust only gateway-signed identity — not raw JWTs.

**Tables:** `profiles` (V1), role administration (V2).

### 5.3 `product-service` (:8082) — bilingual catalog + inventory

- **Domain `Product`** (record): `sku, name, nameAr, descriptionEn, descriptionAr, priceMinor, currency, availableStock, categoryId, version, active`.
- **Schema**: `product` + `category` + bilingual columns (`name_ar`, `description_en`, `description_ar` from V3) + `inventory_reservation`/`reservation_item` + demo seed (V4) with 12 bilingual products across 4 categories (`home`, `tech`, `fashion`, `grocery`).
- **`CatalogService`**: Redis cache (`catalog:v2:<sku>`, 30 s TTL, best-effort), cursor pagination (`after` + `size`), category FK validation.
- **`CatalogAdminController` / `CatalogAdministration`**: STAFF+ endpoints for create/update, `stock_adjustment` audit table with idempotency keys.
- **`InventorySaga`**: consumes `OrderPlaced`, row-locks products, inserts reservations, emits `InventoryReserved`/`InventoryRejected` through the outbox.
- **`CartController`**: server-side cart for signed-in users (guest carts live in browser localStorage).

### 5.4 `order-service` (:8083) — order lifecycle

- **States:** `PENDING → PROCESSING → PAID/FAILED → CONFIRMED | CANCELLED`.
- **Tables:** `orders` (idempotency key per user, request hash, status, totals, expiry), `order_items`, plus V2 columns `payment_method` (`MOYASAR|CRYPTO_USDT_ETH`), `payment_reference_id`, `tx_hash` and payment index.
- **`OrderService` / `OrderController`**: create order (idempotent by `user_id+idempotency_key`), poll status, list own orders. Emits `OrderPlaced` on outbox commit.
- **`OrderQueries` / `AdminOrderController`**: STAFF+ admin listing and analytics.
- **Saga consumption:** `InventoryReserved` → `PROCESSING`; `InventoryRejected` → `CANCELLED`; `PaymentAuthorized` → `PAID/CONFIRMED` with payment reference recorded.

### 5.5 `moyasar-payment-service` (:8084) — fiat rails

- **`POST /api/payments/moyasar/initiate`** — body: `{orderId, amount (halalas), currency (SAR|USD), callbackUrl, source?}`. Creates/returns idempotently a `moyasar_payment` row, then calls Moyasar `POST /v1/payments` with **Basic Auth (`secretKey:`)**. Response includes the hosted-payment `source.url` the SPA redirects to.
- **`POST /api/payments/moyasar/webhook`** — unauthenticated at the gateway by design. The controller extracts `data.id`/`data.status`, **ignores any non-`paid` state**, and then **re-fetches the payment from Moyasar's API** (`MoyasarClient.fetchPayment`) — the webhook is treated as a hint, never as proof. Only an authoritative `paid` response emits `PaymentAuthorized` (outbox → Kafka).
- **`PaymentIntents`**: idempotent intent lifecycle (`user_id, idempotency_key` unique), `confirmPaid` transitions and publishes the saga event.
- **`TrustedContext`**: requires the gateway-signed user id on `initiate` (webhook path bypasses it).

**Tables:** `moyasar_payment` (unique `(user_id, idempotency_key)`, index on `order_id`, `CHECK amount>0`), `outbox`, `inbox`.

### 5.6 `crypto-gateway-service` (:8087) — zero-contract Web3 verification

**Design goal:** accept crypto **without writing, deploying, or auditing any Solidity**.

1. Frontend connects MetaMask/WalletConnect and sends a plain transfer (native ETH or standard ERC-20 `transfer(address,uint256)`) to `CRYPTO_MERCHANT_WALLET`.
2. Frontend posts `{orderId, txHash, network, expectedAmountMinor}` to **`POST /api/payments/crypto/verify`** (gateway-authenticated).
3. `CryptoVerificationService` issues two JSON-RPC calls against `CRYPTO_RPC_URL` (Alchemy/Infura — testnets: `ethereum-sepolia`, `polygon-amoy`):
   - `eth_getTransactionByHash` — transaction existence + `to` + `input`
   - `eth_getTransactionReceipt` — `status == 0x1` (confirmed)
4. Verification checks, in order (each failure returns a recorded `REJECTED` + reason):
   - tx exists and is mined with status `0x1`
   - `to == merchant wallet` (case-insensitive)
   - decoded value matches `expectedAmountMinor` exactly: for ERC-20, calldata selector `0xa9059cbb` is parsed and the `uint256` amount extracted; for native transfers, `tx.value` is used
5. On success: writes `crypto_verification` row (`status=PAID`, unique `(network, tx_hash)` prevents double-spend/replay of the same tx), appends `PaymentAuthorized` (with `paymentMethod=CRYPTO_USDT_ETH`, `txHash`) to the outbox → order-service marks the order paid.
6. **Kill-switch:** `CRYPTO_BETA_ENABLED=false` (default) rejects all verification with *"Crypto payments are not enabled yet (v2.0 beta)"* — the UI shows the matching **“v2.0 Beta · Testnet ready”** badge.

**Tables:** `crypto_verification` (unique `(network, tx_hash)`), `outbox`.

### 5.7 `payment-service` (:8084) — legacy sandbox provider

Retained for the original saga demo: `PAYMENT_PROVIDER=sandbox` with `SANDBOX_PAYMENT_DECLINE` toggle, `PaymentController`, outbox publishing `PaymentAuthorized`. Moyasar service is the production-intent replacement; both can coexist during migration.

### 5.8 `notification-service` (:8085)

Consumes saga events (order confirmed, payment events) and stores in-app notifications (`notification` table), exposed via `NotificationController`.

---

## 6. Database Schema (MySQL & Redis)

Per-service schemas live in each service's `src/main/resources/db/migration/`. Consolidated reference DDL:

```sql
-- ============ user-db ============
CREATE TABLE profiles (
  user_id     VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  version     BIGINT NOT NULL,
  CONSTRAINT positive_version CHECK (version > 0)
);
-- V2 adds role administration (grants, audit).

-- ============ product-db ============
CREATE TABLE product (
  sku             VARCHAR(64) PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  name_ar         VARCHAR(200) NULL,          -- V3 bilingual
  description_en  VARCHAR(2000) NULL,          -- V3
  description_ar  VARCHAR(2000) NULL,          -- V3
  price_minor     BIGINT NOT NULL,
  currency        CHAR(3) NOT NULL,
  available_stock INT NOT NULL,
  category_id     VARCHAR(64) NULL,            -- V2
  version         BIGINT NOT NULL DEFAULT 0,   -- V2 optimistic locking
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_product_price CHECK (price_minor > 0),
  CONSTRAINT ck_product_stock  CHECK (available_stock >= 0),
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES category(id)
);
CREATE TABLE category (
  id      VARCHAR(64) PRIMARY KEY,
  name    VARCHAR(100) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  active  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX product_active_sku ON product(active, sku);

CREATE TABLE inventory_reservation (
  order_id    CHAR(36) PRIMARY KEY,
  user_id     VARCHAR(128) NOT NULL,
  status      VARCHAR(16) NOT NULL,
  total_minor BIGINT,
  currency    CHAR(3),
  expires_at  TIMESTAMP(6),
  created_at  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);
CREATE TABLE reservation_item (
  order_id        CHAR(36) NOT NULL,
  sku             VARCHAR(64) NOT NULL,
  quantity        INT NOT NULL,
  unit_price_minor BIGINT NOT NULL,
  PRIMARY KEY (order_id, sku),
  CONSTRAINT fk_reservation_item_order   FOREIGN KEY (order_id) REFERENCES inventory_reservation(order_id),
  CONSTRAINT fk_reservation_item_product FOREIGN KEY (sku)      REFERENCES product(sku),
  CONSTRAINT ck_reservation_quantity CHECK (quantity > 0)
);
CREATE TABLE stock_adjustment (
  id              VARCHAR(36) NOT NULL UNIQUE,
  actor_id        VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash    VARCHAR(64) NOT NULL,
  sku             VARCHAR(64) NOT NULL,
  delta           INT NOT NULL,
  reason          VARCHAR(200) NOT NULL,
  result_json     TEXT,
  created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (actor_id, idempotency_key),
  FOREIGN KEY (sku) REFERENCES product(sku)
);

-- ============ order-db ============
CREATE TABLE orders (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash    VARCHAR(64) NOT NULL,
  status          VARCHAR(32) NOT NULL,          -- PENDING|PROCESSING|PAID|FAILED|CONFIRMED|CANCELLED
  total_minor     BIGINT,
  currency        VARCHAR(3),
  payment_method       VARCHAR(32)  NULL,         -- V2: MOYASAR | CRYPTO_USDT_ETH
  payment_reference_id VARCHAR(255) NULL,         -- V2: Moyasar payment id
  tx_hash              VARCHAR(255) NULL,         -- V2: on-chain tx hash (crypto only)
  created_at      TIMESTAMP(6) NOT NULL,
  expires_at      TIMESTAMP(6) NOT NULL,
  UNIQUE (user_id, idempotency_key)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE TABLE order_items (
  order_id VARCHAR(36) NOT NULL,
  sku      VARCHAR(64) NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (order_id, sku),
  FOREIGN KEY (order_id) REFERENCES orders(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE INDEX idx_orders_payment ON orders(payment_method, status);

-- ============ moyasar-db ============
CREATE TABLE moyasar_payment (
  id                CHAR(36) PRIMARY KEY,
  order_id          CHAR(36) NOT NULL,
  user_id           VARCHAR(128) NOT NULL,
  amount_minor      BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL,
  status            VARCHAR(32) NOT NULL,
  moyasar_payment_id VARCHAR(64) NULL,
  callback_url      VARCHAR(500) NULL,
  idempotency_key   VARCHAR(128) NOT NULL,
  created_at        TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at        TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_moyasar_idempotency (user_id, idempotency_key),
  INDEX idx_moyasar_order (order_id),
  CONSTRAINT ck_amount_positive CHECK (amount_minor > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

-- ============ crypto-db ============
CREATE TABLE crypto_verification (
  id                   VARCHAR(36) PRIMARY KEY,
  order_id             CHAR(36) NOT NULL,
  user_id              VARCHAR(128) NOT NULL,
  tx_hash              VARCHAR(128) NOT NULL,
  network              VARCHAR(32) NOT NULL,      -- ethereum-sepolia | polygon-amoy | ...
  expected_amount_minor BIGINT NOT NULL,
  currency             CHAR(3) NOT NULL,
  status               VARCHAR(32) NOT NULL,      -- PAID | REJECTED
  reason               VARCHAR(255) NULL,
  checked_at           TIMESTAMP(6) NULL,
  created_at           TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_crypto_tx (network, tx_hash)        -- replay/double-spend guard
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

-- ============ shared per-service (outbox/inbox pattern) ============
CREATE TABLE outbox (
  event_id     CHAR(36) PRIMARY KEY,
  aggregate_id CHAR(36) NOT NULL,
  payload      LONGTEXT NOT NULL,
  created_at   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  published_at TIMESTAMP(6) NULL,
  INDEX idx_outbox_pending (published_at, created_at)
);
CREATE TABLE inbox (
  event_id    CHAR(36) PRIMARY KEY,
  received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);
```

### Redis usage

| Instance | Purpose | Keys |
|---|---|---|
| `edge-redis` | Gateway rate limiter (fail-closed) | per-user/anonymous request counters |
| `product-redis` | Catalog cache | `catalog:v2:<sku>` (30 s TTL, evicted on commit after admin writes) |

Redis is deliberately **not** used for sessions: the gateway is stateless (JWT per request), and carts for signed-in users live in MySQL via product-service (`/api/cart/**`); guest carts persist in browser localStorage.

---

## 7. Messaging: Kafka Saga Choreography

- Broker: Apache Kafka 4.1 in KRaft mode (single-node dev; 3-broker for prod), 12-partition topic `commerce.saga.v1`, per-service DLTs, retention 7 days.
- Events (JSON): `OrderPlaced`, `InventoryReserved`, `InventoryRejected`, `PaymentAuthorized`.
- Delivery: outbox relay → Kafka → consumer inserts into `inbox` before processing (idempotency), DLT on repeated failure with alert-level logs.
- No orchestration service — each service reacts to events, keeping the saga decentralized and failure-isolated.

---

## 8. Security Model

1. **Edge:** Firebase-issued RS256 ID tokens validated at the gateway only. Services never parse user JWTs.
2. **Internal trust:** gateway signs `X-User-Id`/`X-User-Roles` with HMAC-SHA256 (`INTERNAL_HMAC_SECRET`); each service's `InternalContextFilter` rejects unsigned/invalid internal headers. The `services` docker network is `internal: true` (no outbound internet) to limit blast radius.
3. **RBAC:** `USER` (default) / `STAFF` (catalog+order admin) / `SUPER_ADMIN` (user roles, analytics). Legacy `admin:true` claim → `STAFF`.
4. **Payments:** Moyasar secret key only in the service env; webhook never trusted directly (authoritative re-fetch). Crypto verification enforces exact amount match, merchant-wallet match, tx confirmation, and `(network, tx_hash)` uniqueness.
5. **Data:** per-service DB credentials, `no-new-privileges`, read-only containers, dropped capabilities, memory/CPU caps on every compose service.

---

## 9. DevOps: Docker Compose Run Guide

### One-command full stack (11+ containers)

```bash
# 0) Prereq: Docker Desktop / Engine running
# 1) Secrets: generate a randomized local .env (never commit it)
cp .env.example .env
#    then fill every value — or on Windows:
powershell -File backend/scripts/new-local-env.ps1

# 2) Build + start everything
docker compose up -d --build

# 3) Watch health (all services must reach "healthy")
docker compose ps
docker compose logs -f api-gateway

# 4) Open the app
#    UI:        http://localhost:3000
#    Gateway:   http://localhost:8080
#    Swagger:   http://localhost:8080/docs/product/swagger-ui.html
#               http://localhost:8080/docs/order/swagger-ui.html
#               http://localhost:8080/docs/moyasar/swagger-ui.html
#               http://localhost:8080/docs/crypto/swagger-ui.html

# 5) Teardown (keeps volumes)
docker compose down
```

First build takes 5–15 min (Maven dependency caching layers); subsequent builds are incremental.

**First-run seeding:** product-service Flyway migration `V4__demo_seed_bilingual_catalog.sql` inserts 12 bilingual demo products in 4 categories automatically — the storefront is populated on first boot.

### Container hardening (applied to every app container)

`restart: unless-stopped`, `init: true`, `read_only: true`, `tmpfs: /tmp`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, mem/CPU limits, healthchecks with generous `start_period`, internal-only networks for service/data/cache planes.

### Local dev without Docker

```bash
# Backend (per service)
cd backend/services/product-service && mvn spring-boot:run   # needs config-server + discovery running

# Frontend with API proxy to the gateway
cd bitsooq-ui
npm install
npm run dev          # http://localhost:5173, /api proxied to :8080
```

---

## 10. Environment Variables (`.env.example`)

```properties
# ---- Core infrastructure ----
FIREBASE_PROJECT_ID=             # Firebase project; gateway validates tokens against it
INTERNAL_HMAC_SECRET=            # HMAC key signing internal identity headers (gateway → services)
CONFIG_USERNAME=config           # Spring Cloud Config basic auth
CONFIG_PASSWORD=
EUREKA_USERNAME=discovery        # Eureka basic auth
EUREKA_PASSWORD=
REDIS_PASSWORD=

# ---- Per-service MySQL ----
MYSQL_ROOT_PASSWORD=
USER_DB_PASSWORD=
PRODUCT_DB_PASSWORD=
ORDER_DB_PASSWORD=
PAYMENT_DB_PASSWORD=
NOTIFICATION_DB_PASSWORD=
MOYASAR_DB_PASSWORD=             # BitSooq new
CRYPTO_DB_PASSWORD=              # BitSooq new

# ---- Firebase web (public client config) ----
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_MEASUREMENT_ID=
# Optional admin capability (see docker-compose.firebase-admin.yml)
FIREBASE_ADMIN_CREDENTIALS_FILE=

# ---- Moyasar (fiat) ----
MOYASAR_BASE_URL=https://api.moyasar.com/v1
MOYASAR_SECRET_KEY=              # sk_live_…/sk_test_… — service env only
MOYASAR_WEBHOOK_SECRET=

# ---- Crypto gateway (Web3, no contracts) ----
CRYPTO_RPC_URL=                  # e.g. https://ethereum-sepolia.g.alchemy.com/v2/<key>
CRYPTO_MERCHANT_WALLET=0x…       #收款 wallet verified on-chain
CRYPTO_BETA_ENABLED=false        # v2.0 beta kill-switch

# ---- Frontend ----
VITE_API_BASE_URL=               # empty = same-origin via nginx/gateway
VITE_CRYPTO_NETWORKS=ethereum-sepolia,polygon-amoy
VITE_CRYPTO_DEFAULT_NETWORK=ethereum-sepolia
VITE_MERCHANT_WALLET=            # mirrors CRYPTO_MERCHANT_WALLET for the checkout UI
```

> Secrets belong in a secret manager for production; `.env` is for local only and is git-ignored.

---

## 11. API & Swagger Reference

Unified documentation through the gateway (no auth needed for docs):

| Service | Swagger UI | OpenAPI JSON |
|---|---|---|
| product | `/docs/product/swagger-ui.html` | `/docs/product/v3/api-docs` |
| order | `/docs/order/swagger-ui.html` | `/docs/order/v3/api-docs` |
| user | `/docs/user/swagger-ui.html` | `/docs/user/v3/api-docs` |
| payment | `/docs/payment/swagger-ui.html` | `/docs/payment/v3/api-docs` |
| moyasar | `/docs/moyasar/swagger-ui.html` | `/docs/moyasar/v3/api-docs` |
| crypto | `/docs/crypto/swagger-ui.html` | `/docs/crypto/v3/api-docs` |
| notification | `/docs/notification/swagger-ui.html` | `/docs/notification/v3/api-docs` |

### Core endpoint map

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/products?after=&size=` | public | bilingual catalog (cursor pagination) |
| GET | `/api/products/{sku}` | public | single product |
| GET | `/api/categories` | public | active categories |
| POST/PUT | `/api/admin/products[/{sku}]` | STAFF+ | create/update product (bilingual fields) |
| GET/PUT | `/api/cart` | USER | server-side cart |
| POST | `/api/orders` | USER | create order (idempotent) |
| GET | `/api/orders`, `/api/orders/{id}` | USER | own orders / status polling |
| GET | `/api/admin/orders` | STAFF+ | admin order lists & analytics |
| POST | `/api/payments/moyasar/initiate` | USER | start Moyasar payment → hosted form URL |
| POST | `/api/payments/moyasar/webhook` | public* | Moyasar webhook (verified by re-fetch) |
| POST | `/api/payments/crypto/verify` | USER | submit txHash for on-chain verification |
| GET | `/api/users/me`, profile endpoints | USER | profile management |
| GET | `/api/admin/users/**` | SUPER_ADMIN | role administration |
| GET | `/api/notifications` | USER | in-app notifications |

\* unauthenticated at the edge by design; authenticity enforced by Moyasar API re-fetch inside the service.

---

## 12. Kubernetes Deployment Strategy (Ubuntu VPS)

### Topology

```
Ingress (nginx / Traefik, TLS via cert-manager)
   ├── /            → bitsooq-ui Service → Deployment (replicas 2)
   ├── /api/**      → api-gateway Service → Deployment (replicas 2)
   ├── /docs/**     → api-gateway
   and per-service ClusterIP Services (never exposed externally)
StatefulSets: mysql per service (or one operator-managed MySQL with separate schemas)
StatefulSet/Strimzi: Kafka · Deployments: redis (edge/product)
```

### Migration steps from Compose

1. **Images:** build/push each `commerce-*` image to a registry (GHCR/ACR/ECR): `docker build -t ghcr.io/<org>/product-service:1.0.0 backend/services/product-service`.
2. **Secrets:** convert `.env` values into `kubectl create secret generic` / SealedSecrets / External Secrets Operator:
   ```bash
   kubectl create secret generic bitsooq-db \
     --from-literal=PRODUCT_DB_PASSWORD=… \
     --from-literal=ORDER_DB_PASSWORD=…
   kubectl create secret generic bitsooq-payments \
     --from-literal=MOYASAR_SECRET_KEY=sk_… \
     --from-literal=CRYPTO_MERCHANT_WALLET=0x… \
     --from-literal=CRYPTO_RPC_URL=https://…
   ```
3. **Config:** the config-server can stay as a Deployment backed by a ConfigMap volume, or migrate to per-service ConfigMaps + Spring's `SPRING_CONFIG_IMPORT=optional:configtree:/etc/config/`.
4. **Databases:** use the StatefulSet + PVC per service, or managed MySQL. Run Flyway migrations as an initContainer/Job per service before the app rolls.
5. **Networking:** replace compose networks with NetworkPolicies: only gateway → services; only service → its own DB; deny cross-service DB access.
6. **Health & rolling updates:** compose healthchecks become readiness/liveness probes (`/actuator/health` with kubernetes probes enabled — already on).
7. **Ingress example (nginx):**
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: bitsooq
     annotations:
       cert-manager.io/cluster-issuer: letsencrypt
       nginx.ingress.kubernetes.io/proxy-body-size: 1m
   spec:
     tls: [{ hosts: [bitsooq.example.com], secretName: bitsooq-tls }]
     rules:
       - host: bitsooq.example.com
         http:
           paths:
             - path: /api
               pathType: Prefix
               backend: { service: { name: api-gateway, port: { number: 8080 } } }
             - path: /docs
               pathType: Prefix
               backend: { service: { name: api-gateway, port: { number: 8080 } } }
             - path: /
               pathType: Prefix
               backend: { service: { name: bitsooq-ui, port: { number: 8080 } } }
   ```
8. **VPS sizing (single Ubuntu node, k3s is ideal):** 4–6 vCPU / 8–12 GB RAM minimum; MySQL pods are the heaviest (512 MB cap each in compose terms).

### Production hardening checklist

- 3-broker Kafka (Strimzi) + MySQL replication or managed DB; PITR backups.
- Move rate-limit Redis to a replicated instance; add Redis Sentinel/Cluster.
- Terminate TLS at ingress; enable HSTS at nginx; keep gateway CORS restricted to the production domain.
- Replace env-file secrets with Vault/External Secrets; rotate `INTERNAL_HMAC_SECRET`.
- Structured logs already JSON — ship with Loki/ELK; Prometheus scrapes `/actuator/prometheus` (micrometer registry present).
- Keep `CRYPTO_BETA_ENABLED=false` until the merchant wallet and RPC are production-hardened; enable per-network allowlist.

---

## 13. Repository Layout

```
bitsooq/
├── docker-compose.yml               # master 11+-container stack (root)
├── .env.example                     # every required variable, documented
├── PROJECT_MASTER_DOC.md            # this document
├── docs/
│   └── BITSOOQ-ARCHITECTURE.md      # deep-dive architecture companion
├── backend/
│   ├── compose.yml                  # backend-relative variant of the same stack
│   ├── contracts/                   # openapi.yml, saga-event.schema.json
│   ├── config-repo/                 # config-server file repository
│   ├── infrastructure/
│   │   ├── config-server/           # :8888
│   │   └── discovery-server/        # :8761 Eureka
│   ├── scripts/                     # new-local-env.ps1, bootstrap-super-admin.ps1
│   └── services/
│       ├── api-gateway/             # :8080 edge
│       ├── user-service/            # :8081 identity/RBAC
│       ├── product-service/         # :8082 bilingual catalog (+ V4 seed)
│       ├── order-service/           # :8083 lifecycle
│       ├── payment-service/         # legacy sandbox provider
│       ├── moyasar-payment-service/ # :8084 Moyasar fiat (NEW)
│       ├── crypto-gateway-service/  # :8087 Web3 verify (NEW)
│       └── notification-service/    # in-app notifications
└── bitsooq-ui/                      # React SPA (NEW)
    ├── Dockerfile · nginx.conf
    └── src/
        ├── i18n/index.ts            # EN/AR bundles + dir engine
        ├── lib/api.ts · lib/store.tsx
        ├── pages/                   # Storefront, Checkout, Dashboard
        └── components/              # Header, Hero, ProductGrid, CartDrawer
```

---

*Maintained as the single source of truth for BitSooq. Update this document with any architectural change.*
