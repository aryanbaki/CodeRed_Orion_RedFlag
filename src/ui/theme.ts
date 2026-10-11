import {gradeColors,gradeVisualCss} from './branding.ts';
import {APP_FONT_STACK,ensureAppFont} from './font.ts';
/** Shared visual tokens and the user-supplied application font. */
export const themeCss = `
:root,:host {
  color-scheme:light;
  --rf-background:#f7f1e7;
  --rf-surface:#fffcf6;
  --rf-surface-raised:#efe5d7;
  --rf-border:#dacbbb;
  --rf-text:#3c2c22;
  --rf-muted:#735c4a;
  --rf-red:#b93822;
  --rf-red-contrast:#fffaf3;
  --rf-warning:#8b4c1d;
  --rf-green:#3e6a36;
  --rf-focus:#a6321e;
  --rf-accent-soft:#f9e8da;
  --rf-danger-soft:#fae5df;
  --rf-heading:#33241c;
  --rf-metadata:#7b6451;
  /* Glossy flag grading palette supplied by the user. */
  --rf-grade-s:${gradeColors.S};
  --rf-grade-a:${gradeColors.A};
  --rf-grade-b:${gradeColors.B};
  --rf-grade-c:${gradeColors.C};
  --rf-grade-d:${gradeColors.D};
  --rf-grade-e:${gradeColors.E};
  --rf-font:${APP_FONT_STACK};
  --rf-ui-font:Arial,sans-serif;
}
${gradeVisualCss}
button,input,textarea,select,option {font-family:var(--rf-ui-font)}
input::file-selector-button {font:inherit}
`;
export function applyTheme(doc:Document = document): void {
  void ensureAppFont(doc).catch(()=>{});
  if (doc.getElementById('redflag-theme')) return;
  const style=doc.createElement('style'); style.id='redflag-theme';style.textContent=themeCss;doc.head.append(style);
}
