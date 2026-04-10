import { supabase, getDeviceId } from './supabase';

export async function uploadImage(supabaseClient, file, bucket) {
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, file, { upsert: false });

  if (error) throw error;

  const { data: pub } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return pub.publicUrl;
}

export async function reportIssue({ file, severity, gps, wardInfo, issueType, description }) {
  const device_id = getDeviceId();

  // MVP Rate Limiting: Max 5 per day per device (frontend)
  const today = new Date().toISOString().split('T')[0];
  const rateLimitKey = `rate_limit_${today}`;
  const currentCount = parseInt(localStorage.getItem(rateLimitKey) || '0', 10);
  if (currentCount >= 5) {
    throw new Error('Daily submission limit reached. Please try again tomorrow.');
  }

  const latitude = gps.lat;
  const longitude = gps.lng;

  if (!latitude || !longitude) throw new Error("No GPS data found");

  // 1) Upload image to 'issues' bucket
  const image_url = await uploadImage(supabase, file, "issues");

  // 2) Insert DB
  const { error } = await supabase.from("issues").insert([{
    latitude,
    longitude,
    ward_number: wardInfo.ward_no,
    ward_name: wardInfo.ward_name,
    issue_type: issueType,
    severity,
    description,
    image_url,
    device_id
  }]);

  if (error) throw error;
  
  localStorage.setItem(rateLimitKey, (currentCount + 1).toString());
}

export async function verifyIssue({ issueId, file }) {
  const device_id = getDeviceId();

  // 1) Upload image to 'verifications' bucket
  const image_url = await uploadImage(supabase, file, "verifications");

  // 2) Insert DB
  const { error } = await supabase.from("verifications").insert([{
    issue_id: issueId,
    image_url,
    device_id
  }]);

  if (error) throw error;

  // Optional MVP workaround: update issue status (might fail if no specific RLS policy grants UPDATE).
  // Depending on the RLS, this might fail unless enabled for public UPDATE.
  // Assuming a temporary trigger or policy exists for this hack.
  // return supabase.from('issues').update({ status: 'resolved' }).eq('id', issueId);
}

export async function getAllComplaintsFromDB() {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  // Transform to match old keys to reduce breaking UI
  return data.map(d => ({
    ...d,
    tracking_id: d.id,
    photo_base64: d.image_url,
    ward_no: d.ward_number,
    lat: d.latitude,
    lng: d.longitude
  }));
}
