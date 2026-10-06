# Beauty Spell — Next.js Cosmetics Store

Full demo e-commerce storefront built with Next.js 14 and TypeScript. It uses modern Bangladesh marketplace/beauty shopping patterns with an original Beauty Spell design.

## Features
- Homepage, category navigation, search, filter and sorting
- Product details, wishlist, flash deals, brands and FAQ
- Multi-product cart, quantity controls and coupons
- Checkout with Dhaka/outside-Dhaka delivery charge
- Cash on Delivery plus manual bKash/Nagad options
- Order success and order tracking
- Admin dashboard for products and order status
- Optional Telegram new-order notification
- Responsive mobile/tablet/desktop UI

## Local test
`npm install`
`npm run dev`

## Production build
`npm run build`

## Vercel
Push to GitHub and import in Vercel. No environment variables are required for the demo.

Optional Telegram notifications:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Demo coupons: `BEAUTY10`, `WELCOME150`.

Products/orders currently use browser storage for easy testing. For a real production store, connect Supabase/PostgreSQL/Firebase, add authenticated admin access and a real payment gateway.
