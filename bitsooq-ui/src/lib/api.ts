import { getFirebaseAccessToken } from './auth';

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
  const token = await getFirebaseAccessToken();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Firebase ID token attached by the auth layer when a session exists.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  version?: number;
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

export interface AdminAnalytics {
  totalOrders: number;
  pendingOrders: number;
  reservedOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  confirmedRevenueMinor: number;
  currency: string;
  daily?: Array<{ date: string; orders: number; confirmedRevenueMinor: number }>;
  statuses?: Array<{ status: string; count: number }>;
  payments?: Array<{ method: string; paymentStatus: string; orders: number; amountMinor: number }>;
}

export interface AdminUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  disabled: boolean;
  roles: string[];
}

export interface Seller {
  id: string;
  ownerUserId: string;
  displayName: string;
  legalName?: string | null;
  slug: string;
  email?: string | null;
  phone?: string | null;
  countryCode: string;
  taxRegistrationNumber?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  version: number;
  createdAt: string;
  updatedAt: string;
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
export const getAdminProducts = (after = '') => request<Product[]>(`/api/admin/products?size=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);

// ---- Orders ----
export const getOrders = (after?: string) => request<OrderPage>(`/api/orders?size=20${after ? `&after=${encodeURIComponent(after)}` : ''}`);
export const getAdminOrders = (after?: string, status?: string) => request<OrderPage>(`/api/admin/orders?size=20${after ? `&after=${encodeURIComponent(after)}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`);
export interface AdminOrderDetail extends OrderSummary {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentReferenceId?: string | null;
  subtotalMinor?: number | null;
  shippingMinor?: number | null;
  shippingMethodCode?: string | null;
  shippingAddress?: ShippingAddress | null;
  shipment?: Shipment | null;
  items: Array<{ sku: string; quantity: number }>;
}
export interface ShipmentUpdate {
  status: string;
  carrierCode?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  description?: string;
  location?: string;
}
export const getAdminOrder = (id: string) => request<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(id)}`);
export const updateAdminShipment = (id: string, update: ShipmentUpdate) => request<void>(`/api/admin/shipments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(update) });
export const getAdminAnalytics = () => request<AdminAnalytics>('/api/admin/analytics/orders');
export const getAdminUsers = (cursor?: string) => request<{ users: AdminUser[]; nextCursor: string | null }>(`/api/admin/users?size=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const updateAdminUserRoles = (uid: string, roles: string[]) => request<{ uid: string; roles: string[] }>(`/api/admin/users/${encodeURIComponent(uid)}/roles`, { method: 'PUT', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ roles }) });
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
export const createAdminCategory = (category: Pick<Category, 'id' | 'name'>) => request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(category) });
export const createDeliveryZone = (zone: Omit<DeliveryZone, 'id'|'active'>) => request<DeliveryZone>('/api/admin/delivery/zones', { method: 'POST', body: JSON.stringify(zone) });
export const createDeliveryRate = (zoneId: string, rate: Pick<DeliveryRate, 'methodCode'|'methodName'|'feeMinor'|'currency'|'minDeliveryDays'|'maxDeliveryDays'|'supportsCod'>) =>
  request<DeliveryRate>(`/api/admin/delivery/zones/${encodeURIComponent(zoneId)}/rates`, { method: 'POST', body: JSON.stringify(rate) });
export const setDeliveryZoneActive = (id: string, active: boolean) => request<DeliveryZone>(`/api/admin/delivery/zones/${encodeURIComponent(id)}/active`, { method: 'PATCH', body: JSON.stringify({ active }) });
export const setDeliveryRateActive = (id: string, active: boolean) => request<DeliveryRate>(`/api/admin/delivery/rates/${encodeURIComponent(id)}/active`, { method: 'PATCH', body: JSON.stringify({ active }) });
export const getAdminSellers = () => request<Seller[]>('/api/admin/sellers?size=100');
export const createAdminSeller = (seller: Omit<Seller, 'id' | 'status' | 'version' | 'createdAt' | 'updatedAt'>) => request<Seller>('/api/admin/sellers', { method: 'POST', body: JSON.stringify(seller) });
export const setAdminSellerStatus = (seller: Seller, status: Seller['status']) => request<Seller>(`/api/admin/sellers/${encodeURIComponent(seller.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status, expectedStatus: seller.status, expectedVersion: seller.version }) });

// ---- Admin catalog ----
export const adminCreateProduct = (product: Partial<Product>) =>
  request<Product>('/api/products', { method: 'POST', body: JSON.stringify({ sku: product.sku, name: product.name, nameAr: product.nameAr, descriptionEn: product.descriptionEn, descriptionAr: product.descriptionAr, priceMinor: product.priceMinor, currency: product.currency ?? 'USD', stock: product.availableStock ?? 0, categoryId: product.categoryId }) });
export const adminUpdateProduct = (sku: string, product: Partial<Product>) =>
  request<Product>(`/api/products/${encodeURIComponent(sku)}`, { method: 'PUT', body: JSON.stringify({ name: product.name, nameAr: product.nameAr, descriptionEn: product.descriptionEn, descriptionAr: product.descriptionAr, priceMinor: product.priceMinor, currency: product.currency ?? 'USD', categoryId: product.categoryId || null, expectedVersion: product.version ?? 0 }) });
export const archiveAdminProduct = (product: Product) => request<void>(`/api/products/${encodeURIComponent(product.sku)}?expectedVersion=${product.version ?? 0}`, { method: 'DELETE' });
export const adjustAdminStock = (product: Product, delta: number, reason: string) => request<Product>(`/api/products/${encodeURIComponent(product.sku)}/stock`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ delta, expectedVersion: product.version ?? 0, reason }) });

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
