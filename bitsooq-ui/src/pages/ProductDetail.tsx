import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowRight, Check, CreditCard, PackageCheck, ShieldCheck, Truck, Wallet } from 'lucide-react';
import { getProducts, type Product } from '../lib/api';
import { formatMoney, useCart } from '../lib/store';
import { productImages, seedProducts } from '../mock/products';
import ProductCard from '../components/ProductCard';
import StockBadge from '../components/StockBadge';

type CustomerOutlet = { openCart: () => void };
type DetailTab = 'details' | 'shipping' | 'reviews';

export default function ProductDetail() {
  const { sku = '' } = useParams();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { add } = useCart();
  const { openCart } = useOutletContext<CustomerOutlet>();
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [loading, setLoading] = useState(import.meta.env.VITE_USE_MOCK !== 'true');
  const [demoMode, setDemoMode] = useState(import.meta.env.VITE_USE_MOCK === 'true');
  const [tab, setTab] = useState<DetailTab>('details');
  const [added, setAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const ar = i18n.language === 'ar';

  useEffect(() => {
    if (import.meta.env.VITE_USE_MOCK === 'true') return;
    let active = true;
    setLoading(true);
    getProducts().then((items) => {
      if (!active) return;
      if (items.length) { setProducts(items); setDemoMode(false); }
      else setDemoMode(true);
    }).catch(() => { if (active) setDemoMode(true); /* Keep the bilingual catalog available while services are being built. */ }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setImageFailed(false);
    setAdded(false);
    setTab('details');
  }, [sku]);

  const product = products.find((item) => item.sku === sku && item.active);
  const image = product ? productImages[product.sku] : undefined;
  const related = product ? products.filter((item) => item.active && item.categoryId === product.categoryId && item.sku !== product.sku).slice(0, 4) : [];
  const name = product ? (ar && product.nameAr ? product.nameAr : product.name) : '';
  const description = product ? (ar && product.descriptionAr ? product.descriptionAr : product.descriptionEn) : '';

  useEffect(() => {
    if (!product) return;
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = descriptionMeta?.content;
    document.title = `${name} · BitSooq`;
    if (descriptionMeta) descriptionMeta.content = description ?? name;
    return () => {
      document.title = previousTitle;
      if (descriptionMeta && previousDescription !== undefined) descriptionMeta.content = previousDescription;
    };
  }, [product?.sku, name, description]);
  const addToCart = (buyNow = false) => {
    if (!product || product.availableStock <= 0) return;
    add(product);
    setAdded(true);
    if (buyNow) navigate('/checkout');
    else openCart();
  };

  if (loading && !product) return <main className="product-detail-loading"><span /><span /><span /></main>;
  if (!product) return <main className="product-not-found"><p className="section-eyebrow"><span />{ar ? 'المنتج غير موجود' : 'PRODUCT NOT FOUND'}</p><h1>{ar ? 'تعذر العثور على هذا المنتج' : 'We could not find that product.'}</h1><Link to="/#shop" className="neon-button">{ar ? 'العودة إلى المتجر' : 'Back to the store'} <ArrowRight size={16} /></Link></main>;

  return (
    <main id="main-content" className="product-detail-page">
      <div className="product-detail-wrap mx-auto max-w-7xl px-4 pb-20 pt-7 sm:px-6 sm:pt-10">
        <nav className="product-breadcrumb" aria-label={ar ? 'مسار التنقل' : 'Breadcrumb'}>
          <Link to="/">{ar ? 'الرئيسية' : 'Home'}</Link><span>/</span><Link to="/#shop">{ar ? 'المتجر' : 'Shop'}</Link><span>/</span><span aria-current="page">{name}</span>
        </nav>
        {demoMode && <p className="product-demo-note">{ar ? 'معاينة — بيانات المنتج الحالية بيانات تجريبية محلية.' : 'Preview — this product is shown from the local seed catalog.'}</p>}
        <div className="product-detail-grid">
          <div className="product-detail-gallery">
            <div className="product-detail-image">
              {!imageFailed && image ? <img src={image} alt={name} fetchPriority="high" onError={() => setImageFailed(true)} /> : <div className={`product-art product-art-${product.categoryId ?? 'home'}`} aria-hidden="true"><span>✦</span><i /><b /></div>}
              <div className="product-detail-image-shade" />
              <StockBadge stock={product.availableStock} />
              <span className="product-gallery-label">BITSOOQ · {product.categoryId?.toUpperCase()}</span>
            </div>
            <div className="product-gallery-caption"><span className="product-gallery-dot" /><span>{ar ? 'صور المنتج' : 'Product photography'}</span><span className="product-gallery-caption-line" /></div>
          </div>
          <div className="product-detail-info">
            <p className="section-eyebrow"><span />{ar ? 'اختيار من الكتالوج' : 'A considered selection'}</p>
            <p className="product-detail-category">{product.categoryId?.replace('-', ' ').toUpperCase()}</p>
            <h1>{name}</h1>
            <p className="product-detail-description">{description}</p>
            <div className="product-detail-price-row"><strong>{formatMoney(product.priceMinor, product.currency, i18n.language)}</strong><span>{ar ? 'شامل السعر المعروض' : 'Price shown in your selected currency'}</span></div>
            <div className="product-detail-stock"><StockBadge stock={product.availableStock} /><span>{product.availableStock > 0 ? (ar ? `${product.availableStock} متاح` : `${product.availableStock} available`) : (ar ? 'نفد المخزون' : 'Currently unavailable')}</span></div>
            {added && <p className="product-added-note" role="status"><Check size={15} />{ar ? 'أُضيف المنتج إلى السلة' : 'Added to your cart'}</p>}
            <div className="product-detail-actions">
              <button type="button" className="neon-button product-buy-button" disabled={product.availableStock <= 0} onClick={() => addToCart(true)}>{ar ? 'اشتر الآن' : 'Buy now'} <ArrowRight size={16} className="rtl:rotate-180" /></button>
              <button type="button" className="product-add-secondary" disabled={product.availableStock <= 0} onClick={() => addToCart()}>{ar ? 'أضف إلى السلة' : 'Add to cart'}</button>
            </div>
            <div className="product-payment-note"><ShieldCheck size={16} /><span>{ar ? 'اختر طريقة الدفع في الخطوة التالية.' : 'Choose your payment method at checkout.'}</span></div>
            <div className="product-payment-options">
              <span><CreditCard size={15} />Moyasar</span><span><Wallet size={15} />Crypto <small>BETA</small></span>
            </div>
            <div className="product-promise-row"><span><PackageCheck size={16} />{ar ? 'مخزون واضح' : 'Live stock status'}</span><span><Truck size={16} />{ar ? 'تفاصيل الشحن عند الدفع' : 'Shipping details at checkout'}</span></div>
          </div>
        </div>

        <section className="product-information" aria-label={ar ? 'معلومات المنتج' : 'Product information'}>
          <div className="product-tabs" role="tablist" aria-label={ar ? 'تفاصيل المنتج' : 'Product details'}>
            {(['details', 'shipping', 'reviews'] as const).map((key) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'product-tab-active' : ''} onClick={() => setTab(key)}>{ar ? ({ details: 'التفاصيل', shipping: 'الشحن', reviews: 'التقييمات' }[key]) : ({ details: 'Details', shipping: 'Shipping', reviews: 'Reviews' }[key])}</button>)}
          </div>
          <div className="product-tab-panel" role="tabpanel">
            {tab === 'details' && <div className="product-details-copy"><div><p className="section-eyebrow"><span />{ar ? 'عن المنتج' : 'ABOUT THIS PRODUCT'}</p><h2>{ar ? 'تفاصيل المنتج' : 'Product overview'}</h2></div><p>{description}</p><dl><div><dt>{ar ? 'رمز المنتج' : 'SKU'}</dt><dd>{product.sku}</dd></div><div><dt>{ar ? 'الفئة' : 'Category'}</dt><dd>{product.categoryId}</dd></div><div><dt>{ar ? 'التوفر' : 'Availability'}</dt><dd>{product.availableStock > 0 ? (ar ? 'متوفر' : 'In stock') : (ar ? 'غير متوفر' : 'Out of stock')}</dd></div></dl></div>}
            {tab === 'shipping' && <div className="product-details-copy"><div><p className="section-eyebrow"><span />{ar ? 'التوصيل' : 'DELIVERY INFORMATION'}</p><h2>{ar ? 'تفاصيل واضحة عند الدفع.' : 'The details before you pay.'}</h2></div><p>{ar ? 'تظهر خيارات الشحن والمدة المتوقعة في صفحة الدفع عند تهيئة قواعد التاجر.' : 'Shipping options and estimated delivery are shown at checkout once merchant delivery rules are configured.'}</p></div>}
            {tab === 'reviews' && <div className="product-details-copy"><div><p className="section-eyebrow"><span />{ar ? 'آراء المشترين' : 'CUSTOMER REVIEWS'}</p><h2>{ar ? 'تقييمات موثقة قريباً.' : 'Verified reviews, when available.'}</h2></div><p>{ar ? 'لا توجد تقييمات موثقة لهذا المنتج بعد.' : 'There are no verified reviews for this product yet.'}</p></div>}
          </div>
        </section>

        {related.length > 0 && <section className="related-products"><div className="related-heading"><div><p className="section-eyebrow"><span />{ar ? 'استكشف المزيد' : 'KEEP EXPLORING'}</p><h2>{ar ? 'قد يعجبك أيضاً' : 'More from this collection'}</h2></div><Link to="/#shop">{ar ? 'كل المنتجات' : 'View all products'} <ArrowRight size={15} /></Link></div><div className="product-grid">{related.map((item) => <ProductCard key={item.sku} product={item} />)}</div></section>}
      </div>
    </main>
  );
}
