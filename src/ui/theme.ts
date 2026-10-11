import {gradeColors,gradeVisualCss} from './branding.ts';
import {APP_FONT_STACK,ensureAppFont} from './font.ts';
/** Shared visual tokens and the user-supplied application font. */
export const themeCss = `
:root,:host {
  color-scheme:dark;
  --rf-background:#101623;
  --rf-surface:#192234;
  --rf-surface-raised:#202d43;
  --rf-border:#34435d;
  --rf-text:#edf2fa;
  --rf-muted:#a6b3c9;
  --rf-red:#b8a7ff;
  --rf-red-contrast:#211839;
  --rf-warning:#d8bf97;
  --rf-green:#b8d3e7;
  --rf-focus:#d8bf97;
  --rf-heading:#ffffff;
  --rf-metadata:#8399b8;
  /* Glossy flag grading palette supplied by the user. */
  --rf-grade-s:${gradeColors.S};
  --rf-grade-a:${gradeColors.A};
  --rf-grade-b:${gradeColors.B};
  --rf-grade-c:${gradeColors.C};
  --rf-grade-d:${gradeColors.D};
  --rf-grade-e:${gradeColors.E};
  --rf-font:${APP_FONT_STACK};
}
${gradeVisualCss}
button,input,textarea,select,option {font-family:var(--rf-font)}
input::file-selector-button {font:inherit}
`;
export function applyTheme(doc:Document = document): void {
  void ensureAppFont(doc).catch(()=>{});
  if (doc.getElementById('redflag-theme')) return;
  const style=doc.createElement('style'); style.id='redflag-theme';style.textContent=themeCss;doc.head.append(style);
}
