import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, CreditCard, LocateFixed, MapPin, PackageCheck, ShieldCheck, Truck, Wallet, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, archiveAddress, createOrder, getDeliveryOptions, getOrder, getSavedAddresses, initiateMoyasarPayment, saveAddress, updateAddress, verifyCryptoPayment, type DeliveryOption, type Order, type SavedAddress, type ShippingAddress } from '../lib/api';
import { formatMoney, useCart } from '../lib/store';

type PaymentMethod = 'CASH_ON_DELIVERY' | 'MOYASAR' | 'CRYPTO_USDT_ETH';
type AddressForm = ShippingAddress & { id?: string; version?: number; addressLabel: string; defaultShipping: boolean; defaultBilling: boolean };
const newAddress = (): AddressForm => ({ addressLabel: 'Home', recipientName: '', phone: '', addressLine1: '', addressLine2: '', area: '', city: '', regionCode: '', postalCode: '', countryCode: 'PK', deliveryInstructions: '', latitude: null, longitude: null, locationAccuracyM: null, defaultShipping: true, defaultBilling: true });
const DEMO_OPTIONS: DeliveryOption[] = [
  { id: 'demo-standard', zoneCode: 'PK-LHR', methodCode: 'STANDARD', methodName: 'Standard delivery', feeMinor: 25000, currency: 'PKR', minDeliveryDays: 3, maxDeliveryDays: 5, supportsCod: true },
  { id: 'demo-express', zoneCode: 'PK-LHR', methodCode: 'EXPRESS', methodName: 'Express delivery', feeMinor: 50000, currency: 'PKR', minDeliveryDays: 1, maxDeliveryDays: 2, supportsCod: true },
];

export default function Checkout() {
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const ar = i18n.language === 'ar';
  const { lines, subtotalMinor, clear } = useCart();
  const demo = import.meta.env.VITE_USE_MOCK === 'true' || lines.some((line) => line.product.demoOnly);
  const currency = lines[0]?.product.currency ?? 'PKR';
  const [address, setAddress] = useState<AddressForm>(newAddress);
  const [options, setOptions] = useState<DeliveryOption[]>(demo ? DEMO_OPTIONS : []);
  const [selectedRate, setSelectedRate] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [saveForLater, setSaveForLater] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [demoOrderId, setDemoOrderId] = useState('');
  const [cryptoHash, setCryptoHash] = useState('');
  const [cryptoResult, setCryptoResult] = useState('');
  const [moyasarSource, setMoyasarSource] = useState<'creditcard' | 'mada' | 'applepay'>('creditcard');
  const orderKey = useRef(crypto.randomUUID());
  const paymentKey = useRef(crypto.randomUUID());
  const priorPayment = useRef(payment);
  const priorMoyasarSource = useRef(moyasarSource);
  const tokenPresent = Boolean(sessionStorage.getItem('bitsooq.token'));
  const canQuote = Boolean(address.countryCode && address.regionCode.trim() && address.city.trim());
  const demoCovered = address.countryCode === 'PK' && ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad'].includes(address.city.trim().toLocaleLowerCase());
  const selectedOption = options.find((option) => option.id === selectedRate);
  const shippingMinor = selectedOption?.feeMinor ?? 0;
  const totalMinor = subtotalMinor + shippingMinor;
  const items = useMemo(() => Object.fromEntries(lines.map(({ product, qty }) => [product.sku, qty])), [lines]);

  useEffect(() => {
    if (priorPayment.current !== payment) orderKey.current = crypto.randomUUID();
    priorPayment.current = payment;
  }, [payment]);

  useEffect(() => {
    if (priorMoyasarSource.current !== moyasarSource) paymentKey.current = crypto.randomUUID();
    priorMoyasarSource.current = moyasarSource;
  }, [moyasarSource]);

  useEffect(() => {
    if (!tokenPresent || demo) return;
    getSavedAddresses().then(setSaved).catch(() => setSaved([]));
  }, [demo, tokenPresent]);

  useEffect(() => {
    const orderId = searchParams.get('order');
    if (!orderId || demo) return;
    getOrder(orderId).then((loaded) => {
      setOrder(loaded);
      if (loaded.paymentMethod === 'MOYASAR') setPayment('MOYASAR');
    }).catch(() => setError(ar ? 'تعذر تحميل تحديث الدفع.' : 'Could not load the payment update.'));
  }, []);

  useEffect(() => {
    setSelectedRate('');
    if (!canQuote) { setOptions([]); return; }
    let cancelled = false;
    if (demo) { const rates = demoCovered ? DEMO_OPTIONS : []; setOptions(rates); setSelectedRate(rates[0]?.id ?? ''); return; }
    setLoadingRates(true);
    getDeliveryOptions({ countryCode: address.countryCode, regionCode: address.regionCode, city: address.city, area: address.area ?? '', postalCode: address.postalCode ?? '' }, currency)
      .then((rates) => { if (!cancelled) { setOptions(rates); setSelectedRate(rates[0]?.id ?? ''); } })
      .catch(() => { if (!cancelled) setOptions([]); })
      .finally(() => { if (!cancelled) setLoadingRates(false); });
    return () => { cancelled = true; };
  }, [address.countryCode, address.regionCode, address.city, address.area, address.postalCode, canQuote, currency, demo, demoCovered]);

  useEffect(() => {
    if (selectedOption && payment === 'CASH_ON_DELIVERY' && !selectedOption.supportsCod) setPayment('MOYASAR');
  }, [payment, selectedOption]);

  function setField<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    orderKey.current = crypto.randomUUID();
    setAddress((current) => ({ ...current, [key]: value }));
  }

  function chooseSaved(value: string) {
    orderKey.current = crypto.randomUUID();
    if (value === 'new') { setAddress(newAddress()); setSaveForLater(false); return; }
    const item = saved.find((entry) => entry.id === value);
    if (item) { setAddress({ ...item, addressLabel: item.addressLabel, defaultShipping: item.defaultShipping, defaultBilling: item.defaultBilling }); setSaveForLater(true); }
  }

  async function removeSavedAddress() {
    if (!address.id || address.version == null) return;
    setBusy(true); setError('');
    try { await archiveAddress(address.id, address.version); setSaved((current) => current.filter((item) => item.id !== address.id)); setAddress(newAddress()); setSaveForLater(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove the saved address.'); }
    finally { setBusy(false); }
  }

  async function waitForReservation(orderId: string): Promise<Order> {
    let current = await getOrder(orderId);
    for (let attempt = 0; attempt < 15; attempt += 1) {
      setOrder(current);
      if (current.status === 'RESERVED' || current.status === 'CONFIRMED') return current;
      if (current.status === 'CANCELLED') throw new Error(ar ? 'تم إلغاء الطلب أثناء فحص المخزون. تحقق من التوفر.' : 'The order was cancelled during stock reservation. Check availability.');
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      current = await getOrder(orderId);
    }
    setOrder(current);
    throw new Error(ar ? 'لا يزال الطلب قيد التحقق. احتفظ برقم الطلب وحاول مرة أخرى بعد قليل.' : 'Your order is still being checked. Keep the reference and try again in a moment.');
  }

  async function refreshOrder() {
    if (!order) return;
    setBusy(true); setError('');
    try { setOrder(await getOrder(order.orderId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not refresh order.'); }
    finally { setBusy(false); }
  }

  async function continueMoyasar(currentOrder: Order) {
    const reservedOrder = currentOrder.status === 'RESERVED' ? currentOrder : await waitForReservation(currentOrder.orderId);
    if (reservedOrder.status !== 'RESERVED' || !reservedOrder.totalMinor || (reservedOrder.currency !== 'SAR' && reservedOrder.currency !== 'USD')) throw new Error(ar ? 'لم يصبح الطلب جاهزا للدفع بعد.' : 'The order is not ready for payment yet.');
    const intent = await initiateMoyasarPayment({ orderId: reservedOrder.orderId, amountHalalas: reservedOrder.totalMinor, currency: reservedOrder.currency, callbackUrl: `${window.location.origin}/checkout?order=${encodeURIComponent(reservedOrder.orderId)}`, source: moyasarSource, idempotencyKey: paymentKey.current });
    const redirectUrl = intent.redirectUrl ?? '';
    if (!redirectUrl) throw new Error(ar ? 'لم يرجع مزود الدفع رابطا للدفع.' : 'Payment provider did not return a checkout URL.');
    clear(); window.location.assign(redirectUrl);
  }

  function useLocation() {
    setError('');
    if (!navigator.geolocation) { setError(ar ? 'هذا المتصفح لا يدعم تحديد الموقع.' : 'Location is not supported by this browser.'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setAddress((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude, locationAccuracyM: Math.max(1, Math.round(coords.accuracy)) })),
      () => setError(ar ? 'تعذر الوصول للموقع. تحقق من إذن المتصفح.' : 'Could not access location. Check your browser permission.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function placeOrder(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (!lines.length) return;
    if (!selectedOption) { setError(ar ? 'أدخل عنوانا ضمن منطقة التوصيل واختر طريقة توصيل.' : 'Enter a covered address and choose a delivery option.'); return; }
    if (payment === 'CASH_ON_DELIVERY' && !selectedOption.supportsCod) { setError(ar ? 'الدفع عند الاستلام غير متاح لهذه الطريقة.' : 'Cash on delivery is unavailable for this service.'); return; }
    setBusy(true);
    try {
      if (demo) {
        const id = `BS-${Date.now().toString(36).toUpperCase()}`;
        const demoOrder: Order = { orderId: id, status: 'CONFIRMED', totalMinor, currency, subtotalMinor, shippingMinor, shippingMethodCode: selectedOption.methodCode, paymentMethod: payment, paymentStatus: 'COD_DUE', shippingAddress: address, shipment: { id: `shipment-${id}`, status: 'PENDING', estimatedDeliveryAt: new Date(Date.now() + selectedOption.maxDeliveryDays * 86400000).toISOString() } };
        try { localStorage.setItem('bitsooq.demo.orders.v1', JSON.stringify([demoOrder, ...JSON.parse(localStorage.getItem('bitsooq.demo.orders.v1') ?? '[]').filter((item: Order) => item.orderId !== id)].slice(0, 20))); } catch { /* Keep the receipt usable if browser storage is unavailable. */ }
        setDemoOrderId(id); setOrder(demoOrder); clear();
        return;
      }
      let savedAddress: ShippingAddress = { recipientName: address.recipientName, phone: address.phone, addressLine1: address.addressLine1, addressLine2: address.addressLine2, area: address.area, city: address.city, regionCode: address.regionCode, postalCode: address.postalCode, countryCode: address.countryCode, deliveryInstructions: address.deliveryInstructions, latitude: address.latitude, longitude: address.longitude, locationAccuracyM: address.locationAccuracyM };
      if (saveForLater && tokenPresent) {
        const input = { addressLabel: address.addressLabel || 'Home', recipientName: address.recipientName, phone: address.phone, addressLine1: address.addressLine1, addressLine2: address.addressLine2, area: address.area, city: address.city, regionCode: address.regionCode, postalCode: address.postalCode, countryCode: address.countryCode, deliveryInstructions: address.deliveryInstructions, latitude: address.latitude, longitude: address.longitude, locationAccuracyM: address.locationAccuracyM, defaultShipping: address.defaultShipping, defaultBilling: address.defaultBilling };
        const created = address.id && address.version != null ? await updateAddress(address.id, input, address.version) : await saveAddress(input);
        savedAddress = { recipientName: created.recipientName, phone: created.phone, addressLine1: created.addressLine1, addressLine2: created.addressLine2, area: created.area, city: created.city, regionCode: created.regionCode, postalCode: created.postalCode, countryCode: created.countryCode, deliveryInstructions: created.deliveryInstructions, latitude: created.latitude, longitude: created.longitude, locationAccuracyM: created.locationAccuracyM };
        setSaved((current) => [created, ...current.filter((item) => item.id !== created.id)]); setAddress(created);
      }
      const createdOrder = await createOrder(items, savedAddress, selectedOption.id, payment, orderKey.current);
      setOrder({ ...createdOrder, totalMinor: createdOrder.totalMinor ?? totalMinor, subtotalMinor: createdOrder.subtotalMinor ?? subtotalMinor, shippingMinor: createdOrder.shippingMinor ?? shippingMinor });
      if (payment === 'CASH_ON_DELIVERY') { clear(); return; }
      if (payment === 'MOYASAR') {
        await continueMoyasar(createdOrder);
        return;
      }
      const reservedOrder = await waitForReservation(createdOrder.orderId);
      if (reservedOrder.status !== 'RESERVED' || !reservedOrder.totalMinor) throw new Error(ar ? 'لم يصبح الطلب جاهزا للدفع بعد.' : 'The order is not ready for payment yet.');
      setNotice(ar ? 'تم إنشاء الطلب. أدخل تجزئة المعاملة بعد إرسال المبلغ.' : 'Order created. Enter the transaction hash after sending the exact amount.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : (ar ? 'تعذر إنشاء الطلب.' : 'Could not place the order.'));
    } finally { setBusy(false); }
  }

  async function verifyCrypto(event: FormEvent) {
    event.preventDefault(); if (!order) return;
    setBusy(true); setError(''); setCryptoResult('');
    try {
      const result = await verifyCryptoPayment({ orderId: order.orderId, txHash: cryptoHash.trim(), network: 'ethereum', expectedAmountMinor: order.totalMinor ?? totalMinor });
      setCryptoResult(result.status === 'PAID' ? (ar ? 'تم تأكيد الدفع.' : 'Payment verified.') : (result.reason ?? (ar ? 'تعذر تأكيد الدفع.' : 'Payment was not verified.')));
      if (result.status === 'PAID') clear();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not verify transaction.'); }
    finally { setBusy(false); }
  }

  if (demoOrderId) return <main id="main-content" className="checkout-page"><section className="checkout-success"><span className="checkout-success-icon"><PackageCheck size={30} /></span><p className="section-eyebrow"><span />{ar ? 'تم استلام الطلب' : 'ORDER RECEIVED'}</p><h1>{ar ? 'طلبك جاهز في العرض التجريبي.' : 'Your demo order is ready.'}</h1><p>{ar ? 'لن يتم تحصيل أي مبلغ حقيقي. تمت محاكاة الطلب والتوصيل عند الاستلام.' : 'No real payment was collected. This demo simulated the order and cash-on-delivery journey.'}</p><div className="checkout-receipt"><span>{ar ? 'رقم الطلب' : 'Order reference'}</span><b>{demoOrderId}</b><span>{ar ? 'الإجمالي شامل التوصيل' : 'Total including delivery'}</span><b>{formatMoney(order?.totalMinor ?? 0, currency, i18n.language)}</b><span>{ar ? 'طريقة التوصيل' : 'Delivery'}</span><b>{selectedOption?.methodName ?? 'Standard delivery'} · {selectedOption?.minDeliveryDays ?? 3}–{selectedOption?.maxDeliveryDays ?? 5} {ar ? 'أيام' : 'days'}</b></div><Link to={`/track?order=${encodeURIComponent(demoOrderId)}`} className="neon-button">{ar ? 'تتبع الطلب' : 'Track this order'}</Link><Link to="/" className="checkout-secondary-link">{ar ? 'متابعة التسوق' : 'Continue shopping'}</Link></section></main>;

  if (order && payment === 'CASH_ON_DELIVERY') return <main id="main-content" className="checkout-page"><section className="checkout-success"><span className="checkout-success-icon"><PackageCheck size={30} /></span><p className="section-eyebrow"><span />{ar ? 'تم استلام الطلب' : 'ORDER RECEIVED'}</p><h1>{ar ? 'سيتم الدفع عند الاستلام.' : 'Pay when your order arrives.'}</h1><p>{ar ? 'تم استلام طلبك. قد يستغرق تحديث حالة المخزون لحظات.' : 'Your order was received. Inventory confirmation may take a moment before shipping updates begin.'}</p><div className="checkout-receipt"><span>{ar ? 'رقم الطلب' : 'Order reference'}</span><b>{order.orderId}</b><span>{ar ? 'حالة الدفع' : 'Payment status'}</span><b>{order.paymentStatus ?? 'COD_DUE'}</b><span>{ar ? 'الإجمالي شامل التوصيل' : 'Total including delivery'}</span><b>{formatMoney(order.totalMinor ?? totalMinor, order.currency ?? currency, i18n.language)}</b><span>{ar ? 'التوصيل المتوقع' : 'Estimated delivery'}</span><b>{selectedOption?.minDeliveryDays}–{selectedOption?.maxDeliveryDays} {ar ? 'أيام' : 'days'}</b></div><Link to={`/track?order=${encodeURIComponent(order.orderId)}`} className="neon-button">{ar ? 'تتبع الطلب' : 'Track this order'}</Link><Link to="/" className="checkout-secondary-link">{ar ? 'متابعة التسوق' : 'Continue shopping'}</Link></section></main>;

  if (order && payment !== 'CASH_ON_DELIVERY') return <main id="main-content" className="checkout-page"><section className="checkout-success"><span className="checkout-success-icon">{payment === 'MOYASAR' ? <CreditCard size={27} /> : <Wallet size={27} />}</span><p className="section-eyebrow"><span />{ar ? 'الطلب قيد التجهيز' : 'ORDER PAYMENT'}</p><h1>{order.status === 'CONFIRMED' ? (ar ? 'تم تأكيد الطلب.' : 'Your order is confirmed.') : payment === 'MOYASAR' ? (ar ? 'الطلب جاهز للدفع.' : 'Your order is ready for payment.') : (ar ? 'الطلب بانتظار تأكيد المخزون.' : 'Waiting for stock confirmation.')}</h1><p>{ar ? 'رقم الطلب محفوظ. يمكنك تحديث حالة المخزون أو متابعة الشحنة في أي وقت.' : 'Your order reference is saved. Refresh its status or track the shipment at any time.'}</p><div className="checkout-receipt"><span>{ar ? 'رقم الطلب' : 'Order reference'}</span><b>{order.orderId}</b><span>{ar ? 'حالة الطلب' : 'Order status'}</span><b>{order.status}</b><span>{ar ? 'الإجمالي' : 'Order total'}</span><b>{formatMoney(order.totalMinor ?? totalMinor, order.currency ?? currency, i18n.language)}</b></div>{error && <p className="checkout-error">{error}</p>}{payment === 'MOYASAR' && order.status === 'RESERVED' && <button className="neon-button" disabled={busy} onClick={() => { setBusy(true); setError(''); void continueMoyasar(order).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not start payment.')).finally(() => setBusy(false)); }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}{ar ? 'متابعة إلى الدفع' : 'Continue to payment'}</button>}{payment === 'CRYPTO_USDT_ETH' && order.status === 'RESERVED' && <form className="checkout-crypto-form" onSubmit={(event) => void verifyCrypto(event)}><p>{ar ? 'أدخل تجزئة المعاملة بعد إرسال المبلغ الدقيق.' : 'Enter the transaction hash after sending the exact amount.'}</p><input className="field" required pattern="0x[0-9a-fA-F]{64}" placeholder="0x…" value={cryptoHash} onChange={(e) => setCryptoHash(e.target.value)} /><button className="neon-button" disabled={busy}>{busy ? 'Verifying…' : 'Verify transaction'}</button>{cryptoResult && <p className="checkout-inline-note"><Check size={15} />{cryptoResult}</p>}</form>}{order.status !== 'CONFIRMED' && <button className="checkout-location-button" disabled={busy} onClick={() => void refreshOrder()}>{busy ? (ar ? 'جارٍ التحديث…' : 'Refreshing…') : (ar ? 'تحديث حالة الطلب' : 'Refresh order status')}</button>}<Link to={`/track?order=${encodeURIComponent(order.orderId)}`} className="checkout-secondary-link">{ar ? 'فتح تتبع الشحنة' : 'Open shipment tracking'}</Link></section></main>;

  return (
    <main id="main-content" className="checkout-page">
      <Link to="/" className="checkout-back"><ArrowLeft size={15} /> {ar ? 'متابعة التسوق' : 'Continue shopping'}</Link>
      <div className="checkout-heading"><div><p className="section-eyebrow"><span />{ar ? 'توصيل آمن ومريح' : 'SECURE, CONVENIENT DELIVERY'}</p><h1>{ar ? 'إتمام الطلب' : 'Checkout'}</h1><p>{ar ? 'أين نرسل طلبك؟ اختر عنوانك وخدمة التوصيل.' : 'Where should we send your order? Choose an address and delivery service.'}</p></div><div className="checkout-trust"><ShieldCheck size={17} /><span>{ar ? 'بيانات العنوان محفوظة بأمان' : 'Your address is handled securely'}</span></div></div>
      {!lines.length ? <section className="checkout-empty"><PackageCheck size={28} /><h2>{ar ? 'سلتك فارغة' : 'Your cart is empty'}</h2><p>{ar ? 'أضف بعض المنتجات قبل إتمام الطلب.' : 'Add something from the store before checking out.'}</p><Link to="/#shop" className="neon-button">{ar ? 'استكشف المنتجات' : 'Explore products'}</Link></section> : (
        <form onSubmit={(event) => void placeOrder(event)} className="checkout-layout">
          <div className="checkout-main-column">
            <section className="checkout-card"><div className="checkout-section-heading"><span>01</span><div><h2>{ar ? 'عنوان التوصيل' : 'Delivery address'}</h2><p>{ar ? 'أدخل موقعا واضحا ليسهل على المندوب الوصول.' : 'Add clear location details so your courier can find you.'}</p></div></div>
              {saved.length > 0 && <><label className="checkout-label">{ar ? 'العناوين المحفوظة' : 'Saved addresses'}<select className="field" value={address.id ?? 'new'} onChange={(event) => chooseSaved(event.target.value)}><option value="new">{ar ? 'عنوان جديد' : 'Use a new address'}</option>{saved.map((item) => <option value={item.id} key={item.id}>{item.addressLabel} · {item.city} {item.defaultShipping ? '★' : ''}</option>)}</select></label>{address.id && <button type="button" className="checkout-secondary-link checkout-remove-address" disabled={busy} onClick={() => void removeSavedAddress()}>{ar ? 'إزالة العنوان المحفوظ' : 'Remove saved address'}</button>}</>}
              <div className="checkout-address-grid">
                <label className="checkout-label">{ar ? 'اسم المستلم' : 'Recipient name'}<input className="field" required maxLength={160} autoComplete="name" value={address.recipientName} onChange={(e) => setField('recipientName', e.target.value)} /></label>
                <label className="checkout-label">{ar ? 'رقم الهاتف' : 'Phone number'}<input className="field" required type="tel" maxLength={32} autoComplete="tel" placeholder="+92 300 1234567" value={address.phone} onChange={(e) => setField('phone', e.target.value)} /></label>
                <label className="checkout-label checkout-span-two">{ar ? 'عنوان الشارع والمنزل' : 'Street address'}<input className="field" required maxLength={240} autoComplete="address-line1" placeholder={ar ? 'المنزل، الشارع، المبنى' : 'House, street, building'} value={address.addressLine1} onChange={(e) => setField('addressLine1', e.target.value)} /></label>
                <label className="checkout-label">{ar ? 'تفاصيل إضافية' : 'Apartment / suite (optional)'}<input className="field" maxLength={240} autoComplete="address-line2" value={address.addressLine2 ?? ''} onChange={(e) => setField('addressLine2', e.target.value)} /></label>
                <label className="checkout-label">{ar ? 'المنطقة / الحي' : 'Area / neighbourhood'}<input className="field" maxLength={120} autoComplete="address-level3" value={address.area ?? ''} onChange={(e) => setField('area', e.target.value)} /></label>
                <label className="checkout-label">{ar ? 'المدينة' : 'City'}<input className="field" required maxLength={120} autoComplete="address-level2" value={address.city} onChange={(e) => setField('city', e.target.value)} /></label>
                <label className="checkout-label">{ar ? 'المحافظة / الولاية' : 'Province / region'}<input className="field" required maxLength={80} autoComplete="address-level1" placeholder={ar ? 'مثال: پنجاب' : 'e.g. Punjab'} value={address.regionCode} onChange={(e) => setField('regionCode', e.target.value)} /></label>
                <label className="checkout-label">{ar ? 'الرمز البريدي' : 'Postal code'}<input className="field" maxLength={24} autoComplete="postal-code" value={address.postalCode ?? ''} onChange={(e) => setField('postalCode', e.target.value)} /></label>
                <label className="checkout-label">{ar ? 'الدولة (رمز من حرفين)' : 'Country (2-letter code)'}<input className="field" required maxLength={2} minLength={2} pattern="[A-Z]{2}" autoComplete="country" placeholder="PK" value={address.countryCode} onChange={(e) => setField('countryCode', e.target.value.toUpperCase())} /></label>
                <label className="checkout-label checkout-span-two">{ar ? 'تعليمات للمندوب' : 'Delivery instructions (optional)'}<textarea className="field checkout-textarea" maxLength={500} placeholder={ar ? 'علامة قريبة، أفضل وقت، أو تعليمات البوابة' : 'Landmark, preferred time, or gate instructions'} value={address.deliveryInstructions ?? ''} onChange={(e) => setField('deliveryInstructions', e.target.value)} /></label>
              </div>
              <div className="checkout-location-tools"><button type="button" className="checkout-location-button" onClick={useLocation}><LocateFixed size={16} />{ar ? 'استخدام موقعي الحالي' : 'Use my current location'}</button><span>{address.latitude != null ? `${ar ? 'تم حفظ دبوس الموقع' : 'Location pin added'}${address.locationAccuracyM ? ` · ±${address.locationAccuracyM}m` : ''}` : (ar ? 'اختياري — يحفظ الإحداثيات فقط، دون تتبع مستمر.' : 'Optional — stores a pin only; no ongoing location tracking.')}</span></div>
              {tokenPresent && !demo && <label className="checkout-save-address"><input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} /><span>{address.id ? (ar ? 'حدّث هذا العنوان المحفوظ' : 'Update this saved address') : (ar ? 'احفظ هذا العنوان لحسابي' : 'Save this address to my account')}</span>{saveForLater && <input className="field checkout-label-input" aria-label={ar ? 'اسم العنوان' : 'Address label'} value={address.addressLabel} maxLength={60} onChange={(e) => setField('addressLabel', e.target.value)} />}</label>}
            </section>

            <section className="checkout-card"><div className="checkout-section-heading"><span>02</span><div><h2>{ar ? 'طريقة التوصيل' : 'Delivery options'}</h2><p>{ar ? 'السعر والمدة حسب منطقة العنوان.' : 'Price and delivery estimate are based on your address.'}</p></div></div>
              {!canQuote ? <div className="checkout-inline-note"><MapPin size={16} />{ar ? 'أدخل المدينة والمحافظة لعرض الخيارات المتاحة.' : 'Enter a city and region to see delivery services.'}</div> : loadingRates ? <div className="checkout-inline-note"><Loader2 size={16} className="animate-spin" />{ar ? 'نبحث عن خدمات التوصيل…' : 'Finding available delivery services…'}</div> : options.length === 0 ? <div className="checkout-inline-note checkout-warning"><Truck size={16} />{demo ? (ar ? 'العرض التجريبي يغطي لاهور، كراتشي، إسلام آباد، روالبندي، وفيصل آباد.' : 'Demo coverage includes Lahore, Karachi, Islamabad, Rawalpindi and Faisalabad.') : (ar ? 'لا توجد خدمة مفعلة لهذه المنطقة. تحقق من المدينة/الرمز البريدي أو تواصل مع المتجر.' : 'No delivery service is configured for this area. Check the city/postal code or contact the store.')}</div> : <div className="checkout-delivery-options">{options.map((option) => <label key={option.id} className={`checkout-option ${selectedRate === option.id ? 'is-selected' : ''}`}><input type="radio" name="deliveryRate" checked={selectedRate === option.id} onChange={() => { orderKey.current = crypto.randomUUID(); setSelectedRate(option.id); }} /><span className="checkout-option-icon"><Truck size={17} /></span><span className="checkout-option-copy"><b>{option.methodName}</b><small>{option.minDeliveryDays}–{option.maxDeliveryDays} {ar ? 'أيام عمل' : 'business days'}{option.supportsCod ? ` · ${ar ? 'الدفع عند الاستلام متاح' : 'COD available'}` : ''}</small></span><strong>{formatMoney(option.feeMinor, option.currency, i18n.language)}</strong></label>)}</div>}
            </section>

            <section className="checkout-card"><div className="checkout-section-heading"><span>03</span><div><h2>{ar ? 'طريقة الدفع' : 'Payment method'}</h2><p>{ar ? 'اختر طريقة الدفع المناسبة.' : 'Choose how you would like to pay.'}</p></div></div>
              <div className="checkout-payment-options">
                <label className={`checkout-payment-option ${payment === 'CASH_ON_DELIVERY' ? 'is-selected' : ''} ${!selectedOption?.supportsCod ? 'is-disabled' : ''}`}><input type="radio" name="payment" disabled={!selectedOption?.supportsCod} checked={payment === 'CASH_ON_DELIVERY'} onChange={() => setPayment('CASH_ON_DELIVERY')} /><span><PackageCheck size={17} /><b>{ar ? 'الدفع عند الاستلام' : 'Cash on delivery'}</b><small>{ar ? 'ادفع للمندوب عند وصول طلبك' : 'Pay the courier when your order arrives'}</small></span></label>
                <label className={`checkout-payment-option ${payment === 'MOYASAR' ? 'is-selected' : ''} ${demo ? 'is-disabled' : ''}`}><input type="radio" name="payment" disabled={demo} checked={payment === 'MOYASAR'} onChange={() => setPayment('MOYASAR')} /><span><CreditCard size={17} /><b>{ar ? 'بطاقة / مدى' : 'Card / Mada'}</b><small>{demo ? (ar ? 'متاح عند ربط المتجر بالخدمات الحية' : 'Available when live services are connected') : 'Visa · Mastercard · Mada · Apple Pay'}</small></span></label>
                <label className={`checkout-payment-option ${payment === 'CRYPTO_USDT_ETH' ? 'is-selected' : ''} ${demo ? 'is-disabled' : ''}`}><input type="radio" name="payment" disabled={demo} checked={payment === 'CRYPTO_USDT_ETH'} onChange={() => setPayment('CRYPTO_USDT_ETH')} /><span><Wallet size={17} /><b>{ar ? 'عملة رقمية' : 'Crypto payment'}</b><small>{demo ? (ar ? 'متاح عند ربط المتجر بالخدمات الحية' : 'Available when live services are connected') : 'USDT · Ethereum'}</small></span></label>
              </div>
              {!demo && payment === 'MOYASAR' && <label className="checkout-label checkout-provider-choice">{ar ? 'مصدر الدفع' : 'Payment type'}<select className="field" value={moyasarSource} onChange={(e) => setMoyasarSource(e.target.value as typeof moyasarSource)}><option value="creditcard">Credit / debit card</option><option value="mada">Mada</option><option value="applepay">Apple Pay</option></select></label>}
            </section>
          </div>

          <aside className="checkout-summary"><div className="checkout-summary-title"><h2>{ar ? 'ملخص الطلب' : 'Order summary'}</h2><span>{lines.length} {ar ? 'منتجات' : lines.length === 1 ? 'item' : 'items'}</span></div><div className="checkout-summary-items">{lines.map(({ product, qty }) => <div className="checkout-summary-item" key={product.sku}><span><b>{product.name}</b><small>Qty {qty}</small></span><strong>{formatMoney(product.priceMinor * qty, product.currency, i18n.language)}</strong></div>)}</div><div className="checkout-summary-row"><span>{ar ? 'المجموع الفرعي' : 'Subtotal'}</span><b>{formatMoney(subtotalMinor, currency, i18n.language)}</b></div><div className="checkout-summary-row"><span>{ar ? 'التوصيل' : 'Delivery'}</span><b>{selectedOption ? formatMoney(shippingMinor, selectedOption.currency, i18n.language) : '—'}</b></div><div className="checkout-summary-total"><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{formatMoney(totalMinor, selectedOption?.currency ?? currency, i18n.language)}</strong></div>{error && <p className="checkout-error" role="alert">{error}</p>}{notice && <p className="checkout-inline-note">{notice}</p>}<button className="neon-button checkout-submit" type="submit" disabled={busy || !lines.length || !selectedOption || !canQuote}>{busy ? <><Loader2 size={16} className="animate-spin" />{ar ? 'جارٍ تجهيز الطلب…' : 'Placing order…'}</> : payment === 'CASH_ON_DELIVERY' ? (ar ? 'تأكيد الطلب' : 'Place order') : (ar ? 'متابعة الدفع' : 'Continue to payment')}</button><p className="checkout-security"><ShieldCheck size={14} />{demo ? (ar ? 'وضع عرض تجريبي — لا يتم تحصيل أموال.' : 'Demo mode — no money will be collected.') : (ar ? 'يتم تأكيد السعر والعنوان وطريقة التوصيل قبل إنشاء الطلب.' : 'Price, address and delivery service are confirmed before order creation.')}</p></aside>
        </form>
      )}
    </main>
  );
}
