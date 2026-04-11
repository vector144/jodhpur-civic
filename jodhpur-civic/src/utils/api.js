import { supabase } from './supabase';

async function getUserIP() {
  try {
    const res = await fetch("https://api64.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch (e) {
    // If adblocker blocks ipify, fallback to a local token
    return ;
  }
}

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
  const device_ip = await getUserIP();

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
    device_id: device_ip
  }]);

  if (error) throw error;
  
  localStorage.setItem(rateLimitKey, (currentCount + 1).toString());
}

export async function verifyIssue({ issueId, file }) {
  const device_ip = await getUserIP();

  // 1) Upload image to 'verifications' bucket
  const image_url = await uploadImage(supabase, file, "verifications");

  // 2) Insert DB
  const { error } = await supabase.from("verifications").insert([{
    issue_id: issueId,
    image_url,
    device_id: device_ip || 'unknown'
  }]);

  if (error) throw error;

  // Update the issue status to resolved
  const { error: updateError } = await supabase.from('issues').update({ status: 'resolved' }).eq('id', issueId);
  if (updateError) throw updateError;
}

export async function upvoteIssue(issueId) {
  const device_ip = await getUserIP();
  
  const { error } = await supabase.from("upvotes").insert([{
    issue_id: issueId,
    device_ip: device_ip
  }]);

  if (error) {
    // 23505 is the Postgres error code for unique_violation
    if (error.code === '23505') {
      throw new Error('You have already endorsed this issue.');
    }
    throw error;
  }
}

export async function getAllComplaintsFromDB() {
  const { data, error } = await supabase
    .from('issues')
    .select('*, verifications(image_url)')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  // Transform to match old keys to reduce breaking UI
  return data.map(d => {
    const verifiedBase64 = d.verifications && d.verifications.length > 0 ? d.verifications[0].image_url : null;
    return {
      ...d,
      tracking_id: d.id,
      photo_base64: d.image_url,
      verified_photo: verifiedBase64,
      ward_no: d.ward_number,
      lat: d.latitude,
      lng: d.longitude
    };
  });
}
