import type {CheckedSite} from '../history/model.ts';
import {summarizeReview} from '../core/summary.ts';
import {reviewFromSite} from '../history/model.ts';
import {gradeBadge} from './popup-review.ts';
import {element} from './dom.ts';
export type RecentItem=CheckedSite;
/** Small trusted-UI component. Caller owns loading/errors and history subscription. */
export function mountRecentItems(container:HTMLElement,items:RecentItem[],onOpen:(origin:string)=>void) {
  const update=(next:RecentItem[])=>{
    const doc=container.ownerDocument,fragment=doc.createDocumentFragment();
    if(!next.length) fragment.append(element('p','Your checked sites will appear here.','recent-empty',doc));
    for(const site of [...next].sort((a,b)=>(b.visitCount??1)-(a.visitCount??1)||b.lastCheckedAt.localeCompare(a.lastCheckedAt)).slice(0,5)) {
      const button=element('button',undefined,'recent-item',doc);button.type='button';
      button.append(gradeBadge(summarizeReview(reviewFromSite(site)).grade,'document-grade'),element('span',new URL(site.origin).hostname,'recent-host',doc));
      button.setAttribute('aria-label',`Open saved review for ${new URL(site.origin).hostname}`);
      button.addEventListener('click',()=>onOpen(site.origin));fragment.append(button);
    }
    const focused=doc.activeElement instanceof HTMLElement && container.contains(doc.activeElement) ? doc.activeElement.getAttribute('aria-label') : null;
    container.replaceChildren(fragment);
    if(focused) [...container.querySelectorAll<HTMLElement>('button')].find(b=>b.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
  };
  update(items);return {update,destroy:()=>container.replaceChildren()};
}
