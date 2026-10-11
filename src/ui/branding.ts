/** Grade colors from the supplied glossy flag references. */
export const gradeColors = {S:'#00b52c', A:'#9bdd00', B:'#ffd000', C:'#ff7200', D:'#ff151b', E:'#b8000c'} as const;
export type FlagGrade = keyof typeof gradeColors;
export function isFlagGrade(grade:string): grade is FlagGrade {return Object.hasOwn(gradeColors,grade);}

/** Code-native artwork stays crisp at toolbar size and has a transparent canvas. */
export function flagSvg(grade:string='Unrated'):string {
 const color=isFlagGrade(grade)?gradeColors[grade]:gradeColors.D;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><defs><linearGradient id="cloth" x1="30" y1="20" x2="115" y2="57" gradientUnits="userSpaceOnUse"><stop stop-color="${color}"/><stop offset=".22" stop-color="${color}"/><stop offset=".34" stop-color="#fff" stop-opacity=".55"/><stop offset=".49" stop-color="${color}"/><stop offset=".75" stop-color="${color}"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient><linearGradient id="pole" x1="10" y1="65" x2="26" y2="67" gradientUnits="userSpaceOnUse"><stop stop-color="#111619"/><stop offset=".42" stop-color="#60686b"/><stop offset=".65" stop-color="#292e31"/><stop offset="1" stop-color="#090d0f"/></linearGradient><radialGradient id="cap" cx=".35" cy=".25" r=".75"><stop stop-color="#e0e5e8"/><stop offset=".3" stop-color="#636b70"/><stop offset=".75" stop-color="#21272b"/><stop offset="1" stop-color="#0b1013"/></radialGradient></defs><path d="M29 27C57 6 77 48 118 28L110 88C72 108 58 67 20 89Z" fill="${color}"/><path d="M29 27C57 6 77 48 118 28L110 88C72 108 58 67 20 89Z" fill="url(#cloth)" stroke="${color}" stroke-width="3" stroke-linejoin="round"/><path d="M31 27C57 9 78 49 116 29M23 87C59 66 76 105 108 87" stroke="#fff" stroke-opacity=".65" stroke-width="1.5"/><path d="M25 22L11 116" stroke="#111619" stroke-width="13" stroke-linecap="round"/><path d="M25 22L11 116" stroke="url(#pole)" stroke-width="10" stroke-linecap="round"/><circle cx="26" cy="17" r="10" fill="url(#cap)" stroke="#22282b" stroke-width="1.5"/></svg>`.replace(/cloth|pole|cap/g,id=>`rf-${isFlagGrade(grade)?grade:"idle"}-${id}`);
}
export function flagMark(grade:string,doc:Document=document):SVGSVGElement {
 const svg=doc.importNode(new DOMParser().parseFromString(flagSvg(grade),'image/svg+xml').documentElement,true) as unknown as SVGSVGElement;
 svg.setAttribute('aria-hidden','true');svg.classList.add('flag-mark');return svg;
}
export const gradeVisualCss = `
:is(.grade-tile,.document-grade,.overall-grade)[data-grade]:not([data-grade=Unrated]) {
 background:linear-gradient(145deg,#ffffff30,transparent 45%,#00000012),var(--grade-color);
 color:#fff;border:1px solid #3c2c2233;box-shadow:inset 0 1px 1px #ffffff70;
 text-shadow:0 1px 1px #3c2c2266;
}
:is(.grade-tile,.document-grade,.overall-grade)[data-grade]:is([data-grade=S],[data-grade=A],[data-grade=B],[data-grade=C]){color:var(--rf-heading);text-shadow:none}
[data-grade=S]{--grade-color:var(--rf-grade-s)}[data-grade=A]{--grade-color:var(--rf-grade-a)}[data-grade=B]{--grade-color:var(--rf-grade-b)}[data-grade=C]{--grade-color:var(--rf-grade-c)}[data-grade=D]{--grade-color:var(--rf-grade-d)}[data-grade=E]{--grade-color:var(--rf-grade-e)}
:is(.grade-tile,.document-grade,.overall-grade)[data-grade=Unrated]{background:var(--rf-surface-raised);color:var(--rf-metadata);border:1px solid var(--rf-border);box-shadow:none;text-shadow:none;font-family:Arial,sans-serif}
.grade-tile[data-grade]{height:58px}.document-grade[data-grade]{height:33px}
.flag-mark{display:block;width:100%;height:100%;flex-shrink:0}
.site-grade-mark{display:flex;align-items:center;gap:12px}.site-grade-mark>.flag-mark{width:72px;height:72px}
`;
