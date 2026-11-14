import { useEffect, useState } from 'react';
import { getCategories, getProducts, type Category, type Product } from '../lib/api';
import Hero from '../components/Hero';
import ProductGrid from '../components/ProductGrid';
import { seedCategories, seedProducts } from '../mock/products';

export default function Storefront({ onOpenCart }: { onOpenCart: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      setProducts(seedProducts);
      setCategories(seedCategories);
      setDemoMode(true);
      setLoading(false);
      return;
    }
    try {
      const [p, c] = await Promise.all([getProducts(), getCategories()]);
      const hasLiveProducts = p.some((product) => product.active);
      setProducts(hasLiveProducts ? p : seedProducts);
      setCategories(c.some((category) => category.active) ? c : seedCategories);
      setDemoMode(!hasLiveProducts || !c.some((category) => category.active));
    } catch {
      // Keep the store usable during backend development; API calls resume on Retry.
      setProducts(seedProducts);
      setCategories(seedCategories);
      setDemoMode(true);
      setError('');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => void load(), []);

  return (
    <main id="main-content">
      <Hero />
      <ProductGrid products={products} categories={categories} loading={loading} error={error} onRetry={() => void load()} onAdded={onOpenCart} demoMode={demoMode} />
    </main>
  );
}
