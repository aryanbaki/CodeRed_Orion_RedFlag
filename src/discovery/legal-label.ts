export type LegalLabelKind = 'terms' | 'privacy' | 'cookies' | 'additional';
/** Recognize explicit legal document titles without treating generic privacy topics as policies. */
export function legalLabel(text:string):{label:string; kinds:LegalLabelKind[]} | undefined {
 const match=text.match(/\b(?:privacy\s+(?:and|&)\s+cookies?\s+(?:polic(?:y|ies)|statement|notice)|(?:site|website)\s+terms|cookie\s*(?:polic(?:y|ies)|statement|notice)|additional\s*terms|terms\s*(?:of\s*(?:service|use)|(?:and|&)\s*conditions)|privacy\s*(?:polic(?:y|ies)|statement|notice))\b/i);
 if(!match)return undefined;
 const label=match[0];
 const kinds:LegalLabelKind[]=/privacy/i.test(label)?(/cookie/i.test(label)?['privacy','cookies']:['privacy']):/cookie/i.test(label)?['cookies']:/additional/i.test(label)?['additional']:['terms'];
 return {label,kinds};
}
