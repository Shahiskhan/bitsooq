import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, Trash2, ShoppingBag, X, ArrowRight } from 'lucide-react';
import { useCart, formatMoney } from '../lib/store';
import { productImages } from '../mock/products';

interface Props {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartDrawer({ open, onClose, onCheckout }: Props) {
  const { t, i18n } = useTranslation();
  const { lines, count, subtotalMinor, setQty, remove, clear } = useCart();
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    const firstControl = drawer?.querySelector<HTMLElement>('button, a, input, select, textarea');
    firstControl?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'Tab' || !drawer) return;
      const controls = Array.from(drawer.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const ar = i18n.language === 'ar';
  return (
    <div className="drawer-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={drawerRef} className="cart-drawer" role="dialog" aria-modal="true" aria-label={t('cart.title')}>
        <div className="drawer-header flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ShoppingBag size={18} className="text-cyan-neon" /> {t('cart.title')} <span className="text-slate-500">({count})</span>
          </h2>
          <button className="ghost-button drawer-close" onClick={onClose} aria-label={ar ? 'إغلاق السلة' : 'Close cart'}>
            <X size={16} />
          </button>
        </div>
        <div className="drawer-lines flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 && <div className="cart-empty"><span><ShoppingBag size={27} /></span><h3>{t('cart.empty')}</h3><p>{ar ? 'ابدأ باكتشاف المنتجات المختارة.' : 'Start with a few thoughtful finds.'}</p><button className="ghost-button" onClick={onClose}>{ar ? 'متابعة التسوق' : 'Continue shopping'} <ArrowRight size={14} className="rtl:rotate-180" /></button></div>}
          {lines.map(({ product, qty }) => (
            <div key={product.sku} className="drawer-line">
              <div className="drawer-line-image">{productImages[product.sku] && <img src={productImages[product.sku]} alt="" loading="lazy" />}</div>
              <div className="drawer-line-name">
                <h3 className="truncate text-sm font-semibold text-white">{i18n.language === 'ar' && product.nameAr ? product.nameAr : product.name}</h3>
                <small className="text-slate-500"><bdi dir="ltr">{product.sku}</bdi></small>
                <b className="drawer-line-total">{formatMoney(product.priceMinor * qty, product.currency, i18n.language)}</b>
              </div>
              <div className="qty-stepper">
                <button className="qty-button" onClick={() => setQty(product.sku, qty - 1)} aria-label={ar ? 'تقليل الكمية' : 'Decrease quantity'}>
                  <Minus size={12} />
                </button>
                <span className="qty-number" dir="ltr">{qty}</span>
                <button className="qty-button" onClick={() => setQty(product.sku, qty + 1)} aria-label={ar ? 'زيادة الكمية' : 'Increase quantity'}>
                  <Plus size={12} />
                </button>
              </div>
              <button className="remove-line" onClick={() => remove(product.sku)} aria-label={t('cart.remove')}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        {lines.length > 0 && (
          <div className="drawer-summary border-t border-line px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-slate-400">{t('cart.subtotal')}</span>
              <b className="text-lg text-white">{formatMoney(subtotalMinor, lines[0]?.product.currency ?? 'USD', i18n.language)}</b>
            </div>
            <button className="neon-button w-full" onClick={onCheckout}>
              {t('cart.checkout')}
            </button>
            <button className="mt-2 w-full text-xs text-slate-500 hover:text-red-400" onClick={clear}>
              {t('cart.clear')}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
