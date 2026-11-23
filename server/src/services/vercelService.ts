import type {
  Deployment,
  VercelDetectedPreset,
  VercelEnvVarInput,
  VercelEnvVarItem,
  VercelProjectConfig,
  VercelProjectItem,
} from '../../../shared/types.ts';
import { getStore } from '../db/index.ts';
import { extractGitHubTarball, type ExtractedRepoFile } from '../utils/tar.ts';
import { realtimeHub } from '../ws/realtime.ts';

function appendTeamQuery(url: string, teamId?: string | null): string {
  if (!teamId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}teamId=${encodeURIComponent(teamId)}`;
}

export function normalizeVercelSlug(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
  return (slug || 'codepulse-app').slice(0, 64);
}

async function recordFailedDeployment(params: {
  workspaceId: string;
  taskId: string | null;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  buildLogs: string[];
  triggeredBy: string | null;
  triggeredByUsername: string | null;
}): Promise<Deployment> {
  const store = await getStore();
  const failed = await store.createDeployment({
    workspaceId: params.workspaceId,
    taskId: params.taskId,
    vercelDeploymentId: null,
    branch: params.branch,
    commitSha: params.commitSha,
    commitMessage: params.commitMessage,
    status: 'ERROR',
    previewUrl: null,
    inspectorUrl: null,
    buildLogs: params.buildLogs,
    triggeredBy: params.triggeredBy,
    triggeredByUsername: params.triggeredByUsername,
    readyAt: null,
  });
  realtimeHub.broadcastToWorkspace(params.workspaceId, {
    type: 'deployment:updated',
    workspaceId: params.workspaceId,
    deployment: failed,
  });
  return failed;
}

export async function fetchVercelProjects(
  token: string,
  teamId?: string | null,
): Promise<VercelProjectItem[]> {
  const res = await fetch(
    appendTeamQuery('https://api.vercel.com/v9/projects?limit=20', teamId),
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Vercel API error (${res.status})`);
  }
  const json = (await res.json()) as {
    projects?: Array<{
      id: string;
      name: string;
      framework?: string | null;
      latestDeployments?: Array<{ url?: string }>;
    }>;
  };

  return (json.projects || []).map((p) => ({
    id: p.id,
    name: p.name,
    framework: p.framework || null,
    latestUrl: p.latestDeployments?.[0]?.url
      ? `https://${p.latestDeployments[0].url}`
      : null,
  }));
}

export async function inspectGitHubRepoPackage(params: {
  githubToken?: string | null;
  owner: string;
  repo: string;
  branch: string;
}): Promise<VercelDetectedPreset> {
  const fallback: VercelDetectedPreset = {
    framework: null,
    label: 'Static / Other',
    buildCommand: '',
    outputDirectory: '',
    installCommand: '',
    rootDirectory: '',
    packageJsonFound: false,
  };

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
      'User-Agent': 'CodePulse',
    };
    if (params.githubToken) {
      headers.Authorization = `Bearer ${params.githubToken}`;
    }

    const res = await fetch(
      `https://api.github.com/repos/${params.owner}/${params.repo}/contents/package.json?ref=${encodeURIComponent(params.branch)}`,
      { headers },
    );
    if (!res.ok) return fallback;

    const pkg = (await res.json()) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const hasBuildScript = Boolean(pkg.scripts?.build);

    if (deps.next) {
      return {
        framework: 'nextjs',
        label: 'Next.js',
        buildCommand: hasBuildScript ? 'npm run build' : 'next build',
        outputDirectory: '.next',
        installCommand: 'npm install',
        rootDirectory: '',
        packageJsonFound: true,
      };
    }
    if (deps.vite) {
      return {
        framework: 'vite',
        label: 'Vite',
        buildCommand: hasBuildScript ? 'npm run build' : 'vite build',
        outputDirectory: 'dist',
        installCommand: 'npm install',
        rootDirectory: '',
        packageJsonFound: true,
      };
    }
    if (deps.astro) {
      return {
        framework: 'astro',
        label: 'Astro',
        buildCommand: hasBuildScript ? 'npm run build' : 'astro build',
        outputDirectory: 'dist',
        installCommand: 'npm install',
        rootDirectory: '',
        packageJsonFound: true,
      };
    }
    if (deps.nuxt) {
      return {
        framework: 'nuxtjs',
        label: 'Nuxt.js',
        buildCommand: hasBuildScript ? 'npm run build' : 'nuxt build',
        outputDirectory: '.output/public',
        installCommand: 'npm install',
        rootDirectory: '',
        packageJsonFound: true,
      };
    }
    if (deps['@sveltejs/kit']) {
      return {
        framework: 'sveltekit',
        label: 'SvelteKit',
        buildCommand: hasBuildScript ? 'npm run build' : 'vite build',
        outputDirectory: '.svelte-kit',
        installCommand: 'npm install',
        rootDirectory: '',
        packageJsonFound: true,
      };
    }
    if (deps['@remix-run/react'] || deps.remix) {
      return {
        framework: 'remix',
        label: 'Remix',
        buildCommand: hasBuildScript ? 'npm run build' : 'remix build',
        outputDirectory: 'build/client',
        installCommand: 'npm install',
        rootDirectory: '',
        packageJsonFound: true,
      };
    }
    if (deps['react-scripts']) {
      return {
        framework: 'create-react-app',
        label: 'Create React App',
        buildCommand: hasBuildScript ? 'npm run build' : 'react-scripts build',
        outputDirectory: 'build',
        installCommand: 'npm install',
        rootDirectory: '',
        packageJsonFound: true,
      };
    }

    return {
      framework: null,
      label: hasBuildScript ? 'Node / Custom Build' : 'Static / Other',
      buildCommand: hasBuildScript ? 'npm run build' : '',
      outputDirectory: hasBuildScript ? 'dist' : '',
      installCommand: 'npm install',
      rootDirectory: '',
      packageJsonFound: true,
    };
  } catch {
    return fallback;
  }
}

export async function getVercelProjectConfig(
  token: string,
  projectIdOrName: string,
  teamId?: string | null,
): Promise<{ config: VercelProjectConfig; envVars: VercelEnvVarItem[]; gitLinked: boolean }> {
  const projRes = await fetch(
    appendTeamQuery(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectIdOrName)}`, teamId),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!projRes.ok) {
    throw new Error(`Unable to fetch Vercel project (${projRes.status})`);
  }

  const proj = (await projRes.json()) as {
    id: string;
    name: string;
    framework?: string | null;
    rootDirectory?: string | null;
    buildCommand?: string | null;
    outputDirectory?: string | null;
    installCommand?: string | null;
    link?: { type?: string };
  };

  let envVars: VercelEnvVarItem[] = [];
  try {
    const envRes = await fetch(
      appendTeamQuery(
        `https://api.vercel.com/v10/projects/${encodeURIComponent(proj.id)}/env`,
        teamId,
      ),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (envRes.ok) {
      const envJson = (await envRes.json()) as {
        envs?: Array<{ id: string; key: string; type?: string; target?: string[] }>;
      };
      envVars = (envJson.envs || []).map((e) => ({
        id: e.id,
        key: e.key,
        type: e.type || 'encrypted',
        target: e.target || ['production', 'preview'],
      }));
    }
  } catch {
    // ignore env list error
  }

  return {
    config: {
      projectId: proj.id,
      projectName: proj.name,
      framework: proj.framework ?? null,
      rootDirectory: proj.rootDirectory ?? null,
      buildCommand: proj.buildCommand ?? null,
      outputDirectory: proj.outputDirectory ?? null,
      installCommand: proj.installCommand ?? null,
    },
    envVars,
    gitLinked: proj.link?.type === 'github',
  };
}

export async function provisionVercelProject(params: {
  token: string;
  teamId?: string | null;
  existingProjectId?: string | null;
  projectName: string;
  framework?: string | null;
  rootDirectory?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
  installCommand?: string | null;
  environmentVariables?: VercelEnvVarInput[];
}): Promise<{
  projectId: string;
  projectName: string;
  created: boolean;
  config: VercelProjectConfig;
  envVars: VercelEnvVarItem[];
}> {
  const slug = normalizeVercelSlug(params.projectName);
  const settingsBody = {
    framework: params.framework || null,
    rootDirectory: params.rootDirectory?.trim() || null,
    buildCommand: params.buildCommand?.trim() || null,
    outputDirectory: params.outputDirectory?.trim() || null,
    installCommand: params.installCommand?.trim() || null,
  };

  let projectId: string | null = null;
  let projectName = slug;
  let created = false;

  // Update existing Vercel project if a real projectId exists on Vercel
  if (params.existingProjectId) {
    const patchRes = await fetch(
      appendTeamQuery(
        `https://api.vercel.com/v9/projects/${encodeURIComponent(params.existingProjectId)}`,
        params.teamId,
      ),
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${params.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsBody),
      },
    );
    if (patchRes.ok) {
      const updatedProj = (await patchRes.json()) as { id: string; name: string };
      projectId = updatedProj.id;
      projectName = updatedProj.name;
    }
  }

  // Create directly on Vercel if not yet created
  if (!projectId) {
    const createRes = await fetch(
      appendTeamQuery('https://api.vercel.com/v10/projects', params.teamId),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: slug,
          ...settingsBody,
        }),
      },
    );

    const createJson = (await createRes.json()) as {
      id?: string;
      name?: string;
      error?: { code?: string; message?: string };
    };

    if (createRes.ok && createJson.id) {
      projectId = createJson.id;
      projectName = createJson.name || slug;
      created = true;
    } else if (createRes.status === 409 || createJson.error?.code === 'conflict') {
      // Adopt existing Vercel project with the same name and apply settings
      const lookupRes = await fetch(
        appendTeamQuery(
          `https://api.vercel.com/v9/projects/${encodeURIComponent(slug)}`,
          params.teamId,
        ),
        { headers: { Authorization: `Bearer ${params.token}` } },
      );
      if (!lookupRes.ok) {
        throw new Error(createJson.error?.message || `Vercel project "${slug}" already exists`);
      }
      const existingProj = (await lookupRes.json()) as { id: string; name: string };
      projectId = existingProj.id;
      projectName = existingProj.name;

      await fetch(
        appendTeamQuery(
          `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`,
          params.teamId,
        ),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${params.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settingsBody),
        },
      );
    } else {
      throw new Error(
        createJson.error?.message || `Vercel project creation failed (${createRes.status})`,
      );
    }
  }

  // Upsert any environment variables provided in CodePulse UI
  for (const item of params.environmentVariables || []) {
    const key = item.key.trim();
    if (!key) continue;
    const envRes = await fetch(
      appendTeamQuery(
        `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true`,
        params.teamId,
      ),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          value: item.value,
          type: 'encrypted',
          target: item.target?.length ? item.target : ['production', 'preview'],
        }),
      },
    );
    if (!envRes.ok) {
      const errData = (await envRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(
        errData.error?.message || `Failed to save environment variable "${key}" (${envRes.status})`,
      );
    }
  }

  const details = await getVercelProjectConfig(params.token, projectId, params.teamId);
  return {
    projectId,
    projectName,
    created,
    config: details.config,
    envVars: details.envVars,
  };
}

export async function deleteVercelEnvVar(
  token: string,
  projectIdOrName: string,
  envId: string,
  teamId?: string | null,
): Promise<void> {
  const res = await fetch(
    appendTeamQuery(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectIdOrName)}/env/${encodeURIComponent(envId)}`,
      teamId,
    ),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to remove environment variable (${res.status})`);
  }
}

async function fetchGitHubSnapshotFiles(params: {
  owner: string;
  repo: string;
  branch: string;
  githubToken?: string | null;
}): Promise<ExtractedRepoFile[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CodePulse',
  };
  if (params.githubToken) {
    headers.Authorization = `Bearer ${params.githubToken}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${params.owner}/${params.repo}/tarball/${encodeURIComponent(params.branch)}`,
    { headers, redirect: 'follow' },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to fetch repository snapshot from GitHub (${res.status} ${res.statusText})`,
    );
  }

  const gzBuffer = Buffer.from(await res.arrayBuffer());
  const extracted = extractGitHubTarball(gzBuffer);
  if (extracted.length === 0) {
    throw new Error('GitHub repository snapshot returned no deployable files');
  }
  return extracted;
}

async function uploadFilesToVercel(
  files: ExtractedRepoFile[],
  token: string,
  teamId?: string | null,
): Promise<void> {
  const uploadUrl = appendTeamQuery('https://api.vercel.com/v2/files', teamId);
  const concurrency = 8;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (f) => {
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(f.size),
            'x-vercel-digest': f.sha,
          },
          body: new Uint8Array(f.data),
        });
        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          throw new Error(
            errJson.error?.message || `Vercel file upload failed for "${f.file}" (${res.status})`,
          );
        }
      }),
    );
  }
}

export async function triggerVercelDeployment(params: {
  workspaceId: string;
  taskId: string | null;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  triggeredBy: string | null;
  triggeredByUsername: string | null;
  vercelToken: string | null;
  vercelTeamId?: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  githubToken?: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  githubRepoId: number | null;
}): Promise<Deployment> {
  const store = await getStore();
  const projectName = normalizeVercelSlug(
    params.vercelProjectName || params.githubRepo || 'codepulse-app',
  );
  const ts = () => new Date().toISOString().slice(11, 19);

  const initialLogs = [
    `[${ts()}] Deployment queued for ${projectName} (branch: ${params.branch})`,
  ];

  // Live Vercel REST API mode when non-demo token + Vercel project exist
  if (
    params.vercelToken &&
    params.vercelProjectId &&
    !params.vercelToken.startsWith('demo_')
  ) {
    const logs = [...initialLogs];
    try {
      const projDetails = await getVercelProjectConfig(
        params.vercelToken,
        params.vercelProjectId,
        params.vercelTeamId,
      ).catch(() => null);

      const deployUrl = appendTeamQuery(
        'https://api.vercel.com/v13/deployments',
        params.vercelTeamId,
      );

      let deployResponse: {
        id?: string;
        url?: string;
        inspectorUrl?: string;
        error?: { message?: string };
      } | null = null;
      let usedGitSource = false;

      // Try native gitSource only when project is linked to GitHub on Vercel
      if (projDetails?.gitLinked && params.githubRepoId) {
        const gitRes = await fetch(deployUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${params.vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projDetails.config.projectName || projectName,
            project: params.vercelProjectId,
            target: 'production',
            gitSource: {
              type: 'github',
              repoId: params.githubRepoId,
              ref: params.branch,
            },
          }),
        });
        const gitData = (await gitRes.json()) as {
          id?: string;
          url?: string;
          inspectorUrl?: string;
          error?: { message?: string };
        };
        if (gitRes.ok && gitData.id) {
          deployResponse = gitData;
          usedGitSource = true;
        }
      }

      // Direct GitHub Snapshot -> Vercel Files Upload (works without installing Vercel GitHub App!)
      if (!deployResponse) {
        if (!params.githubOwner || !params.githubRepo) {
          return recordFailedDeployment({
            ...params,
            buildLogs: [
              ...logs,
              'Error: GitHub repository must be connected before deploying snapshot to Vercel.',
            ],
          });
        }

        logs.push(
          `[${ts()}] Fetching snapshot ${params.githubOwner}/${params.githubRepo}@${params.branch} from GitHub...`,
        );
        const files = await fetchGitHubSnapshotFiles({
          owner: params.githubOwner,
          repo: params.githubRepo,
          branch: params.branch,
          githubToken: params.githubToken,
        });

        logs.push(`[${ts()}] Syncing ${files.length} repository files to Vercel Edge Storage...`);
        await uploadFilesToVercel(files, params.vercelToken, params.vercelTeamId);

        const snapRes = await fetch(deployUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${params.vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projDetails?.config.projectName || projectName,
            project: params.vercelProjectId,
            target: 'production',
            files: files.map((f) => ({
              file: f.file,
              sha: f.sha,
              size: f.size,
            })),
          }),
        });

        const snapData = (await snapRes.json()) as {
          id?: string;
          url?: string;
          inspectorUrl?: string;
          error?: { message?: string };
        };

        if (!snapRes.ok || !snapData.id) {
          return recordFailedDeployment({
            ...params,
            buildLogs: [
              ...logs,
              `Vercel API error: ${snapData.error?.message || snapRes.statusText}`,
            ],
          });
        }
        deployResponse = snapData;
      }

      logs.push(
        `[${ts()}] Vercel ${usedGitSource ? 'Git' : 'Snapshot'} deployment created (${deployResponse.id})`,
        `[${ts()}] Building on Vercel Cloud Build Infrastructure...`,
      );

      const deployment = await store.createDeployment({
        workspaceId: params.workspaceId,
        taskId: params.taskId,
        vercelDeploymentId: deployResponse.id!,
        branch: params.branch,
        commitSha: params.commitSha,
        commitMessage: params.commitMessage,
        status: 'BUILDING',
        previewUrl: deployResponse.url ? `https://${deployResponse.url}` : null,
        inspectorUrl: deployResponse.inspectorUrl || null,
        buildLogs: logs,
        triggeredBy: params.triggeredBy,
        triggeredByUsername: params.triggeredByUsername,
        readyAt: null,
      });

      realtimeHub.broadcastToWorkspace(params.workspaceId, {
        type: 'deployment:updated',
        workspaceId: params.workspaceId,
        deployment,
      });

      pollVercelDeploymentStatus(
        deployment.id,
        deployResponse.id!,
        params.vercelToken,
        params.workspaceId,
        params.vercelTeamId,
      );
      return deployment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vercel request failed';
      return recordFailedDeployment({
        ...params,
        buildLogs: [...logs, `Error: ${message}`],
      });
    }
  }

  // Simulated Vercel deployment pipeline (when Vercel token/project is not connected yet)
  const simId = `dpl_sim_${Date.now().toString(36)}`;
  const slug = projectName;
  const shortSha = (params.commitSha || Math.random().toString(16).slice(2, 9)).slice(0, 7);

  const deployment = await store.createDeployment({
    workspaceId: params.workspaceId,
    taskId: params.taskId,
    vercelDeploymentId: simId,
    branch: params.branch,
    commitSha: shortSha,
    commitMessage: params.commitMessage || `Deploy ${params.branch} via CodePulse`,
    status: 'QUEUED',
    previewUrl: null,
    inspectorUrl: `https://vercel.com/${params.githubOwner || 'team'}/${slug}/${simId}`,
    buildLogs: initialLogs,
    triggeredBy: params.triggeredBy,
    triggeredByUsername: params.triggeredByUsername,
    readyAt: null,
  });

  realtimeHub.broadcastToWorkspace(params.workspaceId, {
    type: 'deployment:updated',
    workspaceId: params.workspaceId,
    deployment,
  });

  runSimulatedVercelBuild(deployment.id, params.workspaceId, slug, shortSha, params.branch);
  return deployment;
}

async function fetchVercelDeploymentLogLines(
  vercelDeploymentId: string,
  token: string,
  teamId?: string | null,
): Promise<string[]> {
  try {
    const res = await fetch(
      appendTeamQuery(
        `https://api.vercel.com/v3/deployments/${encodeURIComponent(vercelDeploymentId)}/events`,
        teamId,
      ),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const events = (await res.json()) as Array<{
      type?: string;
      text?: string;
      payload?: { text?: string };
    }>;
    if (!Array.isArray(events)) return [];
    return events
      .map((e) => e.text || e.payload?.text || '')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-25);
  } catch {
    return [];
  }
}

function pollVercelDeploymentStatus(
  deploymentId: string,
  vercelDeploymentId: string,
  token: string,
  workspaceId: string,
  teamId?: string | null,
): void {
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    if (attempts > 60) {
      clearInterval(timer);
      return;
    }
    try {
      const res = await fetch(
        appendTeamQuery(
          `https://api.vercel.com/v13/deployments/${encodeURIComponent(vercelDeploymentId)}`,
          teamId,
        ),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        readyState?: string;
        url?: string;
        alias?: string[];
        inspectorUrl?: string;
      };
      const store = await getStore();
      const existing = await store.getDeploymentById(deploymentId);
      if (!existing) {
        clearInterval(timer);
        return;
      }

      if (data.readyState === 'READY') {
        const remoteLogs = await fetchVercelDeploymentLogLines(vercelDeploymentId, token, teamId);
        const liveHost = data.alias?.[0] || data.url;
        const liveUrl = liveHost ? `https://${liveHost}` : existing.previewUrl;
        const updated = await store.updateDeployment(deploymentId, {
          status: 'READY',
          previewUrl: liveUrl,
          inspectorUrl: data.inspectorUrl || existing.inspectorUrl,
          readyAt: new Date().toISOString(),
          buildLogs: [
            ...existing.buildLogs,
            ...remoteLogs,
            `[${new Date().toISOString().slice(11, 19)}] Build succeeded. Deployment READY -> ${liveUrl}`,
          ],
        });
        if (updated) {
          realtimeHub.broadcastToWorkspace(workspaceId, {
            type: 'deployment:updated',
            workspaceId,
            deployment: updated,
          });
        }
        clearInterval(timer);
      } else if (data.readyState === 'ERROR' || data.readyState === 'CANCELED') {
        const remoteLogs = await fetchVercelDeploymentLogLines(vercelDeploymentId, token, teamId);
        const updated = await store.updateDeployment(deploymentId, {
          status: 'ERROR',
          buildLogs: [
            ...existing.buildLogs,
            ...remoteLogs,
            `[${new Date().toISOString().slice(11, 19)}] Vercel deployment ended with state: ${data.readyState}`,
          ],
        });
        if (updated) {
          realtimeHub.broadcastToWorkspace(workspaceId, {
            type: 'deployment:updated',
            workspaceId,
            deployment: updated,
          });
        }
        clearInterval(timer);
      }
    } catch {
      // keep polling briefly
    }
  }, 3000);
}

function runSimulatedVercelBuild(
  deploymentId: string,
  workspaceId: string,
  slug: string,
  shortSha: string,
  branch: string,
): void {
  const ts = () => new Date().toISOString().slice(11, 19);

  setTimeout(async () => {
    const store = await getStore();
    const current = await store.getDeploymentById(deploymentId);
    if (!current) return;
    const updated = await store.updateDeployment(deploymentId, {
      status: 'BUILDING',
      buildLogs: [
        ...current.buildLogs,
        `[${ts()}] Cloning branch "${branch}" at commit ${shortSha}...`,
        `[${ts()}] Installing dependencies (npm ci --prefer-offline)...`,
      ],
    });
    if (updated) {
      realtimeHub.broadcastToWorkspace(workspaceId, {
        type: 'deployment:updated',
        workspaceId,
        deployment: updated,
      });
    }
  }, 800);

  setTimeout(async () => {
    const store = await getStore();
    const current = await store.getDeploymentById(deploymentId);
    if (!current) return;
    const updated = await store.updateDeployment(deploymentId, {
      status: 'BUILDING',
      buildLogs: [
        ...current.buildLogs,
        `[${ts()}] Running "tsc -b && vite build"...`,
        `[${ts()}] Built 48 modules -> dist/assets/index-${shortSha}.js (192.4 kB)`,
      ],
    });
    if (updated) {
      realtimeHub.broadcastToWorkspace(workspaceId, {
        type: 'deployment:updated',
        workspaceId,
        deployment: updated,
      });
    }
  }, 2000);

  setTimeout(async () => {
    const store = await getStore();
    const current = await store.getDeploymentById(deploymentId);
    if (!current) return;
    const previewUrl = `https://${slug}-${shortSha}.vercel.app`;
    const updated = await store.updateDeployment(deploymentId, {
      status: 'READY',
      previewUrl,
      readyAt: new Date().toISOString(),
      buildLogs: [
        ...current.buildLogs,
        `[${ts()}] Uploading build artifacts (local simulation mode)...`,
        `[${ts()}] [SIMULATION] Pipeline READY — link a Vercel Project in Project Settings to publish a real *.vercel.app URL.`,
      ],
    });
    if (updated) {
      realtimeHub.broadcastToWorkspace(workspaceId, {
        type: 'deployment:updated',
        workspaceId,
        deployment: updated,
      });
    }
  }, 3300);
}
