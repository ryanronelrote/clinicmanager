import { useState, useRef, useEffect } from 'react';

function parseTreatments(str) {
  if (!str) return [''];
  const parts = str.split('\n');
  return parts.length > 0 ? parts : [''];
}

function joinTreatments(arr) {
  return arr.filter(s => s.trim() !== '').join('\n');
}

export default function TreatmentListInput({ value, onChange, inputStyle, placeholder }) {
  const [items, setItems] = useState(() => parseTreatments(value));
  const refs = useRef([]);

  useEffect(() => {
    const current = joinTreatments(items);
    if (value !== current) {
      setItems(parseTreatments(value));
    }
  }, [value]);

  function handleChange(i, val) {
    const next = [...items];
    next[i] = val;
    setItems(next);
    onChange(joinTreatments(next));
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = [...items];
      next.splice(i + 1, 0, '');
      setItems(next);
      onChange(joinTreatments(next));
      setTimeout(() => refs.current[i + 1]?.focus(), 0);
    } else if (e.key === 'Backspace' && items[i] === '' && items.length > 1) {
      e.preventDefault();
      const next = [...items];
      next.splice(i, 1);
      setItems(next);
      onChange(joinTreatments(next));
      setTimeout(() => refs.current[Math.max(0, i - 1)]?.focus(), 0);
    }
  }

  function remove(i) {
    if (items.length === 1) {
      setItems(['']);
      onChange('');
    } else {
      const next = [...items];
      next.splice(i, 1);
      setItems(next);
      onChange(joinTreatments(next));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            ref={el => { refs.current[i] = el; }}
            value={item}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            placeholder={i === 0 ? (placeholder || 'e.g. Facial') : 'Add treatment…'}
            style={{ ...inputStyle, flex: 1, width: 'auto', minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            style={{
              padding: '0 6px', background: 'none', border: 'none', cursor: 'pointer',
              color: '#c8bdb7', fontSize: 18, lineHeight: 1, flexShrink: 0, fontWeight: 'bold',
            }}
            title="Remove"
          >×</button>
        </div>
      ))}
    </div>
  );
}
