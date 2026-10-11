import {themeCss} from './theme.ts';
// Shared palette from the original popup. Shadow DOM keeps host-page styles out.
export const reviewStyles = `${themeCss}
:host{all:initial;color-scheme:dark;font:14px/1.55 var(--rf-font);color:#f4f5f7}
*{box-sizing:border-box} .warning{background:#121416;border:1px solid #424850;border-radius:14px;box-shadow:0 8px 28px #f4f5f726;padding:18px;display:flex;flex-direction:column;max-height:55vh}.review-content{overflow:auto;min-height:0;overscroll-behavior:contain}header,.warning>p,.warning>button{flex-shrink:0}
h2{font:700 25px/1.2 var(--rf-font);margin:6px 0 12px}h3{font-size:17px;margin:6px 0}h4{font-size:14px;margin:8px 0}p{margin:8px 0;overflow-wrap:anywhere}
header{display:flex;align-items:start;justify-content:space-between;gap:12px}.eyebrow,.badge{font-size:10px;font-weight:750;letter-spacing:1px;color:#b5bac3}.card{background:#1b1e22;border:1px solid #424850;border-radius:10px;padding:14px;margin:12px 0}.grade{font-weight:750}.meta{font-size:12px;color:#b5bac3}blockquote{margin:8px 0;padding:8px 12px;border-left:3px solid #ff334f;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
button{font:650 13px var(--rf-font);border:0;border-radius:8px;background:#ff334f;color:#140407;padding:10px 12px;cursor:pointer;min-height:40px}a{color:#ff334f;text-decoration:underline}summary{cursor:pointer;font-weight:650;min-height:32px}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #ffce85;outline-offset:3px}.uncertain{color:#ffce85}.fictional{border:2px dashed #ffce85;padding:10px}.finding{margin-top:14px}.priority{font-size:11px;font-weight:700;color:#ff334f}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;
