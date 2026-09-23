export interface RepoMeta {
  readonly name: string;
  readonly description: string;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;
  readonly pushedAt: string;
}

export interface Commit {
  readonly sha: string;
  readonly message: string;
  readonly authorName: string;
  readonly authorAvatarUrl: string;
  readonly date: string;
  readonly url: string;
}

export interface Contributor {
  readonly login: string;
  readonly avatarUrl: string;
  readonly contributions: number;
  readonly url: string;
}
