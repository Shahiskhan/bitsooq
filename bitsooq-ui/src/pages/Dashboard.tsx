import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, ArrowRight, BadgeCheck, Boxes, Building2,
  CircleDollarSign, Clock3, CreditCard, ExternalLink, LayoutDashboard, LogOut,
  Loader2, MapPin, Menu, Package, PackageCheck, Plus, RefreshCw, Search, Settings2,
  ShieldCheck, ShoppingBag, ShoppingCart, Store, Truck, UserRound, Users, Wallet, X,
} from 'lucide-react';
import {
  adjustAdminStock, adminCreateProduct, adminUpdateProduct, archiveAdminProduct,
  createAdminCategory, createAdminSeller, createDeliveryRate, createDeliveryZone,
  getAdminAnalytics, getAdminOrder, getAdminOrders, getAdminProducts, getAdminSellers, getAdminUsers,
  getCategories, getDeliveryRates, getDeliveryZones, setAdminSellerStatus,
  setDeliveryRateActive, setDeliveryZoneActive, updateAdminShipment, updateAdminUserRoles,
  type AdminAnalytics, type AdminOrderDetail, type AdminUser, type Category, type DeliveryRate,
  type DeliveryZone, type OrderSummary, type Product, type Seller,
} from '../lib/api';
import { formatMoney } from '../lib/store';
import { productImages } from '../mock/products';
import StatusBadge from '../components/StatusBadge';
import { seedCategories, seedProducts } from '../mock/products';
import { signOut } from '../lib/auth';

type Section = 'overview' | 'orders' | 'products' | 'stores' | 'delivery' | 'payments' | 'customers' | 'team';
type NavItem = { id: Section; label: string; icon: typeof LayoutDashboard; superAdmin?: boolean };
type ResultState = 'idle' | 'loading' | 'ready' | 'error';
const shipmentTransitions: Record<string, string[]> = {
  PENDING: ['LABEL_CREATED', 'READY', 'CANCELLED'], LABEL_CREATED: ['READY', 'CANCELLED'], READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'], OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'RETURNED'], FAILED: ['READY', 'RETURNED'],
};
const roleOptions = [
  { value: 'STAFF', label: 'Staff · full operations' },
  { value: 'PRODUCT_MANAGER', label: 'Product manager' },
  { value: 'STORE_MANAGER', label: 'Store manager' },
  { value: 'FULFILLMENT_MANAGER', label: 'Fulfillment manager' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
] as const;

function tokenClaims() {
  try {
    const token = sessionStorage.getItem('bitsooq.token');
    const payload = token?.split('.')[1];
    if (!payload) return {} as Record<string, unknown>;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as Record<string, unknown>;
  } catch { return {} as Record<string, unknown>; }
}

function claimRoles(claims: Record<string, unknown>) {
  const values = [claims.roles, claims.role, claims.authorities].flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
  const roles = values.map((value) => String(value).replace(/^ROLE_/, '').toUpperCase()).map((role) => role === 'ADMIN' ? 'STAFF' : role);
  if (claims.admin === true) roles.push('STAFF');
  return [...new Set(roles)];
}

const initialProduct = (): Product => ({ sku: '', name: '', nameAr: '', descriptionEn: '', descriptionAr: '', priceMinor: 0, currency: 'USD', availableStock: 0, categoryId: '', active: true });
const initialSeller = () => ({ ownerUserId: '', displayName: '', legalName: '', slug: '', email: '', phone: '', countryCode: 'PK', taxRegistrationNumber: '' });

function money(value?: number | null, currency = 'USD', language = 'en') {
  return formatMoney(value ?? 0, currency, language);
}

function SectionHeading({ eyebrow, title, detail, actions }: { eyebrow: string; title: string; detail: string; actions?: ReactNode }) {
  return <div className="ops-heading"><div><p className="section-eyebrow"><span />{eyebrow}</p><h1>{title}</h1><p>{detail}</p></div>{actions && <div className="ops-heading-actions">{actions}</div>}</div>;
}

function MetricCard({ label, value, hint, icon: Icon, tone = 'cyan' }: { label: string; value: string | number; hint: string; icon: typeof Boxes; tone?: string }) {
  return <article className={`ops-metric ops-tone-${tone}`}><div className="ops-metric-top"><span>{label}</span><i><Icon size={18} /></i></div><strong>{value}</strong><small>{hint}</small></article>;
}

function EmptyState({ icon: Icon = Package, title, detail }: { icon?: typeof Package; title: string; detail: string }) {
  return <div className="ops-empty"><Icon size={25} /><b>{title}</b><span>{detail}</span></div>;
}

export default function Dashboard() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const arabic = i18n.language === 'ar';
  const t = (en: string, ar = en) => arabic ? ar : en;
  const claims = useMemo(tokenClaims, []);
  const demo = import.meta.env.VITE_USE_MOCK === 'true';
  const roles = useMemo(() => demo ? ['SUPER_ADMIN'] : claimRoles(claims), [claims, demo]);
  const isSuper = roles.includes('SUPER_ADMIN');
  const isStaff = roles.includes('STAFF') || isSuper;
  const canCatalog = isStaff || roles.includes('PRODUCT_MANAGER');
  const canManageStores = isStaff || roles.includes('STORE_MANAGER');
  const canFulfill = isStaff || roles.includes('FULFILLMENT_MANAGER');
  const displayName = String(claims.name ?? claims.email ?? (isSuper ? 'Super Admin' : 'Operations team'));
  const roleLabel = isSuper ? 'SUPER ADMIN' : isStaff ? 'STAFF' : roles.includes('PRODUCT_MANAGER') ? 'PRODUCT MANAGER' : roles.includes('STORE_MANAGER') ? 'STORE MANAGER' : 'FULFILLMENT MANAGER';
  const actorUid = String(claims.sub ?? claims.uid ?? claims.user_id ?? '');
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [state, setState] = useState<ResultState>('loading');
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextProductAfter, setNextProductAfter] = useState<string | null>(null);
  const [nextUserCursor, setNextUserCursor] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [rates, setRates] = useState<DeliveryRate[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [orderStatus, setOrderStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [shipmentForm, setShipmentForm] = useState({ status: 'PENDING', carrierCode: '', trackingNumber: '', trackingUrl: '', description: '', location: '' });
  const [productModal, setProductModal] = useState(false);
  const [productForm, setProductForm] = useState<Product>(initialProduct());
  const [sellerModal, setSellerModal] = useState(false);
  const [sellerForm, setSellerForm] = useState(initialSeller());
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '' });
  const [productSearch, setProductSearch] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [zoneForm, setZoneForm] = useState({ zoneCode: 'PK-LHR', countryCode: 'PK', regionCode: 'Punjab', city: 'Lahore', area: '', postalPrefix: '', priority: 0 });
  const [rateForm, setRateForm] = useState({ methodCode: 'STANDARD', methodName: 'Standard delivery', feeMinor: 500, minDeliveryDays: 3, maxDeliveryDays: 5, supportsCod: true });
  const [selectedZone, setSelectedZone] = useState('');

  const navItems: NavItem[] = [
    { id: 'overview', label: t('Overview', 'نظرة عامة'), icon: LayoutDashboard },
    { id: 'orders', label: t('Orders & fulfillment', 'الطلبات والتوصيل'), icon: ShoppingCart },
    { id: 'products', label: t('Products & catalog', 'المنتجات والكتالوج'), icon: Boxes },
    { id: 'stores', label: t('Mini stores', 'المتاجر المصغرة'), icon: Store },
    { id: 'delivery', label: t('Delivery setup', 'إعداد التوصيل'), icon: Truck },
    { id: 'payments', label: t('Analytics & payments', 'التحليلات والمدفوعات'), icon: Wallet, superAdmin: true },
    { id: 'customers', label: t('Customers', 'العملاء'), icon: UserRound, superAdmin: true },
    { id: 'team', label: t('Team & access', 'الفريق والصلاحيات'), icon: ShieldCheck, superAdmin: true },
  ];
  const visibleNav = navItems.filter((item) => {
    if (item.superAdmin) return isSuper;
    if (item.id === 'orders' || item.id === 'delivery') return canFulfill;
    if (item.id === 'products') return canCatalog;
    if (item.id === 'stores') return canManageStores;
    return true;
  });
  const currentPath = location.pathname.replace(/\/$/, '') || '/admin';
  const current = (visibleNav.find((item) => currentPath.endsWith(`/${item.id}`))?.id ?? 'overview') as Section;

  async function loadWorkspace() {
    setState('loading'); setError('');
    if (demo) {
      const today = new Date();
      setProducts(seedProducts.map((product, index) => ({ ...product, version: 1, availableStock: index === 2 ? 3 : index === 5 ? 0 : product.availableStock })));
      setCategories(seedCategories);
      setOrders([
        { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d111', userId: 'customer_amina_01', status: 'PENDING', totalMinor: 798000, currency: 'PKR', createdAt: new Date(today.getTime() - 1000 * 60 * 13).toISOString() },
        { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d112', userId: 'customer_omar_02', status: 'CONFIRMED', totalMinor: 1249000, currency: 'PKR', createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 2).toISOString() },
        { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d113', userId: 'customer_sana_03', status: 'RESERVED', totalMinor: 519000, currency: 'PKR', createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 7).toISOString() },
        { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d114', userId: 'customer_ali_04', status: 'CONFIRMED', totalMinor: 329000, currency: 'PKR', createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 19).toISOString() },
        { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d115', userId: 'customer_hira_05', status: 'CANCELLED', totalMinor: 229000, currency: 'PKR', createdAt: new Date(today.getTime() - 1000 * 60 * 60 * 27).toISOString() },
      ]);
      setNextCursor(null);
      setNextProductAfter(null); setNextUserCursor(null);
      setAnalytics({ totalOrders: 284, pendingOrders: 18, reservedOrders: 12, confirmedOrders: 231, cancelledOrders: 23, confirmedRevenueMinor: 428650000, currency: 'PKR', daily: Array.from({ length: 14 }, (_, index) => ({ date: new Date(today.getTime() - (13 - index) * 86400000).toISOString().slice(0, 10), orders: [8, 13, 11, 17, 15, 21, 19, 24, 17, 28, 26, 31, 29, 36][index], confirmedRevenueMinor: [9200000, 15800000, 13100000, 18400000, 17200000, 23100000, 20900000, 26600000, 19100000, 30800000, 29400000, 33700000, 31900000, 38600000][index] })), statuses: [{ status: 'PENDING', count: 18 }, { status: 'RESERVED', count: 12 }, { status: 'CONFIRMED', count: 231 }, { status: 'CANCELLED', count: 23 }], payments: [{ method: 'MOYASAR', paymentStatus: 'PAID', orders: 145, amountMinor: 271500000 }, { method: 'CASH_ON_DELIVERY', paymentStatus: 'COD_DUE', orders: 89, amountMinor: 133000000 }, { method: 'CRYPTO_USDT_ETH', paymentStatus: 'PAID', orders: 50, amountMinor: 24150000 }] });
      setSellers([
        { id: 'e2ff2d3e-3a65-4ce3-86dd-d27283f4d111', ownerUserId: 'seller_user_amina', displayName: 'Amina Home Studio', legalName: 'Amina Home Goods (Pvt) Ltd', slug: 'amina-home-studio', email: 'hello@aminahome.pk', phone: '+92 300 1234567', countryCode: 'PK', status: 'ACTIVE', version: 2, createdAt: today.toISOString(), updatedAt: today.toISOString() },
        { id: 'e2ff2d3e-3a65-4ce3-86dd-d27283f4d112', ownerUserId: 'seller_user_omar', displayName: 'Northstar Tech', slug: 'northstar-tech', email: 'team@northstar.pk', countryCode: 'PK', status: 'PENDING', version: 0, createdAt: today.toISOString(), updatedAt: today.toISOString() },
        { id: 'e2ff2d3e-3a65-4ce3-86dd-d27283f4d113', ownerUserId: 'seller_user_sana', displayName: 'Sana Pantry', slug: 'sana-pantry', email: 'orders@sanapantry.pk', countryCode: 'PK', status: 'SUSPENDED', version: 1, createdAt: today.toISOString(), updatedAt: today.toISOString() },
      ]);
      setZones([{ id: 'd4b82d3e-3a65-4ce3-86dd-d27283f4d111', zoneCode: 'PK-KHI', countryCode: 'PK', regionCode: 'Sindh', city: 'Karachi', priority: 10, active: true }, { id: 'd4b82d3e-3a65-4ce3-86dd-d27283f4d112', zoneCode: 'PK-LHR', countryCode: 'PK', regionCode: 'Punjab', city: 'Lahore', priority: 8, active: true }]);
      setRates([{ id: 'a5aa2d3e-3a65-4ce3-86dd-d27283f4d111', zoneId: 'd4b82d3e-3a65-4ce3-86dd-d27283f4d111', zoneCode: 'PK-KHI', methodCode: 'STANDARD', methodName: 'Standard delivery', feeMinor: 25000, currency: 'PKR', minDeliveryDays: 2, maxDeliveryDays: 4, supportsCod: true, active: true }, { id: 'a5aa2d3e-3a65-4ce3-86dd-d27283f4d112', zoneId: 'd4b82d3e-3a65-4ce3-86dd-d27283f4d112', zoneCode: 'PK-LHR', methodCode: 'EXPRESS', methodName: 'Express delivery', feeMinor: 45000, currency: 'PKR', minDeliveryDays: 1, maxDeliveryDays: 2, supportsCod: false, active: true }]);
      setUsers([{ uid: 'admin_demo_01', email: 'sara@bitsooq.pk', displayName: 'Sara Khan', disabled: false, roles: ['USER', 'STAFF'] }, { uid: 'owner_demo_01', email: 'hello@aminahome.pk', displayName: 'Amina Tariq', disabled: false, roles: ['USER'] }, { uid: 'owner_demo_02', email: 'team@northstar.pk', displayName: 'Omar Shah', disabled: false, roles: ['USER'] }, { uid: 'customer_demo_01', email: 'sana@example.pk', displayName: 'Sana Ali', disabled: false, roles: ['USER'] }]);
      setState('ready');
      return;
    }
    const loaders: Array<Promise<unknown>> = [];
    if (canFulfill) loaders.push(getAdminOrders().then((page) => { setOrders(page.items); setNextCursor(page.nextCursor); }));
    if (canCatalog) loaders.push(getAdminProducts().then((items) => { setProducts(items); setNextProductAfter(items.length === 100 ? items.at(-1)?.sku ?? null : null); }));
    if (canCatalog) loaders.push(getCategories().then(setCategories));
    if (canFulfill) loaders.push(getDeliveryZones().then((zoneList) => { setZones(zoneList); setSelectedZone((value) => value || zoneList[0]?.id || ''); }));
    if (canFulfill) loaders.push(getDeliveryRates().then(setRates));
    if (canManageStores) loaders.push(getAdminSellers().then(setSellers));
    const basic = await Promise.allSettled(loaders);
    if (isSuper) {
      const [stats, directory] = await Promise.allSettled([getAdminAnalytics(), getAdminUsers()]);
      if (stats.status === 'fulfilled') setAnalytics(stats.value);
      if (directory.status === 'fulfilled') { setUsers(directory.value.users); setNextUserCursor(directory.value.nextCursor); }
    }
    const coreFailure = basic.length > 0 && basic.every((result) => result.status === 'rejected');
    if (coreFailure) { setState('error'); setError(t('Could not load admin data. Check your staff account and API connection, then retry.', 'تعذر تحميل بيانات الإدارة. تحقق من صلاحية الموظف والاتصال ثم أعد المحاولة.')); }
    else setState('ready');
  }

  useEffect(() => { void loadWorkspace(); }, [isSuper, canCatalog, canManageStores, canFulfill]);

  const pendingOrders = analytics?.pendingOrders ?? orders.filter((order) => order.status === 'PENDING').length;
  const lowStock = products.filter((product) => product.availableStock > 0 && product.availableStock <= 5).length;
  const outOfStock = products.filter((product) => product.availableStock <= 0).length;
  const activeZones = zones.filter((zone) => zone.active).length;
  const activeStores = sellers.filter((seller) => seller.status === 'ACTIVE').length;
  const dailyMetrics = analytics?.daily ?? [];
  const maxDailyRevenue = Math.max(1, ...dailyMetrics.map((day) => day.confirmedRevenueMinor));
  const totalStatusCount = Math.max(1, ...[(analytics?.statuses ?? []).reduce((sum, row) => sum + row.count, 0)]);
  const searchableProducts = products.filter((product) => `${product.name} ${product.sku} ${product.categoryId ?? ''}`.toLowerCase().includes(productSearch.toLowerCase()));
  const searchableSellers = sellers.filter((seller) => `${seller.displayName} ${seller.slug} ${seller.email ?? ''}`.toLowerCase().includes(sellerSearch.toLowerCase()));
  const searchableUsers = users.filter((user) => `${user.displayName ?? ''} ${user.email ?? ''} ${user.uid} ${user.roles.join(' ')}`.toLowerCase().includes(teamSearch.toLowerCase()));

  function go(section: Section) { navigate(section === 'overview' ? '/admin' : `/admin/${section}`); setMobileNav(false); setNotice(''); }
  function editProduct(product: Product) { setProductForm({ ...product, categoryId: product.categoryId ?? '' }); setProductModal(true); }
  async function saveProduct(event: FormEvent) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to save catalog changes.')); return; }
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const existing = products.find((product) => product.sku === productForm.sku);
      let saved = existing
        ? await adminUpdateProduct(existing.sku, productForm)
        : await adminCreateProduct({ ...productForm, active: true });
      if (existing && productForm.availableStock !== existing.availableStock) {
        const delta = productForm.availableStock - existing.availableStock;
        if (delta !== 0) saved = await adjustAdminStock(saved, delta, 'Catalog admin stock adjustment');
      }
      setProductModal(false); await loadWorkspace(); setNotice(t('Product saved. Inventory changes were recorded.', 'تم حفظ المنتج وتسجيل تغييرات المخزون.'));
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not save product.')); }
    finally { setBusy(false); }
  }
  async function archiveProduct(product: Product) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to archive listings.')); return; }
    if (!window.confirm(t(`Archive ${product.name}? It will stop appearing in the storefront.`, `أرشفة ${product.name}؟`))) return;
    setBusy(true); setNotice('');
    try { await archiveAdminProduct(product); setProducts((items) => items.filter((item) => item.sku !== product.sku)); setNotice(t('Product archived.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not archive product.')); }
    finally { setBusy(false); }
  }
  async function saveCategory(event: FormEvent) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to manage categories.')); return; }
    event.preventDefault(); setBusy(true); setNotice('');
    try { const category = await createAdminCategory({ id: categoryForm.id.toUpperCase(), name: categoryForm.name }); setCategories((items) => [...items, category]); setCategoryForm({ id: '', name: '' }); setNotice(t('Category created.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not create category.')); }
    finally { setBusy(false); }
  }
  async function saveSeller(event: FormEvent) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to save store applications.')); return; }
    event.preventDefault(); setBusy(true); setNotice('');
    try { const seller = await createAdminSeller({ ...sellerForm, legalName: sellerForm.legalName || null, email: sellerForm.email || null, phone: sellerForm.phone || null, taxRegistrationNumber: sellerForm.taxRegistrationNumber || null }); setSellers((items) => [seller, ...items]); setSellerModal(false); setSellerForm(initialSeller()); setNotice(t('Store application created. It starts in Pending review.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not create store.')); }
    finally { setBusy(false); }
  }
  async function changeSeller(seller: Seller, status: Seller['status']) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to change store status.')); return; }
    setBusy(true); setNotice('');
    try { const updated = await setAdminSellerStatus(seller, status); setSellers((items) => items.map((item) => item.id === seller.id ? updated : item)); setNotice(t(`Store status changed to ${status}.`)); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not update store status.')); }
    finally { setBusy(false); }
  }
  async function changeUserRoles(user: AdminUser, selected: string[]) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the identity API to change team roles.')); return; }
    const next = [...new Set(['USER', ...selected])]; setBusy(true); setNotice('');
    try { const updated = await updateAdminUserRoles(user.uid, next); setUsers((items) => items.map((item) => item.uid === user.uid ? { ...item, roles: updated.roles } : item)); setNotice(t('Access roles updated.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not update access roles.')); }
    finally { setBusy(false); }
  }
  async function openOrder(orderId: string) {
    if (demo) { const order = orders.find((item) => item.orderId === orderId); if (order) { setSelectedOrder({ ...order, paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: order.status === 'CONFIRMED' ? 'PAID' : 'COD_DUE', subtotalMinor: order.totalMinor, shippingMinor: 25000, shippingMethodCode: 'STANDARD', shippingAddress: { recipientName: 'Demo customer', phone: '+92 300 0000000', addressLine1: 'Sample address, Gulberg', city: 'Lahore', regionCode: 'Punjab', countryCode: 'PK' }, shipment: { id: 'b6bb2d3e-3a65-4ce3-86dd-d27283f4d111', status: 'PENDING', carrierCode: null, trackingNumber: null, trackingUrl: null, events: [] }, items: [{ sku: 'CERAMIC-MUG-01', quantity: 1 }, { sku: 'CANDLE-AMBER-03', quantity: 2 }] }); setShipmentForm({ status: 'PENDING', carrierCode: '', trackingNumber: '', trackingUrl: '', description: '', location: '' }); } return; }
    setBusy(true); setNotice('');
    try { const detail = await getAdminOrder(orderId); setSelectedOrder(detail); setShipmentForm({ status: detail.shipment?.status ?? 'PENDING', carrierCode: detail.shipment?.carrierCode ?? '', trackingNumber: detail.shipment?.trackingNumber ?? '', trackingUrl: detail.shipment?.trackingUrl ?? '', description: '', location: '' }); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not load order details.')); }
    finally { setBusy(false); }
  }
  async function saveShipment(event: FormEvent) {
    event.preventDefault();
    if (demo) { setNotice(t('Preview mode is read-only. Connect the fulfillment API to save tracking updates.')); return; }
    const shipment = selectedOrder?.shipment;
    if (!shipment) return;
    setBusy(true); setNotice('');
    try {
      await updateAdminShipment(shipment.id, { status: shipmentForm.status, carrierCode: shipmentForm.carrierCode || undefined, trackingNumber: shipmentForm.trackingNumber || undefined, trackingUrl: shipmentForm.trackingUrl || undefined, description: shipmentForm.description || undefined, location: shipmentForm.location || undefined });
      const refreshed = await getAdminOrder(selectedOrder.orderId); setSelectedOrder(refreshed); setShipmentForm({ status: refreshed.shipment?.status ?? 'PENDING', carrierCode: refreshed.shipment?.carrierCode ?? '', trackingNumber: refreshed.shipment?.trackingNumber ?? '', trackingUrl: refreshed.shipment?.trackingUrl ?? '', description: '', location: '' }); setNotice(t('Shipment update recorded.'));
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not update shipment.')); }
    finally { setBusy(false); }
  }
  async function saveZone(event: FormEvent) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to save delivery coverage.')); return; }
    event.preventDefault(); setBusy(true); setNotice('');
    try { const zone = await createDeliveryZone({ ...zoneForm, area: zoneForm.area || undefined, postalPrefix: zoneForm.postalPrefix || undefined }); setZones((items) => [zone, ...items]); setSelectedZone(zone.id); setNotice(t('Delivery zone created. Add at least one service rate.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not create delivery zone.')); }
    finally { setBusy(false); }
  }
  async function saveRate(event: FormEvent) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to save delivery rates.')); return; }
    event.preventDefault(); setBusy(true); setNotice('');
    try { const rate = await createDeliveryRate(selectedZone, { ...rateForm, currency: 'USD' }); setRates((items) => [rate, ...items]); setNotice(t('Delivery service added.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not create delivery service.')); }
    finally { setBusy(false); }
  }
  async function toggleZone(zone: DeliveryZone) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to update delivery zones.')); return; }
    setBusy(true); setNotice('');
    try { const updated = await setDeliveryZoneActive(zone.id, !zone.active); setZones((items) => items.map((item) => item.id === zone.id ? updated : item)); setNotice(t(updated.active ? 'Delivery zone enabled.' : 'Delivery zone paused.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not update delivery zone.')); }
    finally { setBusy(false); }
  }
  async function toggleRate(rate: DeliveryRate) {
    if (demo) { setNotice(t('Preview mode is read-only. Connect the admin API to update delivery rates.')); return; }
    setBusy(true); setNotice('');
    try { const updated = await setDeliveryRateActive(rate.id, !rate.active); setRates((items) => items.map((item) => item.id === rate.id ? updated : item)); setNotice(t(updated.active ? 'Delivery rate enabled.' : 'Delivery rate paused.')); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not update delivery rate.')); }
    finally { setBusy(false); }
  }
  async function loadOlderOrders() {
    if (demo) return;
    if (!nextCursor) return;
    setBusy(true);
    try { const page = await getAdminOrders(nextCursor, orderStatus || undefined); setOrders((items) => [...items, ...page.items]); setNextCursor(page.nextCursor); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not load older orders.')); }
    finally { setBusy(false); }
  }
  async function loadMoreProducts() {
    if (!nextProductAfter) return;
    setBusy(true);
    try { const items = await getAdminProducts(nextProductAfter); setProducts((currentProducts) => [...currentProducts, ...items]); setNextProductAfter(items.length === 100 ? items.at(-1)?.sku ?? null : null); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not load more products.')); }
    finally { setBusy(false); }
  }
  async function loadMoreUsers() {
    if (!nextUserCursor) return;
    setBusy(true);
    try { const page = await getAdminUsers(nextUserCursor); setUsers((currentUsers) => [...currentUsers, ...page.users]); setNextUserCursor(page.nextCursor); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not load more users.')); }
    finally { setBusy(false); }
  }
  async function filterOrders(status: string) {
    if (demo) { setOrderStatus(status); setOrders((currentOrders) => status ? currentOrders.filter((order) => order.status === status) : [
      { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d111', userId: 'customer_amina_01', status: 'PENDING', totalMinor: 798000, currency: 'PKR', createdAt: new Date(Date.now() - 1000 * 60 * 13).toISOString() },
      { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d112', userId: 'customer_omar_02', status: 'CONFIRMED', totalMinor: 1249000, currency: 'PKR', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
      { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d113', userId: 'customer_sana_03', status: 'RESERVED', totalMinor: 519000, currency: 'PKR', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString() },
      { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d114', userId: 'customer_ali_04', status: 'CONFIRMED', totalMinor: 329000, currency: 'PKR', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 19).toISOString() },
      { orderId: 'f6bb2d3e-3a65-4ce3-86dd-d27283f4d115', userId: 'customer_hira_05', status: 'CANCELLED', totalMinor: 229000, currency: 'PKR', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 27).toISOString() },
    ]); return; }
    setOrderStatus(status); setBusy(true); setNotice('');
    try { const page = await getAdminOrders(undefined, status || undefined); setOrders(page.items); setNextCursor(page.nextCursor); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : t('Could not filter orders.')); }
    finally { setBusy(false); }
  }

  const nav = <>
    <div className="ops-brand"><span className="ops-brand-mark"><ShoppingBag size={19} /></span><div><b>BitSooq</b><small>MERCHANT CONSOLE</small></div></div>
    <div className="ops-nav-label">{t('WORKSPACE', 'مساحة العمل')}</div>
    <nav className="ops-nav">{visibleNav.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={`ops-nav-item ${current === id ? 'is-current' : ''}`} onClick={() => go(id)}><Icon size={17} /><span>{label}</span>{id === 'orders' && pendingOrders > 0 && <i>{pendingOrders > 99 ? '99+' : pendingOrders}</i>}</button>)}</nav>
    <div className="ops-sidebar-spacer" />
    <div className="ops-health"><span><i />{t('Services connected', 'الخدمات متصلة')}</span><small>{t('Your secure API workspace', 'مساحة العمل الآمنة')}</small></div>
    <Link to="/" className="ops-store-link"><ExternalLink size={14} />{t('View storefront', 'عرض المتجر')}</Link>
    <div className="ops-profile"><span className="ops-avatar">{displayName.slice(0, 1).toUpperCase()}</span><div><b>{displayName}</b><small>{roleLabel}</small></div><button type="button" className="ops-signout" onClick={() => { signOut(); navigate('/login', { replace: true }); }} title={t('Sign out')} aria-label={t('Sign out')}><LogOut size={14} /></button></div>
  </>;

  return <div className="ops-shell" dir={arabic ? 'rtl' : 'ltr'}>
    <aside className={`ops-sidebar ${mobileNav ? 'is-open' : ''}`}>{nav}</aside>
    {mobileNav && <button className="ops-backdrop" aria-label={t('Close navigation')} onClick={() => setMobileNav(false)} />}
    <div className="ops-main">
      <header className="ops-topbar"><button className="ops-mobile-menu" aria-label={t('Open navigation')} onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="ops-breadcrumb"><span>{t('Workspace', 'مساحة العمل')}</span><ArrowRight size={13} /><b>{visibleNav.find((item) => item.id === current)?.label}</b></div><div className="ops-top-actions"><button className="ops-search-shortcut" onClick={() => setMobileSearch((open) => !open)}><Search size={15} /><span>{t('Search', 'بحث')}</span><kbd>⌘ K</kbd></button><button className="ops-refresh" onClick={() => void loadWorkspace()} title={t('Refresh data')}><RefreshCw size={15} /></button><span className="ops-top-avatar">{displayName.slice(0, 1).toUpperCase()}</span></div></header>
      {mobileSearch && <div className="ops-search-box"><Search size={16} /><input autoFocus placeholder={t('Search products, stores and customers…')} value={productSearch} onChange={(event) => { setProductSearch(event.target.value); go('products'); }} /><button onClick={() => setMobileSearch(false)}><X size={16} /></button></div>}
      <main className="ops-content">
        {demo && <div className="ops-demo-banner"><span><Activity size={14} />{t('INTERACTIVE DEMO')}</span><p>{t('Sample marketplace data · Read-only preview · Connect live services to make changes')}</p></div>}
        {notice && <div className="ops-notice" role="status"><BadgeCheck size={16} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label={t('Dismiss')}><X size={15} /></button></div>}
        {state === 'loading' && <div className="ops-loading"><Loader2 className="animate-spin" size={23} /><span>{t('Loading your workspace…', 'جارٍ تحميل مساحة العمل…')}</span></div>}
        {state === 'error' && <div className="ops-error"><Activity size={22} /><div><b>{t('Workspace unavailable', 'مساحة العمل غير متاحة')}</b><p>{error}</p><button className="ghost-button" onClick={() => void loadWorkspace()}><RefreshCw size={14} />{t('Try again', 'أعد المحاولة')}</button></div></div>}
        {state === 'ready' && current === 'overview' && <>
          <SectionHeading eyebrow={t('YOUR BUSINESS AT A GLANCE', 'نظرة سريعة على نشاطك')} title={t('Good to see you', 'سعداء بعودتك')} detail={t('Here is what is happening across your marketplace today.', 'إليك آخر المستجدات في متجرك اليوم.')} actions={<button className="ghost-button" onClick={() => void loadWorkspace()}><RefreshCw size={14} />{t('Refresh data')}</button>} />
          <div className="ops-welcome"><div><span className="ops-live-dot" />{t('LIVE STORE OPERATIONS', 'تشغيل المتجر المباشر')}<h2>{t('Your marketplace, in one place.', 'سوقك في مكان واحد.')}</h2><p>{t('Track sales, keep inventory healthy and get every order moving.', 'تابع المبيعات وحافظ على المخزون وحرك كل طلب.')}</p><button className="neon-button" onClick={() => go(canFulfill ? 'orders' : canCatalog ? 'products' : 'stores')}>{t(canFulfill ? 'Review orders' : canCatalog ? 'Manage catalog' : 'Manage stores', 'فتح مساحة العمل')}<ArrowRight size={15} /></button></div><div className="ops-welcome-art"><div className="ops-art-ring ops-ring-one" /><div className="ops-art-ring ops-ring-two" /><div className="ops-art-center"><Store size={33} /></div><span className="ops-art-chip chip-top"><ShoppingCart size={14} />{canFulfill ? orders.length : '—'} {t('orders')}</span><span className="ops-art-chip chip-bottom"><PackageCheck size={14} />{canCatalog ? products.length : '—'} {t('products')}</span></div></div>
          <div className="ops-metrics-grid">
            <MetricCard label={t('Total orders')} value={canFulfill ? analytics?.totalOrders ?? orders.length : '—'} hint={t(canFulfill ? 'All recorded orders' : 'Fulfillment workspace access required')} icon={ShoppingCart} />
            <MetricCard label={t('Needs attention')} value={canFulfill ? pendingOrders : '—'} hint={t('Awaiting the next step')} icon={Clock3} tone="amber" />
            <MetricCard label={t('Confirmed revenue')} value={analytics ? money(analytics.confirmedRevenueMinor, analytics.currency, i18n.language) : '—'} hint={analytics ? `${analytics.confirmedOrders} ${t('confirmed orders')}` : t('Super Admin analytics access required')} icon={CircleDollarSign} tone="green" />
            <MetricCard label={t('Catalog health')} value={canCatalog ? outOfStock + lowStock : '—'} hint={canCatalog ? `${outOfStock} ${t('out of stock')} · ${lowStock} ${t('low stock')}` : t('Catalog workspace access required')} icon={Boxes} tone="purple" />
          </div>
          <div className="ops-overview-grid">
            <section className="ops-panel"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('LATEST ACTIVITY')}</span><h2>{t(canFulfill ? 'Recent orders' : canCatalog ? 'Catalog health' : 'Store network')}</h2></div>{canFulfill && <button className="ops-text-button" onClick={() => go('orders')}>{t('See all')}<ArrowRight size={14} /></button>}</div>
              {canFulfill && orders.length ? <div className="ops-mini-orders">{orders.slice(0, 5).map((order) => <button key={order.orderId} className="ops-mini-order" onClick={() => void openOrder(order.orderId)}><span className="ops-order-icon"><ShoppingBag size={15} /></span><span className="ops-mini-order-copy"><b>#{order.orderId.slice(0, 8).toUpperCase()}</b><small>{new Date(order.createdAt).toLocaleString(arabic ? 'ar-PK' : 'en-PK')}</small></span><StatusBadge status={order.status} /><strong>{money(order.totalMinor, order.currency ?? 'USD', i18n.language)}</strong><ArrowRight size={14} /></button>)}</div> : canCatalog ? <div className="ops-shortcut-stat"><b>{products.length} {t('catalog listings')}</b><span>{outOfStock} {t('out of stock')} · {lowStock} {t('low stock')}</span><button className="ops-text-button" onClick={() => go('products')}>{t('Manage catalog')}<ArrowRight size={14} /></button></div> : <div className="ops-shortcut-stat"><b>{sellers.length} {t('registered stores')}</b><span>{sellers.filter((seller) => seller.status === 'PENDING').length} {t('awaiting review')}</span><button className="ops-text-button" onClick={() => go('stores')}>{t('Manage stores')}<ArrowRight size={14} /></button></div>}{canFulfill && orders.length === 0 && <EmptyState icon={ShoppingCart} title={t('No orders yet')} detail={t('New customer orders will appear here.')} />}</section>
            <section className="ops-panel ops-shortcuts"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('QUICK ACTIONS')}</span><h2>{t('Keep things moving')}</h2></div><Activity size={18} /></div>{canCatalog && <button onClick={() => { setProductForm(initialProduct()); setProductModal(true); }}><span className="shortcut-icon cyan"><Plus size={16} /></span><span><b>{t('Add a product')}</b><small>{t('Create a catalog listing')}</small></span><ArrowRight size={15} /></button>}{canManageStores && <button onClick={() => go('stores')}><span className="shortcut-icon purple"><Store size={16} /></span><span><b>{t('Review stores')}</b><small>{t('Approve seller applications')}</small></span><ArrowRight size={15} /></button>}{canFulfill && <button onClick={() => go('delivery')}><span className="shortcut-icon green"><MapPin size={16} /></span><span><b>{t('Set delivery coverage')}</b><small>{t('Manage zones and service rates')}</small></span><ArrowRight size={15} /></button>}<div className="ops-health-note"><i />{canFulfill ? activeZones : '—'} {t('active delivery zones')} <span>·</span> {canManageStores ? activeStores : '—'} {t('active stores')}</div></section>
          </div>
        </>}

        {state === 'ready' && current === 'orders' && <>
          <SectionHeading eyebrow={t('ORDER OPERATIONS')} title={t('Orders & fulfillment')} detail={t('Review customer orders and keep each one moving through fulfillment.')} actions={<span className="ops-page-count"><ShoppingCart size={14} />{orders.length} {t('orders loaded')}</span>} />
          <div className="ops-filter-row">{['', 'PENDING', 'RESERVED', 'CONFIRMED', 'CANCELLED'].map((status) => <button key={status || 'all'} className={`ops-filter ${orderStatus === status ? 'is-active' : ''}`} onClick={() => void filterOrders(status)}>{status || t('All orders')}</button>)}<span className="ops-filter-spacer" />{busy && <Loader2 className="animate-spin" size={16} />}</div>
          <section className="ops-panel ops-table-panel"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('ORDER QUEUE')}</span><h2>{t('All activity')}</h2></div><span className="ops-page-count"><i className="ops-live-dot" />{t('Updated just now')}</span></div>
            {orders.length ? <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t('Order')}</th><th>{t('Customer reference')}</th><th>{t('Date placed')}</th><th>{t('Status')}</th><th>{t('Order total')}</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.orderId}><td><b className="ops-order-id">#{order.orderId.slice(0, 8).toUpperCase()}</b></td><td><span className="ops-customer-ref">{order.userId.slice(0, 14)}{order.userId.length > 14 ? '…' : ''}</span></td><td>{new Date(order.createdAt).toLocaleString(arabic ? 'ar-PK' : 'en-PK')}</td><td><StatusBadge status={order.status} /></td><td className="ops-amount">{money(order.totalMinor, order.currency ?? 'USD', i18n.language)}</td><td><button className="ops-row-action" onClick={() => void openOrder(order.orderId)}>{t('View')}<ArrowRight size={14} /></button></td></tr>)}</tbody></table></div> : <EmptyState icon={ShoppingCart} title={t('No matching orders')} detail={t('Try another status filter or refresh the order queue.')} />}
            {nextCursor && <div className="ops-pagination"><button className="ghost-button" disabled={busy} onClick={() => void loadOlderOrders()}>{busy ? <Loader2 className="animate-spin" size={14} /> : null}{t('Load older orders')}</button></div>}
          </section>
          <div className="ops-callout"><PackageCheck size={18} /><div><b>{t('Fulfillment updates')}</b><p>{t('Order details include the shipping address and payment state. Shipment statuses, carrier references, tracking links and event notes are written to the shipment timeline.')}</p></div></div>
        </>}

        {state === 'ready' && current === 'products' && <>
          <SectionHeading eyebrow={t('CATALOG MANAGEMENT')} title={t('Products & catalog')} detail={t('Manage your listings, prices, categories and stock levels.')} actions={<button className="neon-button" onClick={() => { setProductForm(initialProduct()); setProductModal(true); }}><Plus size={15} />{t('Add product')}</button>} />
          <div className="ops-catalog-summary"><div><span>{t('Active listings')}</span><strong>{products.filter((product) => product.active).length}</strong></div><div><span>{t('Low stock')}</span><strong className="is-warn">{lowStock}</strong></div><div><span>{t('Out of stock')}</span><strong className="is-danger">{outOfStock}</strong></div><div><span>{t('Categories')}</span><strong>{categories.length}</strong></div></div>
          <div className="ops-toolbar"><label className="ops-input-search"><Search size={15} /><input placeholder={t('Search SKU, product or category…')} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></label><span className="ops-page-count">{searchableProducts.length} {t('listings')}</span></div>
          <section className="ops-panel ops-table-panel">{searchableProducts.length ? <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t('Product')}</th><th>{t('SKU')}</th><th>{t('Category')}</th><th>{t('Price')}</th><th>{t('Inventory')}</th><th>{t('Status')}</th><th /></tr></thead><tbody>{searchableProducts.map((product) => <tr key={product.sku}><td><div className="ops-product-cell">{productImages[product.sku] ? <img src={productImages[product.sku]} alt="" /> : <span><Package size={17} /></span>}<b>{arabic && product.nameAr ? product.nameAr : product.name}</b></div></td><td><code>{product.sku}</code></td><td>{categories.find((category) => category.id === product.categoryId)?.name ?? product.categoryId ?? '—'}</td><td className="ops-amount">{money(product.priceMinor, product.currency, i18n.language)}</td><td><span className={`ops-stock ${product.availableStock <= 0 ? 'is-empty' : product.availableStock <= 5 ? 'is-low' : ''}`}><i />{product.availableStock} {t('units')}</span></td><td><span className={`ops-status-tag ${product.active ? 'is-active' : 'is-paused'}`}>{product.active ? t('Active') : t('Archived')}</span></td><td><div className="ops-row-actions"><button className="ops-row-action" onClick={() => editProduct(product)}>{t('Edit')}</button><button className="ops-row-action danger" onClick={() => void archiveProduct(product)}>{t('Archive')}</button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Package} title={t('No products found')} detail={t('Add a new listing or change your search.')} />}{nextProductAfter && <div className="ops-pagination"><button className="ghost-button" disabled={busy} onClick={() => void loadMoreProducts()}>{busy ? <Loader2 className="animate-spin" size={14} /> : null}{t('Load more listings')}</button></div>}</section>
          <section className="ops-panel ops-category-panel"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('TAXONOMY')}</span><h2>{t('Categories')}</h2></div></div><div className="ops-category-chips">{categories.map((category) => <span key={category.id}>{category.name}<small>{category.id}</small></span>)}{categories.length === 0 && <span className="text-slate-500">{t('No categories available.')}</span>}</div><form className="ops-inline-form" onSubmit={(event) => void saveCategory(event)}><input className="field" placeholder={t('ID e.g. HOME')} required pattern="[A-Za-z0-9_-]{1,64}" value={categoryForm.id} onChange={(event) => setCategoryForm({ ...categoryForm, id: event.target.value })} /><input className="field" placeholder={t('Category name')} required maxLength={100} value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /><button className="ghost-button" disabled={busy}><Plus size={14} />{t('Add category')}</button></form></section>
        </>}

        {state === 'ready' && current === 'stores' && <>
          <SectionHeading eyebrow={t('SELLER OPERATIONS')} title={t('Mini stores')} detail={t('Review merchant applications and manage storefront participation in the marketplace.')} actions={<button className="neon-button" onClick={() => setSellerModal(true)}><Plus size={15} />{t('Add store')}</button>} />
          <div className="ops-store-banner"><div className="ops-store-banner-icon"><Building2 size={23} /></div><div><b>{t('Marketplace seller network')}</b><p>{t('Store applications are created in Pending status. Activate a store when its owner and compliance details have been reviewed.')}</p></div><span><BadgeCheck size={14} />{t('Seller controls live')}</span></div>
          <div className="ops-catalog-summary"><div><span>{t('All stores')}</span><strong>{sellers.length}</strong></div><div><span>{t('Active')}</span><strong className="is-good">{activeStores}</strong></div><div><span>{t('Awaiting review')}</span><strong className="is-warn">{sellers.filter((seller) => seller.status === 'PENDING').length}</strong></div><div><span>{t('Suspended')}</span><strong className="is-danger">{sellers.filter((seller) => seller.status === 'SUSPENDED').length}</strong></div></div>
          <div className="ops-toolbar"><label className="ops-input-search"><Search size={15} /><input placeholder={t('Search stores, owners or email…')} value={sellerSearch} onChange={(event) => setSellerSearch(event.target.value)} /></label><span className="ops-page-count">{searchableSellers.length} {t('stores')}</span></div>
          <section className="ops-panel ops-table-panel">{searchableSellers.length ? <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t('Store')}</th><th>{t('Owner ID')}</th><th>{t('Country')}</th><th>{t('Contact')}</th><th>{t('Created')}</th><th>{t('Status')}</th><th>{t('Manage')}</th></tr></thead><tbody>{searchableSellers.map((seller) => <tr key={seller.id}><td><div className="ops-seller-cell"><span><Store size={16} /></span><div><b>{seller.displayName}</b><small>/{seller.slug}</small></div></div></td><td><code>{seller.ownerUserId}</code></td><td>{seller.countryCode}</td><td>{seller.email || seller.phone || '—'}</td><td>{new Date(seller.createdAt).toLocaleDateString(arabic ? 'ar-PK' : 'en-PK')}</td><td><span className={`ops-status-tag status-${seller.status.toLowerCase()}`}>{seller.status}</span></td><td><select className="ops-status-select" aria-label={`${t('Change status')} ${seller.displayName}`} value={seller.status} disabled={busy} onChange={(event) => void changeSeller(seller, event.target.value as Seller['status'])}>{['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'].map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div> : <EmptyState icon={Store} title={t('No stores yet')} detail={t('Create a merchant application to start your seller network.')} />}</section>
          <div className="ops-callout"><ShieldCheck size={18} /><div><b>{t('Seller onboarding details')}</b><p>{t('Each store has a unique slug, owner, legal name, country and optional tax registration. Applications start pending, and every status change checks the current status to avoid overwriting a newer update.')}</p></div></div>
        </>}

        {state === 'ready' && current === 'delivery' && <>
          <SectionHeading eyebrow={t('FULFILLMENT SETTINGS')} title={t('Delivery setup')} detail={t('Configure location coverage, delivery windows, fees and cash on delivery.')} />
          <div className="ops-delivery-grid"><form className="ops-panel ops-form-panel" onSubmit={(event) => void saveZone(event)}><div className="ops-panel-heading"><div><span className="ops-kicker">{t('LOCATION COVERAGE')}</span><h2><MapPin size={17} />{t('Add delivery zone')}</h2></div></div><div className="ops-form-grid"><label>{t('Zone code')}<input className="field" required maxLength={64} value={zoneForm.zoneCode} onChange={(event) => setZoneForm({ ...zoneForm, zoneCode: event.target.value.toUpperCase() })} /></label><label>{t('Country code')}<input className="field" required maxLength={2} value={zoneForm.countryCode} onChange={(event) => setZoneForm({ ...zoneForm, countryCode: event.target.value.toUpperCase() })} /></label><label>{t('Province / region')}<input className="field" required maxLength={80} value={zoneForm.regionCode} onChange={(event) => setZoneForm({ ...zoneForm, regionCode: event.target.value })} /></label><label>{t('City')}<input className="field" required maxLength={120} value={zoneForm.city} onChange={(event) => setZoneForm({ ...zoneForm, city: event.target.value })} /></label><label>{t('Area, optional')}<input className="field" maxLength={120} value={zoneForm.area} onChange={(event) => setZoneForm({ ...zoneForm, area: event.target.value })} /></label><label>{t('Postal prefix, optional')}<input className="field" maxLength={24} value={zoneForm.postalPrefix} onChange={(event) => setZoneForm({ ...zoneForm, postalPrefix: event.target.value })} /></label><label>{t('Priority')}<input className="field" type="number" min={-1000} max={1000} value={zoneForm.priority} onChange={(event) => setZoneForm({ ...zoneForm, priority: Number(event.target.value) })} /></label></div><button className="neon-button" disabled={busy}><Plus size={14} />{t('Create zone')}</button></form>
            <form className="ops-panel ops-form-panel" onSubmit={(event) => void saveRate(event)}><div className="ops-panel-heading"><div><span className="ops-kicker">{t('DELIVERY SERVICE')}</span><h2><Truck size={17} />{t('Add service rate')}</h2></div></div><div className="ops-form-grid"><label className="full">{t('Delivery zone')}<select className="field" required value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)}><option value="">{t('Select a zone')}</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.zoneCode} · {zone.city}, {zone.regionCode}</option>)}</select></label><label>{t('Service code')}<input className="field" required maxLength={40} value={rateForm.methodCode} onChange={(event) => setRateForm({ ...rateForm, methodCode: event.target.value.toUpperCase() })} /></label><label>{t('Service name')}<input className="field" required maxLength={100} value={rateForm.methodName} onChange={(event) => setRateForm({ ...rateForm, methodName: event.target.value })} /></label><label>{t('Fee (USD cents)')}<input className="field" type="number" required min={0} value={rateForm.feeMinor} onChange={(event) => setRateForm({ ...rateForm, feeMinor: Number(event.target.value) })} /></label><label>{t('Minimum days')}<input className="field" type="number" required min={0} max={90} value={rateForm.minDeliveryDays} onChange={(event) => setRateForm({ ...rateForm, minDeliveryDays: Number(event.target.value) })} /></label><label>{t('Maximum days')}<input className="field" type="number" required min={0} max={90} value={rateForm.maxDeliveryDays} onChange={(event) => setRateForm({ ...rateForm, maxDeliveryDays: Number(event.target.value) })} /></label><label className="ops-checkbox full"><input type="checkbox" checked={rateForm.supportsCod} onChange={(event) => setRateForm({ ...rateForm, supportsCod: event.target.checked })} />{t('Cash on delivery supported')}</label></div><button className="neon-button" disabled={busy || !selectedZone || rateForm.maxDeliveryDays < rateForm.minDeliveryDays}><Plus size={14} />{t('Add service')}</button></form></div>
          <section className="ops-panel ops-zones-panel"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('SERVICE MAP')}</span><h2>{t('Configured delivery coverage')}</h2></div><span className="ops-page-count"><i className="ops-live-dot" />{activeZones} {t('active zones')}</span></div>{zones.length ? <div className="ops-zone-list">{zones.map((zone) => <article className={`ops-zone-card ${zone.active ? '' : 'is-inactive'}`} key={zone.id}><div className="ops-zone-top"><span className="ops-zone-icon"><MapPin size={16} /></span><div className="ops-zone-copy"><b>{zone.zoneCode}</b><small>{[zone.area, zone.city, zone.regionCode, zone.countryCode, zone.postalPrefix ? `${zone.postalPrefix}…` : ''].filter(Boolean).join(' · ')}</small></div><span className={`ops-status-tag ${zone.active ? 'is-active' : 'is-paused'}`}>{zone.active ? t('Active') : t('Paused')}</span><button className="ghost-button" disabled={busy} onClick={() => void toggleZone(zone)}>{zone.active ? t('Pause') : t('Enable')}</button></div><div className="ops-rate-list">{rates.filter((rate) => rate.zoneId === zone.id).map((rate) => <div key={rate.id} className="ops-rate-row"><div><b>{rate.methodName}</b><small>{money(rate.feeMinor, rate.currency, i18n.language)} · {rate.minDeliveryDays}–{rate.maxDeliveryDays} {t('days')}{rate.supportsCod ? ` · ${t('COD available')}` : ''}</small></div><span className={`ops-status-tag ${rate.active ? 'is-active' : 'is-paused'}`}>{rate.active ? t('Active') : t('Paused')}</span><button className="ops-row-action" disabled={busy || !zone.active} onClick={() => void toggleRate(rate)}>{rate.active ? t('Pause') : t('Enable')}</button></div>)}{!rates.some((rate) => rate.zoneId === zone.id) && <small className="ops-no-rates">{t('Add a delivery service to make this location available at checkout.')}</small>}</div></article>)}</div> : <EmptyState icon={MapPin} title={t('No delivery zones')} detail={t('Create a location zone and at least one rate to offer delivery at checkout.')} />}</section>
        </>}

        {state === 'ready' && current === 'payments' && <>
          <SectionHeading eyebrow={t('ADMIN ANALYTICS')} title={t('Analytics & payments')} detail={t('Review order trends, status distribution, payment methods and confirmed order value.')} />
          <div className="ops-metrics-grid ops-payment-metrics"><MetricCard label={t('Confirmed order value')} value={analytics ? money(analytics.confirmedRevenueMinor, analytics.currency, i18n.language) : '—'} hint={t('Aggregated confirmed orders')} icon={CircleDollarSign} tone="green" /><MetricCard label={t('Confirmed orders')} value={analytics?.confirmedOrders ?? orders.filter((order) => order.status === 'CONFIRMED').length} hint={t('Settled order status')} icon={BadgeCheck} tone="cyan" /><MetricCard label={t('Awaiting payment or review')} value={pendingOrders} hint={t('Pending and reserved orders')} icon={Clock3} tone="amber" /><MetricCard label={t('Order currency')} value={analytics?.currency ?? 'USD'} hint={t('Current catalog currency')} icon={CreditCard} tone="purple" /></div>
          <div className="ops-analytics-grid"><section className="ops-panel"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('LAST 14 DAYS')}</span><h2>{t('Confirmed order value trend')}</h2></div><span className="ops-page-count">{dailyMetrics.length} {t('days')}</span></div>{dailyMetrics.length ? <div className="ops-chart-bars">{dailyMetrics.map((day) => <div key={day.date} title={`${day.date} · ${money(day.confirmedRevenueMinor, analytics?.currency ?? 'USD', i18n.language)} · ${day.orders} ${t('orders')}`}><span style={{ height: `${Math.max(4, day.confirmedRevenueMinor / maxDailyRevenue * 100)}%` }} /><small>{day.date.slice(5)}</small></div>)}</div> : <EmptyState icon={Activity} title={t('No trend data yet')} detail={t('Order metrics will appear when production orders are recorded.')} />}</section><section className="ops-panel"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('ORDER HEALTH')}</span><h2>{t('Status distribution')}</h2></div></div>{analytics?.statuses?.length ? <div className="ops-status-bars">{analytics.statuses.map((row) => <div key={row.status}><span>{row.status.replaceAll('_', ' ')}</span><div><i style={{ width: `${Math.max(2, row.count / totalStatusCount * 100)}%` }} /></div><b>{row.count}</b></div>)}</div> : <EmptyState icon={Activity} title={t('Status data unavailable')} detail={t('The analytics API has no order status totals yet.')} />}</section></div>
          <div className="ops-payment-grid"><section className="ops-panel"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('CHECKOUT PROVIDERS')}</span><h2>{t('Payment methods')}</h2></div><Settings2 size={17} /></div><div className="ops-provider-row"><span className="ops-provider-logo moyasar">M</span><div><b>Moyasar</b><small>{t('Cards, Mada and Apple Pay checkout')}</small></div><span className="ops-status-tag">{t('Service integration')}</span></div><div className="ops-provider-row"><span className="ops-provider-logo crypto">₿</span><div><b>{t('Crypto payment')}</b><small>{t('USDT on Ethereum verification flow')}</small></div><span className="ops-status-tag">{t('Service integration')}</span></div><div className="ops-provider-row"><span className="ops-provider-logo cod"><Wallet size={15} /></span><div><b>{t('Cash on delivery')}</b><small>{t('Availability is controlled by delivery service rates')}</small></div><button className="ops-row-action" onClick={() => go('delivery')}>{t('Configure')}<ArrowRight size={13} /></button></div></section><section className="ops-panel ops-payment-note"><span className="ops-note-icon"><ShieldCheck size={20} /></span><span className="ops-kicker">{t('SETTLEMENT SAFETY')}</span><h2>{t('Order totals are authoritative')}</h2><p>{t('This dashboard reports confirmed order totals from the order service. Provider settlement, refunds and payout reconciliation need a dedicated payment ledger before they can be presented as financial balances.')}</p><button className="ghost-button" onClick={() => go('orders')}>{t('Review orders')}<ArrowRight size={14} /></button></section></div>
          {analytics?.payments?.length ? <section className="ops-panel ops-payments-table"><div className="ops-panel-heading"><div><span className="ops-kicker">{t('PAYMENT MIX')}</span><h2>{t('Orders by payment method and state')}</h2></div><CreditCard size={17} /></div><div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t('Payment method')}</th><th>{t('Payment state')}</th><th>{t('Orders')}</th><th>{t('Order value')}</th></tr></thead><tbody>{analytics.payments.map((row) => <tr key={`${row.method}-${row.paymentStatus}`}><td>{row.method}</td><td><span className="ops-status-tag">{row.paymentStatus}</span></td><td>{row.orders}</td><td className="ops-amount">{money(row.amountMinor, analytics.currency, i18n.language)}</td></tr>)}</tbody></table></div></section> : null}
        </>}

        {state === 'ready' && current === 'customers' && <>
          <SectionHeading eyebrow={t('CUSTOMER DIRECTORY')} title={t('Customers')} detail={t('Browse accounts and identify customer access state. Role changes are managed separately.')} />
          <div className="ops-store-banner"><div className="ops-store-banner-icon"><Users size={22} /></div><div><b>{users.length} {t('accounts in the loaded directory')}</b><p>{t('Directory access is restricted to Super Admins. The account provider returns the current page of users.')}</p></div><span><ShieldCheck size={14} />{t('Super Admin only')}</span></div>
          <div className="ops-toolbar"><label className="ops-input-search"><Search size={15} /><input placeholder={t('Search name, email or account ID…')} value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} /></label><span className="ops-page-count">{searchableUsers.filter((user) => user.roles.length <= 1).length} {t('customer accounts')}</span></div>
          <section className="ops-panel ops-table-panel">{searchableUsers.length ? <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t('Account')}</th><th>{t('User ID')}</th><th>{t('Access')}</th><th>{t('Account state')}</th></tr></thead><tbody>{searchableUsers.map((user) => <tr key={user.uid}><td><div className="ops-user-cell"><span>{(user.displayName || user.email || user.uid).slice(0, 1).toUpperCase()}</span><div><b>{user.displayName || t('Customer')}</b><small>{user.email || '—'}</small></div></div></td><td><code>{user.uid}</code></td><td>{user.roles.map((role) => <span key={role} className={`ops-role-pill ${role === 'SUPER_ADMIN' ? 'is-super' : role === 'STAFF' ? 'is-staff' : ''}`}>{role}</span>)}</td><td><span className={`ops-status-tag ${user.disabled ? 'is-paused' : 'is-active'}`}>{user.disabled ? t('Disabled') : t('Active')}</span></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title={t('No accounts in this view')} detail={t('Try a different search query.')} />}{nextUserCursor && <div className="ops-pagination"><button className="ghost-button" disabled={busy} onClick={() => void loadMoreUsers()}>{busy ? <Loader2 className="animate-spin" size={14} /> : null}{t('Load more accounts')}</button></div>}</section>
        </>}

        {state === 'ready' && current === 'team' && <>
          <SectionHeading eyebrow={t('ACCESS CONTROL')} title={t('Team & access')} detail={t('Manage trusted workspace roles. Role changes are applied by the identity provider.')} />
          <div className="ops-store-banner"><div className="ops-store-banner-icon"><ShieldCheck size={22} /></div><div><b>{t('Role changes are audited and protected')}</b><p>{t('Create focused Product, Store and Fulfillment Managers, or grant broad Staff access. Only a Super Admin can assign roles.')}</p></div><span><ShieldCheck size={14} />{t('Super Admin only')}</span></div>
          <div className="ops-toolbar"><label className="ops-input-search"><Search size={15} /><input placeholder={t('Search name, email or account ID…')} value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} /></label><span className="ops-page-count">{searchableUsers.length} {t('accounts')}</span></div>
          <section className="ops-panel ops-table-panel">{searchableUsers.length ? <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t('Team member')}</th><th>{t('Account ID')}</th><th>{t('Assigned workspaces')}</th><th>{t('State')}</th></tr></thead><tbody>{searchableUsers.map((user) => <tr key={user.uid}><td><div className="ops-user-cell"><span>{(user.displayName || user.email || user.uid).slice(0, 1).toUpperCase()}</span><div><b>{user.displayName || t('Unnamed account')}</b><small>{user.email || '—'}</small></div></div></td><td><code>{user.uid}</code></td><td><div className="ops-role-controls">{roleOptions.map(({ value, label }) => <label key={value}><input type="checkbox" checked={user.roles.includes(value)} disabled={busy || (user.uid === actorUid && value === 'SUPER_ADMIN')} onChange={(event) => void changeUserRoles(user, event.target.checked ? [...user.roles, value] : user.roles.filter((role) => role !== value))} />{t(label)}</label>)}</div></td><td><span className={`ops-status-tag ${user.disabled ? 'is-paused' : 'is-active'}`}>{user.disabled ? t('Disabled') : t('Active')}</span></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title={t('No accounts in this view')} detail={t('Try a different search query.')} />}{nextUserCursor && <div className="ops-pagination"><button className="ghost-button" disabled={busy} onClick={() => void loadMoreUsers()}>{busy ? <Loader2 className="animate-spin" size={14} /> : null}{t('Load more accounts')}</button></div>}</section>
          <div className="ops-callout"><ShieldCheck size={18} /><div><b>{t('Current permission model')}</b><p>{t('USER is always retained. Product Manager can manage catalog and stock, Store Manager controls seller onboarding, Fulfillment Manager works orders and delivery, Staff combines operations access, and Super Admin controls users and analytics.')}</p></div></div>
        </>}
      </main>
      <footer className="ops-footer"><span>BitSooq Merchant Console</span><span>{t('Secure operations workspace')} · {t('All changes are sent to the API')}</span></footer>
    </div>

    {productModal && <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductModal(false); }}><form className="ops-modal" onSubmit={(event) => void saveProduct(event)}><div className="ops-modal-header"><div><span className="ops-kicker">{productForm.version !== undefined ? t('EDIT LISTING') : t('NEW LISTING')}</span><h2>{productForm.version !== undefined ? t('Edit product') : t('Add product')}</h2></div><button type="button" className="ops-icon-button" onClick={() => setProductModal(false)}><X size={17} /></button></div><div className="ops-form-grid"><label>{t('SKU')}<input className="field" required maxLength={64} pattern="[A-Z0-9_-]+" disabled={productForm.version !== undefined} value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value.toUpperCase() })} /></label><label>{t('Product name')}<input className="field" required maxLength={200} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label><label>{t('Arabic name')}<input className="field" maxLength={200} value={productForm.nameAr ?? ''} onChange={(event) => setProductForm({ ...productForm, nameAr: event.target.value })} /></label><label>{t('Category')}<select className="field" value={productForm.categoryId ?? ''} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })}><option value="">{t('Uncategorized')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>{t('Price (USD cents)')}<input className="field" type="number" required min={1} max={1000000000000} value={productForm.priceMinor || ''} onChange={(event) => setProductForm({ ...productForm, priceMinor: Number(event.target.value) })} /></label><label>{productForm.version !== undefined ? t('Stock quantity') : t('Initial stock')}<input className="field" type="number" required min={0} max={1000000000} value={productForm.availableStock} onChange={(event) => setProductForm({ ...productForm, availableStock: Number(event.target.value) })} /></label><label className="full">{t('Description')}<textarea className="field" rows={3} maxLength={2000} value={productForm.descriptionEn ?? ''} onChange={(event) => setProductForm({ ...productForm, descriptionEn: event.target.value })} /></label><label className="full">{t('Arabic description')}<textarea className="field" rows={3} maxLength={2000} value={productForm.descriptionAr ?? ''} onChange={(event) => setProductForm({ ...productForm, descriptionAr: event.target.value })} /></label></div><div className="ops-modal-actions"><button type="button" className="ghost-button" onClick={() => setProductModal(false)}>{t('Cancel')}</button><button className="neon-button" disabled={busy}>{busy && <Loader2 className="animate-spin" size={15} />}{t('Save product')}</button></div></form></div>}
    {sellerModal && <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSellerModal(false); }}><form className="ops-modal" onSubmit={(event) => void saveSeller(event)}><div className="ops-modal-header"><div><span className="ops-kicker">{t('MERCHANT ONBOARDING')}</span><h2>{t('Create store application')}</h2></div><button type="button" className="ops-icon-button" onClick={() => setSellerModal(false)}><X size={17} /></button></div><p className="ops-modal-intro">{t('Applications are saved as Pending and must be reviewed before the store is activated.')}</p><div className="ops-form-grid"><label className="full">{t('Owner user ID')}<input className="field" required maxLength={128} value={sellerForm.ownerUserId} onChange={(event) => setSellerForm({ ...sellerForm, ownerUserId: event.target.value })} /></label><label>{t('Store display name')}<input className="field" required maxLength={160} value={sellerForm.displayName} onChange={(event) => setSellerForm({ ...sellerForm, displayName: event.target.value })} /></label><label>{t('Store slug')}<input className="field" required pattern="[a-z0-9-]{2,180}" placeholder="my-store" value={sellerForm.slug} onChange={(event) => setSellerForm({ ...sellerForm, slug: event.target.value.toLowerCase().replace(/\s+/g, '-') })} /></label><label>{t('Legal name')}<input className="field" maxLength={200} value={sellerForm.legalName} onChange={(event) => setSellerForm({ ...sellerForm, legalName: event.target.value })} /></label><label>{t('Country code')}<input className="field" required maxLength={2} pattern="[A-Z]{2}" value={sellerForm.countryCode} onChange={(event) => setSellerForm({ ...sellerForm, countryCode: event.target.value.toUpperCase() })} /></label><label>{t('Contact email')}<input className="field" type="email" maxLength={254} value={sellerForm.email} onChange={(event) => setSellerForm({ ...sellerForm, email: event.target.value })} /></label><label>{t('Phone')}<input className="field" maxLength={32} value={sellerForm.phone} onChange={(event) => setSellerForm({ ...sellerForm, phone: event.target.value })} /></label><label className="full">{t('Tax registration number')}<input className="field" maxLength={100} value={sellerForm.taxRegistrationNumber} onChange={(event) => setSellerForm({ ...sellerForm, taxRegistrationNumber: event.target.value })} /></label></div><div className="ops-modal-actions"><button type="button" className="ghost-button" onClick={() => setSellerModal(false)}>{t('Cancel')}</button><button className="neon-button" disabled={busy}>{busy && <Loader2 className="animate-spin" size={15} />}{t('Create pending application')}</button></div></form></div>}
    {selectedOrder && <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}><section className="ops-modal ops-order-modal"><div className="ops-modal-header"><div><span className="ops-kicker">{t('ORDER DETAILS')}</span><h2>#{selectedOrder.orderId.slice(0, 8).toUpperCase()}</h2></div><button type="button" className="ops-icon-button" onClick={() => setSelectedOrder(null)}><X size={17} /></button></div>
      <div className="ops-order-detail-summary"><div><small>{t('Status')}</small><StatusBadge status={selectedOrder.status as OrderSummary['status']} /></div><div><small>{t('Total')}</small><b>{money(selectedOrder.totalMinor, selectedOrder.currency ?? 'USD', i18n.language)}</b></div><div><small>{t('Placed')}</small><b>{new Date(selectedOrder.createdAt).toLocaleString(arabic ? 'ar-PK' : 'en-PK')}</b></div></div>
      <div className="ops-order-detail-summary"><div><small>{t('Payment method')}</small><b>{selectedOrder.paymentMethod ?? '—'}</b></div><div><small>{t('Payment status')}</small><b>{selectedOrder.paymentStatus ?? '—'}</b></div><div><small>{t('Delivery service')}</small><b>{selectedOrder.shippingMethodCode ?? '—'}</b></div></div>
      <div className="ops-order-customer"><span className="ops-kicker">{t('CUSTOMER ACCOUNT')}</span><code>{selectedOrder.userId}</code></div>
      {selectedOrder.shippingAddress && <div className="ops-order-customer"><span className="ops-kicker">{t('SHIP TO')}</span><b>{selectedOrder.shippingAddress.recipientName} · {selectedOrder.shippingAddress.phone}</b><span>{[selectedOrder.shippingAddress.addressLine1, selectedOrder.shippingAddress.addressLine2, selectedOrder.shippingAddress.area, selectedOrder.shippingAddress.city, selectedOrder.shippingAddress.regionCode, selectedOrder.shippingAddress.postalCode, selectedOrder.shippingAddress.countryCode].filter(Boolean).join(', ')}</span>{selectedOrder.shippingAddress.deliveryInstructions && <small>{t('Instructions')}: {selectedOrder.shippingAddress.deliveryInstructions}</small>}</div>}
      <div className="ops-line-items"><span className="ops-kicker">{t('ORDER ITEMS')}</span>{selectedOrder.items.map((item) => <div key={item.sku}><span><Package size={15} />{item.sku}</span><b>× {item.quantity}</b></div>)}</div>
      {canFulfill && selectedOrder.shipment && <form className="ops-shipment-form" onSubmit={(event) => void saveShipment(event)}><div className="ops-panel-heading"><div><span className="ops-kicker">{t('FULFILLMENT')}</span><h2><Truck size={16} />{t('Shipment tracking')}</h2></div><span className={`ops-status-tag ${selectedOrder.shipment.status === 'DELIVERED' ? 'is-active' : ''}`}>{selectedOrder.shipment.status}</span></div><div className="ops-form-grid"><label>{t('Shipment status')}<select className="field" required value={shipmentForm.status} onChange={(event) => setShipmentForm({ ...shipmentForm, status: event.target.value })}>{[selectedOrder.shipment.status, ...(shipmentTransitions[selectedOrder.shipment.status] ?? [])].map((status, index) => <option key={`${status}-${index}`} value={status}>{status}</option>)}</select></label><label>{t('Carrier code')}<input className="field" maxLength={64} value={shipmentForm.carrierCode} onChange={(event) => setShipmentForm({ ...shipmentForm, carrierCode: event.target.value.toUpperCase() })} /></label><label>{t('Tracking number')}<input className="field" maxLength={120} value={shipmentForm.trackingNumber} onChange={(event) => setShipmentForm({ ...shipmentForm, trackingNumber: event.target.value })} /></label><label>{t('Tracking URL')}<input className="field" type="url" pattern="https://.*" maxLength={1000} placeholder="https://carrier.example/track/…" value={shipmentForm.trackingUrl} onChange={(event) => setShipmentForm({ ...shipmentForm, trackingUrl: event.target.value })} /></label><label>{t('Event location')}<input className="field" maxLength={160} value={shipmentForm.location} onChange={(event) => setShipmentForm({ ...shipmentForm, location: event.target.value })} /></label><label>{t('Event note')}<input className="field" maxLength={300} value={shipmentForm.description} onChange={(event) => setShipmentForm({ ...shipmentForm, description: event.target.value })} /></label></div><button className="neon-button" disabled={busy}>{busy && <Loader2 className="animate-spin" size={14} />}{t('Save shipment update')}</button>{selectedOrder.shipment.events?.length ? <div className="ops-shipment-events"><span className="ops-kicker">{t('TRACKING TIMELINE')}</span>{selectedOrder.shipment.events.slice().reverse().slice(0, 5).map((item, index) => <div key={`${item.eventCode}-${item.occurredAt}-${index}`}><i /><b>{item.eventCode}</b><span>{item.description}</span><small>{[item.location, new Date(item.occurredAt).toLocaleString(arabic ? 'ar-PK' : 'en-PK')].filter(Boolean).join(' · ')}</small></div>)}</div> : null}</form>}
      {canFulfill && !selectedOrder.shipment && <div className="ops-callout"><Truck size={17} /><div><b>{t('Shipment not created')}</b><p>{t('A shipment record will appear after the order service reserves fulfillment.')}</p></div></div>}
      <div className="ops-modal-actions"><button className="ghost-button" onClick={() => setSelectedOrder(null)}>{t('Close')}</button></div></section></div>}
  </div>;
}
