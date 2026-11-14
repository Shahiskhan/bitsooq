import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export type Language = 'en' | 'ar';

const resources = {
  en: {
    translation: {
      brand: 'BitSooq',
      tagline: 'The marketplace of the future',
      nav: { store: 'Store', dashboard: 'Dashboard', cart: 'Cart', language: 'العربية' },
      hero: {
        badge: 'Hybrid payments · Fiat + Web3',
        title1: 'Sell everywhere.',
        title2: 'Pay any way.',
        subtitle:
          'BitSooq is an enterprise marketplace with instant Mada & card payments via Moyasar, and direct wallet-to-merchant crypto checkout — all in a bilingual experience.',
        cta: 'Explore products',
      },
      search: { placeholder: 'Search products…' },
      product: { inStock: 'In stock', outOfStock: 'Sold out', low: 'Low stock', add: 'Add to cart', stockLeft: '{{count}} left' },
      cart: {
        title: 'Your cart',
        empty: 'Your cart is empty.',
        subtotal: 'Subtotal',
        checkout: 'Proceed to checkout',
        clear: 'Clear cart',
        remove: 'Remove',
      },
      checkout: {
        title: 'Checkout',
        method: 'Payment method',
        moyasar: 'Instant Pay',
        moyasarDesc: 'Mada · Visa · MasterCard · Apple Pay — powered by Moyasar',
        crypto: 'Crypto Web3 Pay',
        cryptoDesc: 'Pay from MetaMask or WalletConnect directly to the merchant wallet',
        payNow: 'Pay now',
        connectWallet: 'Connect Wallet',
        verifying: 'Verifying on-chain…',
        merchantAddress: 'Merchant address',
        network: 'Network',
        amount: 'Amount',
        betaBadge: 'v2.0 Beta · Testnet ready',
        copy: 'Copy',
        copied: 'Copied!',
        sendExact: 'Send the exact amount shown — the transaction is verified on-chain against your order.',
        txHash: 'Transaction hash',
        verify: 'Verify payment',
        status: 'Status',
        paid: 'Payment confirmed 🎉',
        failed: 'Verification failed',
      },
      dashboard: {
        title: 'Dashboard',
        orders: 'Orders',
        products: 'Products',
        status: 'Status',
        total: 'Total',
        method: 'Method',
        addProduct: 'Add product',
        nameEn: 'Name (English)',
        nameAr: 'Name (Arabic)',
        descEn: 'Description (English)',
        descAr: 'Description (Arabic)',
        price: 'Price (minor units)',
        stock: 'Stock',
        save: 'Save',
        emptyOrders: 'No orders yet.',
        emptyProducts: 'No products yet.',
        txHash: 'Tx hash',
        paymentRef: 'Payment ref',
      },
      status: {
        PENDING: 'Pending',
        RESERVED: 'Stock reserved',
        PROCESSING: 'Processing',
        PAID: 'Paid',
        FAILED: 'Failed',
        CONFIRMED: 'Confirmed',
        CANCELLED: 'Cancelled',
      },
      common: { loading: 'Loading…', error: 'Something went wrong.', retry: 'Try again' },
    },
  },
  ar: {
    translation: {
      brand: 'بيت سوق',
      tagline: 'سوق المستقبل',
      nav: { store: 'المتجر', dashboard: 'لوحة التحكم', cart: 'السلة', language: 'English' },
      hero: {
        badge: 'مدفوعات هجينة · فيات + ويب ٣',
        title1: 'بِع في كل مكان.',
        title2: 'وادفع بالطريقة التي تناسبك.',
        subtitle:
          'بيت سوق منصة تجارية مؤسسية تدعم مدفوعات مدى والبطاقات فورية عبر مويسر، والدفع المباشر بالعملات الرقمية من محفظتك إلى البائع — بتجربة ثنائية اللغة كاملة.',
        cta: 'استكشف المنتجات',
      },
      search: { placeholder: 'ابحث عن منتج…' },
      product: { inStock: 'متوفر', outOfStock: 'نفدت الكمية', low: 'الكمية محدودة', add: 'أضف إلى السلة', stockLeft: 'بقي {{count}}' },
      cart: {
        title: 'سلتك',
        empty: 'سلتك فارغة.',
        subtotal: 'المجموع',
        checkout: 'إتمام الشراء',
        clear: 'إفراغ السلة',
        remove: 'إزالة',
      },
      checkout: {
        title: 'إتمام الشراء',
        method: 'طريقة الدفع',
        moyasar: 'الدفع الفوري',
        moyasarDesc: 'مدى · فيزا · ماستركارد · أبل باي — عبر مويسر',
        crypto: 'الدفع بالعملات الرقمية',
        cryptoDesc: 'ادفع من محفظة ميتاماسك أو WalletConnect مباشرة إلى محفظة البائع',
        payNow: 'ادفع الآن',
        connectWallet: 'ربط المحفظة',
        verifying: 'جارٍ التحقق على السلسلة…',
        merchantAddress: 'عنوان البائع',
        network: 'الشبكة',
        amount: 'المبلغ',
        betaBadge: 'الإصدار ٢.٠ بيتا · جاهز للتجربة',
        copy: 'نسخ',
        copied: 'تم النسخ!',
        sendExact: 'أرسل المبلغ المحدد بدقة — يتم التحقق من العملية على السلسلة مقابل طلبك.',
        txHash: 'معاملة العملية',
        verify: 'تحقق من الدفع',
        status: 'الحالة',
        paid: 'تم تأكيد الدفع 🎉',
        failed: 'فشل التحقق',
      },
      dashboard: {
        title: 'لوحة التحكم',
        orders: 'الطلبات',
        products: 'المنتجات',
        status: 'الحالة',
        total: 'الإجمالي',
        method: 'طريقة الدفع',
        addProduct: 'إضافة منتج',
        nameEn: 'الاسم (إنجليزي)',
        nameAr: 'الاسم (عربي)',
        descEn: 'الوصف (إنجليزي)',
        descAr: 'الوصف (عربي)',
        price: 'السعر (أصغر وحدة)',
        stock: 'المخزون',
        save: 'حفظ',
        emptyOrders: 'لا توجد طلبات بعد.',
        emptyProducts: 'لا توجد منتجات بعد.',
        txHash: 'هاش العملية',
        paymentRef: 'مرجع الدفع',
      },
      status: {
        PENDING: 'قيد الانتظار',
        RESERVED: 'تم حجز المخزون',
        PROCESSING: 'قيد المعالجة',
        PAID: 'مدفوع',
        FAILED: 'فاشل',
        CONFIRMED: 'مؤكد',
        CANCELLED: 'ملغى',
      },
      common: { loading: 'جارٍ التحميل…', error: 'حدث خطأ ما.', retry: 'حاول مجدداً' },
    },
  },
};

function initialLanguage(): Language {
  const stored = localStorage.getItem('bitsooq.lang');
  if (stored === 'ar' || stored === 'en') return stored;
  return navigator.language?.startsWith('ar') ? 'ar' : 'en';
}

export function applyDirection(lang: Language) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
  document.documentElement.classList.toggle('font-arabic', lang === 'ar');
  document.documentElement.classList.toggle('font-sans', lang === 'en');
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDirection(i18n.language as Language);

export function toggleLanguage() {
  const next: Language = i18n.language === 'ar' ? 'en' : 'ar';
  void i18n.changeLanguage(next);
  localStorage.setItem('bitsooq.lang', next);
  applyDirection(next);
}

export default i18n;
