# BitSooq (بيت سوق) — Enterprise Platform Architecture

## 1. System Mind-Map (ASCII)

```
                                   ┌──────────────────────────────┐
                                   │        bitsooq-ui (SPA)      │
                                   │  React 19 + Vite + Tailwind  │
                                   │  TypeScript · i18next EN/AR  │
                                   │  dir=rtl | dir=ltr dynamic   │
                                   │  Firebase Auth · Web3 wallet │
                                   └──────────────┬───────────────┘
                                                  │ HTTPS (Firebase ID token)
                                                  ▼
                        ┌─────────────────────────────────────────────┐
                        │              api-gateway :8080              │
                        │  Spring Cloud Gateway (WebFlux)             │
                        │  · JWT validation filter (Firebase RS256)   │
                        │  · CORS configuration · Redis rate limiter  │
                        │  · Circuit breakers · Secure headers        │
                        └──────┬───────────┬───────────┬──────────────┘
                               │           │           │ (Eureka discovery, mTLS-ready)
              ┌────────────────┘           │           └───────────────────┐
              ▼                            ▼                               ▼
 ┌─────────────────────┐    ┌──────────────────────┐    ┌──────────────────────────────┐
 │  auth (user-svc)    │    │   product-service    │    │        order-service         │
 │  :8081 profiles/RBAC│    │  :8082 catalog       │    │ :8083 PENDING/RESERVED/      │
 │  ADMIN / CUSTOMER   │    │  bilingual EN/AR     │    │  CONFIRMED / CANCELLED       │
 │  Firebase UID keyed │    │  Redis cache · carts │    │  paymentMethod (MOYASAR /    │
 │  optimistic version │    │  inventory locking   │    │  CRYPTO) + paymentReference  │
 └─────────┬───────────┘    └──────────┬───────────┘    └───────────────┬──────────────┘
           │                           │                                │
           ▼                           ▼                                ▼
   [user-db MySQL]             [product-db MySQL]               [order-db MySQL]

 ┌──────────────────────────────┐    ┌──────────────────────────────────────┐
 │   moyasar-payment-service    │    │        crypto-gateway-service        │
 │  :8084 fiat (Mada/Visa/Apple)│    │  :8085 Web3 verify (NO contracts)    │
 │  Moyasar REST + Basic Auth   │    │  Alchemy/Infura RPC eth_getTransaction│
 │  idempotent initiate         │    │  receipt + ERC-20 TransferLog parse  │
 │  signed webhook → PAID       │    │  merchant wallet + amount matching   │
 └──────────────┬───────────────┘    └──────────────────┬───────────────────┘
                │                                       │
                ▼                                       ▼
        [payment-db MySQL]                      [crypto-db MySQL]   (Moyasar = external HTTPS)
                │                                       │                    Alchemy/Infura
                └───────────────────┬───────────────────┘
                                    ▼
                    ┌───────────────────────────────────┐
                    │        Apache Kafka (KRaft)       │
                    │  commerce.saga.v1  (12 partitions)│
                    │  + per-consumer DLTs              │
                    │  choreography-based saga          │
                    └───────────────────────────────────┘

 Cross-cutting: config-server :8888 · discovery-server (Eureka) :8761 · edge-redis + product-redis
 Observability: structured JSON logs · /actuator/health only · Prometheus registry
```

### Saga choreography (order placement)
```
order-service ──OrderPlaced──▶ product-service (reserve stock)
        ▲                              │
        └──── InventoryRejected ───────┘
                    InventoryReserved
                                   │
                                   ▼
            ┌──── MOYASAR path ────┴──── CRYPTO path ────┐
            │ initiate → webhook(paid)      verify(tx)   │
            │        PaymentAuthorized                    │
            └──────────────────┬──────────────────────────┘
                               ▼
                     order-service CONFIRMED → notification-service (in-app)
```

## 2. Folder Structure

```
scalable-ecommerce-microservices/
├── compose.yml                     # master stack (all services)
├── .env.example                    # every required variable, documented
├── init-scripts/01-create-dbs.sql  # per-service databases
├── docs/                           # architecture, operations, runbooks
├── infrastructure/
│   ├── config-server/              # :8888 externalized configuration
│   └── discovery-server/           # :8761 Eureka registry
├── services/
│   ├── api-gateway/                # :8080 edge: JWT + CORS + rate limits
│   ├── user-service/               # :8081 identity profiles + RBAC
│   ├── product-service/            # :8082 bilingual catalog + inventory
│   ├── order-service/              # :8083 order lifecycle + saga state
│   ├── moyasar-payment-service/    # :8084 Moyasar fiat (NEW)
│   ├── crypto-gateway-service/     # :8085 on-chain verification (NEW)
│   └── notification-service/       # in-app notifications
└── bitsooq-ui/                     # React 19 + Vite + TS + Tailwind + i18next (NEW)
    └── src/
        ├── i18n/                   # en.ts, ar.ts, engine (dir switching)
        ├── lib/                    # api client, firebase, wallet (EIP-1193)
        ├── pages/                  # Storefront, Checkout, Dashboard
        └── components/             # Header, ProductGrid, CartDrawer, ...
```

## 3. Key decisions
- **Retained:** Firebase ID-token validation at the gateway (stateless, no password DB), per-service MySQL, Redis caching, Kafka saga with transactional outbox/inbox (at-least-once + idempotent consumers), Eureka discovery, Config Server.
- **Added:** two payment domains, isolated DBs, gateway routes, bilingual catalog columns, order payment references.
- **Crypto, no smart contracts:** frontend transfers to the merchant wallet directly; backend verifies the receipt via public RPC (status, `to` address, value/log matching) before marking `PAID`.
- **Moyasar:** secret key never leaves the service env; webhook status polling uses Basic Auth; `paymentReferenceId` = Moyasar payment id, `txHash` populated only for crypto.
