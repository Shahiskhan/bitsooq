import { useTranslation } from 'react-i18next';

export default function StockBadge({ stock }: { stock: number }) {
  const { t } = useTranslation();
  if (stock <= 0) return <span className="stock-badge-out">{t('product.outOfStock')}</span>;
  if (stock <= 5) return <span className="stock-badge-low">{t('product.low')} · {t('product.stockLeft', { count: stock })}</span>;
  return <span className="stock-badge">{t('product.inStock')}</span>;
}
