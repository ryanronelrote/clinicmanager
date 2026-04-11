export function outlineBtn(color) {
  return {
    padding: '9px 20px', fontSize: 13, cursor: 'pointer', borderRadius: 8,
    border: `1px solid ${color}`, background: 'transparent', color,
    fontFamily: 'var(--font-body)', fontWeight: '600',
    transition: 'all 0.15s ease',
  };
}

export function solidBtn(color) {
  const needsDarkText = (
    color === '#c8a97e' || color === 'var(--primary)' ||
    color === '#6b8f71' || color === '#d6a45c' || color === '#c97b7b'
  );
  return {
    padding: '9px 20px', fontSize: 13, cursor: 'pointer', borderRadius: 8,
    border: 'none', background: color,
    color: needsDarkText ? '#3e2f25' : '#fff',
    fontFamily: 'var(--font-body)', fontWeight: '600',
    transition: 'all 0.15s ease',
  };
}

export const VIP_BADGE = (
  <span style={{
    display: 'inline-block', background: '#d6a45c', color: '#3e2f25',
    borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: '700',
    marginLeft: 6, verticalAlign: 'middle', fontFamily: 'var(--font-body)',
  }}>
    ★ VIP
  </span>
);

export const VIP_BADGE_FULL = (
  <span style={{
    background: '#d6a45c', color: '#3e2f25',
    borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: '700',
    fontFamily: 'var(--font-body)',
  }}>★ VIP Client</span>
);

// Standard input style — use when creating new forms or refactoring
export const inputBase = {
  padding: '9px 12px',
  border: '1px solid var(--input-border)',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'var(--font-body)',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--card-bg)',
  color: 'var(--text-primary)',
};
