import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Store } from 'lucide-react';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import AdminGate from './components/AdminGate';
import Storefront from './pages/Storefront';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import OrderTracking from './pages/OrderTracking';
import Login from './pages/Login';
import { CartProvider } from './lib/store';
import Footer from './components/Footer';

type CustomerOutlet = { openCart: () => void };

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    const frame = window.requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}

function CustomerLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const openCart = () => setDrawerOpen(true);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header onOpenCart={openCart} />
      <div className="flex-1"><Outlet context={{ openCart }} /></div>
      <Footer />
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onCheckout={() => { setDrawerOpen(false); navigate('/checkout'); }} />
    </div>
  );
}

function StorefrontRoute() {
  const { openCart } = useOutletContext<CustomerOutlet>();
  return <Storefront onOpenCart={openCart} />;
}

function ProductDetailRoute() {
  return <ProductDetail />;
}

function NotFound() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return <main id="main-content" className="product-not-found"><p className="section-eyebrow"><span />404 · {ar ? 'الصفحة غير موجودة' : 'NOT FOUND'}</p><h1>{ar ? 'هذه الصفحة غير موجودة.' : 'This page is not here.'}</h1><p className="not-found-copy">{ar ? 'المتجر ما زال مفتوحاً. ارجع إلى المنتجات لمتابعة التصفح.' : 'The store is still open. Head back to the catalog to keep looking.'}</p><Link to="/#shop" className="neon-button"><ArrowLeft size={16} className="rtl:rotate-180" /> {ar ? 'العودة إلى المتجر' : 'Back to the store'}</Link><Store className="not-found-watermark" aria-hidden="true" /></main>;
}

export default function App() {
  return (
    <CartProvider>
      <ScrollManager />
      <Routes>
        <Route path="/admin/*" element={<AdminGate />} />
        <Route path="/login" element={<Login />} />
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<StorefrontRoute />} />
          <Route path="/product/:sku" element={<ProductDetailRoute />} />
          <Route path="/cart" element={<Checkout />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/track" element={<OrderTracking />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </CartProvider>
  );
}
