# BitSooq UI — Complete Frontend Documentation

> **Purpose of this document:** a self-contained handoff guide so a designer or frontend developer can **redesign the entire UI from scratch** without needing to understand the backend. Everything here is extracted from the real source files in `bitsooq-ui/` — no guesses.
>
> Repo path: `D:\Sbprojects\ecommerce\bitsooq-ui`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Design System](#2-design-system)
3. [Routes & Pages](#3-routes--pages)
4. [Components Breakdown](#4-components-breakdown)
5. [i18n / RTL Engine](#5-i18n--rtl-engine)
6. [API Client](#6-api-client)
7. [State Management](#7-state-management)
8. [Data Models](#8-data-models-typescript-interfaces)
9. [Backend API Contract](#9-backend-api-contract)
10. [Wallet Integration (Crypto)](#10-wallet-integration-crypto)
11. [Responsive Design](#11-responsive-design)
12. [Accessibility](#12-accessibility)
13. [Performance](#13-performance)
14. [Redesign Guidelines for Designers](#14-redesign-guidelines-for-designers)
15. [Redesign Handoff Checklist](#15-redesign-handoff-checklist)

---

## 1. Project Overview

**BitSooq (بيت سوق)** is a bilingual (English ⇄ Arabic-RTL) e-commerce storefront with a dual payment system: fiat (Moyasar — Mada / Visa / MasterCard / Apple Pay) and crypto (direct Web3 wallet transfer, verified on-chain by the backend — no smart contracts).

### Tech stack

| Layer | Technology | Version |
|---|---|---|
| UI framework | React | 18.3 |
| Language | TypeScript (strict mode) | 5.7 |
| Build tool | Vite (`@vitejs/plugin-react`) | 6.0 |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | 3.4 |
| Routing | react-router-dom | v6.28 |
| State | React Context + localStorage (no Redux) | — |
| i18n | i18next + react-i18next | 24 / 15 |
| Icons | lucide-react (tree-shakeable SVG) | latest |
| Web3 | Browser EIP-1193 provider (`window.ethereum`) | — |
| Testing | Vitest | 2.1 |

### File structure

```
bitsooq-ui/
├── index.html               # fonts loaded here (Google Fonts), dir="ltr" default
├── package.json · vite.config.ts · tsconfig.json
├── tailwind.config.js       # design tokens (colors, fonts, shadows)
├── postcss.config.js · nginx.conf · Dockerfile
└── src/
    ├── main.tsx             # entry: BrowserRouter + i18n init + styles.css
    ├── App.tsx              # routes + CartProvider + Header/Footer/CartDrawer
    ├── styles.css           # Tailwind layers + design-system component classes
    ├── vite-env.d.ts        # typed import.meta.env + Window.ethereum
    ├── i18n/index.ts        # EN/AR bundles + RTL/LTR direction engine
    ├── lib/
    │   ├── api.ts           # fetch wrapper + all backend calls + data types
    │   └── store.tsx        # CartProvider context + formatMoney helper
    ├── pages/
    │   ├── Storefront.tsx   # home: hero + product grid
    │   ├── Checkout.tsx     # dual-tab payment page
    │   └── Dashboard.tsx    # admin: orders + product form
    └── components/
        ├── Header.tsx       # sticky top bar
        ├── Hero.tsx         # marketing banner
        ├── ProductGrid.tsx  # catalog + search + category pills
        └── CartDrawer.tsx   # slide-over cart
```

### Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173 — /api proxied to gateway :8080
npm run build      # type-check (tsc -b) + production build to dist/
npm run preview    # serve the production build locally
npm run test       # Vitest
```

Dev proxy (from `vite.config.ts`):

```ts
server: {
  port: 5173,
  proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
},
```

---

## 2. Design System

### 2.1 Color palette (from `tailwind.config.js`)

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#090D16` | Page background — deep slate |
| `bg-panel` | `#111827` | Cards, header, drawer (used at 80% opacity + blur) |
| `bg-panel-2` | `#1A2234` | Secondary surfaces (inputs, icon tiles, pills) |
| `border-line` | `#1F2937` | All borders — cards, dividers, table rows |
| `cyan-neon` | `#06B6D4` | Primary accent — CTAs, badges, logo gradient start, cart count |
| `purple-neon` | `#8B5CF6` | Secondary accent — logo gradient end, crypto tab, beta badge |
| `emerald-neon` | `#10B981` | Prices, "In stock" badges, success states |
| Tailwind slate | `slate-200/300/400/500` | Text hierarchy (bright → muted) |
| Tailwind red-400 | `#F87171` | Errors, destructive hover |
| Tailwind amber-400 | `#FBBF24` | "Low stock" badge, PENDING status |

Tailwind config (real file):

```js
colors: {
  base: '#090D16',
  panel: '#111827',
  'panel-2': '#1A2234',
  line: '#1F2937',
  cyan: { neon: '#06B6D4' },
  purple: { neon: '#8B5CF6' },
  emerald: { neon: '#10B981' },
},
fontFamily: {
  sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
  arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
},
boxShadow: {
  glow: '0 0 24px -6px rgba(6, 182, 212, 0.45)',
  'glow-purple': '0 0 24px -6px rgba(139, 92, 246, 0.45)',
},
backdropBlur: { glass: '14px' },
```

### 2.2 Typography

Loaded in `index.html` (single Google Fonts request, 4 families):

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />
```

- **LTR (EN):** `font-sans` → Plus Jakarta Sans, fallback Inter.
- **RTL (AR):** `font-arabic` → Cairo, fallback Tajawal. The `<html>` element gets `font-arabic` class swapped in by the direction engine (§5).
- Scale in use: page titles `text-3xl font-extrabold`, hero `text-4xl sm:text-6xl font-extrabold`, card titles `text-sm font-semibold`, body `text-sm text-slate-300/400`, captions/labels `text-xs text-slate-500`.

### 2.3 Ambient background

Applied to `body` in `styles.css` — fixed radial glows give the "deep space" feel:

```css
body {
  @apply bg-base text-slate-200 font-sans;
  background-image: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6, 182, 212, 0.12), transparent),
    radial-gradient(ellipse 60% 40% at 90% 10%, rgba(139, 92, 246, 0.08), transparent);
  background-attachment: fixed;
}
```

### 2.4 Reusable component classes (from `src/styles.css`)

| Class | Definition | Used in |
|---|---|---|
| `.glass-card` | `bg-panel/80 backdrop-blur-glass border border-line rounded-2xl` | All cards: products, drawer rows, forms, tables |
| `.neon-button` | Cyan→purple gradient, white bold text, `hover:shadow-glow hover:brightness-110` | Primary CTAs (Add to cart, Pay now, Save, Checkout) |
| `.ghost-button` | `border border-line bg-panel-2/60`, hover: cyan border | Secondary actions (nav buttons, qty ±, copy) |
| `.field` | Dark input: `bg-panel-2/70 border-line`, focus: cyan ring | All inputs/selects/textareas |
| `.pill` / `.pill-active` | Category chips; active = cyan border + glow + tint | Category filter row |
| `.beta-badge` | Purple tinted chip with border | "v2.0 Beta · Testnet ready", hero badge |
| `.stock-badge` / `-low` / `-out` | Emerald / amber / red tinted chips | Product cards |
| `.status-*` | Status chips: PENDING amber, PROCESSING cyan, PAID/CONFIRMED emerald, FAILED/CANCELLED red | Orders table |
| `.product-card` | `.glass-card` + hover: cyan border + glow + `-translate-y-1` lift | Product grid |
| `.drawer-scrim` / `.cart-drawer` | Slide-over backdrop + panel, anchored `inset-inline-end`, animated | Cart drawer |
| `.table-cell` | `px-4 py-3 text-sm text-slate-300 whitespace-nowrap` | Dashboard tables |

### 2.5 Glassmorphism pattern

Every floating surface = translucent panel + blur + hairline border:

```
bg-panel/80  +  backdrop-blur-glass (14px)  +  border-line (1px)  +  rounded-2xl
```

Applied to: Header (`bg-base/80 backdrop-blur-glass`), all `.glass-card`s. Shadows are used sparingly — only `.neon-button` hover and `.product-card` hover get the neon glow.

### 2.6 Radii & spacing patterns

- Radii: `rounded-xl` (buttons, inputs), `rounded-2xl` (cards), `rounded-full` (pills, badges, cart count).
- Container: `mx-auto max-w-7xl px-4 sm:px-6` (page shell); sections spaced with `py-12/14/16/20`.
- Internal card padding: `p-4` (product card), `p-6` (forms), `p-3` (drawer rows).

---

## 3. Routes & Pages

### Route table (from `App.tsx`)

```tsx
<Routes>
  <Route path="/" element={<Storefront />} />
  <Route path="/cart" element={<Checkout />} />      {/* /cart reuses checkout */}
  <Route path="/checkout" element={<Checkout />} />
  <Route path="/dashboard" element={<Dashboard />} />
</Routes>
```

Global shell (also `App.tsx`): `CartProvider` wraps everything; `Header` is sticky; the `CartDrawer` is mounted once at app level, toggled by local state `drawerOpen`; footer is inline.

### 3.1 `/` — Storefront (`pages/Storefront.tsx`)

**Purpose:** bilingual product catalog landing page.

**State:**

```tsx
const [products, setProducts] = useState<Product[]>([]);
const [categories, setCategories] = useState<Category[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
```

**API calls (on mount, `useEffect(() => void load(), [])`):**

```ts
const [p, c] = await Promise.all([getProducts(), getCategories()]);
```

**Interactions:** none directly — delegates to `<Hero />` and `<ProductGrid />`. Retry button re-triggers `load()` on error.

### 3.2 `/checkout` — Checkout (`pages/Checkout.tsx`)

**Purpose:** order placement + hybrid payment. Two phases:

**Phase 1 — order summary card** (when no order yet): shows cart lines and subtotal, one button calls `placeOrder()` → `POST /api/orders` with `{ items: { [sku]: qty } }`. Empty cart renders just the `cart.empty` message.

**Phase 2 — dual-tab payment card** (after order created). Tab state:

```tsx
const [tab, setTab] = useState<'moyasar' | 'crypto'>('moyasar');
```

**Tab 1 — Moyasar Instant Pay** (`payMoyasar`):

```ts
const payment = await initiateMoyasarPayment({
  orderId: order.orderId,
  amount: order.totalMinor,
  currency: currency === 'SAR' ? 'SAR' : 'USD',
  callbackUrl: `${location.origin}/checkout`,
});
const url = (payment as { source?: { url?: string } }).source?.url;
if (url) location.href = url;   // redirect to Moyasar hosted form
```

Shows 3 provider chips (Mada, Visa/MC, Apple Pay) before the pay button.

**Tab 2 — Crypto Web3 Pay** (`connectWalletAndSend` + `payCrypto`):
- Merchant address row with copy-to-clipboard (copied state resets after 1.5 s)
- Network `<select>` from `VITE_CRYPTO_NETWORKS`
- `txHash` input (verify button disabled until length ≥ 66)
- `connectWalletAndSend()` → MetaMask `eth_sendTransaction` (§10)
- `payCrypto()` → `verifyCryptoPayment`; on `PAID` → success panel (check icon + txHash + link to dashboard) and `clear()` the cart

**Full local state:** `tab`, `order`, `busy`, `message` (error/info line), `txHash`, `network`, `copied`, `paid`.

### 3.3 `/dashboard` — Admin Dashboard (`pages/Dashboard.tsx`)

**Purpose:** order tracking + bilingual product management.

**State:** `orders`, `products`, `showForm` (toggle product form), `saving`, `form` (8 fields: sku, name, nameAr, descriptionEn, descriptionAr, priceMinor, currency, availableStock).

**API calls:**

```ts
setOrders(await getOrders().catch(() => []));      // GET /api/orders
setProducts(await getProducts().catch(() => []));  // GET /api/products
// saveProduct():
if (form.sku && products.some((p) => p.sku === form.sku))
  await adminUpdateProduct(form.sku, form);        // PUT /api/admin/products/{sku}
else
  await adminCreateProduct({ ...form, active: true }); // POST /api/admin/products
```

**UI:** "Add product" toggle button; a 2-column responsive form (`.glass-card`); orders table with `status-PAID`-style chips, method column, truncated mono txHash/paymentRef; products table with stock counts.

### 3.4 Cart Drawer (slide-over, not a route)

Controlled from `App.tsx` (`drawerOpen` state) — currently opened programmatically; intended trigger points are the header cart button and quick-add actions. `/cart` route currently renders `<Checkout />`.

---

## 4. Components Breakdown

### 4.1 `components/Header.tsx` — sticky top bar

**Props:** none. **Context:** `useTranslation()`, `useCart()`.

**Events:** language toggle button → `toggleLanguage()` from `../i18n`; nav links via `react-router-dom` `<Link>`.

**Styling classes:** `sticky top-0 z-40 border-b border-line bg-base/80 backdrop-blur-glass` (outer), `ghost-button !px-3` (nav buttons), gradient wordmark (`from-cyan-neon to-purple-neon bg-clip-text text-transparent`).

**Notable details:**
- Cart count badge: absolutely positioned `-top-1.5 -end-1.5` — uses logical `-end` so it sits correctly in RTL.
- Labels hidden on mobile (`hidden sm:inline`); the dashboard/cart links degrade to icon-only.
- Language indicator chip (`EN`/`AR`) only on `md:` and up.

Full render structure:

```tsx
<header className="sticky top-0 z-40 border-b border-line bg-base/80 backdrop-blur-glass">
  <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
    <Link to="/" className="text-xl font-extrabold tracking-tight text-white">
      Bit<span className="...gradient...">Sooq</span>
      <span className="ms-2 hidden text-sm font-normal text-slate-400 sm:inline">بيت سوق</span>
    </Link>
    <nav className="ms-auto flex items-center gap-2">  {/* logical ms-auto → flips */}
      <Link to="/dashboard" className="ghost-button !px-3">…</Link>
      <Link to="/cart" className="ghost-button !px-3 relative">…{count badge}…</Link>
      <button onClick={toggleLanguage} className="ghost-button !px-3">…</button>
    </nav>
  </div>
</header>
```

### 4.2 `components/Hero.tsx` — marketing banner

**Props:** none. **Events:** single `<Link to="/#shop">` CTA.

**Visual construction:** one `.glass-card` with two absolutely-positioned blurred gradient glows (cyan top, purple bottom), a `.beta-badge` chip, an `h1` with a gradient-clipped second line (`from-cyan-neon via-emerald-neon to-purple-neon`), subtitle, and a `.neon-button` whose `ArrowRight` icon flips in RTL via Tailwind's `rtl:rotate-180` variant.

**State:** none (pure presentational).

### 4.3 `components/ProductGrid.tsx` — catalog section

**Props interface:**

```ts
interface Props {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}
```

**State:** `category` (active filter, default `'all'`), `query` (search text).

**Derived data:**

```ts
const filtered = products.filter(
  (p) =>
    p.active &&
    (category === 'all' || p.categoryId === category) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.nameAr ?? '').includes(query)),   // search matches BOTH languages
);
```

**Interactions:** category pills (`setCategory`), search input with clear button (`setQuery`), quick-add button (`add(p)` from cart context, disabled when `availableStock <= 0`), retry button on error.

**Inner component — `StockBadge`:**

```tsx
function StockBadge({ stock }: { stock: number }) {
  const { t } = useTranslation();
  if (stock <= 0) return <span className="stock-badge-out">{t('product.outOfStock')}</span>;
  if (stock <= 5) return <span className="stock-badge-low">{t('product.low')} · {t('product.stockLeft', { count: stock })}</span>;
  return <span className="stock-badge">{t('product.inStock')}</span>;
}
```

**Bilingual rendering rule (used everywhere):**

```tsx
{i18n.language === 'ar' && p.nameAr ? p.nameAr : p.name}
// and for descriptions:
{i18n.language === 'ar' ? p.descriptionAr : p.descriptionEn}
```

**Grid layout:** `grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4`.

### 4.4 `components/CartDrawer.tsx` — slide-over cart

**Props interface:**

```ts
interface Props {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}
```

**Context:** full `useCart()` (lines, count, subtotalMinor, setQty, remove, clear).

**Events:** scrim click closes (`onMouseDown` filtered to the backdrop itself), close button, qty −/+, line remove (trash icon), subtotal checkout, clear cart.

**Accessibility:** `role="dialog" aria-modal="true" aria-label={t('cart.title')}`, aria-labels on all icon buttons.

**RTL-aware anchoring (from `styles.css`):**

```css
.cart-drawer {
  @apply fixed top-0 bottom-0 w-full max-w-md bg-panel border-line flex flex-col z-50 shadow-2xl;
  inset-inline-end: 0;          /* right side in LTR, LEFT side in RTL */
  border-inline-start-width: 1px;
  animation: slide-in 0.25s ease-out;
}
@keyframes slide-in {
  from { transform: translateX(var(--slide-from, 100%)); }
  to   { transform: translateX(0); }
}
[dir='rtl'] { --slide-from: -100%; }   /* drawer slides from the left in Arabic */
```

**Line item layout:** icon tile (gradient "B"), name (bilingual) + SKU, qty stepper (− count +), line total (emerald), trash button — a `glass-card` row with `mb-3 flex items-center gap-3 p-3`.

### 4.5 Components that DO NOT exist yet (redesign opportunities)

The tasking brief lists these as components, but they are currently **inline in pages** — extracting them is the first refactoring step for a redesign:

| Requested component | Current reality |
|---|---|
| `components/ProductCard.tsx` | Inlined in `ProductGrid.tsx` (`<article className="product-card">` block) |
| `components/LanguageToggle.tsx` | Inline `<button>` in `Header.tsx` calling `toggleLanguage()` |
| `components/CheckoutTabs.tsx` | Inline tab buttons + tab panels inside `Checkout.tsx` |
| `components/Footer.tsx` | Inline `<footer>` in `App.tsx` (single line: `BitSooq · بيت سوق — © 2026`) |

---

## 5. i18n / RTL Engine

Full file: `src/i18n/index.ts` (185 lines). Key parts:

### 5.1 Language type & resources

```ts
export type Language = 'en' | 'ar';

const resources = {
  en: { translation: { brand: 'BitSooq', tagline: 'The marketplace of the future', nav: { store: 'Store', dashboard: 'Dashboard', cart: 'Cart', language: 'العربية' }, hero: { badge: '…', title1: 'Sell everywhere.', title2: 'Pay any way.', … }, … } },
  ar: { translation: { brand: 'بيت سوق', … } },
};
```

### 5.2 Key structure (both bundles share identical shape)

```
brand · tagline
nav.{store, dashboard, cart, language}
hero.{badge, title1, title2, subtitle, cta}
search.placeholder
product.{inStock, outOfStock, low, add, stockLeft}      # stockLeft uses {{count}} interpolation
cart.{title, empty, subtotal, checkout, clear, remove}
checkout.{title, method, moyasar, moyasarDesc, crypto, cryptoDesc, payNow,
          connectWallet, verifying, merchantAddress, network, amount,
          betaBadge, copy, copied, sendExact, txHash, verify, status, paid, failed}
dashboard.{title, orders, products, status, total, method, addProduct,
           nameEn, nameAr, descEn, descAr, price, stock, save,
           emptyOrders, emptyProducts, txHash, paymentRef}
status.{PENDING, PROCESSING, PAID, FAILED, CONFIRMED, CANCELLED}
common.{loading, error, retry}
```

Note the deliberate symmetry: `nav.language` shows the *other* language's name ("العربية" in EN, "English" in AR).

### 5.3 Language detection & direction engine

```ts
function initialLanguage(): Language {
  const stored = localStorage.getItem('bitsooq.lang');
  if (stored === 'ar' || stored === 'en') return stored;
  return navigator.language?.startsWith('ar') ? 'ar' : 'en';
}

export function applyDirection(lang: Language) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
  document.documentElement.classList.toggle('font-arabic', lang === 'ar');
  document.documentElement.classList.toggle('font-sans', lang === 'en');
}

i18n.use(initReactI18next).init({
  resources, lng: initialLanguage(), fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDirection(i18n.language as Language);   // applied once at module load

export function toggleLanguage() {
  const next: Language = i18n.language === 'ar' ? 'en' : 'ar';
  void i18n.changeLanguage(next);
  localStorage.setItem('bitsooq.lang', next);
  applyDirection(next);
}
```

**Detection order:** `localStorage['bitsooq.lang']` → `navigator.language` (starts with `ar`?) → `'en'`.

### 5.4 RTL strategy — logical CSS properties

The layout never reads the current direction in JS (except for the drawer animation variable). Everything mirrors through CSS logical properties:

| Tailwind class | Logical property | LTR | RTL |
|---|---|---|---|
| `ms-auto`, `ms-2`, `ms-3` | margin-inline-start | left margin | **right** margin |
| `-end-1.5` (badge) | inset-inline-end offset | right corner | **left** corner |
| `text-end` | text-align: end | right | **left** |
| `border-inline-start-width: 1px` (drawer) | — | left edge border | **right** edge border |
| `inset-inline-end: 0` (drawer) | — | docked right | **docked left** |
| `rtl:rotate-180` (Hero arrow) | Tailwind RTL variant | → | ← |

Because of this, **no component has an Arabic variant** — redesign freely using the same logical-property classes.

---

## 6. API Client

Complete file: `src/lib/api.ts` (104 lines). Pasted verbatim in sections below.

### 6.1 The `request<T>()` wrapper

```ts
const BASE: string = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Firebase ID token attached by the auth layer when a session exists.
      ...(sessionStorage.getItem('bitsooq.token')
        ? { Authorization: `Bearer ${sessionStorage.getItem('bitsooq.token')}` }
        : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ApiError(response.status, body || `Request failed: ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
```

Behavior: base-URL prefix (empty in prod = same-origin) · JSON content type · optional Bearer token · throws typed `ApiError` with HTTP status · 204 → undefined.

### 6.2 Exposed functions (signatures + contracts)

| Function | Method & path | Request | Response |
|---|---|---|---|
| `getProducts()` | GET `/api/products` | — | `Product[]` |
| `getCategories()` | GET `/api/categories` | — | `Category[]` |
| `getOrders()` | GET `/api/orders` | — | `Order[]` |
| `getOrder(id)` | GET `/api/orders/{id}` | — | `Order` |
| `createOrder(items)` | POST `/api/orders` | `{ items: Record<string, number> }` (sku→qty) | `Order` |
| `adminCreateProduct(p)` | POST `/api/admin/products` | `Partial<Product>` | `Product` (201) |
| `adminUpdateProduct(sku, p)` | PUT `/api/admin/products/{sku}` | `Partial<Product>` | `Product` |
| `initiateMoyasarPayment(body)` | POST `/api/payments/moyasar/initiate` | `MoyasarInitiateRequest` (below) | `Record<string, unknown>` — `source.url` is the hosted-form redirect |
| `verifyCryptoPayment(body)` | POST `/api/payments/crypto/verify` | `CryptoVerifyRequest` (below) | `CryptoVerifyResult` |

Request/response shapes:

```ts
export interface MoyasarInitiateRequest {
  orderId: string;
  amount: number; // halalas / cents
  currency: 'SAR' | 'USD';
  callbackUrl?: string;
  source?: { type: 'creditcard' | 'applepay'; name?: string; number?: string;
             cvc?: string; month?: string; year?: string; token?: string };
}

export interface CryptoVerifyRequest {
  orderId: string;
  txHash: string;      // must match ^0x[0-9a-fA-F]{64}$ on the backend
  network: string;     // e.g. ethereum-sepolia, polygon-amoy
  expectedAmountMinor: number;
}

export interface CryptoVerifyResult {
  status: 'PAID' | 'REJECTED';
  reason: string | null;
  txHash: string;
  network: string;
}
```

---

## 7. State Management

### 7.1 Cart — `CartProvider` (React Context, `src/lib/store.tsx`)

Real implementation, complete:

```tsx
export interface CartLine { sku: string; qty: number; product: Product; }

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotalMinor: number;
  add: (product: Product) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'bitsooq.cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<string, { qty: number; product: Product }>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const lines = Object.values(items);
    return {
      lines: lines.map((l) => ({ ...l, sku: l.product.sku })),
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      subtotalMinor: lines.reduce((sum, line) => sum + line.qty * line.product.priceMinor, 0),
      add: (product) => setItems((prev) => ({ ...prev, [product.sku]: { qty: (prev[product.sku]?.qty ?? 0) + 1, product } })),
      setQty: (sku, qty) => setItems((prev) => {
        if (qty <= 0 || !prev[sku]) { const next = { ...prev }; delete next[sku]; return next; }
        return { ...prev, [sku]: { ...prev[sku], qty } };
      }),
      remove: (sku) => setItems((prev) => { const next = { ...prev }; delete next[sku]; return next; }),
      clear: () => setItems({}),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
```

**Storage format:** `localStorage['bitsooq.cart']` = `{ [sku]: { qty: number, product: Product } }` — the product snapshot is stored so prices/totals render even if the catalog fetch fails.

**Money formatting helper:**

```ts
export function formatMoney(minor: number, currency = 'USD', lang = 'en') {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency }).format(minor / 100);
}
```

All prices travel as **integer minor units** (cents/halalas) — never floats.

### 7.2 Auth state

There is deliberately **no auth context**. The token lives in `sessionStorage['bitsooq.token']` (set by the auth layer / Firebase flow) and is read per-request by the API wrapper. This keeps auth stateless and redesign-safe.

- **Roles:** derived server-side from JWT claims at the gateway (`USER` default; `admin:true → STAFF`; explicit `roles` claim → `SUPER_ADMIN|STAFF|USER`).
- **Admin gating:** the frontend currently does not pre-filter admin UI by role — protected API calls simply fail with `ApiError(403)` if the user lacks STAFF/SUPER_ADMIN. A redesign may add a role gate around `/dashboard` (e.g. decode the JWT `roles` claim client-side), but the backend remains the source of truth.

### 7.3 Persistence keys summary

| Key | Storage | Owner |
|---|---|---|
| `bitsooq.lang` | localStorage | i18n engine |
| `bitsooq.cart` | localStorage | CartProvider |
| `bitsooq.token` | sessionStorage | auth layer |

---

## 8. Data Models (TypeScript Interfaces)

From `src/lib/api.ts` (verbatim):

```ts
export interface Product {
  sku: string;
  name: string;                    // English (canonical)
  nameAr?: string | null;          // Arabic
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  priceMinor: number;              // integer cents/halalas — never floats
  currency: string;                // 'USD' | 'SAR'
  availableStock: number;
  categoryId?: string | null;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameAr?: string | null;
  active: boolean;
}

export interface Order {
  orderId: string;                 // UUID
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CONFIRMED' | 'CANCELLED';
  totalMinor: number;
  currency: string;
  paymentMethod?: 'MOYASAR' | 'CRYPTO_USDT_ETH' | string;
  paymentReferenceId?: string | null;  // Moyasar payment id
  txHash?: string | null;              // on-chain tx hash (crypto only)
}
```

**Additional (from `store.tsx`):**

```ts
export interface CartLine { sku: string; qty: number; product: Product; }
```

**User type (not yet modeled in code):** the current frontend has no `User` interface — user identity is implied by the JWT. For a redesign that needs it:

```ts
// Suggested (matches gateway claim mapping: admin:true→STAFF, roles claim, default USER)
export interface User {
  uid: string;          // Firebase UID
  displayName?: string;
  roles: ('USER' | 'STAFF' | 'SUPER_ADMIN')[];
}
```

---

## 9. Backend API Contract

**Base URL:** `import.meta.env.VITE_API_BASE_URL` — empty in production (same-origin: nginx serves the SPA and reverse-proxies `/api/` to `api-gateway:8080`); in dev, Vite proxies `/api` to `:8080`.

**Auth:** Firebase ID token in the `Authorization: Bearer <token>` header. The gateway validates RS256 against Google's public JWK set and enforces RBAC before proxying.

**Endpoints the frontend consumes:**

| # | Endpoint | Auth | Used by |
|---|---|---|---|
| 1 | `GET /api/products` | public | Storefront, Dashboard |
| 2 | `GET /api/categories` | public | Storefront |
| 3 | `GET /api/orders` | USER | Dashboard |
| 4 | `GET /api/orders/{id}` | USER | (available; status polling) |
| 5 | `POST /api/orders` | USER | Checkout |
| 6 | `POST /api/admin/products` | STAFF+ | Dashboard |
| 7 | `PUT /api/admin/products/{sku}` | STAFF+ | Dashboard |
| 8 | `POST /api/payments/moyasar/initiate` | USER | Checkout tab 1 |
| 9 | `POST /api/payments/crypto/verify` | USER | Checkout tab 2 |

**Error handling:** every non-2xx throws `ApiError(status, bodyOrMessage)`. Pages catch it and render the message in a `message` state line (`text-red-400`), with a retry button on catalog load failures. There is no global error boundary or toast system yet — a redesign may add one.

**CORS:** the gateway allow-lists origins via `security.cors.allowed-origins` (defaults `http://localhost:5173,http://localhost:3000`). Same-origin deployments bypass CORS entirely (recommended).

**Rate limiting note:** authenticated calls are rate-limited per user (20 req/s burst 40, fail-closed) — avoid tight polling loops; status polling should be ≥ 2 s intervals.

---

## 10. Wallet Integration (Crypto)

No external Web3 library is bundled — the code talks to the browser's injected EIP-1193 provider directly (typed in `src/vite-env.d.ts`):

```ts
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
}
```

**Flow (from `pages/Checkout.tsx`):**

```
1. VITE_MERCHANT_WALLET  → shown in UI with copy button (must equal backend CRYPTO_MERCHANT_WALLET)
2. VITE_CRYPTO_NETWORKS  → network <select> (default 'ethereum-sepolia', 'polygon-amoy')
3. connectWalletAndSend():
     accounts = ethereum.request({ method: 'eth_requestAccounts' })
     ethereum.request({ method: 'eth_sendTransaction',
       params: [{ from: accounts[0], to: MERCHANT_WALLET, value: '0x' + totalMinor.toString(16) }] })
4. User pastes the resulting txHash into the input
5. verifyCryptoPayment({ orderId, txHash, network, expectedAmountMinor })
6. Backend re-fetches the receipt via public RPC:
     eth_getTransactionByHash (existence, to, input) + eth_getTransactionReceipt (status==0x1)
     checks recipient == merchant wallet AND value == expectedAmountMinor
7. status === 'PAID' → success panel + cart cleared
   status === 'REJECTED' → result.reason shown (e.g. "Recipient does not match the merchant wallet")
```

**Known demo-mode caveats (flag for redesign/next iteration):**
- The native-transfer demo converts minor units directly to wei (`totalMinor.toString(16)`) — production needs an explicit ETH/USDT price conversion step.
- ERC-20 (USDT) sends are verified backend-side (calldata `0xa9059cbb`) but the UI currently sends native transactions only; a USDT send helper would call the token contract's `transfer` via `eth_sendTransaction` with `data` instead of `value`.
- The wallet popup does not return the txHash directly in this flow — the user pastes it; listening to the provider's `transactionHash` event or using `eth_sendRawTransaction` via a relayer is the production-grade alternative.

**Kill-switch:** backend `CRYPTO_BETA_ENABLED=false` rejects all verifies; the UI reflects beta status with the `.beta-badge` ("v2.0 Beta · Testnet ready").

---

## 11. Responsive Design

Mobile-first (Tailwind default). Breakpoints actually used:

| Breakpoint | Applied to |
|---|---|
| base (mobile) | Product grid 2 cols; nav labels hidden (icon-only); hero `text-4xl` |
| `sm:` (≥640) | Page padding `px-6`; hero `text-6xl`; nav labels visible; product form 2-col; checkout grid 2-col (wallet/verify buttons) |
| `md:` (≥768) | Product grid 3 cols; toolbar row switches to horizontal (`md:flex-row md:items-center`); language chip visible |
| `lg:` (≥1024) | Product grid 4 cols |

Other patterns:
- Everything centers through `mx-auto max-w-7xl px-4 sm:px-6` (storefront/dashboard) or `max-w-3xl/4xl` (checkout).
- Dashboard tables use `overflow-x-auto` + `min-w-[640px]` for mobile horizontal scroll.
- The cart drawer is `w-full max-w-md` — full-width sheet on phones, fixed panel on desktop.
- Header never collapses into a hamburger; it degrades to icon-only buttons (a hamburger nav is a redesign option for deeper nav growth).

---

## 12. Accessibility

Currently implemented:
- **Semantic HTML:** `<header>`, `<nav>`, `<main>`, `<section id="shop">`, `<article>` (product cards), `<aside>` (drawer), `<footer>`, `<form>` with `<label>` wrappers.
- **ARIA:** drawer `role="dialog" aria-modal="true" aria-label`; icon-only buttons carry `aria-label` (close, minus, plus, remove, clear search, toggle language).
- **States on controls:** `disabled` binding on pay/add buttons during busy states and out-of-stock (`disabled={p.availableStock <= 0}`), `aria-label` on qty steppers.
- **Focus-visible:** Tailwind's `.field` has an explicit `focus:border-cyan-neon/60 focus:ring-2 focus:ring-cyan-neon/20`.

Gaps a redesign should close (WCAG AA checklist):
1. **Focus trapping** in the cart drawer (currently scrim-click + no trap; add Tab-cycle trap + Escape-to-close).
2. **Skip-to-content link** at the top of the app.
3. **Contrast audit** — `text-slate-400/500` on `#090D16` passes AA for large text but `text-slate-500` captions are borderline; consider `slate-400` minimum for meaningful text.
4. **Status announcements** — toast/message lines (`role="alert"`) for payment success/failure.
5. **Touch targets** — some `!px-1.5 !py-1` stepper buttons are below the 44×44 px recommendation; enlarge hit areas without changing visuals.
6. **Language toggle** should expose `aria-pressed` or announce the switch via a live region.

---

## 13. Performance

Current state:
- **Vite production build** (`npm run build` = `tsc -b && vite build`): measured output ≈ **254 kB JS / 24 kB CSS** (≈ 80 kB JS gzipped) — small bundle, no heavy deps (no chart/UI kit; icons tree-shaken).
- **No router-level code splitting yet** — all three pages ship in one chunk. First win: `React.lazy(() => import('./pages/Dashboard'))` + `Suspense` (dashboard is admin-only and rarely visited).
- **Fonts:** four families in one request with `display=swap`; consider subsetting to the weights actually used (400/600/700/800 sans, 400/700 arabic) or self-hosting via `@fontsource` to remove the Google Fonts third-party call.
- **Images:** product tiles are currently gradient placeholders (no `<img>`), so there is no image cost — but a redesign adding photos must use `loading="lazy"` + explicit `width/height` (CLS) + a CDN (`?w=850&q=80` style params) and `srcset` for retina.
- **State:** catalog is fetched fresh on each storefront mount; a redesign could add `stale-while-revalidate` caching (e.g. TanStack Query) or at minimum `sessionStorage` memoization.
- **Render:** cart lines and product grid derive from memoized context values (`useMemo` on the cart value object); filters recompute per keystroke — fine at this scale, but virtualize the grid if the catalog exceeds ~200 items.

---

## 14. Redesign Guidelines for Designers

### 14.1 Color — do & don't

**Do:**
- Keep `#090D16` as the canvas; use `#111827`-family panels for elevation.
- Reserve the three neons for **meaning**, not decoration: cyan = primary action/brand, purple = crypto/beta identity, emerald = money/success only.
- Use opacity tints for badges (e.g. `bg-cyan-neon/10 text-cyan-neon border-cyan-neon/30`) — this is the established pattern; keep it.
- Gradient text is a signature (`from-cyan-neon to-purple-neon bg-clip-text`) — reuse it for the brand and one hero line, no more.

**Don't:**
- No light mode in scope — do not introduce white surfaces.
- Don't add new saturated hues (no orange/pink) — the system is 3-accent by design.
- Don't put emerald on non-money elements (it currently signals price/stock/success only).
- Don't stack two glows on one element; at most one `shadow-glow` per view region.

### 14.2 Typography scale

| Role | Classes | EN font | AR font |
|---|---|---|---|
| Display (hero) | `text-4xl sm:text-6xl font-extrabold leading-tight` | Plus Jakarta Sans 800 | Cairo 800 |
| Page title | `text-3xl font-extrabold` | 800 | 800 |
| Card/table header | `text-lg font-bold` | 700 | 700 |
| Product title | `text-sm font-semibold` | 600 | 600 |
| Body | `text-sm text-slate-300` | 400/500 | 400 |
| Caption/label | `text-xs text-slate-400/500` | 400 | 400 |
| Data (money, hash) | `text-sm` (+ `font-mono` for hashes) | tabular-nums | tabular-nums |

Rules: always pair weight 700+ with white (`text-white`); body text never below `text-xs`; Arabic always renders in the `font-arabic` stack (auto-swapped by `<html>` class — never hardcode a font-family per component).

### 14.3 Spacing system

Base-4 scale in use: **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px** (Tailwind `p-1,2,3,4,6,8,12,16`).

- Card padding: `p-3` (dense rows) → `p-4` (product card) → `p-6` (forms/panels).
- Section rhythm: `py-12` standard, `py-14/16` hero, `pb-20` catalog bottom.
- Grid gaps: `gap-2` chips, `gap-4` cards/forms, `gap-3` form fields.
- Page shell: `max-w-7xl px-4 sm:px-6` — do not exceed 7xl for content.

### 14.4 Component states (spec for every interactive element)

| State | Button (neon) | Button (ghost) | Input (field) | Pill |
|---|---|---|---|---|
| Default | cyan→purple gradient, white text | `border-line bg-panel-2/60 text-slate-200` | `bg-panel-2/70 border-line` | `border-line bg-panel-2/60 text-slate-300` |
| Hover | `shadow-glow brightness-110` | `border-cyan-neon/50 text-white` | — | `border-cyan-neon/50 text-white` |
| Active/focus | same + `focus:ring-2 ring-cyan-neon/20` | same | `border-cyan-neon/60 ring-2 ring-cyan-neon/20` | — |
| Disabled | `opacity-50 cursor-not-allowed` | same | same | — |
| Loading | swap label for `<Loader2 className="animate-spin" size={16} />` + disable | — | — | — |

Loading/idle/empty/error exist at page level too: catalog has loading text, retry-on-error card, and a `∅` empty state — design proper illustrations for all three.

### 14.5 RTL mirroring rules (non-negotiable)

1. **Use logical properties only** — `ms-*`/`me-*`/`ps-*`/`pe-*`, `text-start`/`text-end`, `start-*`/`end-*`. Never `ml-*`, `mr-*`, `text-left`, `text-right`, `left-*`, `right-*`.
2. Directional **icons** flip explicitly: add `rtl:rotate-180` to arrows/chevrons (see Hero). Never mirror symmetric icons (plus, search, check).
3. Numbers, money and code (SKU, txHash) stay **LTR inside RTL text**: wrap in `<bdi>` or `dir="ltr"` spans where mixed.
4. Motion mirrors via the `--slide-from` CSS variable pattern (drawer) — any new animation with a direction should do the same.
5. Test every screen in AR immediately after designing EN — if a component needs "an RTL fix", it's using the wrong properties.

### 14.6 Contrast targets (WCAG AA)

| Pair | Current | Ratio | Verdict |
|---|---|---|---|
| `slate-200` on `#090D16` | body text | ~14:1 | ✅ AAA |
| `slate-400` on `#090D16` | secondary text | ~7:1 | ✅ AA |
| `slate-500` on `#090D16` | captions | ~4.6:1 | ✅ AA (borderline — keep ≥ 12px) |
| `cyan-neon` on `#090D16` | accents/links | ~8:1 | ✅ |
| white on `.neon-button` | CTA | ~8:1 (cyan half) | ✅ |
| `emerald-neon` on `#090D16` | prices | ~9:1 | ✅ |

Rule of thumb: any *meaningful* text below `slate-400` brightness fails the spirit of AA — captions may use 500 only for truly decorative metadata.

---

## 15. Redesign Handoff Checklist

### 15.1 Figma file structure

```
📄 BitSooq UI Redesign
├── Page: 🎨 Foundations          → color styles, type styles, effect styles (glow), grid styles
├── Page: 🧩 Components           → auto-layout variants: buttons, fields, pills, badges,
│                                    product card, cart row, table row, drawer, header
├── Page: 🏠 Storefront           → desktop 1440 / tablet 768 / mobile 390, EN + AR frames
├── Page: 💳 Checkout             → order summary, Moyasar tab, Crypto tab, success/failure, EN + AR
├── Page: 📊 Dashboard            → orders table, product form, empty/loading/error states
└── Page: ✨ States & Motion      → drawer slide (LTR + RTL), hover/active/disabled matrices
```

Every frame needs an **AR duplicate** (`dir="rtl"`, Cairo type styles) — treat RTL as a first-class frame, not an afterthought.

### 15.2 Design tokens export (map to `tailwind.config.js`)

Deliver as JSON or a Tailwind preset file with exactly these keys:

```js
{
  colors: { base, panel, panel2, line, cyanNeon, purpleNeon, emeraldNeon,
            text: { primary: slate200, secondary: slate400, muted: slate500,
                    danger: red400, warning: amber400 } },
  fontFamily: { sans: ['Plus Jakarta Sans','Inter'], arabic: ['Cairo','Tajawal'] },
  radius: { control: '0.75rem' /* xl */, card: '1rem' /* 2xl */, chip: '9999px' },
  shadow: { glow: '0 0 24px -6px rgba(6,182,212,0.45)',
            glowPurple: '0 0 24px -6px rgba(139,92,246,0.45)' },
  blur: { glass: '14px' },
  spacing: [4, 8, 12, 16, 24, 32, 48, 64],
}
```

### 15.3 Icons

- Current set: **lucide-react** — `Languages, ShoppingCart, LayoutDashboard, Sparkles, ArrowRight, Plus, Search, X, Minus, Trash2, ShoppingBag, CreditCard, Wallet, Copy, Check, ShieldCheck, Loader2, QrCode`.
- Keep lucide for consistency (tree-shakeable, `size={n}` prop, stroke-based fits the neon aesthetic). If replacing with custom SVGs: match 24×24 viewBox, 2px stroke, `currentColor`, and keep the same names so imports don't change.

### 15.4 Fonts (keep these exact links in `index.html`)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />
```

### 15.5 Assets to deliver

| Asset | Spec | Notes |
|---|---|---|
| Logo (wordmark) | SVG, gradient "Sooq", both EN + AR lockup | Header uses inline text today; supply real SVG |
| Hero banner art | Optional illustration/webp, ≤ 200 kB, 2× (1600w) | Current hero is pure CSS glow — keep or upgrade |
| Product imagery | 850w & 480w webp per product, 4:3 | Tiles are placeholders today; needs `loading="lazy"` |
| Empty states | 3 illustrations (no products / error / empty cart) | SVG, single-color + one accent |
| Favicon | 32/180/512 ICO+PNG | `index.html` has none currently |
| Social preview | 1200×630 og-image | Not present |

### 15.6 Implementation contract (what must NOT break)

The redesign may restyle anything, but must preserve:
1. **Routes:** `/`, `/checkout`, `/dashboard` (+ `/cart` currently aliased to Checkout).
2. **API calls & payloads** exactly as in §6 — the backend contract is fixed.
3. **localStorage keys:** `bitsooq.lang`, `bitsooq.cart`; **sessionStorage:** `bitsooq.token`.
4. **i18n keys** from §5.2 (adding keys is fine; renaming breaks `t()` calls).
5. **The `<html dir>` engine** — direction switching is app-level, not per-component.
6. **Minor-unit money rule** — `priceMinor/totalMinor` are integers; formatting only via `formatMoney`.
7. **Docker/nginx:** build output must stay at `dist/` (the Dockerfile copies `dist/` → nginx html root).

---

*Extracted from the actual source of `bitsooq-ui/` on 2026-11-13. Pair with `PROJECT_MASTER_DOC.md` (repo root) for backend/architecture context.*
