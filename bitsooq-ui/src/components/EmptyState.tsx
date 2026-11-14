import { PackageOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function EmptyState({ onReset }: { onReset: () => void }) {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return <div className="empty-state"><span className="empty-state-icon"><PackageOpen size={25} /></span><h3>{ar ? 'لم نجد منتجات مطابقة' : 'No products found'}</h3><p>{ar ? 'جرّب فئة أخرى أو أزل كلمات البحث.' : 'Try another category or clear your search.'}</p><button type="button" className="ghost-button" onClick={onReset}>{ar ? 'عرض الكل' : 'Browse all'}</button></div>;
}
