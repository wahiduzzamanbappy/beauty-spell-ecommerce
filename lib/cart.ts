import type { Product } from './products';

export const CART_STORAGE_KEY = 'beauty-spell-cart';
export const MAX_CART_QUANTITY = 99;

export type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
};

export function getProductSellingPrice(product: Product): number {
  return product.discountPrice ?? product.price;
}

export function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return Boolean(
    item.product &&
      typeof item.product === 'object' &&
      Number.isSafeInteger(item.product.id) &&
      typeof item.product.name === 'string' &&
      typeof item.product.image === 'string' &&
      Number.isFinite(item.unitPrice) &&
      (item.unitPrice as number) >= 0 &&
      Number.isInteger(item.quantity) &&
      (item.quantity as number) > 0 &&
      (item.quantity as number) <= MAX_CART_QUANTITY,
  );
}

export function getCartItemsFromStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Stored cart is not an array.');
    return parsed.filter(isCartItem);
  } catch (error) {
    console.error('Could not load the saved cart.', error);
    return [];
  }
}

