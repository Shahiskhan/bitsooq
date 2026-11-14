/**
 * API client. All requests go through the API Gateway, which handles JWT
 * validation, rate limiting and routing to the backing microservices.
 */
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

export interface Product {
  sku: string;
  name: string;
  nameAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  priceMinor: number;
  currency: string;
  availableStock: number;
  categoryId?: string | null;
  active: boolean;
  slug?: string;
  brandName?: string;
  sellerName?: string;
  imageUrl?: string;
  compareAtMinor?: number;
  ratingAverage?: number;
  reviewCount?: number;
  badge?: string;
  demoOnly?: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameAr?: string | null;
  active: boolean;
  imageUrl?: string;
}

export interface Order {
  orderId: string;
  status: 'PENDING' | 'RESERVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CONFIRMED' | 'CANCELLED';
  totalMinor: number | null;
  currency: string | null;
  paymentMethod?: 'MOYASAR' | 'CRYPTO_USDT_ETH' | 'CASH_ON_DELIVERY' | string;
  paymentReferenceId?: string | null;
  txHash?: string | null;
  subtotalMinor?: number | null;
  shippingMinor?: number | null;
  paymentStatus?: string | null;
  shippingMethodCode?: string | null;
  shippingAddress?: ShippingAddress | null;
  shipment?: Shipment | null;
}

export interface OrderSummary {
  orderId: string;
  userId: string;
  status: Order['status'];
  totalMinor: number | null;
  currency: string | null;
  createdAt: string;
}

export interface OrderPage {
  items: OrderSummary[];
  nextCursor: string | null;
}

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  area?: string | null;
  city: string;
  regionCode: string;
  postalCode?: string | null;
  countryCode: string;
  deliveryInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
}

export interface SavedAddress extends ShippingAddress {
  id: string;
  addressLabel: string;
  defaultShipping: boolean;
  defaultBilling: boolean;
  version: number;
}

export interface DeliveryOption {
  id: string;
  zoneCode: string;
  methodCode: string;
  methodName: string;
  feeMinor: number;
  currency: string;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  supportsCod: boolean;
}

export interface DeliveryZone {
  id: string;
  zoneCode: string;
  countryCode: string;
  regionCode: string;
  city: string;
  area?: string | null;
  postalPrefix?: string | null;
  priority: number;
  active: boolean;
}

export interface DeliveryRate extends DeliveryOption {
  zoneId: string;
  active: boolean;
}

export interface Shipment {
  id: string;
  status: string;
  carrierCode?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  events?: ShipmentEvent[];
}

export interface ShipmentEvent {
  eventCode: string;
  description?: string | null;
  location?: string | null;
  occurredAt: string;
}

export interface MoyasarInitiateRequest {
  orderId: string;
  amountHalalas: number;
  currency: 'SAR' | 'USD';
  callbackUrl: string;
  source: 'creditcard' | 'mada' | 'applepay';
  idempotencyKey: string;
}

export interface MoyasarIntent {
  orderId: string;
  paymentId: string;
  status: string;
  redirectUrl?: string | null;
  provider?: Record<string, unknown>;
}

// ---- Catalog (public) ----
export const getProducts = () => request<Product[]>('/api/products');
export const getCategories = () => request<Category[]>('/api/categories');

// ---- Orders ----
export const getOrders = (after?: string) => request<OrderPage>(`/api/orders?size=20${after ? `&after=${encodeURIComponent(after)}` : ''}`);
export const getOrder = (id: string) => request<Order>(`/api/orders/${id}`);
export const createOrder = (items: Record<string, number>, shippingAddress?: ShippingAddress, deliveryRateId?: string, paymentMethod = 'MOYASAR', idempotencyKey = crypto.randomUUID()) =>
  request<Order>('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({
    items: Object.entries(items).map(([sku, quantity]) => ({ sku, quantity })),
    shippingAddress, deliveryRateId, paymentMethod,
  }) });

export const getDeliveryOptions = (destination: Pick<ShippingAddress,'countryCode'|'regionCode'|'city'|'area'|'postalCode'>, currency: string) =>
  request<DeliveryOption[]>(`/api/delivery/options?currency=${encodeURIComponent(currency)}`, { method: 'POST', body: JSON.stringify(destination) });
export const getSavedAddresses = () => request<SavedAddress[]>('/api/users/me/addresses');
export type SavedAddressInput = Omit<SavedAddress, 'id'|'version'>;
export const saveAddress = (address: Omit<SavedAddress,'id'|'version'>) =>
  request<SavedAddress>('/api/users/me/addresses', { method: 'POST', body: JSON.stringify(address) });
export const updateAddress = (id: string, address: SavedAddressInput, expectedVersion: number) =>
  request<SavedAddress>(`/api/users/me/addresses/${encodeURIComponent(id)}?expectedVersion=${expectedVersion}`, { method: 'PUT', body: JSON.stringify(address) });
export const archiveAddress = (id: string, expectedVersion: number) =>
  request<void>(`/api/users/me/addresses/${encodeURIComponent(id)}?expectedVersion=${expectedVersion}`, { method: 'DELETE' });
export const getDeliveryZones = () => request<DeliveryZone[]>('/api/admin/delivery/zones');
export const getDeliveryRates = () => request<DeliveryRate[]>('/api/admin/delivery/rates');
export const createDeliveryZone = (zone: Omit<DeliveryZone, 'id'|'active'>) => request<DeliveryZone>('/api/admin/delivery/zones', { method: 'POST', body: JSON.stringify(zone) });
export const createDeliveryRate = (zoneId: string, rate: Pick<DeliveryRate, 'methodCode'|'methodName'|'feeMinor'|'currency'|'minDeliveryDays'|'maxDeliveryDays'|'supportsCod'>) =>
  request<DeliveryRate>(`/api/admin/delivery/zones/${encodeURIComponent(zoneId)}/rates`, { method: 'POST', body: JSON.stringify(rate) });
export const setDeliveryZoneActive = (id: string, active: boolean) => request<DeliveryZone>(`/api/admin/delivery/zones/${encodeURIComponent(id)}/active`, { method: 'PATCH', body: JSON.stringify({ active }) });
export const setDeliveryRateActive = (id: string, active: boolean) => request<DeliveryRate>(`/api/admin/delivery/rates/${encodeURIComponent(id)}/active`, { method: 'PATCH', body: JSON.stringify({ active }) });

// ---- Admin catalog ----
export const adminCreateProduct = (product: Partial<Product>) =>
  request<Product>('/api/admin/products', { method: 'POST', body: JSON.stringify(product) });
export const adminUpdateProduct = (sku: string, product: Partial<Product>) =>
  request<Product>(`/api/admin/products/${sku}`, { method: 'PUT', body: JSON.stringify(product) });

// ---- Moyasar payments ----
export const initiateMoyasarPayment = (body: MoyasarInitiateRequest) =>
  request<MoyasarIntent>('/api/payments/moyasar/initiate', { method: 'POST', body: JSON.stringify(body) });

// ---- Crypto payments ----
export interface CryptoVerifyRequest {
  orderId: string;
  txHash: string;
  network: string;
  expectedAmountMinor: number;
}
export interface CryptoVerifyResult {
  status: 'PAID' | 'REJECTED';
  reason: string | null;
  txHash: string;
  network: string;
}
export const verifyCryptoPayment = (body: CryptoVerifyRequest) =>
  request<CryptoVerifyResult>('/api/payments/crypto/verify', { method: 'POST', body: JSON.stringify(body) });
