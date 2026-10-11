import {categories, prioritize, validateDocument, type Category, type Finding} from '../core/evidence.ts';
import {demoDocument, demoFindings} from '../providers/demo.ts';
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const preview = document.querySelector<HTMLDetailsElement>('#preview')!;
const text = document.querySelector<HTMLElement>('#text')!;
const boxes = [...document.querySelectorAll<HTMLInputElement>('input')];
let findings: Finding[] = [];
function selected(): Category[] {return boxes.filter(b => b.checked).map(b => b.value as Category);}
function render() {
  results.replaceChildren();
  for (const finding of prioritize(findings, selected())) {
    const card = document.createElement('article'); card.className = 'card';
    const badge = document.createElement('div'); badge.className='badge'; badge.textContent='FICTIONAL EXAMPLE' + (selected().includes(finding.category) ? ' · YOUR PRIORITY' : '');
    const title = document.createElement('h2'); title.textContent=finding.category[0].toUpperCase()+finding.category.slice(1);
    const description = document.createElement('p'); description.textContent=finding.explanation;
    const quote = document.createElement('blockquote'); quote.textContent=finding.quote;
    card.append(badge,title,description,quote); results.append(card);
  }
}
async function init() {
  const saved = await chrome.storage.local.get('priorities');
  const values = Array.isArray(saved.priorities) ? saved.priorities.filter((v:unknown) => categories.includes(v as Category)) : [];
  boxes.forEach(b => {b.checked=values.includes(b.value); b.addEventListener('change', () => {render(); void chrome.storage.local.set({priorities:selected()}).catch(() => {status.textContent='Could not save priorities.';});});});
}
void init().catch(() => {status.textContent='Preferences could not be loaded.';});
document.querySelector('#demo')!.addEventListener('click', () => {
  findings=demoFindings(); text.textContent=demoDocument.text; preview.hidden=false; render();
  status.textContent='Fictional example only. These findings do not describe your current page.';
});
document.querySelector('#capture')!.addEventListener('click', async () => {
  findings=[]; render(); preview.hidden=true; text.textContent='';
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('button')]; buttons.forEach(b => b.disabled=true);
  status.textContent='Reading page text locally…';
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) throw new Error('Open an HTTP or HTTPS policy page first.');
    const [result] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:() => {
      const selection=window.getSelection()?.toString().trim();
      const value=selection || (document.querySelector<HTMLElement>('main, article') ?? document.body).innerText;
      return {text:value.slice(0,60001),partial:Boolean(selection),url:location.href};
    }});
    if (!result?.result) throw new Error('This page could not be read.');
    const captured={url:result.result.url,text:result.result.text,capturedAt:new Date().toISOString()};
    validateDocument(captured); text.textContent=captured.text; preview.hidden=false;
    status.textContent=`Captured ${captured.text.length.toLocaleString()} characters${result.result.partial ? ' from your selection (partial review)' : ' from the page'}. Review the source below. No risk analysis has been run.`;
  } catch(error) {status.textContent=error instanceof Error ? error.message : 'Could not read this page.';}
  finally {buttons.forEach(b => b.disabled=false);}
});
