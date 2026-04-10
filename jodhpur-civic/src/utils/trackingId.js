export function generateTrackingId() {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-5);
  return `JDH-${year}-${seq}`;
}
