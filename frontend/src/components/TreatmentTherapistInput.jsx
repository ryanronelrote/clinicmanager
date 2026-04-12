import { useRef } from 'react';

/**
 * Renders a list of {name, therapist} treatment rows.
 * value:    array of {name, therapist} objects
 * onChange: called with updated array
 */
export default function TreatmentTherapistInput({ value = [], onChange, inputStyle = {} }) {
  const nameRefs = useRef([]);

  const items = value.length > 0 ? value : [{ name: '', therapist: '' }];

  function update(index, field, val) {
    const next = items.map((item, i) =>
      i === index ? { ...item, [field]: val } : item
    );
    onChange(next);
  }

  function addRow() {
    onChange([...items, { name: '', therapist: '' }]);
    setTimeout(() => nameRefs.current[items.length]?.focus(), 0);
  }

  function remove(index) {
    if (items.length === 1) {
      onChange([{ name: '', therapist: '' }]);
      return;
    }
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  }

  function handleNameKeyDown(index, e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRow();
    } else if (e.key === 'Backspace' && items[index].name === '' && items.length > 1) {
      e.preventDefault();
      remove(index);
      setTimeout(() => nameRefs.current[Math.max(0, index - 1)]?.focus(), 0);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Column headers */}
      <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 600, color: '#9a8a7f', paddingLeft: 2 }}>
        <span style={{ flex: 2 }}>Treatment</span>
        <span style={{ flex: 1 }}>Therapist</span>
        <span style={{ width: 24 }}></span>
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={el => { nameRefs.current[i] = el; }}
            type="text"
            value={item.name}
            onChange={e => update(i, 'name', e.target.value)}
            onKeyDown={e => handleNameKeyDown(i, e)}
            placeholder={i === 0 ? 'e.g. Facial' : 'Add treatment…'}
            style={{ ...inputStyle, flex: 2, width: 'auto', minWidth: 0 }}
          />
          <input
            type="text"
            value={item.therapist}
            onChange={e => update(i, 'therapist', e.target.value)}
            placeholder="Therapist"
            style={{ ...inputStyle, flex: 1, width: 'auto', minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            style={{
              width: 24, background: 'none', border: 'none', cursor: 'pointer',
              color: '#c8bdb7', fontSize: 18, lineHeight: 1, flexShrink: 0, fontWeight: 'bold', padding: 0,
            }}
            title="Remove"
          >×</button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        style={{
          alignSelf: 'flex-start', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--primary)', fontSize: 13,
          padding: '2px 0', fontWeight: 600,
        }}
      >
        + Add treatment
      </button>
    </div>
  );
}
