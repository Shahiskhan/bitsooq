import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Footer() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return (
    <footer className="site-footer">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 sm:px-6 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
        <div>
          <Link to="/" className="brand-lockup footer-brand">
            <span className="brand-symbol" aria-hidden="true"><i /></span>
            <span className="brand-copy"><span className="brand-word">Bit<span>Sooq</span></span><span className="brand-ar" lang="ar">بيت سوق</span></span>
          </Link>
          <p className="mt-3 max-w-sm text-xs text-slate-400">{ar ? 'اكتشف منتجات يومية واختيارات مميزة من مكان واحد.' : 'Everyday shopping and thoughtful finds, in one place.'}</p>
        </div>
        <nav className="footer-links" aria-label={ar ? 'روابط التذييل' : 'Footer links'}>
          <Link to="/#shop">{ar ? 'المتجر' : 'Store'}</Link>
          <Link to="/#shop">{ar ? 'كل المنتجات' : 'All products'}</Link>
          <Link to="/?category=home#shop">{ar ? 'المنزل والمعيشة' : 'Home & living'}</Link>
          <Link to="/?category=tech#shop">{ar ? 'التقنية' : 'Tech & gadgets'}</Link>
          <a href="mailto:hello@bitsooq.com">{ar ? 'تواصل معنا' : 'Contact us'}</a>
        </nav>
        <div className="market-footer-promise">{ar ? 'تسوّق بسهولة من باكستان' : 'Made for everyday shopping in Pakistan'}</div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-slate-400 sm:px-6">
          <span>BitSooq — © 2026</span><span>{ar ? 'واجهة تجريبية — خيارات الدفع الفعلية تعتمد على إعداد المتجر.' : 'Store preview · Live payment methods depend on provider setup.'}</span>
        </div>
      </div>
    </footer>
  );
}
