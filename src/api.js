const API_BASE = '/api';

export async function compareSnapshots({ masterOld, transactionsOld, masterNew, transactionsNew, partyName, period }) {
  const formData = new FormData();
  // The latest master stands in for the original unless the original is given (only asked for when ledgers
  // of the filed vouchers are missing from the latest master)
  if (masterOld) {
    formData.append('master_old', masterOld);
  }
  formData.append('transactions_old', transactionsOld);
  formData.append('master_new', masterNew);
  formData.append('transactions_new', transactionsNew);
  if (partyName && partyName.trim()) {
    formData.append('party_name', partyName.trim());
  }
  if (period && period.trim()) {
    formData.append('period', period.trim());
  }

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

async function jsonOrThrow(response, fallback) {
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error || data.detail || fallback);
    err.details = data.details || [];
    throw err;
  }
  return data;
}

export async function getKeywords() {
  return jsonOrThrow(await fetch(`${API_BASE}/keywords`), 'Failed to load keywords');
}

export async function saveKeyword(keyword, section) {
  const response = await fetch(`${API_BASE}/keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, section }),
  });
  return jsonOrThrow(response, 'Failed to save keyword');
}

export async function deleteKeyword(keyword) {
  const response = await fetch(`${API_BASE}/keywords/${encodeURIComponent(keyword)}`, { method: 'DELETE' });
  return jsonOrThrow(response, 'Failed to remove keyword');
}

export async function getHistory(search = '') {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return jsonOrThrow(await fetch(`${API_BASE}/history${query}`), 'Failed to load report history');
}

export async function deleteReport(reportId) {
  const response = await fetch(`${API_BASE}/history/${encodeURIComponent(reportId)}`, { method: 'DELETE' });
  return jsonOrThrow(response, 'Failed to delete report');
}
