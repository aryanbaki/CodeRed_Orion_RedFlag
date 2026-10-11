// Shared palette from the original popup. Shadow DOM keeps host-page styles out.
export const reviewStyles = `
:host{all:initial;color-scheme:light;font:14px/1.55 system-ui,sans-serif;color:#172d29}
*{box-sizing:border-box} .warning{background:#f7f6ef;border:1px solid #d7dfce;border-radius:14px;box-shadow:0 8px 28px #172d2926;padding:18px;display:flex;flex-direction:column;max-height:55vh}.review-content{overflow:auto;min-height:0;overscroll-behavior:contain}header,.warning>p,.warning>button{flex-shrink:0}
h2{font:700 25px/1.2 Georgia,serif;margin:6px 0 12px}h3{font-size:17px;margin:6px 0}h4{font-size:14px;margin:8px 0}p{margin:8px 0;overflow-wrap:anywhere}
header{display:flex;align-items:start;justify-content:space-between;gap:12px}.eyebrow,.badge{font-size:10px;font-weight:750;letter-spacing:1px;color:#596d4c}.card{background:white;border:1px solid #dce2d5;border-radius:10px;padding:14px;margin:12px 0}.grade{font-weight:750}.meta{font-size:12px;color:#516450}blockquote{margin:8px 0;padding:8px 12px;border-left:3px solid #a8bc87;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
button{font:650 13px system-ui;border:0;border-radius:8px;background:#23583f;color:white;padding:10px 12px;cursor:pointer;min-height:40px}a{color:#23583f;text-decoration:underline}summary{cursor:pointer;font-weight:650;min-height:32px}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #ba7935;outline-offset:3px}.uncertain{color:#7b4e1d}.fictional{border:2px dashed #9d622d;padding:10px}.finding{margin-top:14px}.priority{font-size:11px;font-weight:700;color:#23583f}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;
