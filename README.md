# Beauty Spell — Next.js Cosmetics Store

Full demo e-commerce storefront built with Next.js 14 and TypeScript. It uses modern Bangladesh marketplace/beauty shopping patterns with an original Beauty Spell design.

## Features
- Homepage, category navigation, search, filter and sorting
- Product details, wishlist, flash deals, brands and FAQ
- Multi-product cart, quantity controls and coupons
- Checkout with Dhaka/outside-Dhaka delivery charge
- Cash on Delivery plus manual bKash/Nagad options
- Order success and order tracking
- Supabase-backed Admin dashboard for products and order status
- Optional Telegram new-order notification
- Responsive mobile/tablet/desktop UI

## Local test
`npm install`
`npm run dev`

## Production build
`npm run build`

## Supabase product catalogue

Supabase is the source of truth for products. Public pages read active rows from
`public.products`; the Admin panel inserts, updates and disables rows in that
same table. Cart and wishlist preferences remain in browser storage.

The existing `products` table must have these columns (the `id` is a generated
integer primary key):

- `id`, `name`, `brand`, `category`, `price`, `discount_price`, `stock`
- `image_url`, `description`, `badge`, `featured`, `active`

Apply `supabase/migrations/20261009000000_products_rls_and_images.sql` in the
Supabase SQL Editor. It does not create another products table; it adds the
`active` flag if needed, installs policies that allow public reads only for
active products and require an Admin claim for writes, and creates the public
`product-images` Storage bucket with Admin-only uploads. Existing product-table
policies are still constrained by restrictive Admin/read policies.

Admin access uses Supabase Auth email/password. Create the Admin user in
Supabase Auth, then set the user's **app metadata** role to `admin` from a
trusted server or the SQL Editor (replace the address):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin')
where email = 'admin@example.com';
```

Sign out and back in after changing app metadata so the Admin JWT is refreshed.
Do not put a service-role/secret key in any `NEXT_PUBLIC_*` variable or browser
code.

If the old browser-local catalogue needs to be moved, sign in to Admin in the
browser that still has it and use **Import this browser's old products** while
the Supabase catalogue is empty. This guarded one-time import preserves the
existing numeric IDs, then removes the old product key after Supabase confirms
the import. It does not merge or overwrite a non-empty Supabase catalogue.

## Vercel

Set these variables for the Vercel **Production** environment (and Preview if
needed):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Use only the public anon/publishable key in the app. No service-role key is
required by the browser-based authenticated Admin flow. Redeploy after setting
environment variables or pushing code changes.

Optional Telegram notifications:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Demo coupons: `BEAUTY10`, `WELCOME150`.

Orders and order status continue to use browser storage; product catalogue data
does not. Admin image uploads are stored in Supabase Storage and the resulting
public URL is saved on the matching product row.
