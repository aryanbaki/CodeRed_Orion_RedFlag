/** Shared worker boundary. Version changes require integration-owner approval. */
export const CONTRACT_VERSION = 1 as const;
export const PREFERENCES_STORAGE_KEY = 'redflag.preferences.v1';
export const AI_NOTICE_VERSION = '2026-10-11-v1';
export type DocumentKind = 'terms' | 'privacy' | 'additional' | 'unknown';
export type ConsentContext = 'signup' | 'checkout' | 'onboarding' | 'consent';
export type RiskCategory = 'sharing' | 'retention' | 'tracking' | 'renewal' | 'cancellation' | 'arbitration' | 'content-rights' | 'other';
export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'Unrated';
export type Coverage = 'complete' | 'partial' | 'unknown';
export type UnratedReason = 'pending' | 'permission-required' | 'authentication-required' | 'inaccessible' | 'unsupported' | 'too-large' | 'incomplete' | 'insufficient-evidence' | 'ai-consent-required' | 'quota' | 'timeout' | 'invalid-response' | 'unsafe-url' | 'network-error';

export interface DiscoveredDocument {
  /** Stable within a page review; no raw text in the identifier. */
  id: string;
  url: string;
  kind: DocumentKind;
  label: string;
  discoveredAt: string;
}

export interface DocumentFreshness {
  retrievedAt?: string;
  /** Actual publisher date, never inferred from retrieval/analysis time. */
  documentUpdatedAt?: string;
  analyzedAt?: string;
  /** Cache freshness does not imply a recent human review. */
  cacheExpiresAt?: string;
}

export interface EvidenceFinding {
  id: string;
  category: RiskCategory;
  severity: 'low' | 'medium' | 'high';
  title: string;
  explanation: string;
  quote: string;
  sourceUrl: string;
  /** Offsets into exactly the extracted input, if supplied. */
  startOffset?: number;
  endOffset?: number;
}

/** Community service ratings are references, not document grades. */
export interface CommunityReference {
  provider: 'tosdr' | 'privacyspy';
  serviceId: string;
  serviceName: string;
  sourceUrl: string;
  rating?: string;
  scope: 'service' | 'document';
  documentUrl?: string;
  reviewStatus: 'reviewed' | 'unreviewed' | 'unknown';
  recordUpdatedAt?: string;
  reviewedAt?: string;
  fetchedAt: string;
  freshness: 'current' | 'stale' | 'unknown';
  attribution: string;
}

export interface DocumentAssessment {
  documentId: string;
  documentUrl: string;
  kind: DocumentKind;
  grade: RiskGrade;
  coverage: Coverage;
  findings: EvidenceFinding[];
  summary: string;
  /** Required when grade is Unrated. Never interpret an empty findings array as safe. */
  reason?: UnratedReason;
  provider: 'gemini' | 'community';
  analyzedAt: string;
  model?: string;
  promptVersion: string;
  rubricVersion: string;
  contentHash: string;
}

export interface DocumentReview {
  document: DiscoveredDocument;
  status: 'pending' | 'ready' | 'unrated';
  grade: RiskGrade;
  coverage: Coverage;
  reason?: UnratedReason;
  freshness: DocumentFreshness;
  community: CommunityReference[];
  assessment?: DocumentAssessment;
  cached: boolean;
  failure?: {stage: 'retrieval' | 'analysis';code: UnratedReason;message:string;retryAfterSeconds?:number};
}

export interface ReviewState {
  schemaVersion: typeof CONTRACT_VERSION;
  /** Background-generated review generation; changes on navigation. */
  pageKey: string;
  /** Page URL without credentials, query, or fragment; not sent to Gemini. */
  pageUrl: string;
  context: ConsentContext;
  documents: DocumentReview[];
  updatedAt: string;
}

export interface RedFlagPreferences {
  schemaVersion: typeof CONTRACT_VERSION;
  enabled: boolean;
  priorities: RiskCategory[];
  aiConsent: {
    enabled: boolean;
    /** Set only when affirmative consent has actually been given. */
    grantedAt?: string;
    updatedAt: string;
    noticeVersion: string;
  };
}

export function createDefaultPreferences(now: string): RedFlagPreferences {
  return {
    schemaVersion: CONTRACT_VERSION, enabled: true, priorities: [],
    aiConsent: {enabled: false, updatedAt: now, noticeVersion: AI_NOTICE_VERSION},
  };
}

/** Worker 1 extracts this input; worker 2 validates all fields at the HTTP boundary. */
export interface AnalysisDocument {
  id: string;
  url: string;
  kind: DocumentKind;
  text: string;
  retrievedAt: string;
  documentUpdatedAt?: string;
  coverage: Coverage;
  contentHash: string;
}
export interface AnalyzeRequest {
  schemaVersion: typeof CONTRACT_VERSION;
  document: AnalysisDocument;
}
export interface AnalyzeResponse {
  schemaVersion: typeof CONTRACT_VERSION;
  assessment: DocumentAssessment;
}
export interface AnalyzeErrorResponse {
  schemaVersion: typeof CONTRACT_VERSION;
  error: {code: UnratedReason; message: string; retryable: boolean};
}

/** Content scripts cannot choose their own tabId or submit arbitrary text for AI. */
export type ExtensionMessage =
  | {type: 'redflag/discover'; pageUrl: string; context: ConsentContext; documents: DiscoveredDocument[]}
  | {type: 'redflag/get-state'}
  | {type: 'redflag/state'; state: ReviewState}
  | {type: 'redflag/get-preferences'}
  | {type: 'redflag/set-preferences'; preferences: RedFlagPreferences};
export type ExtensionResponse =
  | {ok: true; state?: ReviewState | null; preferences?: RedFlagPreferences}
  | {ok: false; error: string};

/** Agent 3 implements src/ui/overview.ts; Agent 1 owns mounting and message wiring. */
export interface OverviewActions {
  onDismiss: () => void;
  onOpenSettings: () => void;
}
export interface OverviewController {
  update: (state: ReviewState, preferences: RedFlagPreferences) => void;
  destroy: () => void;
}
export type MountOverview = (
  state: ReviewState,
  preferences: RedFlagPreferences,
  actions: OverviewActions,
) => OverviewController;
