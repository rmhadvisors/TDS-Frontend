const API_BASE = '/api';

export async function compareSnapshots({ masterOld, transactionsOld, masterNew, transactionsNew }) {
  const formData = new FormData();
  formData.append('master_old', masterOld);
  formData.append('transactions_old', transactionsOld);
  formData.append('master_new', masterNew);
  formData.append('transactions_new', transactionsNew);

  const response = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data.error || 'Failed to compare snapshots';
    const details = data.details || [];
    const err = new Error(message);
    err.details = details;
    throw err;
  }

  return data;
}

export function getDownloadUrl(downloadId) {
  return `${API_BASE}/download/${downloadId}`;
}
