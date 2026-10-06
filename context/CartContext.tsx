'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CART_STORAGE_KEY,
  getCartItemsFromStorage,
  getProductSellingPrice,
  MAX_CART_QUANTITY,
  type CartItem,
} from '@/lib/cart';
import type { Product } from '@/lib/products';

type CartContextValue = {
  cartItems: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  cartTotal: number;
  hydrated: boolean;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  increaseQuantity: (productId: number) => void;
  decreaseQuantity: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCartItems(getCartItemsFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Could not save the cart to this browser.', error);
    }
  }, [cartItems, hydrated]);

  const addToCart = useCallback((product: Product) => {
    setCartItems((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        return items.map((item) =>
          item.product.id === product.id
            ? { ...item, product, quantity: Math.min(item.quantity + 1, MAX_CART_QUANTITY) }
            : item,
        );
      }
      return [
        ...items,
        { product, quantity: 1, unitPrice: getProductSellingPrice(product) },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCartItems((items) => items.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (!Number.isFinite(quantity)) return;
    const safeQuantity = Math.min(Math.max(Math.floor(quantity), 1), MAX_CART_QUANTITY);
    setCartItems((items) =>
      items.map((item) =>
        item.product.id === productId ? { ...item, quantity: safeQuantity } : item,
      ),
    );
  }, []);

  const increaseQuantity = useCallback(
    (productId: number) => {
      setCartItems((items) =>
        items.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.min(item.quantity + 1, MAX_CART_QUANTITY) }
            : item,
        ),
      );
    },
    [],
  );

  const decreaseQuantity = useCallback(
    (productId: number) => {
      setCartItems((items) =>
        items.map((item) =>
          item.product.id === productId && item.quantity > 1
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        ),
      );
    },
    [],
  );

  const clearCart = useCallback(() => setCartItems([]), []);

  const value = useMemo(() => {
    const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);
    const cartSubtotal = cartItems.reduce(
      (subtotal, item) => subtotal + item.unitPrice * item.quantity,
      0,
    );
    return {
      cartItems,
      cartCount,
      cartSubtotal,
      cartTotal: cartSubtotal,
      hydrated,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      updateQuantity,
      clearCart,
    };
  }, [
    addToCart,
    cartItems,
    clearCart,
    decreaseQuantity,
    hydrated,
    increaseQuantity,
    removeFromCart,
    updateQuantity,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider.');
  return context;
}
