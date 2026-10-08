'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getProducts, type Product } from '@/lib/products';

type ProductCatalogValue = {
  products: Product[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const ProductCatalogContext = createContext<ProductCatalogValue | null>(null);

export function ProductCatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await getProducts());
      setError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load products.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ products, loading, error, refresh }),
    [products, loading, error, refresh],
  );

  return (
    <ProductCatalogContext.Provider value={value}>
      {error && <p className="commerceNotice" role="alert">{error}</p>}
      {children}
    </ProductCatalogContext.Provider>
  );
}

export function useProductCatalog() {
  const context = useContext(ProductCatalogContext);
  if (!context) throw new Error('useProductCatalog must be used within ProductCatalogProvider.');
  return context;
}
