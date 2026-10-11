import {element} from './dom.ts';
import {reviewStyles} from './styles.ts';
import {renderReview} from './review.ts';
import type {ReviewState, RedFlagPreferences} from '../core/contracts.ts';

export interface WarningOptions {
  result: ReviewState;
  preferences?: RedFlagPreferences;
  container?: HTMLElement;
  onDismiss?: () => void;
  onOpenSettings?: () => void;
}
/** Mount on supported consent discovery, then update as individual results arrive.
 * Non-modal: never moves focus, touches a form, or prevents navigation.
 */
function mountProactiveWarning(options: WarningOptions) {
  const container = options.container ?? document.body;
  const doc = container.ownerDocument;
  const host = element('div', undefined, undefined, doc);
  host.dataset.redflagUi = 'warning';
  host.style.cssText = 'position:fixed;right:12px;bottom:12px;width:min(420px,calc(100vw - 24px));z-index:2147483647;';
  const root = host.attachShadow({mode:'open'});
  const style = element('style', reviewStyles, undefined, doc);
  const panel = element('section', undefined, 'warning', doc);
  panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'RedFlag agreement review');
  const header = element('header', undefined, undefined, doc);
  const heading = element('div', undefined, undefined, doc);
  heading.append(element('p', 'REDFLAG · BEFORE YOU AGREE', 'eyebrow', doc), element('h2', 'Check the fine print.', undefined, doc));
  const dismiss = element('button', 'Dismiss', undefined, doc); dismiss.type = 'button';
  const status = element('p', undefined, 'meta', doc); status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); status.setAttribute('aria-atomic','true');
  const content = element('div', undefined, 'review-content', doc);
  const settings = element('button', 'Privacy settings', undefined, doc); settings.type = 'button';
  settings.addEventListener('click', () => options.onOpenSettings?.());
  header.append(heading, dismiss); panel.append(header, status, content, settings); root.append(style, panel);
  let dismissed = false; let destroyed = false;
  let preferences = options.preferences;
  let result = options.result;
  const paint = () => {
    if (destroyed || dismissed) return;
    if (preferences?.enabled === false) {host.remove();return;}
    if (!host.isConnected) container.append(host);
    renderReview(content, result, preferences, status);
  };
  dismiss.addEventListener('click', () => {
    dismissed = true; host.remove(); options.onDismiss?.();
  });
  paint();
  return {
    update(next: ReviewState, nextPreferences = preferences) {
      if (next.pageKey !== options.result.pageKey) return;
      result = next; preferences = nextPreferences; paint();
    },
    destroy() {destroyed = true; host.remove();},
    get dismissed() {return dismissed;}
  };
}

/** Canonical content-script mounting contract. */
export const mountOverview: import('../core/contracts.ts').MountOverview = (state, preferences, actions) => {
  return mountProactiveWarning({result:state, preferences, onDismiss:actions.onDismiss, onOpenSettings:actions.onOpenSettings});
};
