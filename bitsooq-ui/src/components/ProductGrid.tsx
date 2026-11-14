import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, SlidersHorizontal, ArrowDownWideNarrow } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Category, Product } from '../lib/api';
import ProductCard from './ProductCard';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

interface Props {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onAdded?: () => void;
  demoMode?: boolean;
}
type SortMode = 'featured' | 'price-asc' | 'price-desc' | 'rating';

export default function ProductGrid({ products, categories, loading, error, onRetry, onAdded, demoMode = false }: Props) {
  const { t, i18n } = useTranslation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [params] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const urlCategory = params.get('category') ?? 'all';
  const [category, setCategory] = useState(urlCategory);
  const [query, setQuery] = useState(urlQuery);
  const [sort, setSort] = useState<SortMode>('featured');
  const ar = i18n.language === 'ar';

  useEffect(() => { setQuery(urlQuery); setCategory(urlCategory); }, [urlQuery, urlCategory]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const activeProducts = products.filter((product) => product.active);
  const activeCategories = categories.filter((item) => item.active);
  const filtered = activeProducts.filter((product) =>
    (category === 'all' || product.categoryId === category) &&
    (product.name.toLowerCase().includes(query.toLowerCase()) || (product.nameAr ?? '').includes(query)),
  );
  const visible = [...filtered].sort((a, b) => {
    if (sort === 'price-asc') return a.priceMinor - b.priceMinor;
    if (sort === 'price-desc') return b.priceMinor - a.priceMinor;
    if (sort === 'rating') return (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0);
    return 0;
  });
  const reset = () => { setCategory('all'); setQuery(''); setSort('featured'); };

  return <section id="shop" className="catalog-shell mx-auto max-w-7xl px-4 pb-20 sm:px-6">
    <div className="catalog-heading market-catalog-heading">
      <div><p className="section-eyebrow"><span />{ar ? 'مختارة لك' : 'A GOOD PLACE TO START'}</p><h2>{ar ? 'تسوّق المفضّلات' : 'Find something you’ll love'}</h2><p className="catalog-subtitle">{ar ? 'منتجات يومية واختيارات مميزة، كلّها في مكان واحد.' : 'Everyday essentials and thoughtful finds, all in one place.'}</p></div>
      <div className="catalog-heading-side"><span className="catalog-count">{activeProducts.length.toString().padStart(2, '0')} <small>{ar ? 'منتج' : 'products'}</small></span></div>
    </div>
    {demoMode && <div className="demo-data-banner"><span className="demo-dot" /> <span>{ar ? 'معاينة المتجر — هذه بيانات وأسعار تجريبية بالروبية الباكستانية.' : 'Store preview · Sample products and PKR prices. No live checkout in demo mode.'}</span></div>}
    <div className="market-category-strip" aria-label={ar ? 'تصفية حسب الفئة' : 'Browse by department'}>
      <button className={`market-category-chip ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}><span className="category-chip-emoji">✦</span><b>{ar ? 'الكل' : 'All finds'}</b></button>
      {activeCategories.map((item, index) => <button key={item.id} className={`market-category-chip ${category === item.id ? 'active' : ''}`} onClick={() => setCategory(item.id)}><span className={`category-chip-emoji category-emoji-${index}`}>{['⌂', '⌘', '✳', '◌'][index % 4]}</span><b>{ar && item.nameAr ? item.nameAr : item.name}</b></button>)}
    </div>
    <div className="catalog-toolbar market-catalog-toolbar">
      <div className="market-result-count"><SlidersHorizontal size={16} /><span>{ar ? 'تصفية وترتيب' : `${visible.length} products`}</span></div>
      <label className="catalog-search market-inline-search"><Search size={16} /><input ref={searchRef} aria-label={t('search.placeholder')} placeholder={ar ? 'ابحث في المنتجات' : 'Search this collection'} value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label={ar ? 'مسح البحث' : 'Clear search'} onClick={() => setQuery('')}><X size={14} /></button>}</label>
      <label className="market-sort"><ArrowDownWideNarrow size={16} /><span>{ar ? 'ترتيب حسب' : 'Sort:'}</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label={ar ? 'ترتيب المنتجات' : 'Sort products'}>
        <option value="featured">{ar ? 'المميزة' : 'Featured'}</option><option value="price-asc">{ar ? 'السعر: الأقل أولاً' : 'Price: low to high'}</option><option value="price-desc">{ar ? 'السعر: الأعلى أولاً' : 'Price: high to low'}</option><option value="rating">{ar ? 'الأعلى تقييماً' : 'Top rated'}</option>
      </select></label>
    </div>
    {loading ? <LoadingSkeleton /> : error ? <ErrorState message={error} onRetry={onRetry} /> : visible.length ? <div className="product-grid">{visible.map((product) => <ProductCard key={product.sku} product={product} onAdded={onAdded} />)}</div> : <EmptyState onReset={reset} />}
  </section>;
}
