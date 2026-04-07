function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function confirmPage(title, message, color) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;">
    <div style="text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.1);max-width:480px;">
      <div style="font-size:48px;margin-bottom:16px;">${color === '#0f9d58' ? '✓' : color === '#e07b54' ? '○' : '✕'}</div>
      <h2 style="color:${color};margin:0 0 12px">${title}</h2>
      <p style="color:#555;font-size:16px;line-height:1.5">${message}</p>
    </div>
  </body></html>`;
}

module.exports = { escHtml, confirmPage };
