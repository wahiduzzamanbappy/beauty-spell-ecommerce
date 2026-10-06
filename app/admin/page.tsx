'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Package, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import styles from './AdminImageFields.module.css';
import { getProductsFromStorage, starterProducts, type Product } from '@/lib/products';
import { convertGoogleDriveUrl } from '@/lib/image';
import { formatTaka } from '@/lib/currency';
import { getStoredOrders, updateOrderStatus, type Order, type OrderStatus } from '@/lib/order';

type Tab = 'dashboard' | 'products' | 'orders';

export default function Admin() {
  const [products, setProducts] = useState<Product[]>(starterProducts);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImage, setUploadedImage] = useState('');
  const [imageError, setImageError] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setProducts(getProductsFromStorage());
    setOrders(getStoredOrders());
  }, []);

  function save(value: Product[]) {
    localStorage.setItem('beauty-spell-products', JSON.stringify(value));
    setProducts(value);
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const convertedImageUrl = convertGoogleDriveUrl(imageUrl);
    if (convertedImageUrl === null && !uploadedImage) {
      setImageError('Enter a valid Google Drive file-sharing link.');
      return;
    }
    const image = uploadedImage || convertedImageUrl;
    if (!image) {
      setImageError('Enter a product image URL or upload an image.');
      return;
    }

    const form = event.currentTarget;
    const fields = new FormData(form);
    const product: Product = {
      ...editingProduct,
      id: editingProduct?.id ?? Date.now(),
      name: String(fields.get('name')),
      category: String(fields.get('category')),
      brand: String(fields.get('brand')) || 'Beauty Spell',
      price: Number(fields.get('price')),
      discountPrice: Number(fields.get('discountPrice')) || undefined,
      image: uploadedImage || convertedImageUrl || editingProduct?.image || image,
      description: String(fields.get('description')),
      badge: String(fields.get('badge')) || undefined,
      rating: editingProduct?.rating ?? 4.8,
      reviews: editingProduct?.reviews ?? 0,
      stock: Number(fields.get('stock')) || 0,
      featured: fields.get('featured') === 'on',
    };

    if (editingProduct) {
      save(products.map((existing) => existing.id === editingProduct.id ? product : existing));
      setSuccessMessage('Product updated successfully.');
    } else {
      save([product, ...products]);
      setSuccessMessage('Product added successfully.');
    }
    form.reset();
    setEditingProduct(null);
    setImageUrl('');
    setUploadedImage('');
    setImageError('');
    window.setTimeout(() => setSuccessMessage(''), 3000);
  }

  function editProduct(product: Product) {
    setEditingProduct(product);
    setImageUrl(product.image.startsWith('data:') ? '' : product.image);
    setUploadedImage('');
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
    setUploadedImage('');
    setImageError('');
  }

  function deleteProduct(id: number) {
    save(products.filter((product) => product.id !== id));
    if (editingProduct?.id === id) cancelEdit();
  }

  function resetCatalogue() {
    save(starterProducts);
    cancelEdit();
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
      setUploadedImage('');
      setImageError(urlError);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setUploadedImage('');
      setImageError('Choose an image file.');
      return;
    }

    setImageError(urlError);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setImageError('Could not read the uploaded image.');
        return;
      }
      setUploadedImage(reader.result);
    };
    reader.onerror = () => setImageError('Could not read the uploaded image.');
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
  const previewImage = uploadedImage || convertedImageUrl || editingProduct?.image || '';

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
          <Link href="/" className="ctaGhost dark">View Store</Link>
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
                <input required name="name" placeholder="Product name" defaultValue={editingProduct?.name ?? ''} />
                <input required name="category" placeholder="Category e.g. Skincare" defaultValue={editingProduct?.category ?? ''} />
                <input name="brand" placeholder="Brand" defaultValue={editingProduct?.brand ?? ''} />
                <input required type="number" min="0" name="price" placeholder="Regular price" defaultValue={editingProduct?.price ?? ''} />
                <input type="number" min="0" name="discountPrice" placeholder="Discount price" defaultValue={editingProduct?.discountPrice ?? ''} />
                <input type="number" min="0" name="stock" placeholder="Stock quantity" defaultValue={editingProduct?.stock ?? ''} />
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
                <input name="badge" placeholder="Badge e.g. NEW / 20% OFF" defaultValue={editingProduct?.badge ?? ''} />
                <textarea required name="description" placeholder="Product description" defaultValue={editingProduct?.description ?? ''} />
                <label className="checkLabel">
                  <input type="checkbox" name="featured" defaultChecked={editingProduct?.featured ?? false} /> Featured on homepage
                </label>
                <div className={styles.formActions}>
                  <button className="ctaPrimary">
                    {editingProduct ? 'Save Changes' : <><Plus size={17} /> Add Product</>}
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
                <button onClick={resetCatalogue}>Reset demo catalogue</button>
              </div>
              <div className="adminProductTable">
                {products.map((product) => (
                  <div key={product.id} className={styles.productRow}>
                    <img src={product.image} alt="" />
                    <div className={styles.productName}>
                      <b>{product.name}</b><span>{product.brand} · {product.category}</span>
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
                        aria-label={`Delete ${product.name}`}
                        title={`Delete ${product.name}`}
                        onClick={() => deleteProduct(product.id)}
                      >
                        <Trash2 size={17} />
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
