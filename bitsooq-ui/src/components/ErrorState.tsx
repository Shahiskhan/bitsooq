import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return <div className="error-state" role="alert"><span className="error-state-icon"><AlertCircle size={20} /></span><div><h3>{t('common.error')}</h3><p>{message}</p><button className="ghost-button" onClick={onRetry}>{t('common.retry')}</button></div></div>;
}
