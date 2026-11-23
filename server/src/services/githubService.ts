import { Octokit } from '@octokit/rest';
import type { DiffFile, DiffSummary, GitHubRepoItem, Task } from '../../../shared/types.js';

export async function fetchUserGitHubRepos(token: string): Promise<GitHubRepoItem[]> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 50,
    affiliation: 'owner,collaborator,organization_member',
  });

  return data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    defaultBranch: repo.default_branch || 'main',
    private: repo.private,
    htmlUrl: repo.html_url,
  }));
}

export async function enableBranchProtectionOnMain(
  token: string,
  owner: string,
  repo: string,
  branch = 'main',
): Promise<{ ok: boolean; message: string }> {
  const octokit = new Octokit({ auth: token });
  try {
    await octokit.rest.repos.updateBranchProtection({
      owner,
      repo,
      branch,
      required_status_checks: null,
      enforce_admins: true,
      required_pull_request_reviews: {
        dismiss_stale_reviews: false,
        require_code_owner_reviews: false,
        required_approving_review_count: 1,
      },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
    });
    return { ok: true, message: `GitHub branch protection enabled on ${branch}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to enable branch protection';
    return { ok: false, message: msg };
  }
}

export async function registerGitHubWebhook(
  token: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string,
): Promise<{ ok: boolean; webhookId: number | null; message: string }> {
  const octokit = new Octokit({ auth: token });
  try {
    const existing = await octokit.rest.repos.listWebhooks({ owner, repo });
    const match = existing.data.find((h) => h.config?.url === webhookUrl);
    if (match) {
      return { ok: true, webhookId: match.id, message: 'Existing CodePulse webhook reused' };
    }

    const { data } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      name: 'web',
      active: true,
      events: ['push', 'pull_request'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret,
        insecure_ssl: '0',
      },
    });
    return { ok: true, webhookId: data.id, message: 'GitHub webhook registered' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create webhook';
    return { ok: false, webhookId: null, message: msg };
  }
}

export async function fetchGitHubDiff(
  token: string,
  owner: string,
  repo: string,
  opts: { prNumber?: number | null; baseBranch?: string; headBranch?: string | null },
): Promise<DiffSummary | null> {
  const octokit = new Octokit({ auth: token });
  const base = opts.baseBranch || 'main';

  try {
    if (opts.prNumber) {
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: opts.prNumber,
        per_page: 30,
      });

      const mappedFiles: DiffFile[] = files.map((f) => ({
        filename: f.filename,
        status:
          f.status === 'added' || f.status === 'modified' || f.status === 'removed'
            ? f.status
            : 'renamed',
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || '(binary or patch omitted by GitHub)',
      }));

      return {
        baseBranch: base,
        headBranch: opts.headBranch || `pr-${opts.prNumber}`,
        totalAdditions: mappedFiles.reduce((sum, f) => sum + f.additions, 0),
        totalDeletions: mappedFiles.reduce((sum, f) => sum + f.deletions, 0),
        changedFiles: mappedFiles.length,
        files: mappedFiles,
      };
    }

    if (opts.headBranch) {
      const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
        owner,
        repo,
        basehead: `${base}...${opts.headBranch}`,
      });

      const mappedFiles: DiffFile[] = (data.files || []).slice(0, 30).map((f) => ({
        filename: f.filename,
        status:
          f.status === 'added' || f.status === 'modified' || f.status === 'removed'
            ? f.status
            : 'renamed',
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || '(binary or patch omitted by GitHub)',
      }));

      return {
        baseBranch: base,
        headBranch: opts.headBranch,
        totalAdditions: mappedFiles.reduce((sum, f) => sum + f.additions, 0),
        totalDeletions: mappedFiles.reduce((sum, f) => sum + f.deletions, 0),
        changedFiles: mappedFiles.length,
        files: mappedFiles,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function mergeGitHubTask(
  token: string,
  owner: string,
  repo: string,
  baseBranch: string,
  task: Task,
  approverUsername: string,
): Promise<{ ok: boolean; mergeSha: string | null; message: string }> {
  const octokit = new Octokit({ auth: token });
  try {
    if (task.prNumber) {
      const { data } = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: task.prNumber,
        commit_title: `Merge PR #${task.prNumber} (${task.taskCode}) approved by ${approverUsername}`,
        merge_method: 'squash',
      });
      return { ok: true, mergeSha: data.sha || null, message: data.message };
    }

    if (task.branchName) {
      const { data } = await octokit.rest.repos.merge({
        owner,
        repo,
        base: baseBranch,
        head: task.branchName,
        commit_message: `CodePulse Gatekeeper merge ${task.branchName} (${task.taskCode}) approved by ${approverUsername}`,
      });
      return { ok: true, mergeSha: data.sha, message: 'Branch merged via GitHub API' };
    }

    return { ok: false, mergeSha: null, message: 'No branch or PR linked to this task' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GitHub merge failed';
    return { ok: false, mergeSha: null, message: msg };
  }
}
