import {writeFile} from 'node:fs/promises';
const names=['google','youtube','facebook','amazon','reddit','wikipedia'];
const records=[];
for(const name of names) {
 const response=await fetch('https://api.tosdr.org/search/v5?query='+encodeURIComponent(name),{signal:AbortSignal.timeout(15000)});
 if(!response.ok){console.log('Skipped '+name+': HTTP '+response.status);continue;}
 records.push(...(await response.json()).services);
 await new Promise(resolve=>setTimeout(resolve,2000));
}
if(!records.length)throw Error('No ToS;DR data received; existing snapshot preserved.');
const services=[...new Map(records.map(s=>[s.id,s])).values()];
await writeFile('src/background/community-seed.ts','// ToS;DR data © its contributors, CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/\n// Official ToS;DR API snapshot; refresh with node scripts/refresh-community.mjs.\nexport const seedFetchedAt='+JSON.stringify(new Date().toISOString())+';\nexport const seedServices='+JSON.stringify({services},null,2)+';\n');
console.log('Bundled '+services.length+' ToS;DR services.');
