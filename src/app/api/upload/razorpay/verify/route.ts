import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Use Service Role Key to bypass RLS and update credits safely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = await request.json();

    // 1. Verify HMAC SHA256 Signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // 2. Fetch current credits & add 10 new credits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    const updatedCredits = (profile?.credits || 0) + 10;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ credits: updatedCredits })
      .eq('id', userId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, credits: updatedCredits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}