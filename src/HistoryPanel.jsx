import React, { useEffect, useState } from 'react';
import { deleteReport, getDownloadUrl, getHistory } from './api';

function formatDateTime(iso) {
  const dt = new Date(iso);
  return isNaN(dt)
    ? iso
    : dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Every report generated so far, shared by everyone using the app. Reloads whenever the tab is opened.
export default function HistoryPanel({ active }) {
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = async (term = search) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHistory(term);
      setReports(data.reports);
      setSelected(new Set());
      setStorage(data.storage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) load();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (r) => {
    const label = `${r.party_name || 'All Parties'} — ${r.period || 'Full Period'} (${formatDateTime(r.created_at)})`;
    if (!window.confirm(`Delete this report for everyone?

${label}

It will be removed from storage and cannot be recovered.`)) return;
    setDeleting(r.report_id);
    setError(null);
    try {
      await deleteReport(r.report_id);
      setReports((list) => list.filter((x) => x.report_id !== r.report_id));
      setSelected((s) => {
        const next = new Set(s);
        next.delete(r.report_id);
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelected = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = reports.length > 0 && reports.every((r) => selected.has(r.report_id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(reports.map((r) => r.report_id)));
  };

  // Deletes the selected reports one by one; the ones that fail stay listed and selected so they can be retried
  const handleDeleteSelected = async () => {
    const ids = reports.map((r) => r.report_id).filter((id) => selected.has(id));
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} selected report${ids.length === 1 ? '' : 's'} for everyone?

${ids.length === 1 ? 'It' : 'They'} will be removed from storage and cannot be recovered.`)) return;
    setBulkDeleting(true);
    setError(null);
    const failed = [];
    for (const id of ids) {
      try {
        await deleteReport(id);
      } catch (err) {
        failed.push(id);
      }
    }
    const removed = new Set(ids.filter((id) => !failed.includes(id)));
    setReports((list) => list.filter((x) => !removed.has(x.report_id)));
    setSelected(new Set(failed));
    if (failed.length) {
      setError(`${failed.length} of ${ids.length} reports could not be deleted. They are still selected; try again.`);
    }
    setBulkDeleting(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  return (
    <div>
      <form className="history-toolbar" onSubmit={handleSearch}>
        <input
          type="search"
          className="text-input"
          aria-label="Search by party or period"
          placeholder="Search by party or period"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn btn-small" disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="error-box" role="alert">
          <div className="error-title">{error}</div>
        </div>
      )}

      {reports.length > 0 && (
        <div className="history-bulk">
          <label className="history-check">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={bulkDeleting} />
            Select all
          </label>
          {selected.size > 0 && (
            <>
              <span className="history-meta">{selected.size} selected</span>
              <button
                type="button"
                className="btn btn-small btn-delete"
                disabled={bulkDeleting}
                onClick={handleDeleteSelected}
              >
                {bulkDeleting ? 'Deleting…' : `Delete selected (${selected.size})`}
              </button>
            </>
          )}
        </div>
      )}

      {(!error || reports.length > 0) && (
        <ul className="history-list">
          {reports.length === 0 && (
            <li className="history-empty">
              {loading ? 'Loading reports…' : search.trim() ? 'No reports match this search.' : 'No reports generated yet.'}
            </li>
          )}
          {reports.map((r) => (
            <li className="history-item" key={r.report_id}>
              <input
                type="checkbox"
                className="history-select"
                aria-label={`Select report for ${r.party_name || 'All Parties'}`}
                checked={selected.has(r.report_id)}
                onChange={() => toggleSelected(r.report_id)}
                disabled={bulkDeleting}
              />
              <div className="history-info">
                <div className="history-party">{r.party_name || 'All Parties'}</div>
                <div className="history-meta">
                  {r.period || 'Full Period'} · {formatDateTime(r.created_at)} · {formatSize(r.size)}
                </div>
              </div>
              <div className="history-actions">
                <a className="btn btn-small btn-download" href={getDownloadUrl(r.report_id)} download={r.filename}>
                  Download
                </a>
                <button
                  type="button"
                  className="btn btn-small btn-delete"
                  aria-label={`Delete report for ${r.party_name || 'All Parties'}`}
                  disabled={deleting === r.report_id || bulkDeleting}
                  onClick={() => handleDelete(r)}
                >
                  {deleting === r.report_id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {storage && (
        <p className="history-note">
          {reports.length > 0 && `${reports.length} report${reports.length === 1 ? '' : 's'}, newest first · `}
          {storage === 's3' ? 'Stored in S3' : 'Stored on this server (S3 not configured)'}
        </p>
      )}
    </div>
  );
}
