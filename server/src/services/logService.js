export function auditLog(event, metadata = {}) {
  const record = {
    event,
    metadata,
    timestamp: new Date().toISOString()
  };
  console.info(JSON.stringify(record));
}
