import React, { useState } from 'react';
import { compareSnapshots, getDownloadUrl } from './api';

function formatCurrency(amountStr) {
  if (!amountStr) return '₹0.00';
  const num = parseFloat(amountStr);
  const formatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

export default function App() {
  const [masterOld, setMasterOld] = useState(null);
  const [transactionsOld, setTransactionsOld] = useState(null);
  const [masterNew, setMasterNew] = useState(null);
  const [transactionsNew, setTransactionsNew] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const isFormComplete = masterOld && transactionsOld && masterNew && transactionsNew;

  const handleCompare = async (e) => {
    e.preventDefault();
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
    <div className="container">
      <header className="header">
        <h1 className="title">TDS Change Comparison</h1>
        <p className="subtitle">Identify post-filing accounting and TDS changes with deterministic reconciliation</p>
      </header>

      <form onSubmit={handleCompare}>
        {/* Section 1: Original / Filed Data */}
        <div className="section">
          <div className="section-title">Original / Filed Data</div>
          
          <div className="file-group">
            <label className="file-label" htmlFor="master-old">Master JSON</label>
            <div className="file-input-wrapper">
              <input
                id="master-old"
                type="file"
                accept=".json"
                className="file-input"
                onChange={(e) => setMasterOld(e.target.files[0] || null)}
              />
            </div>
          </div>

          <div className="file-group">
            <label className="file-label" htmlFor="tx-old">Transaction JSON</label>
            <div className="file-input-wrapper">
              <input
                id="tx-old"
                type="file"
                accept=".json"
                className="file-input"
                onChange={(e) => setTransactionsOld(e.target.files[0] || null)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Updated / Current Data */}
        <div className="section">
          <div className="section-title">Updated / Current Data</div>
          
          <div className="file-group">
            <label className="file-label" htmlFor="master-new">Master JSON</label>
            <div className="file-input-wrapper">
              <input
                id="master-new"
                type="file"
                accept=".json"
                className="file-input"
                onChange={(e) => setMasterNew(e.target.files[0] || null)}
              />
            </div>
          </div>

          <div className="file-group">
            <label className="file-label" htmlFor="tx-new">Transaction JSON</label>
            <div className="file-input-wrapper">
              <input
                id="tx-new"
                type="file"
                accept=".json"
                className="file-input"
                onChange={(e) => setTransactionsNew(e.target.files[0] || null)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="actions">
          <button
            type="submit"
            className="btn"
            id="compare-btn"
            disabled={!isFormComplete || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Comparing & Generating Report...
              </>
            ) : (
              'Compare & Generate Report'
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
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

      {/* Summary View */}
      {result && result.summary && (
        <div className="summary-container">
          <div className="summary-header-row">
            <div className="section-title" style={{ margin: 0 }}>Summary</div>
            {result.reconciliation && (
              <span className={`badge ${result.reconciliation.is_valid ? 'badge-pass' : 'badge-fail'}`}>
                Reconciliation: {result.reconciliation.is_valid ? 'PASS' : 'FAIL'}
              </span>
            )}
          </div>

          <div className="summary-grid">
            <div className="summary-row">
              <span className="summary-label">Original Transactions</span>
              <span className="summary-value">{result.summary.original_transactions}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Updated Transactions</span>
              <span className="summary-value">{result.summary.updated_transactions}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Unchanged</span>
              <span className="summary-value">{result.summary.unchanged}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Modified</span>
              <span className="summary-value">{result.summary.modified}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">New</span>
              <span className="summary-value">{result.summary.new}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Missing</span>
              <span className="summary-value">{result.summary.missing}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Recreated</span>
              <span className="summary-value">{result.summary.recreated}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Unresolved</span>
              <span className="summary-value">{result.summary.unresolved}</span>
            </div>
            <div className="summary-row total-row">
              <span className="summary-label">TDS Difference</span>
              <span className="summary-value highlight-val">{formatCurrency(result.summary.tds_difference)}</span>
            </div>
          </div>

          <div className="actions">
            <a
              href={getDownloadUrl(result.report.download_id)}
              className="btn btn-download"
              id="download-report-btn"
              download={result.report.filename}
            >
              Download Excel Report
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
