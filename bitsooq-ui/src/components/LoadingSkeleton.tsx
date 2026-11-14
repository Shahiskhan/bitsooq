export default function LoadingSkeleton() {
  return <div className="product-grid" aria-label="Loading products" aria-busy="true">
    {Array.from({ length: 8 }).map((_, index) => <div className="product-skeleton" key={index}><div className="skeleton-media" /><div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-copy" /><div className="skeleton-line skeleton-price" /></div>)}
  </div>;
}
