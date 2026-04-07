export function outlineBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: `1px solid ${color}`, background: '#fff', color };
}

export function solidBtn(color) {
  return { padding: '5px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', background: color, color: '#fff', fontWeight: '600' };
}

export const VIP_BADGE = (
  <span style={{
    display: 'inline-block', background: '#fbbf24', color: '#78350f',
    borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: '700',
    marginLeft: 6, verticalAlign: 'middle',
  }}>
    ★ VIP
  </span>
);

export const VIP_BADGE_FULL = (
  <span style={{
    background: '#fbbf24', color: '#78350f',
    borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: '700',
  }}>★ VIP Client</span>
);
