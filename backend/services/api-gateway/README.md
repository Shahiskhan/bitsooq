# API Gateway

Build independently with Java25: mvn verify. Port8080. Spring Boot4.1.2 and Spring Cloud2025.1.2.

GET /api/products and /api/categories (including resource paths) are public catalog reads. The gateway still strips all inbound X-Internal-* headers and signs an anonymous context for downstream catalog readers. Cart, profile, order, payment status and notification APIs require a Firebase ID token. Mutation routes for products/categories and admin product/order monitoring require STAFF or SUPER_ADMIN. Firebase user/role administration and order analytics require SUPER_ADMIN. Other paths/methods are denied.

Roles come only from validated Firebase custom claims. roles:[SUPER_ADMIN] grants super-admin authority; roles:[STAFF] grants staff authority. Legacy ADMIN roles or admin:true map to STAFF, never SUPER_ADMIN. Browser-side navigation is only a convenience; gateway and domain services enforce permissions independently.

Supply FIREBASE_PROJECT_ID, INTERNAL_HMAC_SECRET (at least32 UTF-8bytes), CONFIG_SERVER_URL, CONFIG_USERNAME, CONFIG_PASSWORD, authenticated EUREKA_URL, and Redis connection variables. Startup requires external config; no local authentication bypass is supplied. Explicit development CORS origins default to http://localhost:5173 and http://localhost:3000; override security.cors.allowed-origins for your deployment. Production frontend proxies /api through the same origin.

Firebase token verification validates signature/key, issuer, exact project audience, expiry, issued time and authentication time. It does not perform a Firebase revocation lookup; claim changes take effect after token refresh/expiry. Sensitive role-management operations also use the User service's Firebase Admin credential boundary.

Internal identity headers are X-Internal-User-Id, X-Internal-Roles (sorted comma-separated), X-Internal-Timestamp (epochseconds), X-Internal-Request-Id (UUID), X-Internal-Signature (base64url HMAC-SHA256 without padding). Signing bytes are method, raw URI path without query, userID, roles, timestamp and requestID joined by LF without trailing LF. External Authorization is removed before downstream routing. Receiver services verify constant-time signatures and30second clock skew, then enforce ownership/roles. Internal TLS/network policies and secret rotation remain deployment requirements; shared HMAC keys do not provide workload isolation after a service compromise.

The edge generates X-Request-Id even for rejected authentication, enabling customer support correlation. Redis quotas use authenticated UID or the anonymous socket peer; arbitrary client forwarded-IP headers are ignored. If a reverse proxy is the socket peer, anonymous clients share that proxy's quota until a trusted-proxy/IP policy is configured. Quotas are20requests/s withburst40 per route/key. Exhaustion returns429 and invalid/missing quota decisions return503. Bound connect/response deadlines, circuit breakers and oneGET retry protect downstream resources. Writes are not retried by the gateway; idempotency is a domain concern.

Default routing is explicit and discovery-based wildcard routing is disabled. The cluster Redis profile uses REDIS_CLUSTER_NODES and REDIS_TLS_ENABLED. Only actuator health probes are exposed.
