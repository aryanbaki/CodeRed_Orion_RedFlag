/** Shared dark visual tokens. Monoglyphic is NOT installed or licensed in this build. */
export const TEMPORARY_FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const themeCss = `
:root,:host {
  color-scheme:dark;
  --rf-background:#121416;
  --rf-surface:#1b1e22;
  --rf-surface-raised:#24282e;
  --rf-border:#424850;
  --rf-text:#f4f5f7;
  --rf-muted:#b5bac3;
  --rf-red:#ff334f;
  --rf-red-contrast:#140407;
  --rf-warning:#ffce85;
  --rf-green:#9ce8ba;
  --rf-focus:#ffce85;
  --rf-font:${TEMPORARY_FONT_STACK};
}
`;
export function applyTheme(doc:Document = document): void {
  if (doc.getElementById('redflag-theme')) return;
  const style=doc.createElement('style'); style.id='redflag-theme';style.textContent=themeCss;doc.head.append(style);
}
