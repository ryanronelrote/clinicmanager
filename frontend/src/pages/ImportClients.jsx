import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Map flexible header names to our field names
const HEADER_MAP = {
  first_name: 'first_name',
  firstname:  'first_name',
  'first name': 'first_name',
  last_name:  'last_name',
  lastname:   'last_name',
  'last name': 'last_name',
  phone:      'phone',
  telephone:  'phone',
  mobile:     'phone',
  email:      'email',
  'e-mail':   'email',
  notes:      'notes',
  note:       'notes',
  comments:   'notes',
};

// Simple CSV parser — handles quoted fields with commas inside
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line) {
    const fields = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        fields.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const rawHeaders = parseLine(lines[0]).map(h => h.toLowerCase().trim());

  // Check if first row looks like headers (at least one known header word)
  const hasHeaders = rawHeaders.some(h => HEADER_MAP[h]);

  let headers, dataLines;
  if (hasHeaders) {
    headers = rawHeaders.map(h => HEADER_MAP[h] || h);
    dataLines = lines.slice(1);
  } else {
    // Assume positional: first_name, last_name, phone, email, notes
    headers = ['first_name', 'last_name', 'phone', 'email', 'notes'];
    dataLines = lines;
  }

  const rows = dataLines
    .map(line => {
      const values = parseLine(line);
      const row = {};
      headers.forEach((h, i) => { if (h) row[h] = values[i] || ''; });
      return row;
    })
    .filter(row => row.first_name || row.last_name); // skip fully empty rows

  return { headers, rows };
}

export default function ImportClients() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [preview, setPreview] = useState(null); // { headers, rows }
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState(null);   // { imported, errors }
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file');
      return;
    }
    setParseError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target.result);
      if (rows.length === 0) {
        setParseError('No valid rows found in the CSV file');
        setPreview(null);
      } else {
        setPreview({ headers, rows });
      }
    };
    reader.readAsText(file);
  }

  function onFileInput(e) { handleFile(e.target.files[0]); }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    const res = await fetch('/clients/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clients: preview.rows }),
    });
    const data = await res.json();
    setResult(data);
    setPreview(null);
    setImporting(false);
  }

  function reset() {
    setPreview(null);
    setResult(null);
    setParseError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const DISPLAY_COLS = ['first_name', 'last_name', 'phone', 'email', 'notes'];

  return (
    <div style={{ maxWidth: 800 }}>
      <h2>Import Clients from CSV</h2>
      <p style={{ color: '#666', marginTop: 0 }}>
        Upload a CSV file to bulk-add clients. Expected columns (in any order):<br />
        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>
          first_name, last_name, phone, email, notes
        </code>
      </p>

      {/* Result banner */}
      {result && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: '#e6f4ea', border: '1px solid #a8d5b5', borderRadius: 6,
            padding: '12px 16px', marginBottom: result.errors.length ? 8 : 0,
          }}>
            {result.imported} client{result.imported !== 1 ? 's' : ''} imported successfully.
            <button onClick={() => navigate('/')} style={{ marginLeft: 16, ...linkBtn }}>View all clients</button>
            <button onClick={reset} style={{ marginLeft: 8, ...linkBtn }}>Import more</button>
          </div>
          {result.errors.length > 0 && (
            <div style={{ background: '#fef3e2', border: '1px solid #f5c97a', borderRadius: 6, padding: '10px 16px' }}>
              {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped:
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      {!preview && !result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current.click()}
          style={{
            border: `2px dashed ${dragOver ? '#1a73e8' : '#ccc'}`,
            borderRadius: 8,
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? '#f0f7ff' : '#fafafa',
            color: '#555',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: '600', marginBottom: 4 }}>Drop your CSV file here</div>
          <div style={{ fontSize: 13, color: '#888' }}>or click to browse</div>
          <input ref={fileRef} type="file" accept=".csv" onChange={onFileInput} style={{ display: 'none' }} />
        </div>
      )}

      {parseError && <p style={{ color: 'red' }}>{parseError}</p>}

      {/* Preview table */}
      {preview && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong>{preview.rows.length} client{preview.rows.length !== 1 ? 's' : ''} ready to import</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reset} style={{ padding: '6px 14px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, background: '#fff' }}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{ padding: '6px 16px', cursor: 'pointer', border: 'none', borderRadius: 4, background: '#1a73e8', color: '#fff', fontWeight: '600' }}
              >
                {importing ? 'Importing…' : `Import ${preview.rows.length} clients`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={th}>#</th>
                  {DISPLAY_COLS.map(c => <th key={c} style={th}>{c.replace('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee', background: (!row.first_name || !row.last_name) ? '#fff8e1' : 'transparent' }}>
                    <td style={td}>{i + 1}</td>
                    {DISPLAY_COLS.map(c => (
                      <td key={c} style={{ ...td, color: !row[c] ? '#bbb' : '#222' }}>
                        {row[c] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.some(r => !r.first_name || !r.last_name) && (
            <p style={{ color: '#b45309', fontSize: 12, marginTop: 8 }}>
              Rows highlighted in yellow are missing first or last name and will be skipped.
            </p>
          )}
        </div>
      )}

      {/* CSV format hint */}
      {!preview && !result && (
        <details style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
          <summary style={{ cursor: 'pointer', fontWeight: '600' }}>CSV format example</summary>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginTop: 8, overflowX: 'auto' }}>
{`first_name,last_name,phone,email,notes
Maria,Santos,09171234567,maria@example.com,VIP client
Juan,Dela Cruz,09281234567,,Sensitive skin`}
          </pre>
        </details>
      )}
    </div>
  );
}

const th = { padding: '8px 10px', textAlign: 'left', fontWeight: '600', textTransform: 'capitalize' };
const td = { padding: '7px 10px' };
const linkBtn = { background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 };
