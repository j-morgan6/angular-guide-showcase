export interface PluginSummary {
  readonly slug: string;
  readonly name: string;
  readonly repoFullName: string;
  readonly description: string | null;
  readonly syncedAt: string | null;
  readonly ruleCount: number;
}

export type RuleKind = 'bash' | 'blocking' | 'advisory';

export interface Rule {
  readonly ruleId: string;
  readonly kind: RuleKind;
  readonly trigger: string;
  readonly fix: string;
  readonly gate: string;
}

export interface SkillSummary {
  readonly name: string;
}

export interface SkillDoc {
  readonly name: string;
  readonly body: string;
}

export interface Commit {
  readonly sha: string;
  readonly message: string;
  readonly authorName: string;
  readonly authorAvatarUrl: string;
  readonly url: string;
  readonly authoredAt: string;
}

export interface Contributor {
  readonly login: string;
  readonly avatarUrl: string;
  readonly url: string;
  readonly contributions: number;
}

export interface SyncStatus {
  readonly status: 'never' | 'running' | 'succeeded' | 'failed';
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly rulesSynced: number;
  readonly error: string | null;
  readonly stale: boolean;
}
