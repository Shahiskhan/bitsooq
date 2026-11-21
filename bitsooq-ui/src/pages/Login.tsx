import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { signInWithEmailPassword, signedInUser } from '../lib/auth';

function tokenHasOperationsRole() {
  try {
    const token = sessionStorage.getItem('bitsooq.token');
    const payload = token?.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as { admin?: boolean; roles?: unknown; role?: unknown; authorities?: unknown };
    const values = [claims.roles, claims.role, claims.authorities].flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).map((value) => String(value).replace(/^ROLE_/, '').toUpperCase());
    return claims.admin === true || values.some((role) => ['ADMIN', 'STAFF', 'SUPER_ADMIN', 'PRODUCT_MANAGER', 'STORE_MANAGER', 'FULFILLMENT_MANAGER'].includes(role));
  } catch { return false; }
}

export default function Login() {
  const { i18n } = useTranslation();
  const arabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPath = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await signInWithEmailPassword(email.trim(), password);
      if (!tokenHasOperationsRole()) {
        const name = signedInUser()?.displayName;
        setError(name ? `${name}, this account does not have an operations role.` : 'This account does not have an operations role.');
        return;
      }
      navigate(requestedPath?.startsWith('/admin') ? requestedPath : '/admin', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in. Check the account and try again.');
    } finally { setBusy(false); }
  }

  return <main className="ops-login-shell" dir={arabic ? 'rtl' : 'ltr'}>
    <Link to="/" className="ops-login-back"><ArrowLeft size={15} className="rtl:rotate-180" />{arabic ? 'العودة إلى المتجر' : 'Back to storefront'}</Link>
    <section className="ops-login-card"><div className="ops-login-brand"><span><ShoppingBag size={20} /></span><div><b>BitSooq</b><small>MERCHANT CONSOLE</small></div></div><div className="ops-login-icon"><LockKeyhole size={20} /></div><p className="ops-kicker">{arabic ? 'مساحة عمل آمنة' : 'SECURE WORKSPACE'}</p><h1>{arabic ? 'تسجيل دخول الإدارة' : 'Sign in to operations'}</h1><p className="ops-login-copy">{arabic ? 'استخدم حساب فريق العمل المعتمد لفتح مساحة العمل الخاصة بك.' : 'Use your approved team account to access your assigned workspace.'}</p>
      <form onSubmit={(event) => void submit(event)}><label>{arabic ? 'البريد الإلكتروني' : 'Email address'}<input className="field" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label><label>{arabic ? 'كلمة المرور' : 'Password'}<span className="ops-password-field"><input className="field" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>{error && <p className="ops-login-error" role="alert">{error}</p>}<button className="neon-button" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}{arabic ? 'تسجيل الدخول' : 'Sign in securely'}<ArrowRight size={14} className="rtl:rotate-180" /></button></form>
      <div className="ops-login-footnote"><ShieldCheck size={14} /><span>{arabic ? 'يتم التحقق من الجلسة والصلاحيات عند بوابة API.' : 'Your session and workspace role are verified by the API gateway.'}</span></div>
    </section>
    <p className="ops-login-config">{arabic ? 'أول تسجيل دخول؟ اطلب من مسؤول النظام تفعيل حسابك.' : 'First time here? Ask your system administrator to enable your account.'}</p>
  </main>;
}
