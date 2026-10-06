import { NextResponse } from 'next/server';
import { sendOrderNotification } from '@/lib/orderNotification';
import type { Order } from '@/lib/order';

export async function POST(request: Request) {
  let order: Order;
  try {
    order = (await request.json()) as Order;
  } catch {
    return NextResponse.json({ error: 'Invalid order payload.' }, { status: 400 });
  }

  if (
    typeof order?.orderId !== 'string' ||
    typeof order?.customer?.fullName !== 'string' ||
    typeof order?.customer?.contactNumber !== 'string' ||
    !Array.isArray(order?.items) ||
    !Number.isFinite(order?.total)
  ) {
    return NextResponse.json({ error: 'Order is missing required fields.' }, { status: 400 });
  }

  const result = await sendOrderNotification(order);
  return NextResponse.json({
    configured: result.configured,
    message: result.message,
  });
}

