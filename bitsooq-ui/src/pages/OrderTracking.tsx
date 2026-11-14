import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Clock3, MapPin, Package, Search, Truck } from 'lucide-react';
import { ApiError, getOrder, type Order } from '../lib/api';
import { formatMoney } from '../lib/store';

const steps = ['PENDING', 'READY', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const labels: Record<string, { en: string; ar: string }> = {
  PENDING: { en: 'Order received', ar: 'تم استلام الطلب' }, LABEL_CREATED: { en: 'Shipping label created', ar: 'تم إنشاء ملصق الشحن' },
  READY: { en: 'Packed and ready', ar: 'تم تجهيز الطلب' }, SHIPPED: { en: 'Handed to courier', ar: 'تم تسليم الطلب للمندوب' },
  IN_TRANSIT: { en: 'In transit', ar: 'في الطريق' }, OUT_FOR_DELIVERY: { en: 'Out for delivery', ar: 'خرج للتوصيل' },
  DELIVERED: { en: 'Delivered', ar: 'تم التوصيل' }, FAILED: { en: 'Delivery attempt failed', ar: 'تعذرت محاولة التوصيل' },
  RETURNED: { en: 'Returned', ar: 'تم إرجاع الشحنة' }, CANCELLED: { en: 'Shipment cancelled', ar: 'تم إلغاء الشحنة' },
};

export default function OrderTracking() {
  const [params, setParams] = useSearchParams();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const demo = import.meta.env.VITE_USE_MOCK === 'true';
  const [query, setQuery] = useState(params.get('order') ?? '');
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function lookup(id: string) {
    const orderId = id.trim(); if (!orderId) return;
    setBusy(true); setError(''); setOrder(null);
    try {
      if (demo || orderId.startsWith('BS-')) {
        const localOrders = JSON.parse(localStorage.getItem('bitsooq.demo.orders.v1') ?? '[]') as Order[];
        const localOrder = localOrders.find((item) => item.orderId.toLowerCase() === orderId.toLowerCase());
        if (!localOrder) throw new Error(ar ? 'لم يتم العثور على هذا الطلب التجريبي في هذا المتصفح.' : 'Demo order not found in this browser.');
        setOrder(localOrder);
      } else {
        setOrder(await getOrder(orderId));
      }
      setParams({ order: orderId }, { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? (ar ? 'سجل الدخول لعرض طلباتك.' : 'Sign in to view your orders.') : cause instanceof Error ? cause.message : (ar ? 'تعذر العثور على الطلب.' : 'Could not find this order.'));
    } finally { setBusy(false); }
  }

  useEffect(() => { const id = params.get('order'); if (id) void lookup(id); }, []);

  const shipment = order?.shipment;
  const state = shipment?.status ?? (order?.status === 'CANCELLED' ? 'CANCELLED' : order?.status === 'CONFIRMED' ? 'PENDING' : order?.status);
  const stepIndex = steps.indexOf(state ?? 'PENDING');

  return <main id="main-content" className="checkout-page tracking-page">
    <Link to="/" className="checkout-back"><ArrowLeft size={15} /> {ar ? 'المتجر' : 'Back to store'}</Link>
    <header className="checkout-heading"><div><p className="section-eyebrow"><span />{ar ? 'تحديثات الشحنة' : 'SHIPMENT UPDATES'}</p><h1>{ar ? 'تتبع الطلب' : 'Track your order'}</h1><p>{ar ? 'أدخل رقم طلبك لمشاهدة آخر حالة ومعلومات التوصيل.' : 'Enter your order reference to see its latest delivery status.'}</p></div><Truck className="tracking-heading-icon" size={30} /></header>
    <form className="tracking-search" onSubmit={(event: FormEvent) => { event.preventDefault(); void lookup(query); }}><label className="sr-only" htmlFor="tracking-order-id">{ar ? 'رقم الطلب' : 'Order reference'}</label><Package size={17} /><input id="tracking-order-id" className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ar ? 'أدخل رقم الطلب' : 'e.g. order reference'} required /><button className="neon-button" disabled={busy}><Search size={15} />{busy ? (ar ? 'جارٍ البحث…' : 'Looking up…') : (ar ? 'تتبع' : 'Track order')}</button></form>
    {error && <p className="tracking-error" role="alert">{error}</p>}
    {order && <section className="tracking-result">
      <div className="tracking-result-heading"><div><p className="section-eyebrow"><span />{ar ? 'رقم الطلب' : 'ORDER REFERENCE'}</p><h2>{order.orderId}</h2></div><span className={`tracking-status tracking-status-${(state ?? 'PENDING').toLowerCase()}`}>{labels[state ?? 'PENDING']?.[ar ? 'ar' : 'en'] ?? state}</span></div>
      <div className="tracking-meta-grid"><div><small>{ar ? 'حالة الطلب' : 'Order status'}</small><b>{order.status}</b></div><div><small>{ar ? 'حالة الدفع' : 'Payment status'}</small><b>{order.paymentStatus ?? order.status}</b></div><div><small>{ar ? 'طريقة التوصيل' : 'Delivery service'}</small><b>{order.shippingMethodCode ?? '—'}</b></div><div><small>{ar ? 'الإجمالي' : 'Order total'}</small><b>{formatMoney(order.totalMinor ?? 0, order.currency ?? 'USD', i18n.language)}</b></div></div>
      {order.shippingAddress && <div className="tracking-destination-card"><MapPin size={17} /><div><small>{ar ? 'عنوان التوصيل' : 'Delivering to'}</small><b>{order.shippingAddress.recipientName} · {order.shippingAddress.phone}</b><p>{[order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.area, order.shippingAddress.city, order.shippingAddress.regionCode, order.shippingAddress.postalCode, order.shippingAddress.countryCode].filter(Boolean).join(', ')}</p>{order.shippingAddress.deliveryInstructions && <small>{ar ? 'تعليمات' : 'Instructions'}: {order.shippingAddress.deliveryInstructions}</small>}</div></div>}
      {shipment ? <>
        <div className="tracking-shipment-card"><div className="tracking-shipment-icon"><Truck size={18} /></div><div><small>{ar ? 'رقم تتبع شركة الشحن' : 'Courier tracking number'}</small><b>{shipment.trackingNumber ?? (ar ? 'سيظهر بعد تجهيز الشحنة' : 'Available once the shipment is prepared')}</b>{shipment.carrierCode && <small>{shipment.carrierCode}</small>}</div>{shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="checkout-location-button">{ar ? 'تتبع شركة الشحن' : 'Courier site'} ↗</a>}</div>
        {shipment.estimatedDeliveryAt && <p className="tracking-eta"><Clock3 size={15} />{ar ? 'التوصيل المتوقع' : 'Estimated delivery'}: {new Intl.DateTimeFormat(ar ? 'ar-PK' : 'en-PK', { dateStyle: 'medium' }).format(new Date(shipment.estimatedDeliveryAt))}</p>}
        <div className="tracking-progress" aria-label={ar ? 'مراحل التوصيل' : 'Delivery progress'}>{steps.map((step, index) => <div key={step} className={`tracking-progress-step ${stepIndex >= index ? 'is-done' : ''} ${stepIndex === index ? 'is-current' : ''}`}><span>{stepIndex > index ? <Check size={13} /> : index + 1}</span><small>{labels[step]?.[ar ? 'ar' : 'en']}</small></div>)}</div>
        {shipment.events?.length ? <div className="tracking-events"><h3>{ar ? 'سجل الشحنة' : 'Shipment activity'}</h3>{[...shipment.events].reverse().map((event, index) => <div className="tracking-event" key={`${event.eventCode}-${event.occurredAt}-${index}`}><span className="tracking-event-dot" /><div><b>{labels[event.eventCode]?.[ar ? 'ar' : 'en'] ?? event.eventCode}</b>{event.description && <p>{event.description}</p>}<small>{new Intl.DateTimeFormat(ar ? 'ar-PK' : 'en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurredAt))}{event.location ? ` · ${event.location}` : ''}</small></div></div>)}</div> : <p className="tracking-empty-events"><MapPin size={15} />{ar ? 'ستظهر تحديثات المندوب هنا عند انتقال الشحنة.' : 'Courier updates will appear here as the shipment moves.'}</p>}
      </> : <p className="tracking-empty-events"><Clock3 size={15} />{ar ? 'ننتظر تأكيد المخزون. ستظهر تفاصيل الشحنة هنا بعد ذلك.' : 'Waiting for inventory confirmation. Shipment details will appear here next.'}</p>}
    </section>}
  </main>;
}
