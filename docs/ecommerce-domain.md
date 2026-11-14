# Commerce domain model

This document records the expanded MySQL model added to the service-owned schemas. It separates product data from the order-time snapshot, so later catalog edits cannot rewrite what a buyer agreed to purchase.

## Service ownership

| Schema owner | Aggregate roots and supporting entities |
|---|---|
| `product` | Product and SKU, variants, taxonomy, brands, marketplace sellers, translations, media, category assignments, typed attributes, price lists, reviews, wishlists, tax classes, jurisdiction and rate configuration, stock reservations, and stock-adjustment audit |
| `user` | Customer profile, roles, and saved customer addresses |
| `order` | Order and immutable line/address snapshots, totals, adjustments, tax lines, order-state history, shipments, shipment events, and return requests |
| `payment` | Provider-neutral payment attempts, idempotency, webhook receipt deduplication, refunds, and provider-token references |
| `moyasar` | Moyasar-specific hosted-payment intents and provider state |
| `crypto` | Network transaction verification and replay protection |

The MySQL development helper puts these logical databases on one MySQL 8.4 server, while each microservice retains a separate database name. Production ownership can move each schema to its own database instance without changing table ownership. Do not let services read or write another service's tables.

## Product and catalog

`product` remains the sellable SKU and inventory key. A parent product groups related variants; each variant is itself a product row with its own SKU, barcode, price, and stock reservation. `product_variant` stores the selected option combination (for example, size and colour). `product_option` defines the option names for a parent.

Product identity and merchandising are split into `brand`, `seller`, `product_translation`, `product_media`, `product_category`, and `product_attribute_definition` / `product_attribute_value`. This supports multiple images with ordering and localized alt text, multiple categories, category-specific filterable attributes, manufacturer identifiers, condition, physical dimensions, origin, and warranty. `product_price` supports currency and time-bounded price lists; the old `product.price_minor` stays as the compatibility price read by the current API and reservation saga.

`product_review` stores moderation state and verified-purchase status; public rating aggregates should be calculated from published reviews or a rebuildable projection. `wishlist` and `wishlist_item` keep customer saves separate from catalog records. Existing stock reservation and adjustment flows remain tied to SKU rows; warehouse allocation and multi-seller stock routing need service logic before those use cases can be enabled.

## Cart, order, and fulfillment

The current order API accepts SKU and quantity. `orders` and `order_items` retain those keys and gain columns for subtotal, discount, delivery, tax, currency, sales channel, and order-time product/price snapshots. `order_address` is a copy of the submitted ship-to/bill-to address at purchase time; later edits to a saved customer address do not change an old order.

`order_adjustment` represents coupon discounts, delivery charges, and other explicit total adjustments. `order_tax_line` captures the authority code, jurisdiction, tax code, rate, taxable amount, tax amount, invoice reference, and filing/reconciliation state used for a specific order. `order_status_history` stores who or what changed the lifecycle and why.

The implemented checkout accepts recipient/contact, street and apartment, area, city, region, postal code, country, optional delivery instructions, and an optional one-time GPS pin. It quotes rates from the best matching configured delivery-zone rules and stores a ship-to snapshot on the order. Customer address-book endpoints support listing, saving, editing with an optimistic version, setting defaults, and archiving addresses.

`delivery_zone` matches a country, region, city, optional area and postal prefix. `delivery_rate` defines a service name/code, fee, ETA range and COD availability. Staff can create zones and rates through the admin API/UI. A successful paid order or COD reservation creates a shipment with ETA; staff can update the shipment status, carrier code, tracking number/URL, and event description/location. Customers can query their owned order to see shipment status, ETA, and activity history. These controls do not book a courier, buy a label, or receive carrier webhooks; those provider adapters remain to be integrated.

Fulfillment is modeled with `shipment`, `shipment_item`, and `shipment_event`, allowing split shipments and carrier tracking. `return_request` and `return_item` represent the requested quantity and outcome, but the customer return API/workflow is not implemented. A refund is a payment aggregate and is recorded in the `payment` schema, not directly by the order service.

The tax tables are data structures, not a tax calculator or legal ruleset. They contain no prefilled jurisdiction rates and make no assumption about PRA/FBR filing formats. Provider-specific registration, current rates, invoice requirements, signing, submission, acknowledgement, and reconciliation must be supplied and reviewed for the merchant's actual jurisdictions before production use.

## Payment lifecycle

`payment_attempt` is one attempt to collect one order's amount. Retries create new attempt numbers and idempotency keys. Provider references and status timestamps support reconciliation. `payment_webhook_event` deduplicates events by provider and provider event ID and records only a payload hash; raw cardholder data is not retained. `payment_refund` tracks partial/full refund amounts and provider results. `payment_method_token` stores a provider-issued reference plus display metadata, never a card number, CVV, PIN, or OTP.

The order service supports staff recording an exact-amount COD collection with an idempotent reference. This does not reconcile courier cash remittance. Moyasar can initiate a hosted provider checkout when configured. The crypto verification adapter is disabled by default. Capture/void, automated refund, Pakistan-specific gateway, courier cash reconciliation, carrier booking, and carrier webhook adapters are not configured.

## Migration files

- Product: `V5__marketplace_catalog_model.sql`
- Order: `V3__order_query_indexes.sql`, `V4__marketplace_order_model.sql`, and `V5__delivery_zones_and_rates.sql`
- Customer: `V3__customer_addresses.sql` and `V4__customer_address_location.sql`
- Payment: `V2__payment_lifecycle.sql`
- Moyasar: `V1__payment_intents.sql` and `V2__moyasar_provider_source.sql`

The order query-index migration was assigned V3 because the working tree had both payment references and query indexes at V2. The Moyasar service also had two conflicting V1 create-table scripts; the original payment-intents migration is retained as V1 and the provider-source addition is V2. Flyway requires distinct version numbers within a service. If a database has already recorded either replaced migration name/version, reconcile its Flyway history before applying these files; do not rewrite a production history blindly.

## Current API and rollout boundary

The catalog DTO still exposes the original product fields, and the product/order APIs do not yet provide full CRUD for variants, attributes, pricing, tax, returns, or payment refunds. Live delivery-rate configuration and order-address/shipment logic are implemented, but use USD and require staff-created zones/rates. The local storefront uses PKR examples and browser-only demo orders. Configure real payment credentials and delivery coverage, integrate a courier, and review deployment/security/operations before production use.
