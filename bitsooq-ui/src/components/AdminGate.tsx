import { Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';

const Dashboard = lazy(() => import('../pages/Dashboard'));

function hasStaffClaim() {
  try {
    const token = sessionStorage.getItem('bitsooq.token');
    if (!token) return false;
    const payload = token.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as {
      roles?: unknown;
      role?: unknown;
      authorities?: unknown;
      admin?: unknown;
    };
    const roleValues = [claims.roles, claims.role, claims.authorities].flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
    const roles = roleValues.map((value) => String(value).toUpperCase());
    return claims.admin === true || roles.some((role) => ['ADMIN', 'ROLE_ADMIN', 'STAFF', 'ROLE_STAFF', 'SUPER_ADMIN', 'ROLE_SUPER_ADMIN'].includes(role));
  } catch {
    return false;
  }
}

export default function AdminGate() {
  // This is a navigation guard only; the API gateway remains authoritative for every admin request.
  const demoPreview = import.meta.env.VITE_USE_MOCK === 'true';
  if (!demoPreview && !hasStaffClaim()) return <Navigate to="/" replace />;
  return <Suspense fallback={<main className="admin-loading"><LoaderCircle className="animate-spin" size={23} /><span>Loading workspace</span></main>}><div className="admin-workspace"><Dashboard /></div></Suspense>;
}
