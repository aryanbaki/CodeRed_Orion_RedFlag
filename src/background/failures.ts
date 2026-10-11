import type {DocumentReview, UnratedReason} from '../core/contracts.ts';
export type FailureStage='retrieval'|'analysis';
const common:Partial<Record<UnratedReason,string>>={timeout:'The operation timed out. Try again later.',quota:'The analysis rate limit was reached. Try again after the wait period.', 'invalid-response':'The result failed evidence validation.','ai-consent-required':'Background AI is disabled. No new document text was sent.', 'too-large':'The document is too large for this analysis.',incomplete:'Document coverage is incomplete.', 'insufficient-evidence':'There is insufficient evidence to grade this document.',unsupported:'This document format or scope is unsupported.','unsafe-url':'The destination is not allowed.','network-error':'The request failed over the network.'};
export function failureMessage(stage:FailureStage,code:UnratedReason):string {
  if (code === 'authentication-required') return stage === 'analysis' ? 'Analysis server or provider authorization failed. Check server configuration and the demo access token.' : 'The public document requires authentication; RedFlag will not use your cookies.';
  if (code === 'permission-required') return stage === 'analysis' ? 'Access to the configured analysis server is not granted.' : 'Access to this public document origin is not granted.';
  if (code === 'inaccessible') return stage === 'analysis' ? 'The analysis server is unavailable or not configured.' : 'The public document could not be accessed.';
  return common[code] ?? 'This document remains Unrated.';
}
export function reviewFailure(stage:FailureStage,code:UnratedReason,retryAfterSeconds?:number):NonNullable<DocumentReview['failure']> {
  return {stage,code,message:failureMessage(stage,code),...(Number.isFinite(retryAfterSeconds) && retryAfterSeconds! >= 0 ? {retryAfterSeconds:Math.min(86400,retryAfterSeconds!)} : {})};
}
export class AnalysisFailure extends Error {
  code:UnratedReason; retryAfterSeconds?:number;
  constructor(code:UnratedReason,retryAfterSeconds?:number){super(code);this.code=code;this.retryAfterSeconds=retryAfterSeconds;}
}
