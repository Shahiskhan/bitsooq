import { useTranslation } from 'react-i18next';
import type { Order } from '../lib/api';

export default function StatusBadge({ status }: { status: Order['status'] }) {
  const { t } = useTranslation();
  return <span className={`status-${status}`}>{t(`status.${status}`)}</span>;
}
