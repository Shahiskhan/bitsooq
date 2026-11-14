# BitSooq commerce platform

BitSooq is a bilingual storefront and Spring Boot commerce platform. The storefront has a lightweight sample-data mode; the backend is split into services for catalog/inventory, customers, orders, payments, and notifications.

## Run the storefront without the backend

This is the low-resource path. It starts only Vite and uses a clearly labelled PKR sample catalog. Checkout previews Lahore/Karachi/Islamabad/Rawalpindi/Faisalabad standard and express delivery, address instructions and optional GPS pin, then stores a demo order/tracking timeline in this browser. It does not contact a payment provider, courier, or backend.

```powershell
cd bitsooq-ui
npm install
npm run dev:demo
```

Open the local URL Vite prints. For a small Docker preview on port 3000, run from the repository root:

```powershell
docker compose -f docker-compose.slim.yml up --build
```

## Optional local MySQL

To develop service migrations on one MySQL server, copy the optional root password into `.env`, then start the database:

```powershell
docker compose --env-file .env -f docker-compose.mysql-dev.yml up -d
```

It creates separate logical databases (`user`, `product`, `order`, `payment`, `notification`, `moyasar`, and `crypto`) on one local MySQL 8.4 instance at `127.0.0.1:3307`. The database users and passwords in its init script are local-development credentials; do not reuse them outside this isolated setup. A running database alone does not start any Java service.

## Full backend

See [`backend/README.md`](backend/README.md) for the complete Docker Compose stack, service configuration, and verification commands. You do not need to run that stack to browse the sample storefront.

## Domain and deployment notes

- [`docs/ecommerce-domain.md`](docs/ecommerce-domain.md) describes the expanded catalog, order, tax, fulfillment, customer-address, and payment data model and its migration boundaries.
- [`backend/docs/operations.md`](backend/docs/operations.md) lists production readiness work. The repository contains integration seams and schemas; it does not claim live Pakistan tax filing, live COD, shipping-carrier, JazzCash/Easypaisa, or production payment processing is configured.

The live API supports customer address book, delivery-zone quotes, configurable delivery rates, order address snapshots, COD due/collection, staff shipment milestones, tracking references, ETA, and shipment activity. Delivery zones and rates must be configured by staff before live checkout can quote delivery. Live catalog/order currency remains USD; local demo prices/rates are PKR examples and never submit real orders. No carrier account or automatic courier booking/label purchase is configured. Moyasar requires valid provider credentials and callbacks; crypto remains disabled by default. Never use sample catalog data or local credentials for real orders.
