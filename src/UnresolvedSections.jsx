import React, { useEffect, useState } from 'react';
import { deleteKeyword, getKeywords, saveKeyword } from './api';

function formatCurrency(amountStr) {
  const num = parseFloat(amountStr || '0');
  return `₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KeywordForm({ keyword, setKeyword, initialSection = '', sections, onSaved }) {
  const [section, setSection] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // preselect the guessed section when it is one of the options (194J -> 194J(b) etc. is left for the user)
    if (!section && initialSection && sections.some((s) => s.section === initialSection)) {
      setSection(initialSection);
    }
  }, [sections, initialSection, section]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const data = await saveKeyword(keyword, section);
      setMessage({ ok: true, text: `Saved "${data.saved.keyword}" → ${data.saved.section}` });
      onSaved(data.keywords);
      if (!initialSection) {
        setKeyword('');
        setSection('');
      }
    } catch (err) {
      setMessage({ ok: false, text: (err.details && err.details[0]) || err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="unresolved-form">
        <input
          type="text"
          className="text-input"
          aria-label="Keyword"
          placeholder="Keyword, e.g. LANDSCAPING"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          className="text-input"
          aria-label="TDS section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="">Select section…</option>
          {sections.map((s) => (
            <option key={s.section} value={s.section}>
              {s.section} — {s.description}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-small"
          disabled={!keyword.trim() || !section || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save keyword'}
        </button>
      </div>
      {message && <div className={message.ok ? 'form-ok' : 'form-error'}>{message.text}</div>}
    </>
  );
}

function UnresolvedRow({ item, sections, onSaved }) {
  const [keyword, setKeyword] = useState(item.names[0] || '');

  return (
    <div className="unresolved-item">
      <div className="unresolved-head">
        <span className="unresolved-deductee">{item.deductee}</span>
        <span className="unresolved-meta">
          {item.rows} row{item.rows > 1 ? 's' : ''} · TDS {formatCurrency(item.tds)} · guessed{' '}
          <strong>{item.guessed_section}</strong>
        </span>
      </div>
      <div className="unresolved-names">
        Ledgers / party (click to use as keyword):{' '}
        {item.names.map((n) => (
          <button type="button" key={n} className="chip" onClick={() => setKeyword(n)}>
            {n}
          </button>
        ))}
      </div>
      {item.vouchers.length > 0 && (
        <div className="unresolved-vouchers">Vouchers: {item.vouchers.join(', ')}</div>
      )}
      <KeywordForm
        keyword={keyword}
        setKeyword={setKeyword}
        initialSection={item.guessed_section}
        sections={sections}
        onSaved={onSaved}
      />
    </div>
  );
}

export default function UnresolvedSections({ items, onRegenerate, regenerating }) {
  const [sections, setSections] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [changed, setChanged] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    getKeywords()
      .then((data) => {
        setSections(data.sections || []);
        setKeywords(data.keywords || []);
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  const handleSaved = (list) => {
    setKeywords(list);
    setChanged(true);
  };

  const handleRemove = async (kw) => {
    try {
      const data = await deleteKeyword(kw);
      setKeywords(data.keywords);
      setChanged(true);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  return (
    <div className="unresolved-container">
      <div className="section-title">TDS Section Keywords</div>
      {items.length === 0 && (
        <p className="unresolved-help">
          Every TDS entry in this data has its section named by the ledgers, masters or known keywords — nothing
          needs your input. You can still add a keyword below for a nature of payment the list does not know.
        </p>
      )}
      {items.length > 0 && (
        <>
          <div className="file-label">Sections needing your input ({items.length})</div>
          <p className="unresolved-help">
            No ledger, master or known keyword names the TDS section for these entries, so it was guessed from the
            rate booked. Enter the word that describes the nature of payment (e.g. <em>LANDSCAPING</em>, not the
            full ledger name) and its section. The keyword is saved and applies to every company's data from now on.
          </p>
          {items.map((item) => (
            <UnresolvedRow key={item.names.join('|')} item={item} sections={sections} onSaved={handleSaved} />
          ))}
        </>
      )}

      <div className="unresolved-item manual-keyword">
        <div className="file-label">Add a keyword</div>
        <KeywordForm keyword={newKeyword} setKeyword={setNewKeyword} sections={sections} onSaved={handleSaved} />
      </div>

      {keywords.length > 0 && (
        <div className="saved-keywords">
          <div className="file-label">Saved keywords</div>
          {keywords.map((k) => (
            <span key={k.keyword} className="chip chip-saved">
              {k.keyword} → {k.section}
              <button type="button" aria-label={`Remove ${k.keyword}`} onClick={() => handleRemove(k.keyword)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {loadError && <div className="form-error">{loadError}</div>}

      {changed && (
        <div className="actions">
          <button type="button" className="btn" onClick={onRegenerate} disabled={regenerating}>
            {regenerating ? 'Regenerating…' : 'Regenerate Report with New Keywords'}
          </button>
        </div>
      )}
    </div>
  );
}
