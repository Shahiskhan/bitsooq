import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Product } from './api';

export interface CartLine {
  sku: string;
  qty: number;
  product: Product;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotalMinor: number;
  add: (product: Product) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'bitsooq.cart.v2';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<string, { qty: number; product: Product }>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const lines = Object.values(items);
    return {
      lines: lines.map((l) => ({ ...l, sku: l.product.sku })),
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      subtotalMinor: lines.reduce((sum, line) => sum + line.qty * line.product.priceMinor, 0),
      add: (product) => setItems((prev) => ({ ...prev, [product.sku]: { qty: Math.min(product.availableStock, (prev[product.sku]?.qty ?? 0) + 1), product } })),
      setQty: (sku, qty) =>
        setItems((prev) => {
          if (qty <= 0 || !prev[sku]) {
            const next = { ...prev };
            delete next[sku];
            return next;
          }
          return { ...prev, [sku]: { ...prev[sku], qty: Math.min(qty, prev[sku].product.availableStock) } };
        }),
      remove: (sku) =>
        setItems((prev) => {
          const next = { ...prev };
          delete next[sku];
          return next;
        }),
      clear: () => setItems({}),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

export function formatMoney(minor: number, currency = 'USD', lang = 'en') {
  const locale = lang === 'ar' ? 'ar-PK' : currency === 'PKR' ? 'en-PK' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: currency === 'PKR' ? 'narrowSymbol' : 'symbol' }).format(minor / 100);
}
