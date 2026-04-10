const STORAGE_KEY = 'jdh_complaints';

export function saveComplaint(complaint) {
  const existing = getAllComplaints();
  existing.unshift(complaint);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getAllComplaints() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function updateComplaintStatus(trackingId, newStatus) {
  const all = getAllComplaints();
  const updated = all.map((c) =>
    c.tracking_id === trackingId ? { ...c, status: newStatus } : c
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteComplaint(trackingId) {
  const all = getAllComplaints();
  const updated = all.filter((c) => c.tracking_id !== trackingId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
