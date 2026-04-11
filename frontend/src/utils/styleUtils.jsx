export function outlineBtn(color) {
  return {
    padding: '6px 16px', fontSize: 13, cursor: 'pointer', borderRadius: 8,
    border: `1px solid ${color}`, background: 'transparent', color,
    transition: 'opacity 0.15s ease',
  };
}

export function solidBtn(color) {
  const needsDarkText = color === '#c8a97e' || color === 'var(--primary)';
  return {
    padding: '6px 16px', fontSize: 13, cursor: 'pointer', borderRadius: 8,
    border: 'none', background: color,
    color: needsDarkText ? '#3e2f25' : '#fff',
    fontWeight: '600', transition: 'opacity 0.15s ease',
  };
}

export const VIP_BADGE = (
  <span style={{
    display: 'inline-block', background: '#d6a45c', color: '#3e2f25',
    borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: '700',
    marginLeft: 6, verticalAlign: 'middle',
  }}>
    ★ VIP
  </span>
);

export const VIP_BADGE_FULL = (
  <span style={{
    background: '#d6a45c', color: '#3e2f25',
    borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: '700',
  }}>★ VIP Client</span>
);
