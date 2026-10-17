import React, { useState } from 'react';
import { compareSnapshots, getDownloadUrl } from './api';
import UnresolvedSections from './UnresolvedSections';
import HistoryPanel from './HistoryPanel';
import DateRangeInput from './DateRangeInput';

function formatDate(value) {
  const dt = new Date(value);
  return isNaN(dt) ? value : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTimeline({ from, to }) {
  if (!from && !to) return 'Not specified';
  return `${from ? formatDate(from) : '…'} to ${to ? formatDate(to) : '…'}`;
}

function formatCurrency(amountStr) {
  if (!amountStr) return '₹0.00';
  const num = parseFloat(amountStr);
  const formatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// File picker that also accepts a dropped file and shows the chosen file's name and size.
function FileDrop({ id, label, hint, file, onChange }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onChange(dropped);
  };

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <label
        htmlFor={id}
        className={`dropzone ${file ? 'dropzone-filled' : ''} ${dragging ? 'dropzone-drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          id={id}
          type="file"
          accept=".json"
          className="visually-hidden"
          onChange={(e) => onChange(e.target.files[0] || null)}
        />
        <span className="dropzone-icon" aria-hidden="true">
          {file ? '✓' : '↑'}
        </span>
        <span className="dropzone-text">
          {file ? (
            <>
              <span className="dropzone-name">{file.name}</span>
              <span className="dropzone-sub">{formatSize(file.size)} · click to replace</span>
            </>
          ) : (
            <>
              <span className="dropzone-name">Choose {hint}</span>
              <span className="dropzone-sub">or drag a .json file here</span>
            </>
          )}
        </span>
      </label>
    </div>
  );
}

function SnapshotCard({ step, title, description, prefix, masterLabel, master, setMaster, transactions, setTransactions, timeline, setTimeline }) {
  return (
    <section className="card">
      <div className="card-head">
        <span className="step">{step}</span>
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="card-desc">{description}</p>
        </div>
      </div>
      {setMaster && (
        <FileDrop id={`master-${prefix}`} label={masterLabel || 'Master JSON'} hint="master file" file={master} onChange={setMaster} />
      )}
      <FileDrop id={`tx-${prefix}`} label="Transaction JSON" hint="transactions file" file={transactions} onChange={setTransactions} />
      <div className="field">
        <label className="field-label" htmlFor={`timeline-${prefix}-from`}>
          Data period <span className="optional">Optional</span>
        </label>
        <DateRangeInput idPrefix={`timeline-${prefix}`} value={timeline} onChange={setTimeline} />
      </div>
    </section>
  );
}

// Ledgers of the filed vouchers that the latest master no longer has (renamed or deleted after filing). Their
// details are only in the original master, so it is asked for here and the report regenerated with it.
function MissingMasterLedgers({ names, masterOld, setMasterOld, onRegenerate, regenerating }) {
  if (!names.length) return null;
  const shown = names.slice(0, 10);
  return (
    <div className="unresolved-container">
      <div className="section-title">Ledgers Missing From Latest Master</div>
      <div className="unresolved-item">
        <p className="unresolved-help">
          {names.length} {names.length === 1 ? 'ledger' : 'ledgers'} used in the original vouchers{' '}
          {names.length === 1 ? 'is' : 'are'} not in the latest master, probably renamed or deleted after filing.
          Upload the original master and regenerate for full accuracy.
        </p>
        <div className="unresolved-names">
          {shown.join(', ')}
          {names.length > shown.length && ` and ${names.length - shown.length} more`}
        </div>
        <FileDrop id="master-old" label="Original Master JSON" hint="original master file" file={masterOld} onChange={setMasterOld} />
        <button type="button" className="btn btn-small" disabled={!masterOld || regenerating} onClick={onRegenerate}>
          {regenerating ? 'Regenerating…' : 'Regenerate with original master'}
        </button>
      </div>
    </div>
  );
}

const STATS = [
  ['original_transactions', 'Original'],
  ['updated_transactions', 'Updated'],
  ['unchanged', 'Unchanged'],
  ['modified', 'Modified', 'warn'],
  ['new', 'New', 'info'],
  ['missing', 'Missing', 'bad'],
  ['recreated', 'Recreated', 'info'],
  ['unresolved', 'Unresolved', 'warn'],
];

export default function App() {
  const [masterOld, setMasterOld] = useState(null);
  const [transactionsOld, setTransactionsOld] = useState(null);
  const [masterNew, setMasterNew] = useState(null);
  const [transactionsNew, setTransactionsNew] = useState(null);
  const [partyName, setPartyName] = useState('');
  const [period, setPeriod] = useState('');
  const [timelineOld, setTimelineOld] = useState({ from: '', to: '' });
  const [timelineNew, setTimelineNew] = useState({ from: '', to: '' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('compare');

  // The original master is not part of the form: it is only asked for when the result reports missing ledgers
  const filesChosen = [transactionsOld, masterNew, transactionsNew].filter(Boolean).length;
  const isFormComplete = filesChosen === 3;

  const handleCompare = async (e) => {
    if (e) e.preventDefault();
    if (!isFormComplete) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await compareSnapshots({
        masterOld,
        transactionsOld,
        masterNew,
        transactionsNew,
        partyName,
        period,
        // The Excel report's period is the Updated / Current data period; a reversed range is not sent
        ...(timelineNew.from && timelineNew.to && timelineNew.from > timelineNew.to
          ? {}
          : { periodFrom: timelineNew.from, periodTo: timelineNew.to }),
      });
      setResult(data);
    } catch (err) {
      setError({
        message: err.message || 'Comparison failed',
        details: err.details || [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">TDS</span>
            <div>
              <h1 className="title">TDS Change Comparison</h1>
              <p className="subtitle">Find accounting and TDS changes made after filing</p>
            </div>
          </div>
          <nav className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'compare'}
              className={`tab ${tab === 'compare' ? 'tab-active' : ''}`}
              onClick={() => setTab('compare')}
            >
              New Comparison
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              className={`tab ${tab === 'history' ? 'tab-active' : ''}`}
              onClick={() => setTab('history')}
            >
              Report History
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div hidden={tab !== 'history'}>
          <HistoryPanel active={tab === 'history'} />
        </div>

        {/* Kept mounted while History is open, so the chosen files survive switching tabs */}
        <div hidden={tab !== 'compare'}>
          <form onSubmit={handleCompare}>
            <section className="card">
              <div className="card-head">
                <span className="step">1</span>
                <div>
                  <h2 className="card-title">Report Details</h2>
                  <p className="card-desc">Optional. Shown at the top of the Excel report.</p>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="party-name">Party Name / Company</label>
                <input
                  id="party-name"
                  type="text"
                  placeholder="e.g. ABC Enterprises"
                  className="text-input"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                />
              </div>
            </section>

            <div className="snapshot-grid">
              <SnapshotCard
                step="2"
                title="Original / Filed Data"
                description="The data as it was when the return was filed"
                prefix="old"
                transactions={transactionsOld}
                setTransactions={setTransactionsOld}
                timeline={timelineOld}
                setTimeline={setTimelineOld}
              />
              <SnapshotCard
                step="3"
                title="Updated / Current Data"
                description="The data as it is in the books now"
                prefix="new"
                masterLabel="Latest Master JSON (used for both)"
                master={masterNew}
                setMaster={setMasterNew}
                transactions={transactionsNew}
                setTransactions={setTransactionsNew}
                timeline={timelineNew}
                setTimeline={setTimelineNew}
              />
            </div>

            <div className="action-bar">
              <div className="progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${(filesChosen / 3) * 100}%` }} />
                </div>
                <span className="progress-text">
                  {isFormComplete ? 'All 3 files ready' : `${filesChosen} of 3 files chosen`}
                </span>
              </div>
              <button type="submit" className="btn btn-primary" id="compare-btn" disabled={!isFormComplete || loading}>
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Comparing…
                  </>
                ) : (
                  'Compare & Generate Report'
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="error-box" role="alert">
              <div className="error-title">{error.message}</div>
              {error.details && error.details.length > 0 && (
                <ul className="error-list">
                  {error.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && result.summary && (
            <section className="card results">
              <div className="results-head">
                <h2 className="card-title">Summary</h2>
                {result.reconciliation && (
                  <span className={`badge ${result.reconciliation.is_valid ? 'badge-pass' : 'badge-fail'}`}>
                    Reconciliation {result.reconciliation.is_valid ? 'passed' : 'failed'}
                  </span>
                )}
              </div>

              {result.report && (
                <dl className="meta-grid">
                  <div>
                    <dt>Party Name</dt>
                    <dd>{result.report.party_name || 'All Parties'}</dd>
                  </div>
                  <div>
                    <dt>Period</dt>
                    <dd>{result.report.period || 'Full Period'}</dd>
                  </div>
                  <div>
                    <dt>Original Data Period</dt>
                    <dd>{formatTimeline(timelineOld)}</dd>
                  </div>
                  <div>
                    <dt>Updated Data Period</dt>
                    <dd>{formatTimeline(timelineNew)}</dd>
                  </div>
                </dl>
              )}

              <div className="tds-total">
                <span className="tds-total-label">TDS Difference</span>
                <span className="tds-total-value">{formatCurrency(result.summary.tds_difference)}</span>
              </div>

              <div className="stat-grid">
                {STATS.map(([key, label, tone]) => {
                  const value = result.summary[key];
                  return (
                    <div key={key} className={`stat ${tone && Number(value) > 0 ? `stat-${tone}` : ''}`}>
                      <span className="stat-value">{value}</span>
                      <span className="stat-label">{label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="download-row">
                <a
                  href={getDownloadUrl(result.report.download_id)}
                  className="btn btn-download"
                  id="download-report-btn"
                  download={result.report.filename}
                >
                  ↓ Download Excel Report
                </a>
                {result.report.saved_to_history === false && (
                  <p className="form-error">
                    This report could not be saved to Report History. Download it now; it stays available here for one hour.
                  </p>
                )}
              </div>

              <MissingMasterLedgers
                names={result.missing_master_ledgers || []}
                masterOld={masterOld}
                setMasterOld={setMasterOld}
                onRegenerate={() => handleCompare()}
                regenerating={loading}
              />

              <UnresolvedSections
                items={result.unresolved_sections || []}
                onRegenerate={() => handleCompare()}
                regenerating={loading}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
