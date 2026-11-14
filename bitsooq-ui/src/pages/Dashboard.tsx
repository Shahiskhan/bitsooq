import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, Pencil, PackageOpen, Truck, MapPin } from 'lucide-react';
import { adminCreateProduct, adminUpdateProduct, createDeliveryRate, createDeliveryZone, getDeliveryRates, getDeliveryZones, getOrders, getProducts, setDeliveryRateActive, setDeliveryZoneActive, type DeliveryRate, type DeliveryZone, type OrderSummary, type Product } from '../lib/api';
import { formatMoney } from '../lib/store';
import { productImages } from '../mock/products';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [nextOrderCursor, setNextOrderCursor] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [rates, setRates] = useState<DeliveryRate[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [zoneForm, setZoneForm] = useState({ zoneCode: 'PK-LHR', countryCode: 'PK', regionCode: 'Punjab', city: 'Lahore', area: '', postalPrefix: '', priority: 0 });
  const [rateForm, setRateForm] = useState({ methodCode: 'STANDARD', methodName: 'Standard delivery', feeMinor: 500, minDeliveryDays: 3, maxDeliveryDays: 5, supportsCod: true });
  const [form, setForm] = useState({ sku: '', name: '', nameAr: '', descriptionEn: '', descriptionAr: '', priceMinor: 0, currency: 'USD', availableStock: 0 });

  async function load() {
    const [orderPage, catalog] = await Promise.all([getOrders().catch(() => ({ items: [], nextCursor: null })), getProducts().catch(() => [])]);
    setOrders(orderPage.items); setNextOrderCursor(orderPage.nextCursor); setProducts(catalog);
  }
  async function loadMoreOrders() {
    if (!nextOrderCursor) return;
    const page = await getOrders(nextOrderCursor).catch(() => ({ items: [], nextCursor: null }));
    setOrders((current) => [...current, ...page.items]); setNextOrderCursor(page.nextCursor);
  }
  async function loadDelivery() {
    try {
      const [zoneList, rateList] = await Promise.all([getDeliveryZones(), getDeliveryRates()]);
      setZones(zoneList); setRates(rateList);
      setSelectedZone((current) => current || zoneList[0]?.id || '');
    } catch { setDeliveryMessage(i18n.language === 'ar' ? 'سجل الدخول بصلاحية الموظف لإدارة مناطق التوصيل.' : 'Staff access is required to configure delivery zones.'); }
  }
  useEffect(() => void load(), []);
  useEffect(() => void loadDelivery(), []);

  async function saveProduct() {
    setSaving(true);
    try {
      if (form.sku && products.some((p) => p.sku === form.sku)) await adminUpdateProduct(form.sku, form);
      else await adminCreateProduct({ ...form, active: true });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product: Product) {
    setForm({ sku: product.sku, name: product.name, nameAr: product.nameAr ?? '', descriptionEn: product.descriptionEn ?? '', descriptionAr: product.descriptionAr ?? '', priceMinor: product.priceMinor, currency: product.currency, availableStock: product.availableStock });
    setShowForm(true);
  }

  async function saveZone(event: FormEvent) {
    event.preventDefault(); setDeliveryBusy(true); setDeliveryMessage('');
    try {
      const zone = await createDeliveryZone({ ...zoneForm, area: zoneForm.area || undefined, postalPrefix: zoneForm.postalPrefix || undefined });
      setZones((current) => [zone, ...current]); setSelectedZone(zone.id);
      setDeliveryMessage(i18n.language === 'ar' ? 'تمت إضافة المنطقة. أضف خدمة توصيل لها أدناه.' : 'Zone added. Add at least one delivery service below.');
    } catch (error) { setDeliveryMessage(error instanceof Error ? error.message : 'Could not create delivery zone.'); }
    finally { setDeliveryBusy(false); }
  }

  async function saveRate(event: FormEvent) {
    event.preventDefault(); setDeliveryBusy(true); setDeliveryMessage('');
    try {
      const rate = await createDeliveryRate(selectedZone, { ...rateForm, currency: 'USD' });
      setRates((current) => [rate, ...current]);
      setDeliveryMessage(i18n.language === 'ar' ? 'تمت إضافة خدمة التوصيل.' : 'Delivery service added to the zone.');
    } catch (error) { setDeliveryMessage(error instanceof Error ? error.message : 'Could not create delivery rate.'); }
    finally { setDeliveryBusy(false); }
  }

  async function toggleZone(zone: DeliveryZone) {
    setDeliveryBusy(true); setDeliveryMessage('');
    try { const updated = await setDeliveryZoneActive(zone.id, !zone.active); setZones((current) => current.map((item) => item.id === zone.id ? updated : item)); }
    catch (error) { setDeliveryMessage(error instanceof Error ? error.message : 'Could not update zone.'); }
    finally { setDeliveryBusy(false); }
  }

  async function toggleRate(rate: DeliveryRate) {
    setDeliveryBusy(true); setDeliveryMessage('');
    try { const updated = await setDeliveryRateActive(rate.id, !rate.active); setRates((current) => current.map((item) => item.id === rate.id ? updated : item)); }
    catch (error) { setDeliveryMessage(error instanceof Error ? error.message : 'Could not update delivery service.'); }
    finally { setDeliveryBusy(false); }
  }

  return (
    <main className="dashboard-page mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div><p className="section-eyebrow"><span />{i18n.language === 'ar' ? 'إدارة المتجر' : 'STORE OPERATIONS'}</p><h1 className="mt-2 text-3xl font-extrabold text-white">{t('dashboard.title')}</h1></div>
        <button className="neon-button" onClick={() => { setForm({ sku: '', name: '', nameAr: '', descriptionEn: '', descriptionAr: '', priceMinor: 0, currency: 'USD', availableStock: 0 }); setShowForm((v) => !v); }}>
          <Plus size={15} /> {t('dashboard.addProduct')}
        </button>
      </div>

      {showForm && (
        <form
          className="glass-card product-form mb-8 grid gap-3 p-6 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveProduct();
          }}
        >
          {(
            [
              ['sku', 'SKU'],
              ['name', t('dashboard.nameEn')],
              ['nameAr', t('dashboard.nameAr')],
              ['descriptionEn', t('dashboard.descEn')],
              ['descriptionAr', t('dashboard.descAr')],
              ['currency', 'Currency'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <small className="mb-1 block text-slate-500">{label}</small>
              <input className="field" value={String(form[key] ?? '')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </label>
          ))}
          <label>
            <small className="mb-1 block text-slate-500">{t('dashboard.price')}</small>
            <input className="field" type="number" min={1} value={form.priceMinor || ''} onChange={(e) => setForm({ ...form, priceMinor: Number(e.target.value) })} />
          </label>
          <label>
            <small className="mb-1 block text-slate-500">{t('dashboard.stock')}</small>
            <input className="field" type="number" min={0} value={form.availableStock || ''} onChange={(e) => setForm({ ...form, availableStock: Number(e.target.value) })} />
          </label>
          <button className="neon-button sm:col-span-2" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={15} /> : null} {t('dashboard.save')}
          </button>
        </form>
      )}

      <section className="glass-card delivery-admin mb-8">
        <div className="delivery-admin-heading"><div><p className="section-eyebrow"><span />{i18n.language === 'ar' ? 'إعدادات المناطق' : 'FULFILMENT CONFIGURATION'}</p><h2><Truck size={19} />{i18n.language === 'ar' ? 'التوصيل ومناطق الخدمة' : 'Delivery zones & services'}</h2><p>{i18n.language === 'ar' ? 'حدد تغطية المدن والأحياء والرموز البريدية، ثم أضف أسعار التوصيل والمدة والدفع عند الاستلام.' : 'Define city, neighbourhood and postal coverage, then set service prices, delivery windows and COD availability.'}</p></div></div>
        <div className="delivery-admin-grid">
          <form className="delivery-admin-form" onSubmit={(event) => void saveZone(event)}><h3><MapPin size={15} />{i18n.language === 'ar' ? 'إضافة منطقة توصيل' : 'Add a delivery zone'}</h3><div className="delivery-admin-fields">
            <label>Zone code<input className="field" required maxLength={64} value={zoneForm.zoneCode} onChange={(e) => setZoneForm({ ...zoneForm, zoneCode: e.target.value.toUpperCase() })} /></label>
            <label>Country code<input className="field" required maxLength={2} value={zoneForm.countryCode} onChange={(e) => setZoneForm({ ...zoneForm, countryCode: e.target.value.toUpperCase() })} /></label>
            <label>Province / region<input className="field" required maxLength={80} value={zoneForm.regionCode} onChange={(e) => setZoneForm({ ...zoneForm, regionCode: e.target.value })} /></label>
            <label>City<input className="field" required maxLength={120} value={zoneForm.city} onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })} /></label>
            <label>Area (optional)<input className="field" maxLength={120} value={zoneForm.area} onChange={(e) => setZoneForm({ ...zoneForm, area: e.target.value })} /></label>
            <label>Postal prefix (optional)<input className="field" maxLength={24} value={zoneForm.postalPrefix} onChange={(e) => setZoneForm({ ...zoneForm, postalPrefix: e.target.value })} /></label>
            <label>Priority<input className="field" type="number" min={-1000} max={1000} value={zoneForm.priority} onChange={(e) => setZoneForm({ ...zoneForm, priority: Number(e.target.value) })} /></label>
          </div><button className="neon-button" disabled={deliveryBusy}><Plus size={14} />{i18n.language === 'ar' ? 'حفظ المنطقة' : 'Create zone'}</button></form>
          <form className="delivery-admin-form" onSubmit={(event) => void saveRate(event)}><h3><Truck size={15} />{i18n.language === 'ar' ? 'إضافة خدمة وسعر' : 'Add a service and rate'}</h3><label>Delivery zone<select className="field" required value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}><option value="">Select zone</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.zoneCode} · {zone.city}, {zone.regionCode}</option>)}</select></label><div className="delivery-admin-fields">
            <label>Service code<input className="field" required maxLength={40} value={rateForm.methodCode} onChange={(e) => setRateForm({ ...rateForm, methodCode: e.target.value.toUpperCase() })} /></label>
            <label>Service name<input className="field" required maxLength={100} value={rateForm.methodName} onChange={(e) => setRateForm({ ...rateForm, methodName: e.target.value })} /></label>
            <label>Fee (USD cents)<input className="field" type="number" required min={0} value={rateForm.feeMinor} onChange={(e) => setRateForm({ ...rateForm, feeMinor: Number(e.target.value) })} /></label>
            <label>Min days<input className="field" type="number" required min={0} max={90} value={rateForm.minDeliveryDays} onChange={(e) => setRateForm({ ...rateForm, minDeliveryDays: Number(e.target.value) })} /></label>
            <label>Max days<input className="field" type="number" required min={0} max={90} value={rateForm.maxDeliveryDays} onChange={(e) => setRateForm({ ...rateForm, maxDeliveryDays: Number(e.target.value) })} /></label>
          </div><label className="delivery-cod-check"><input type="checkbox" checked={rateForm.supportsCod} onChange={(e) => setRateForm({ ...rateForm, supportsCod: e.target.checked })} /> Cash on delivery supported</label><button className="neon-button" disabled={deliveryBusy || !selectedZone || rateForm.maxDeliveryDays < rateForm.minDeliveryDays}><Plus size={14} />{i18n.language === 'ar' ? 'إضافة الخدمة' : 'Add service'}</button></form>
        </div>
        {deliveryMessage && <p className="delivery-admin-message" role="status">{deliveryMessage}</p>}
        <div className="delivery-admin-list">
          <h3>{i18n.language === 'ar' ? 'المناطق والخدمات' : 'Configured delivery coverage'}</h3>
          {zones.length ? zones.map((zone) => <article className={`delivery-zone-row ${zone.active ? '' : 'is-inactive'}`} key={zone.id}>
            <div className="delivery-zone-identity"><b>{zone.zoneCode}</b><span>{[zone.area, zone.city, zone.regionCode, zone.countryCode, zone.postalPrefix ? `${zone.postalPrefix}…` : ''].filter(Boolean).join(' · ')}</span><button className="delivery-toggle" disabled={deliveryBusy} onClick={() => void toggleZone(zone)}>{zone.active ? 'Pause zone' : 'Enable zone'}</button></div>
            <div className="delivery-zone-rates">{rates.filter((rate) => rate.zoneId === zone.id).map((rate) => <div className={`delivery-rate-row ${rate.active ? '' : 'is-inactive'}`} key={rate.id}><span>{rate.methodName} · {formatMoney(rate.feeMinor, rate.currency, i18n.language)} · {rate.minDeliveryDays}–{rate.maxDeliveryDays} days{rate.supportsCod ? ' · COD' : ''} · {rate.active ? 'Active' : 'Paused'}</span><button className="delivery-toggle" disabled={deliveryBusy || !zone.active} onClick={() => void toggleRate(rate)}>{rate.active ? 'Pause rate' : 'Enable rate'}</button></div>)}{!rates.some((rate) => rate.zoneId === zone.id) && <small>No service rate added yet</small>}</div>
          </article>) : <p className="delivery-admin-empty">{i18n.language === 'ar' ? 'لم تتم إضافة مناطق بعد.' : 'No zones configured yet. Add a zone and at least one rate to enable live delivery quotes.'}</p>}
        </div>
        <p className="delivery-admin-footnote">Live order/catalog pricing currently uses USD. Fees are entered as minor currency units (100 = $1.00); configure production carrier accounts and local currencies separately.</p>
      </section>

      <section className="glass-card dashboard-table-shell mb-8 overflow-x-auto p-0">
        <h2 className="border-b border-line px-5 py-4 font-bold text-white">{t('dashboard.orders')}</h2>
        <table className="dashboard-table w-full min-w-[640px]">
          <thead><tr><th>{i18n.language === 'ar' ? 'رقم الطلب' : 'Order'}</th><th>{t('dashboard.status')}</th><th>{t('dashboard.total')}</th><th>{i18n.language === 'ar' ? 'تاريخ الإنشاء' : 'Placed'}</th></tr></thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td className="table-cell text-slate-500">{t('dashboard.emptyOrders')}</td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.orderId} className="border-t border-line">
                <td className="table-cell font-mono text-xs">{o.orderId}</td>
                <td className="table-cell"><StatusBadge status={o.status} /></td>
                <td className="table-cell">{formatMoney(o.totalMinor ?? 0, o.currency ?? 'USD', i18n.language)}</td>
                <td className="table-cell text-slate-400">{new Date(o.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-PK' : 'en-PK')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mobile-data-list">
          {orders.length === 0 ? <div className="dashboard-empty"><PackageOpen size={22} /><span>{t('dashboard.emptyOrders')}</span></div> : orders.map((order) => <article className="mobile-order-card" key={order.orderId}>
            <div className="mobile-order-top"><b dir="ltr">{order.orderId.slice(0, 8)}</b><StatusBadge status={order.status} /></div>
            <div className="mobile-order-bottom"><span>{i18n.language === 'ar' ? 'تم الإنشاء' : new Date(order.createdAt).toLocaleDateString()}</span><b>{formatMoney(order.totalMinor ?? 0, order.currency ?? 'USD', i18n.language)}</b></div>
          </article>)}
        </div>
        {nextOrderCursor && <button className="edit-product-button m-4" onClick={() => void loadMoreOrders()}>{i18n.language === 'ar' ? 'تحميل طلبات أقدم' : 'Load older orders'}</button>}
      </section>

      <section className="glass-card dashboard-table-shell overflow-x-auto p-0">
        <h2 className="border-b border-line px-5 py-4 font-bold text-white">{t('dashboard.products')}</h2>
        <table className="dashboard-table w-full min-w-[640px]">
          <thead><tr><th>{i18n.language === 'ar' ? 'المنتج' : 'Product'}</th><th>{t('dashboard.price')}</th><th>{t('dashboard.stock')}</th><th>{i18n.language === 'ar' ? 'الإجراء' : 'Action'}</th></tr></thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td className="table-cell text-slate-500">{t('dashboard.emptyProducts')}</td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.sku} className="border-t border-line">
                <td className="table-cell"><div className="dashboard-product-cell"><img src={productImages[p.sku]} alt="" loading="lazy" /><span><b>{i18n.language === 'ar' && p.nameAr ? p.nameAr : p.name}</b><small dir="ltr">{p.sku}</small></span></div></td>
                <td className="table-cell text-emerald-neon">{formatMoney(p.priceMinor, p.currency, i18n.language)}</td>
                <td className="table-cell"><span className={`dashboard-stock ${p.availableStock <= 0 ? 'is-out' : p.availableStock <= 5 ? 'is-low' : ''}`}><i />{p.availableStock}</span></td>
                <td className="table-cell"><button className="edit-product-button" onClick={() => editProduct(p)} aria-label={`${t('dashboard.save')} ${p.name}`}><Pencil size={14} />{i18n.language === 'ar' ? 'تعديل' : 'Edit'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mobile-data-list mobile-product-list">
          {products.length === 0 ? <div className="dashboard-empty"><PackageOpen size={22} /><span>{t('dashboard.emptyProducts')}</span></div> : products.map((product) => <article className="mobile-product-card" key={product.sku}>
            <div className="mobile-product-image">{productImages[product.sku] && <img src={productImages[product.sku]} alt="" loading="lazy" />}</div>
            <div className="mobile-product-copy"><b>{i18n.language === 'ar' && product.nameAr ? product.nameAr : product.name}</b><small dir="ltr">{product.sku}</small><span className="text-emerald-neon">{formatMoney(product.priceMinor, product.currency, i18n.language)}</span></div>
            <button className="edit-product-button icon-only" onClick={() => editProduct(product)} aria-label={`${t('dashboard.save')} ${product.name}`}><Pencil size={14} /></button>
          </article>)}
        </div>
      </section>
    </main>
  );
}
