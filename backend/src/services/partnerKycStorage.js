const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'partner-kyc';

function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureBucket() {
  const client = storageClient();
  if (!client) return false;
  const { data: buckets } = await client.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return true;
  const { error } = await client.storage.createBucket(BUCKET, { public: false });
  if (error && !String(error.message || '').includes('already exists')) {
    console.warn('[partner-kyc-storage] createBucket:', error.message);
  }
  return true;
}

async function uploadKycImage({ portalAccountId, side, buffer, mimeType }) {
  const client = storageClient();
  if (!client) {
    const err = new Error('Storage not configured');
    err.statusCode = 503;
    throw err;
  }
  await ensureBucket();
  const ext = mimeType?.includes('png') ? 'png' : 'jpg';
  const path = `${portalAccountId}/${side}-${Date.now()}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType || 'image/jpeg',
    upsert: true,
  });
  if (error) {
    const err = new Error(error.message || 'Upload failed');
    err.statusCode = 500;
    throw err;
  }
  return path;
}

async function downloadKycImage(storagePath) {
  const client = storageClient();
  if (!client || !storagePath) return null;
  const { data, error } = await client.storage.from(BUCKET).download(storagePath);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return buf;
}

module.exports = { uploadKycImage, downloadKycImage, BUCKET };
