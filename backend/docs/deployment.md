# Local container deployment

Run ./backend/scripts/new-local-env.ps1 once from the repository root. It preserves existing backend/.env and frontend/.env.local, creates missing local credentials, and creates root .env by combining the existing backend credentials with public Firebase web configuration. A project mismatch stops generation. Existing root .env is never overwritten. Fill missing values in root .env without committing it.

The default single command from the repository root is:

~~~powershell
docker compose up --build --wait
~~~

Open http://localhost:3000. Frontend Nginx proxies /api to the gateway; the gateway is also bound to loopback8080 for direct API tooling. MySQL, Redis, Kafka, Eureka and Config Server have no public host ports. Backend-only development remains available from backend/ using its compose.yml and backend/.env.

The Firebase web configuration is public client configuration. Never use a Firebase service-account private key as a VITE_* variable. The User service's optional privileged management capability is enabled separately:

~~~powershell
# Set FIREBASE_ADMIN_CREDENTIALS_FILE in root .env to an existing absolute JSON key path outside the repository.
docker compose -f docker-compose.yml -f docker-compose.firebase-admin.yml up --build --wait
~~~

The overlay mounts that file read-only at /run/secrets/firebase-admin.json and enables Firebase Admin for the User service. Missing host files fail mount creation rather than becoming directories. In managed production, use workload ADC/IAM instead of distributing JSON keys. The default stack starts with Firebase Admin disabled; privileged management APIs return an actionable503 until configured. Only the User service gets outbound access for Firebase Admin. Database networks remain private per service.

## ZooKeeper compatibility topology

Kafka4 removed ZooKeeper mode. The default uses Kafka4.1 KRaft. Because a ZooKeeper topology was requested, docker-compose.zookeeper.yml is a standalone alternative using the official Apache Kafka3.9.1 JVM image and ZooKeeper3.9:

~~~powershell
docker compose -f docker-compose.zookeeper.yml up --build --wait
~~~

Run only one topology at a time because both bind the same local frontend/API ports. The legacy topology has its own Compose project name and broker/ZooKeeper volumes. Never mount Kafka4 metadata/data into a Kafka3 broker. Do not merge the two base files. Apply docker-compose.firebase-admin.yml after whichever single base file you choose. This compatibility stack is not a recommendation to start new production infrastructure on ZooKeeper.

Sources: [Kafka4 upgrade requirements](https://kafka.apache.org/40/getting-started/upgrade/), [Kafka3.9 quickstart with ZooKeeper](https://kafka.apache.org/39/getting-started/quickstart/), and [official Apache Kafka Docker image](https://kafka.apache.org/39/getting-started/docker/).

## Verification limits

Docker is not installed on the authoring host. YAML syntax and independent Java/frontend builds can be checked here; image pulls, Compose semantics, port wiring, browser Firebase login, broker durability and full end-to-end smoke tests must run on a Docker host. No container integration success is implied by a Java unit/context test.

This is a one-host development topology. Production requires replicated services/state stores, authenticated TLS/mTLS, workload identities, secrets management, backups/restore drills, real payment-provider reconciliation, load/failover testing and operational monitoring. See operations.md for the rollout gates.
