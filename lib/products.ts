import { getSupabaseClient } from '@/lib/supabase';

export type Product = {
  id: number;
  name: string;
  category: string;
  brand?: string;
  price: number;
  discountPrice?: number;
  image: string;
  description: string;
  badge?: string;
  rating?: number;
  reviews?: number;
  stock?: number;
  featured?: boolean;
  active: boolean;
  tags?: string[];
};

export type ProductFields = Omit<Product, 'id'>;
const LEGACY_PRODUCT_STORAGE_KEY = 'beauty-spell-products';

function toProduct(row: Record<string, unknown>): Product {
  const id = Number(row.id ?? row.product_id);
  const price = Number(row.price);
  const image = row.image_url ?? row.image;

  if (!Number.isSafeInteger(id) || !Number.isFinite(price) ||
      typeof row.name !== 'string' || typeof row.category !== 'string' ||
      typeof image !== 'string') {
    throw new Error('A product row is missing a valid id, name, category, price, or image URL.');
  }

  const discountPrice = row.discount_price ?? row.discountPrice;
  const stock = row.stock;

  return {
    id,
    name: row.name,
    category: row.category,
    brand: typeof row.brand === 'string' ? row.brand : undefined,
    price,
    discountPrice: discountPrice == null ? undefined : Number(discountPrice),
    image,
    description: typeof row.description === 'string' ? row.description : '',
    badge: typeof row.badge === 'string' ? row.badge : undefined,
    rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : 4.8,
    reviews: Number.isFinite(Number(row.reviews)) ? Number(row.reviews) : 0,
    stock: stock == null ? undefined : Number(stock),
    featured: row.featured === true,
    active: row.active !== false,
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}

function toDatabaseFields(product: ProductFields) {
  return {
    name: product.name,
    brand: product.brand ?? null,
    category: product.category,
    price: product.price,
    discount_price: product.discountPrice ?? null,
    stock: product.stock ?? 0,
    image_url: product.image,
    description: product.description,
    badge: product.badge ?? null,
    featured: product.featured ?? false,
    active: product.active,
  };
}

export async function getProducts(includeInactive = false): Promise<Product[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured. Set the public Supabase URL and anon or publishable key.');
  }

  const { data, error } = await client.from('products').select('*');
  if (error) throw new Error(`Could not load products: ${error.message}`);
  if (!data) throw new Error('Supabase returned no product data.');

  const products = data.map((row) => toProduct(row as Record<string, unknown>));
  return includeInactive ? products : products.filter((product) => product.active);
}

export async function addProduct(product: ProductFields): Promise<Product> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { data, error } = await client
    .from('products')
    .insert(toDatabaseFields(product))
    .select('*')
    .single();
  if (error) throw new Error(`Could not add product: ${error.message}`);
  if (!data) throw new Error('Supabase did not return the newly added product.');
  return toProduct(data as Record<string, unknown>);
}

export async function updateProduct(id: number, product: ProductFields): Promise<Product> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { data, error } = await client
    .from('products')
    .update(toDatabaseFields(product))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Could not update product: ${error.message}`);
  if (!data) throw new Error('Supabase did not return the updated product.');
  return toProduct(data as Record<string, unknown>);
}

export async function setProductActive(id: number, active: boolean): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { data, error } = await client
    .from('products')
    .update({ active })
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw new Error(`Could not ${active ? 'enable' : 'disable'} product: ${error.message}`);
  if (!data) throw new Error('The product was not found.');
}

export async function migrateLegacyProducts(): Promise<number> {
  if (typeof window === 'undefined') throw new Error('Legacy product import is only available in a browser.');

  const raw = window.localStorage.getItem(LEGACY_PRODUCT_STORAGE_KEY);
  if (!raw) throw new Error('No legacy product catalogue was found in this browser.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The legacy product catalogue is not valid JSON.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('The legacy product catalogue is empty or invalid.');
  }

  const legacyProducts = parsed.map((item: unknown): Product => {
    if (!item || typeof item !== 'object') throw new Error('A legacy product record is invalid.');
    const legacy = item as Partial<Product>;
    if (!Number.isSafeInteger(legacy.id) || typeof legacy.name !== 'string' ||
        typeof legacy.category !== 'string' || !Number.isFinite(legacy.price) ||
        typeof legacy.image !== 'string' || typeof legacy.description !== 'string') {
      throw new Error('A legacy product is missing a valid id, name, category, price, image, or description.');
    }
    return {
      ...legacy,
      id: legacy.id as number,
      name: legacy.name,
      category: legacy.category,
      price: legacy.price as number,
      image: legacy.image,
      description: legacy.description,
      active: legacy.active !== false,
    };
  });

  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');
  const { data: existing, error: lookupError } = await client
    .from('products')
    .select('id')
    .limit(1);
  if (lookupError) throw new Error(`Could not check the Supabase catalogue: ${lookupError.message}`);
  if (existing?.length) {
    throw new Error('Supabase already has products. Legacy import is only allowed into an empty catalogue.');
  }

  for (const product of legacyProducts) {
    if (!product.image.startsWith('data:image/')) continue;
    const response = await fetch(product.image);
    if (!response.ok) throw new Error(`Could not read the saved image for "${product.name}".`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error(`The saved image for "${product.name}" has an invalid image format.`);
    }
    const extension = blob.type.split('/')[1]?.replace(/[^a-zA-Z0-9]/g, '') || 'img';
    const path = `products/${product.id}-${crypto.randomUUID()}.${extension}`;
    const { data: uploaded, error: uploadError } = await client.storage
      .from('product-images')
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (uploadError) {
      throw new Error(`Could not migrate the saved image for "${product.name}": ${uploadError.message}`);
    }
    product.image = client.storage.from('product-images').getPublicUrl(uploaded.path).data.publicUrl;
  }

  const { data, error } = await client
    .from('products')
    .insert(legacyProducts.map((product) => ({
      id: product.id,
      ...toDatabaseFields(product),
    })))
    .select('id');
  if (error) throw new Error(`Could not import legacy products: ${error.message}`);
  if (!data || data.length !== legacyProducts.length) {
    throw new Error('Supabase did not confirm that every legacy product was imported.');
  }

  const { error: sequenceError } = await client.rpc('sync_products_id_sequence');
  if (sequenceError) {
    throw new Error(`Products were imported, but the ID sequence could not be synchronized: ${sequenceError.message}`);
  }

  try {
    window.localStorage.removeItem(LEGACY_PRODUCT_STORAGE_KEY);
  } catch (error) {
    throw new Error(
      `Products were imported, but the old browser copy could not be removed: ${
        error instanceof Error ? error.message : 'browser storage is unavailable'
      }`,
    );
  }
  return data.length;
}

export function getDiscountPercent(product: Product) {
  if (!product.discountPrice || product.discountPrice >= product.price) return 0;
  return Math.round((1 - product.discountPrice / product.price) * 100);
}
