import type { Category, Product } from '../lib/api';

// Mirrors the backend V4 demo catalog so the storefront remains explorable while services are offline.
export const seedCategories: Category[] = [
  { id: 'home', name: 'Home & Living', nameAr: 'المنزل والمعيشة', active: true },
  { id: 'tech', name: 'Tech & Gadgets', nameAr: 'التقنية والأجهزة', active: true },
  { id: 'fashion', name: 'Fashion & Accessories', nameAr: 'الأزياء والإكسسوارات', active: true },
  { id: 'grocery', name: 'Grocery & Gourmet', nameAr: 'البقالة والمنتجات الفاخرة', active: true },
];

const sourceProducts: Product[] = [
  { sku: 'CERAMIC-MUG-01', name: 'Handmade Ceramic Mug', nameAr: 'كوب سيراميك مصنوع يدويا', descriptionEn: 'A stoneware mug glazed in matte teal, thrown by hand. Holds 350 ml, dishwasher safe.', descriptionAr: 'كوب من الحجر الخزفي بطلاء أزرق مطفي، مصنوع يدويا. سعة 350 مل، آمن في غسالة الأطباق.', priceMinor: 8900, currency: 'USD', availableStock: 42, categoryId: 'home', active: true },
  { sku: 'LINEN-TOTE-02', name: 'Stonewashed Linen Tote', nameAr: 'حقيبة كتان مغسولة', descriptionEn: 'A roomy everyday tote in heavy linen with an interior pocket and magnetic clasp.', descriptionAr: 'حقيبة يومية واسعة من الكتان الثقيل مع جيب داخلي وإغلاق مغناطيسي.', priceMinor: 24500, currency: 'USD', availableStock: 18, categoryId: 'fashion', active: true },
  { sku: 'CANDLE-AMBER-03', name: 'Amber & Oud Candle', nameAr: 'شمعة العنبر والعود', descriptionEn: 'A slow-burn soy candle with amber, oud and a whisper of rose. 45 hours of burn time.', descriptionAr: 'شمعة صويا بطيء الاحتراق برائحة العنبر والعود ولمسة من الورد. 45 ساعة إشعال.', priceMinor: 15750, currency: 'USD', availableStock: 30, categoryId: 'home', active: true },
  { sku: 'CARAFE-GLASS-04', name: 'Recycled Glass Carafe', nameAr: 'دورق زجاجي معاد تدويره', descriptionEn: 'A 1 L carafe of mouth-blown recycled glass; each one carries its own subtle ripples.', descriptionAr: 'دورق سعة 1 لتر من الزجاج المعاد تدويره منفوخ بالفم؛ كل قطعة تحمل تموجاتها الخاصة.', priceMinor: 19900, currency: 'USD', availableStock: 12, categoryId: 'home', active: true },
  { sku: 'DESK-LAMP-05', name: 'Halo LED Desk Lamp', nameAr: 'مصباح مكتب هالو LED', descriptionEn: 'A minimalist lamp with stepless dimming, 3 color temperatures and a USB-C port.', descriptionAr: 'مصباح بسيط بتعتيم متدرج وثلاث درجات حرارة لونية ومنفذ USB-C.', priceMinor: 32900, currency: 'USD', availableStock: 25, categoryId: 'tech', active: true },
  { sku: 'KEYBOARD-MECH-06', name: 'Mechanical Keyboard 65%', nameAr: 'لوحة مفاتيح ميكانيكية 65%', descriptionEn: 'Hot-swappable switches, gasket mount, PBT keycaps and Bluetooth + USB-C dual mode.', descriptionAr: 'مفاتيح قابلة للتبديل، هيكل جاسكيت، أغطية PBT ووضع بلوتوث و USB-C مزدوج.', priceMinor: 47500, currency: 'USD', availableStock: 9, categoryId: 'tech', active: true },
  { sku: 'EARBUDS-PRO-07', name: 'ANC Wireless Earbuds', nameAr: 'سماعات لاسلكية بخاصية إلغاء الضوضاء', descriptionEn: 'Active noise cancellation, 8 h per charge (32 h with the case), IPX5 water resistance.', descriptionAr: 'إلغاء ضوضاء نشط، 8 ساعات لكل شحنة (32 ساعة مع العلبة)، مقاومة للماء IPX5.', priceMinor: 38900, currency: 'USD', availableStock: 40, categoryId: 'tech', active: true },
  { sku: 'DATHOSE-MERINO-08', name: 'Merino Wool Socks', nameAr: 'جوارب صوف ميرينو', descriptionEn: 'Mid-calf merino socks, cushioned sole and seamless toe. Warm, breathable, honest.', descriptionAr: 'جوارب ميرينو حتى منتصف الساق، بنعل مبطن ورأس بدون خياطة. دافئة ومتنفسة وأصيلة.', priceMinor: 6400, currency: 'USD', availableStock: 60, categoryId: 'fashion', active: true },
  { sku: 'COFFEE-ARABICA-09', name: 'Single-Origin Arabica 250g', nameAr: 'قهوة عربية أحادية المصدر 250 جرام', descriptionEn: 'Ethiopian Yirgacheffe, light roast, notes of jasmine and citrus. Roasted last week.', descriptionAr: 'إثيوبية من يرقاتشيفي، تحميص فاتح، بنكهة الياسمين والحمضيات. محمصة الأسبوع الماضي.', priceMinor: 11500, currency: 'USD', availableStock: 75, categoryId: 'grocery', active: true },
  { sku: 'OLIVE-OIL-EXV-10', name: 'Extra Virgin Olive Oil 500ml', nameAr: 'زيت زيتون بكر ممتاز 500 مل', descriptionEn: 'Cold-pressed within 8 hours of harvest from a single Jordanian grove.', descriptionAr: 'معصور على البارد خلال 8 ساعات من الحصاد من بستان أردني واحد.', priceMinor: 13750, currency: 'USD', availableStock: 50, categoryId: 'grocery', active: true },
  { sku: 'BOWL-SET-11', name: 'Stoneware Bowl Set (4)', nameAr: 'طقم أواني حجرية (٤)', descriptionEn: 'Four reactive-glaze stoneware bowls; no two are identical. Microwave and dishwasher safe.', descriptionAr: 'أربعة أطباق خزفية بطلاء تفاعلي؛ لا تتشابه اثنتان. آمنة في الميكروويف وغسالة الأطباق.', priceMinor: 27500, currency: 'USD', availableStock: 22, categoryId: 'home', active: true },
  { sku: 'WATCH-CLASSIC-12', name: 'Minimal Field Watch', nameAr: 'ساعة حقل بسيطة', descriptionEn: 'A 38 mm sapphire-crystal watch with Swiss quartz movement and quick-release leather strap.', descriptionAr: 'ساعة 38 مم مع بلور ياقوتي وحركة كوارتز سويسرية وسوار جلد سريع التبديل.', priceMinor: 89900, currency: 'USD', availableStock: 7, categoryId: 'fashion', active: true },
];

// Demo-only PKR catalog values. Live prices always come from the catalog API.
const pkrPrices = [189000, 349000, 229000, 279000, 549000, 1249000, 899000, 119000, 189000, 229000, 429000, 1899000];
const ratings = [4.8, 4.6, 4.9, 4.5, 4.7, 4.6, 4.4, 4.3, 4.8, 4.7, 4.9, 4.5];
const reviews = [126, 54, 38, 19, 82, 44, 211, 27, 63, 95, 31, 16];
export const seedProducts = sourceProducts.map((product, index) => ({
  ...product,
  currency: 'PKR',
  priceMinor: pkrPrices[index],
  compareAtMinor: index === 0 ? 249000 : index === 5 ? 1499000 : undefined,
  ratingAverage: ratings[index],
  reviewCount: reviews[index],
  badge: index === 0 ? 'Bestseller' : index === 5 ? 'Deal' : undefined,
  demoOnly: true,
}));

// Fixed product photography; if an image host is unavailable, ProductCard shows its local illustrated fallback.
export const productImages: Record<string, string> = {
  'CERAMIC-MUG-01': 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80',
  'LINEN-TOTE-02': 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80',
  'CANDLE-AMBER-03': 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80',
  'CARAFE-GLASS-04': 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=900&q=80',
  'DESK-LAMP-05': 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80',
  'KEYBOARD-MECH-06': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  'EARBUDS-PRO-07': 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80',
  'DATHOSE-MERINO-08': 'https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=900&q=80',
  'COFFEE-ARABICA-09': 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=80',
  'OLIVE-OIL-EXV-10': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80',
  'BOWL-SET-11': 'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=900&q=80',
  'WATCH-CLASSIC-12': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
};
