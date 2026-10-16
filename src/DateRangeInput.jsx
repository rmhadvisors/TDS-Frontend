import React, { useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');

// Typed day/month/year -> "YYYY-MM-DD", or null. Accepts 1/3/2025, 01-03-2025, 1.3.25 and 2025-03-01.
export function parseTypedDate(text) {
  const t = (text || '').trim();
  let d, m, y;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (iso) [, y, m, d] = iso.map(Number);
  else if (dmy) {
    [, d, m, y] = dmy.map(Number);
    if (dmy[3].length === 2) y += 2000;
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // e.g. 31/2/2025
  return `${y}-${pad(m)}-${pad(d)}`;
}

const toDisplay = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const longDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function DateField({ id, ariaLabel, value, onChange }) {
  const [text, setText] = useState(toDisplay(value));
  const typed = text.trim() !== '';
  const parsed = typed ? parseTypedDate(text) : null;

  return (
    <div className="date-field">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="text-input"
        aria-label={ariaLabel}
        aria-invalid={typed && !parsed}
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseTypedDate(e.target.value) || '');
        }}
        onBlur={() => parsed && setText(toDisplay(parsed))}
      />
      {typed && (
        <span className={parsed ? 'date-hint' : 'date-hint date-hint-error'}>
          {parsed ? longDate(parsed) : 'Use day/month/year, e.g. 1/3/2025'}
        </span>
      )}
    </div>
  );
}

// From / to dates typed as day/month/year; `value` and `onChange` use { from, to } as "YYYY-MM-DD" ('' when blank or invalid).
export default function DateRangeInput({ idPrefix, value, onChange }) {
  const reversed = value.from && value.to && value.from > value.to;
  return (
    <>
      <div className="date-range">
        <DateField
          id={`${idPrefix}-from`}
          ariaLabel="From date"
          value={value.from}
          onChange={(from) => onChange({ ...value, from })}
        />
        <span className="date-range-sep">to</span>
        <DateField id={`${idPrefix}-to`} ariaLabel="To date" value={value.to} onChange={(to) => onChange({ ...value, to })} />
      </div>
      {reversed && <div className="form-error">The "from" date is after the "to" date.</div>}
    </>
  );
}
