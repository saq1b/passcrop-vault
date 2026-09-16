'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Script from 'next/script';

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<any[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
      if (profile) setCredits(profile.credits);
    }
  };

  const fetchUploads = async () => {
    const { data } = await supabase.from('uploads').select('*').order('created_at', { ascending: false });
    if (data) setUploads(data);
  };

  useEffect(() => {
    loadUserData();
    fetchUploads();
  }, []);

  const handlePay = async () => {
    // 1. Call order creation endpoint
    const res = await fetch('/api/razorpay/order', { method: 'POST' });
    const { orderId, amount } = await res.json();

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount,
      currency: 'INR',
      name: 'PassCrop Vault',
      description: '10 Upload Credits',
      order_id: orderId,
      handler: async (response: any) => {
        // 2. Verify signature on completion
        const verifyRes = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...response,
            userId: user.id,
          }),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          setCredits(verifyData.credits);
          alert('Payment Successful! 10 Credits added.');
        }
      },
    };

    const paymentObject = new (window as any).Razorpay(options);
    paymentObject.open();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();
    setUploading(false);

    if (result.success) {
      setFile(null);
      fetchUploads();
    } else {
      alert(result.error || 'Upload failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header with Balance and Top-up */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">PassCrop Vault</h1>
            <p className="text-gray-400 text-sm">{user?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg text-sm">
              Credits: <span className="text-blue-400 font-bold">{credits}</span>
            </div>
            <button
              onClick={handlePay}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
            >
              Buy +10 Credits (₹10)
            </button>
          </div>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUpload} className="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
          />
          <button
            type="submit"
            disabled={!file || uploading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? 'Processing & Storing...' : 'Upload to Cloudinary & Vault'}
          </button>
        </form>

        {/* Uploaded Media Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {uploads.map((item) => (
            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden p-3">
              <img src={item.cloudinary_url} alt={item.file_name} className="w-full h-40 object-cover rounded-lg mb-2" />
              <p className="text-xs text-gray-400 truncate">{item.file_name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}