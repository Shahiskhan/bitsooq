import { useTranslation } from 'react-i18next';
import { ArrowRight, BadgePercent, Check, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productImages } from '../mock/products';

export default function Hero() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return (
    <>
      <section className="market-hero">
        <div className="market-hero-inner mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.02fr_.98fr]">
          <div className="market-hero-copy">
            <span className="market-hero-kicker"><span />{ar ? 'اكتشف أشياء تحبها' : 'A little more joy in every day'}</span>
            <h1>{ar ? <>تسوّق الأشياء<br /><em>التي تحبها.</em></> : <>Good finds.<br /><em>Better everyday.</em></>}</h1>
            <p>{ar ? 'منتجات مختارة للمنزل والتقنية والأزياء، في مكان واحد سهل الاستخدام.' : 'Shop everyday essentials, thoughtful home finds and the latest tech in one easy place.'}</p>
            <div className="market-hero-actions"><Link to="/#shop" className="market-primary-button">{ar ? 'ابدأ التسوق' : 'Shop the collection'} <ArrowRight size={17} /></Link><span><ShieldCheck size={16} />{ar ? 'تظهر خيارات الدفع عند إعداد المتجر' : 'Payment options appear when configured'}</span></div>
            <div className="market-hero-perks"><span><Truck size={17} /><b>{ar ? 'تجربة مهيأة للسوق المحلي' : 'Made for local shopping'}</b></span><span><Check size={17} /><b>{ar ? 'توفر واضح' : 'Clear availability'}</b></span><span><BadgePercent size={17} /><b>{ar ? 'اختيارات متنوعة' : 'A mix of good finds'}</b></span></div>
          </div>
          <div className="market-hero-art" aria-label={ar ? 'اختيارات السوق لهذا الأسبوع' : 'This week’s marketplace picks'}>
            <div className="market-hero-splash" />
            <div className="market-hero-product market-hero-product-main"><img src={productImages['DESK-LAMP-05']} alt="Modern desk lamp" fetchPriority="high" /><span>{ar ? 'اختيار الأسبوع' : 'Editor’s pick'}</span></div>
            <div className="market-hero-product market-hero-product-small"><img src={productImages['CERAMIC-MUG-01']} alt="Handmade ceramic mug" /><span>{ar ? 'صُنع بعناية' : 'Made with care'}</span></div>
            <div className="market-hero-deal"><small>{ar ? 'تسوّق واكتشف' : 'SHOP SOMETHING NEW'}</small><strong>{ar ? 'كل ما تحب، في مكان واحد' : 'Find your next favourite'}</strong><Link to="/#shop">{ar ? 'تصفّح الآن' : 'Explore now'} <ArrowRight size={14} /></Link></div>
            <span className="market-hero-sparkle market-sparkle-one">✳</span><span className="market-hero-sparkle market-sparkle-two">✦</span>
          </div>
        </div>
      </section>
      <div className="market-benefits mx-auto max-w-7xl px-4 sm:px-6">
        <div><span><Truck size={19} /></span><p><b>{ar ? 'معلومات الطلب' : 'Order information'}</b><small>{ar ? 'حسب إعدادات المتجر' : 'Based on store setup'}</small></p></div>
        <div><span><ShieldCheck size={19} /></span><p><b>{ar ? 'خيارات الدفع' : 'Payment options'}</b><small>{ar ? 'عند ربط مزود الدفع' : 'Shown when a provider is connected'}</small></p></div>
        <div><span><Check size={19} /></span><p><b>{ar ? 'منتجات موثوقة' : 'Quality picks'}</b><small>{ar ? 'اختيارات نهتم بها' : 'Selected with care'}</small></p></div>
        <div><span><BadgePercent size={19} /></span><p><b>{ar ? 'عروض مميزة' : 'Great value'}</b><small>{ar ? 'اكتشف شيئاً جديداً' : 'Find a good deal'}</small></p></div>
      </div>
    </>
  );
}
