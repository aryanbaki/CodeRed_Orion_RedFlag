import type {CheckedSite} from '../history/model.ts';
import {visibleGrade} from './review.ts';
import {element} from './dom.ts';
export type RecentItem=CheckedSite;
/** Small trusted-UI component. Caller owns loading/errors and history subscription. */
export function mountRecentItems(container:HTMLElement,items:RecentItem[],onOpen:(origin:string)=>void) {
  const update=(next:RecentItem[])=>{
    const doc=container.ownerDocument,fragment=doc.createDocumentFragment();
    if(!next.length) fragment.append(element('p','No checked sites yet. Reviews appear here after RedFlag checks a site.','recent-empty',doc));
    for(const site of next.slice(0,5)) {
      const button=element('button',undefined,'recent-item',doc);button.type='button';
      button.append(element('span',new URL(site.origin).hostname,'recent-host',doc));
      const grades=site.documents.map(r=>`${r.document.kind}: ${r.status==='pending'?'Pending':visibleGrade(r)}`).join(' · ');
      button.append(element('span',grades,'recent-grades',doc));
      button.setAttribute('aria-label',`Open saved review for ${new URL(site.origin).hostname}`);
      button.addEventListener('click',()=>onOpen(site.origin));fragment.append(button);
    }
    const focused=doc.activeElement instanceof HTMLElement && container.contains(doc.activeElement) ? doc.activeElement.getAttribute('aria-label') : null;
    container.replaceChildren(fragment);
    if(focused) [...container.querySelectorAll<HTMLElement>('button')].find(b=>b.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
  };
  update(items);return {update,destroy:()=>container.replaceChildren()};
}
