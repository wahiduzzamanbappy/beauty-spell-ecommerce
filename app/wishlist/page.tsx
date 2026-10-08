'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import ProductCard from '@/components/ProductCard';
import { useWishlist } from '@/context/WishlistContext';
import { useProductCatalog } from '@/context/ProductCatalogContext';

export default function Wishlist() {
  const { ids, hydrated } = useWishlist();
  const { products, loading: productsLoading } = useProductCatalog();
  const [toast, setToast] = useState('');
  const saved = useMemo(
    () => products.filter((product) => ids.includes(product.id)),
    [products, ids],
  );

  return (
    <>
      <SiteHeader />
      <main className="commercePage">
        <div className="commerceHeading">
          <span className="kicker">YOUR FAVORITES</span>
          <h1>Wishlist</h1>
          <p>Save products you love and add them to your cart whenever you’re ready.</p>
        </div>
        {!hydrated || productsLoading ? (
          <p className="commerceNotice">Loading wishlist…</p>
        ) : saved.length ? (
          <div className="productGrid wishlistGrid">
            {saved.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdded={(name) => {
                  setToast(`${name} added to cart`);
                  setTimeout(() => setToast(''), 2200);
                }}
              />
            ))}
          </div>
        ) : (
          <section className="emptyCart">
            <div className="emptyCartIcon"><Heart /></div>
            <h2>Your wishlist is empty</h2>
            <p>Tap the heart on any product to save it here.</p>
            <Link className="ctaPrimary" href="/shop">Explore Products <ArrowRight size={17} /></Link>
          </section>
        )}
      </main>
      <SiteFooter />
      <div className="cartToast">{toast}</div>
    </>
  );
}
