import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ShoppingCart, Search, Menu, X, MapPin, PackageCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toggleLanguage } from '../i18n';
import { useCart } from '../lib/store';

export default function Header({ onOpenCart }: { onOpenCart: () => void }) {
  const { t, i18n } = useTranslation();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => setSearch(new URLSearchParams(location.search).get('q') ?? ''), [location.search]);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    const query = params.toString();
    navigate(`/${query ? `?${query}` : ''}#shop`);
    closeMenu();
  };
  const ar = i18n.language === 'ar';

  return (
    <header className="market-header sticky top-0 z-40">
      <div className="market-topline"><div className="market-topline-inner"><span><MapPin size={13} />{ar ? 'تجربة تسوق مصممة لباكستان' : 'Shopping designed for Pakistan'}</span><span>{ar ? 'خيارات التوصيل والدفع تعتمد على إعداد المتجر' : 'Delivery and payment options depend on store setup'}</span></div></div>
      <div className="market-main-row mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6">
        <button className="market-icon-button mobile-menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <Link to="/" className="brand-lockup market-brand" onClick={closeMenu} aria-label="BitSooq home">
          <span className="brand-symbol" aria-hidden="true"><i /></span>
          <span className="brand-copy"><span className="brand-word">Bit<span>Sooq</span></span><span className="brand-ar" lang="ur">بازار، آسان</span></span>
        </Link>
        <form className="market-search" onSubmit={submitSearch} role="search">
          <Search size={18} aria-hidden="true" />
          <input aria-label={ar ? 'ابھی خریداری تلاش کریں' : 'Search for products'} placeholder={ar ? 'اپنی پسند کی چیز تلاش کریں' : 'Search products, brands and categories'} value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button type="button" className="market-search-clear" onClick={() => setSearch('')} aria-label={ar ? 'مسح البحث' : 'Clear search'}><X size={15} /></button>}
          <button type="submit" className="market-search-submit">{ar ? 'بحث' : 'Search'}</button>
        </form>
        <div className="market-actions">
          <button type="button" className="market-locale" onClick={toggleLanguage} aria-label="Toggle language"><Languages size={17} /><span>{t('nav.language')}</span></button>
          <Link to="/#shop" className="market-orders" onClick={closeMenu}><PackageCheck size={19} /><span>{ar ? 'تسوّق' : 'Shop'}</span></Link>
          <button type="button" className="market-cart" onClick={() => { closeMenu(); onOpenCart(); }} aria-label={`${t('nav.cart')}${count ? `, ${count}` : ''}`}>
            <span className="market-cart-icon"><ShoppingCart size={21} />{count > 0 && <span className="cart-count">{count}</span>}</span><span>{ar ? 'السلة' : 'Cart'}</span>
          </button>
        </div>
      </div>
      <nav className={`market-category-nav ${menuOpen ? 'market-category-nav-open' : ''}`} aria-label={ar ? 'فئات التسوق' : 'Shop departments'}>
        <div className="market-category-inner mx-auto max-w-7xl px-4 sm:px-6">
          <Link to="/#shop" onClick={closeMenu}>{ar ? 'كل المنتجات' : 'All products'}</Link>
          <Link to="/?category=tech#shop" onClick={closeMenu}>{ar ? 'الإلكترونيات' : 'Electronics'}</Link>
          <Link to="/?category=fashion#shop" onClick={closeMenu}>{ar ? 'الأزياء' : 'Fashion'}</Link>
          <Link to="/?category=home#shop" onClick={closeMenu}>{ar ? 'المنزل والمطبخ' : 'Home & kitchen'}</Link>
          <Link to="/?category=grocery#shop" onClick={closeMenu}>{ar ? 'البقالة' : 'Grocery'}</Link>
          <span className="market-nav-note">{ar ? 'اكتشف اختيارات جديدة' : 'Everyday picks to explore'}</span>
        </div>
      </nav>
    </header>
  );
}
