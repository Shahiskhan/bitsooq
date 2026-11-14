import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowUpRight, Plus, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../lib/api';
import { formatMoney, useCart } from '../lib/store';
import { productImages } from '../mock/products';
import StockBadge from './StockBadge';

export default function ProductCard({ product, onAdded }: { product: Product; onAdded?: () => void }) {
  const { i18n } = useTranslation();
  const { add } = useCart();
  const [imageFailed, setImageFailed] = useState(false);
  const ar = i18n.language === 'ar';
  const image = product.imageUrl || productImages[product.sku];
  const name = ar && product.nameAr ? product.nameAr : product.name;
  const discount = product.compareAtMinor && product.compareAtMinor > product.priceMinor
    ? Math.round((1 - product.priceMinor / product.compareAtMinor) * 100)
    : 0;
  return (
    <article className="product-card group market-product-card">
      <Link to={`/product/${encodeURIComponent(product.sku)}`} className="product-card-link" aria-label={`${ar ? 'عرض تفاصيل' : 'View details for'} ${name}`}>
        <div className="product-media market-product-media">
          {!imageFailed && image ? <img src={image} alt={name} loading="lazy" width="900" height="675" onError={() => setImageFailed(true)} /> : <div className={`product-art product-art-${product.categoryId ?? 'home'}`} aria-hidden="true"><span><Package size={42} /></span><i /><b /></div>}
          {discount > 0 && <span className="product-deal-badge">-{discount}%</span>}
          {product.badge && <span className="product-editor-badge">{product.badge}</span>}
        </div>
      </Link>
      <div className="product-card-body market-product-body">
        <div className="market-product-title"><h3><Link to={`/product/${encodeURIComponent(product.sku)}`}>{name}</Link></h3><span className="market-product-open"><ArrowUpRight size={15} /></span></div>
        {product.ratingAverage != null && <div className="market-product-rating" aria-label={`${product.ratingAverage} out of 5 stars`}><span>★</span><b>{product.ratingAverage.toFixed(1)}</b><small>({product.reviewCount ?? 0})</small></div>}
        <div className="market-product-price-row"><b>{formatMoney(product.priceMinor, product.currency, i18n.language)}</b>{product.compareAtMinor && product.compareAtMinor > product.priceMinor && <del>{formatMoney(product.compareAtMinor, product.currency, i18n.language)}</del>}</div>
        <div className="market-product-meta"><StockBadge stock={product.availableStock} /><span>{product.availableStock > 0 ? (ar ? 'التوفر موضح' : 'Availability shown') : (ar ? 'غير متوفر' : 'Out of stock')}</span></div>
        <button className="product-add-button market-add-button" disabled={product.availableStock <= 0} onClick={() => { add(product); onAdded?.(); }}><span><Plus size={15} />{ar ? 'أضف إلى السلة' : 'Add to basket'}</span><ArrowRight size={14} /></button>
      </div>
    </article>
  );
}
