'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Package, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import styles from './AdminImageFields.module.css';
import { addProduct, getProducts, migrateLegacyProducts, setProductActive, updateProduct, type ProductFields, type Product } from '@/lib/products';
import { useProductCatalog } from '@/context/ProductCatalogContext';
import { getSupabaseClient } from '@/lib/supabase';
import { convertGoogleDriveUrl } from '@/lib/image';
import { formatTaka } from '@/lib/currency';
import { getStoredOrders, updateOrderStatus, type Order, type OrderStatus } from '@/lib/order';

type Tab = 'dashboard' | 'products' | 'orders';

export default function Admin() {
  const { refresh: refreshPublicProducts } = useProductCatalog();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState('');
  const [imageError, setImageError] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  useEffect(() => {
    setOrders(getStoredOrders());
    const client = getSupabaseClient();
    if (!client) {
      setAuthError('Supabase is not configured. Set the public URL and anon or publishable key.');
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    const applySession = (session: Awaited<ReturnType<typeof client.auth.getSession>>['data']['session']) => {
      const authorized = session?.user.app_metadata.role === 'admin';
      setIsAdmin(Boolean(authorized));
      if (authorized) void refreshProducts();
      else setProducts([]);
    };

    client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(`Could not check Admin access: ${error.message}`);
      applySession(data.session);
      setAuthLoading(false);
    }).catch((error: unknown) => {
      if (!mounted) return;
      setAuthError(error instanceof Error ? error.message : 'Could not check Admin access.');
      setAuthLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (mounted) applySession(session);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshProducts() {
    setProductsLoading(true);
    try {
      setProducts(await getProducts(true));
      setProductsError('');
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'Could not load products.');
    } finally {
      setProductsLoading(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      setAuthError('Supabase is not configured. Set the public URL and anon or publishable key.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(`Could not sign in: ${error.message}`);
      setAuthLoading(false);
      return;
    }
    if (data.user.app_metadata.role !== 'admin') {
      await client.auth.signOut();
      setAuthError('This account is not authorized for Admin access.');
      setAuthLoading(false);
      return;
    }
    setIsAdmin(true);
    setPassword('');
    await refreshProducts();
    setAuthLoading(false);
  }

  async function signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) setAuthError(`Could not sign out: ${error.message}`);
    else setIsAdmin(false);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const convertedImageUrl = convertGoogleDriveUrl(imageUrl);
    const isKeepingExistingImage = Boolean(
      editingProduct && imageUrl === editingProduct.image,
    );
    if (convertedImageUrl === null && !uploadedImage && !isKeepingExistingImage) {
      setImageError('Enter a valid Google Drive file-sharing link.');
      setSaving(false);
      return;
    }
    let image = convertedImageUrl || editingProduct?.image || '';
    if (!image && !uploadedImage) {
      setImageError('Enter a product image URL or upload an image.');
      setSaving(false);
      return;
    }

    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase is not configured.');
      if (uploadedImage) {
        const safeName = uploadedImage.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `products/${crypto.randomUUID()}-${safeName}`;
        const { data, error } = await client.storage
          .from('product-images')
          .upload(path, uploadedImage, { contentType: uploadedImage.type, upsert: false });
        if (error) throw new Error(`Could not upload image: ${error.message}`);
        image = client.storage.from('product-images').getPublicUrl(data.path).data.publicUrl;
      }

      const product: ProductFields = {
        name: String(fields.get('name')),
        category: String(fields.get('category')),
        brand: String(fields.get('brand')) || 'Beauty Spell',
        price: Number(fields.get('price')),
        discountPrice: Number(fields.get('discountPrice')) || undefined,
        image,
        description: String(fields.get('description')),
        badge: String(fields.get('badge')) || undefined,
        stock: Number(fields.get('stock')) || 0,
        featured: fields.get('featured') === 'on',
        active: fields.get('active') === 'on',
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, product);
        setSuccessMessage('Product updated successfully.');
      } else {
        await addProduct(product);
        setSuccessMessage('Product added successfully.');
      }
      await refreshProducts();
      await refreshPublicProducts();
      form.reset();
      setEditingProduct(null);
      setImageUrl('');
      setUploadedImage(null);
      setUploadedPreview('');
      setImageError('');
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'Could not save the product.');
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product: Product) {
    setEditingProduct(product);
    setImageUrl(product.image.startsWith('data:') ? '' : product.image);
    setUploadedImage(null);
    setUploadedPreview('');
    setImageError('');
    setSuccessMessage('');
    document.querySelector('.adminMain .productForm')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function cancelEdit() {
    setEditingProduct(null);
    setImageUrl('');
    setUploadedImage(null);
    setUploadedPreview('');
    setImageError('');
  }

  async function toggleProductActive(product: Product) {
    try {
      await setProductActive(product.id, !product.active);
      if (editingProduct?.id === product.id) cancelEdit();
      await refreshProducts();
      await refreshPublicProducts();
      setSuccessMessage(product.active ? 'Product disabled.' : 'Product enabled.');
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'Could not update product status.');
    }
  }

  async function importLegacyCatalogue() {
    try {
      const count = await migrateLegacyProducts();
      await refreshProducts();
      await refreshPublicProducts();
      setSuccessMessage(`${count} legacy product${count === 1 ? '' : 's'} imported into Supabase.`);
      window.setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'Could not import legacy products.');
    }
  }

  function handleImageUrlChange(value: string) {
    setImageUrl(value);
    setImageError(convertGoogleDriveUrl(value) === null
      ? 'Enter a valid Google Drive file-sharing link.'
      : '');
  }

  function handleImageUpload(file?: File) {
    const urlError = convertGoogleDriveUrl(imageUrl) === null
      ? 'Enter a valid Google Drive file-sharing link.'
      : '';
    if (!file) {
      setUploadedImage(null);
      setUploadedPreview('');
      setImageError(urlError);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setUploadedImage(null);
      setUploadedPreview('');
      setImageError('Choose an image file.');
      return;
    }

    setUploadedImage(file);
    setImageError(urlError);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setUploadedImage(null);
        setImageError('Could not read the uploaded image.');
        return;
      }
      setUploadedPreview(reader.result);
    };
    reader.onerror = () => {
      setUploadedImage(null);
      setImageError('Could not read the uploaded image.');
    };
    reader.readAsDataURL(file);
  }

  function updateStatus(id: string, status: OrderStatus) {
    updateOrderStatus(id, status);
    setOrders(getStoredOrders());
  }

  const revenue = useMemo(
    () => orders.filter((order) => order.status !== 'Cancelled')
      .reduce((sum, order) => sum + order.total, 0),
    [orders],
  );
  const pending = orders.filter((order) =>
    ['New', 'Confirmed', 'Processing'].includes(order.status),
  ).length;
  const convertedImageUrl = convertGoogleDriveUrl(imageUrl);
  const previewImage = uploadedPreview || convertedImageUrl || editingProduct?.image || '';

  if (authLoading) {
    return <main className="adminShell"><p className="commerceNotice">Checking Admin access…</p></main>;
  }

  if (!isAdmin) {
    return (
      <main className="adminShell">
        <section className="adminMain">
          <div className="adminPanel">
            <span className="kicker">BEAUTY SPELL ADMIN</span>
            <h1>Admin sign in</h1>
            <p className="muted">Sign in with an authorized Supabase account to manage products and orders.</p>
            <form className="productForm" onSubmit={signIn}>
              <label className={styles.formField}>
                Email
                <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className={styles.formField}>
                Password
                <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              {authError && <p className={styles.imageError} role="alert">{authError}</p>}
              <div className={styles.formActions}>
                <button className="ctaPrimary">Sign in</button>
              </div>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <aside className="adminSidebar">
        <Link className="adminLogo" href="/">
          <img src="/beauty-spell-logo.png" alt="Beauty Spell" />
        </Link>
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
          <BarChart3 /> Dashboard
        </button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          <Package /> Products
        </button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          <ShoppingCart /> Orders <span>{orders.length}</span>
        </button>
        <Link className="adminBack" href="/"><ArrowLeft /> Back to store</Link>
      </aside>

      <section className="adminMain">
        <div className="adminTop">
          <div>
            <span className="kicker">BEAUTY SPELL ADMIN</span>
            <h1>{tab[0].toUpperCase() + tab.slice(1)}</h1>
          </div>
          <div className={styles.formActions}>
            <Link href="/" className="ctaGhost dark">View Store</Link>
            <button type="button" className="ctaGhost dark" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>

        {tab === 'dashboard' && (
          <>
            <div className="statGrid">
              <div><span>Total products</span><b>{products.length}</b><small>Current catalogue</small></div>
              <div><span>Total orders</span><b>{orders.length}</b><small>Orders on this browser</small></div>
              <div><span>Open orders</span><b>{pending}</b><small>Need attention</small></div>
              <div><span>Order value</span><b>{formatTaka(revenue)}</b><small>Excluding cancelled</small></div>
            </div>
            <div className="adminPanel">
              <h2>Recent orders</h2>
              {orders.length ? orders.slice(0, 5).map((order) => (
                <div className="recentOrder" key={order.orderId}>
                  <div><b>{order.orderId}</b><span>{order.customer.fullName} · {order.customer.contactNumber}</span></div>
                  <strong>{formatTaka(order.total)}</strong>
                  <span className="statusPill">{order.status}</span>
                </div>
              )) : <p className="muted">No orders yet. Place a test order from the storefront.</p>}
            </div>
          </>
        )}

        {tab === 'products' && (
          <>
            <div className="adminPanel">
              <h2>{editingProduct ? 'Edit product' : 'Add product'}</h2>
              {editingProduct && <p className="muted">Editing product #{editingProduct.id}</p>}
              <form
                key={editingProduct?.id ?? 'new'}
                onSubmit={submitProduct}
                className="productForm"
              >
                <label className={styles.formField}>
                  Product name
                  <input required name="name" placeholder="Product name" defaultValue={editingProduct?.name ?? ''} />
                </label>
                <label className={styles.formField}>
                  Category
                  <input required name="category" placeholder="e.g. Skincare" defaultValue={editingProduct?.category ?? ''} />
                </label>
                <label className={styles.formField}>
                  Brand
                  <input name="brand" placeholder="Brand" defaultValue={editingProduct?.brand ?? ''} />
                </label>
                <label className={styles.formField}>
                  Regular price
                  <input required type="number" min="0" name="price" placeholder="Regular price" defaultValue={editingProduct?.price ?? ''} />
                </label>
                <label className={styles.formField}>
                  Discount price
                  <input type="number" min="0" name="discountPrice" placeholder="Discount price" defaultValue={editingProduct?.discountPrice ?? ''} />
                </label>
                <label className={styles.formField}>
                  Stock quantity
                  <input type="number" min="0" name="stock" placeholder="Stock quantity" defaultValue={editingProduct?.stock ?? ''} />
                </label>
                <label className={styles.imageField}>
                  Product Image URL
                  <input
                    name="image"
                    value={imageUrl}
                    onChange={(event) => handleImageUrlChange(event.target.value)}
                    placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
                    aria-invalid={Boolean(imageError)}
                    aria-describedby="product-image-hint product-image-error"
                  />
                </label>
                <label className={styles.imageField}>
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageUpload(event.target.files?.[0])}
                  />
                </label>
                <small id="product-image-hint" className={styles.imageHint}>
                  Google Drive share links are converted automatically. An uploaded image takes priority.
                </small>
                {imageError && (
                  <p id="product-image-error" className={styles.imageError} role="alert">{imageError}</p>
                )}
                {productsError && (
                  <p className={styles.imageError} role="alert">{productsError}</p>
                )}
                {previewImage && (
                  <div className={styles.imagePreview}>
                    <img src={previewImage} alt="Product image preview" />
                    <span>
                      {uploadedImage
                        ? 'Uploaded image preview'
                        : editingProduct && imageUrl === editingProduct.image
                          ? 'Current product image'
                          : 'Image preview'}
                    </span>
                  </div>
                )}
                <label className={styles.formField}>
                  Badge
                  <input name="badge" placeholder="e.g. NEW / 20% OFF" defaultValue={editingProduct?.badge ?? ''} />
                </label>
                <label className={`${styles.formField} ${styles.descriptionField}`}>
                  Description
                  <textarea required name="description" placeholder="Product description" defaultValue={editingProduct?.description ?? ''} />
                </label>
                <div className={styles.formField}>
                  Featured
                  <label className="checkLabel">
                    <input type="checkbox" name="featured" defaultChecked={editingProduct?.featured ?? false} /> Show on homepage
                  </label>
                </div>
                <div className={styles.formField}>
                  Status
                  <label className="checkLabel">
                    <input type="checkbox" name="active" defaultChecked={editingProduct?.active ?? true} /> Active on storefront
                  </label>
                </div>
                <div className={styles.formActions}>
                  <button className="ctaPrimary" disabled={saving}>
                    {saving ? 'Saving…' : editingProduct ? 'Save Changes' : <><Plus size={17} /> Add Product</>}
                  </button>
                  {editingProduct && (
                    <button type="button" className="ctaGhost dark" onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="adminPanel">
              <div className="panelHeading">
                <h2>Products</h2>
                <div className={styles.formActions}>
                  {!products.length && !productsLoading && (
                    <button type="button" onClick={() => void importLegacyCatalogue()}>
                      Import this browser&apos;s old products
                    </button>
                  )}
                  <button type="button" onClick={() => void refreshProducts()} disabled={productsLoading}>
                    {productsLoading ? 'Loading…' : 'Refresh products'}
                  </button>
                </div>
              </div>
              {productsError && <p className={styles.imageError} role="alert">{productsError}</p>}
              <div className="adminProductTable">
                {!products.length && !productsLoading
                  ? <p className="muted">No products found in the Supabase products table.</p>
                  : products.map((product) => (
                  <div key={product.id} className={styles.productRow}>
                    <img src={product.image} alt="" />
                    <div className={styles.productName}>
                      <b>{product.name}</b><span>{product.brand} · {product.category}{product.active ? '' : ' · Inactive'}</span>
                    </div>
                    <strong>{formatTaka(product.discountPrice ?? product.price)}</strong>
                    <span>Stock {product.stock ?? '—'}</span>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        aria-label={`Edit ${product.name}`}
                        title={`Edit ${product.name}`}
                        onClick={() => editProduct(product)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${product.active ? 'Disable' : 'Enable'} ${product.name}`}
                        title={`${product.active ? 'Disable' : 'Enable'} ${product.name}`}
                        onClick={() => void toggleProductActive(product)}
                      >
                        {product.active ? <Trash2 size={17} /> : <Plus size={17} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'orders' && (
          <div className="adminPanel">
            <h2>Order management</h2>
            {orders.length ? (
              <div className="orderTable">
                {orders.map((order) => (
                  <article key={order.orderId}>
                    <div className="orderHead">
                      <div><b>{order.orderId}</b><span>{new Date(order.createdAt).toLocaleString()}</span></div>
                      <strong>{formatTaka(order.total)}</strong>
                    </div>
                    <div className="orderCustomer">
                      <span><b>{order.customer.fullName}</b><small>{order.customer.contactNumber}</small></span>
                      <span><b>{order.itemCount} items</b><small>{order.paymentMethod}</small></span>
                      <span>
                        <b>{order.customer.area === 'outside' ? 'Outside Dhaka' : 'Inside Dhaka'}</b>
                        <small>{order.customer.address}</small>
                      </span>
                    </div>
                    <div className="orderLines">
                      {order.items.map((item) => (
                        <span key={item.productId}>{item.name} × {item.quantity}</span>
                      ))}
                    </div>
                    <div className="orderStatusRow">
                      <label>
                        Status
                        <select
                          value={order.status}
                          onChange={(event) => updateStatus(order.orderId, event.target.value as OrderStatus)}
                        >
                          {['New', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                      <span>Notification: <b>{order.notificationStatus}</b></span>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="muted">No orders yet.</p>}
          </div>
        )}
      </section>
      <div className="cartToast" role="status">{successMessage}</div>
    </main>
  );
}
