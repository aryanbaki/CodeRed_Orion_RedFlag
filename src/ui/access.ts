import type {ReviewState} from '../core/contracts.ts';
import {element} from './dom.ts';
export function permissionPattern(value: string): string | null {
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? `${url.origin}/*` : null;} catch {return null;}
}
/** Permission requests run directly from a trusted popup click, never from background. */
export async function renderSiteAccess(container: HTMLElement, status: HTMLElement, state: ReviewState | null) {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const patterns=[...new Set([tab?.url,...(state?.documents.map(r=>r.document.url) ?? [])].map(url=>url ? permissionPattern(url) : null).filter((v):v is string=>Boolean(v)))];
  container.replaceChildren();
  if (!patterns.length) {status.textContent='Open an HTTP or HTTPS site to manage scoped access.';return;}
  status.textContent='Grant only the site and public document origins you want RedFlag to read. AI consent is a separate choice.';
  for (const pattern of patterns) {
    const allowed=await chrome.permissions.contains({origins:[pattern]});
    const row=element('div'); row.className='access-row';
    const label=element('p',`${new URL(pattern).origin} · ${allowed ? 'Access enabled' : 'Access not enabled'}`,'note');
    const button=element('button',allowed ? 'Revoke access' : 'Allow access');button.type='button';
    button.dataset.origin=pattern;
    button.setAttribute('aria-label',`${allowed ? 'Revoke' : 'Allow'} access to ${new URL(pattern).origin}`);
    button.addEventListener('click',async()=>{
      // Keep the request itself first so Chrome sees the originating user gesture.
      try {
        const operation=allowed ? chrome.permissions.remove({origins:[pattern]}) : chrome.permissions.request({origins:[pattern]});
        button.disabled=true;
        const changed=await operation;
        await renderSiteAccess(container,status,state);
        [...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.dataset.origin === pattern)?.focus({preventScroll:true});
        const stillAllowed=allowed && await chrome.permissions.contains({origins:[pattern]});
        status.textContent=changed ? (allowed ? (stillAllowed ? 'Broader access still covers this site. Revoke it in Chrome extension settings.' : 'Site access revoked.') : 'Site access granted. Reload the site to start automatic reviews.') : 'Permission was not changed.';
      } catch {status.textContent='Site access could not be changed. This build may not include discovery permissions.';button.disabled=false;}
    });
    row.append(label,button);container.append(row);
  }
}
