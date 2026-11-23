import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  FolderOpen,
  KeyRound,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type {
  Deployment,
  PublicUser,
  VercelEnvVarInput,
  VercelEnvVarItem,
  VercelProjectItem,
  Workspace,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { VercelTokenGuide } from './VercelTokenGuide.tsx';

interface VercelDeployConfiguratorProps {
  workspace: Workspace;
  currentUser: PublicUser;
  showDeployButton?: boolean;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onUserUpdated?: (user: PublicUser) => void;
  onDeploymentCreated?: (deployment: Deployment) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface FrameworkOption {
  value: string;
  label: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
}

const FRAMEWORK_OPTIONS: FrameworkOption[] = [
  {
    value: '',
    label: 'Other / Static HTML (Auto)',
    buildCommand: '',
    outputDirectory: '',
    installCommand: '',
  },
  {
    value: 'vite',
    label: 'Vite',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    installCommand: 'npm install',
  },
  {
    value: 'nextjs',
    label: 'Next.js',
    buildCommand: 'npm run build',
    outputDirectory: '.next',
    installCommand: 'npm install',
  },
  {
    value: 'create-react-app',
    label: 'Create React App',
    buildCommand: 'npm run build',
    outputDirectory: 'build',
    installCommand: 'npm install',
  },
  {
    value: 'astro',
    label: 'Astro',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    installCommand: 'npm install',
  },
  {
    value: 'nuxtjs',
    label: 'Nuxt.js',
    buildCommand: 'npm run build',
    outputDirectory: '.output/public',
    installCommand: 'npm install',
  },
  {
    value: 'sveltekit',
    label: 'SvelteKit',
    buildCommand: 'npm run build',
    outputDirectory: '.svelte-kit',
    installCommand: 'npm install',
  },
  {
    value: 'remix',
    label: 'Remix',
    buildCommand: 'npm run build',
    outputDirectory: 'build/client',
    installCommand: 'npm install',
  },
];

function suggestSlug(workspace: Workspace): string {
  const base = workspace.vercelProjectName || workspace.githubRepo || workspace.name;
  return (
    base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[._-]+|[._-]+$/g, '') || 'codepulse-app'
  );
}

export function VercelDeployConfigurator({
  workspace,
  currentUser,
  showDeployButton = false,
  onWorkspaceUpdated,
  onUserUpdated,
  onDeploymentCreated,
  onToast,
}: VercelDeployConfiguratorProps) {
  const { L } = useLanguage();
  const isLeader = isWorkspaceLeader(workspace, currentUser);

  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  const [projectName, setProjectName] = useState(suggestSlug(workspace));
  const [framework, setFramework] = useState<string>('');
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [buildCommand, setBuildCommand] = useState('');
  const [outputDirectory, setOutputDirectory] = useState('');
  const [installCommand, setInstallCommand] = useState('');
  const [rootDirectory, setRootDirectory] = useState('');
  const [autoDeployOnMerge, setAutoDeployOnMerge] = useState(workspace.autoDeployOnMerge);

  const [showBuildOverrides, setShowBuildOverrides] = useState(true);
  const [showExistingPicker, setShowExistingPicker] = useState(false);

  const [existingProjects, setExistingProjects] = useState<VercelProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [savedEnvVars, setSavedEnvVars] = useState<VercelEnvVarItem[]>([]);
  const [pendingEnvVars, setPendingEnvVars] = useState<VercelEnvVarInput[]>([]);
  const [envKeyInput, setEnvKeyInput] = useState('');
  const [envValueInput, setEnvValueInput] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [deployingAfterSave, setDeployingAfterSave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .detectVercelSetup(workspace.id)
      .then((res) => {
        if (cancelled) return;
        if (res.detected.packageJsonFound) {
          setDetectedLabel(res.detected.label);
        } else {
          setDetectedLabel(null);
        }

        if (res.config) {
          setProjectName(res.config.projectName || suggestSlug(workspace));
          setFramework(res.config.framework || '');
          setBuildCommand(res.config.buildCommand || '');
          setOutputDirectory(res.config.outputDirectory || '');
          setInstallCommand(res.config.installCommand || '');
          setRootDirectory(res.config.rootDirectory || '');
          setSavedEnvVars(res.envVars);
        } else {
          setFramework(res.detected.framework || '');
          setBuildCommand(res.detected.buildCommand || '');
          setOutputDirectory(res.detected.outputDirectory || '');
          setInstallCommand(res.detected.installCommand || '');
          setRootDirectory(res.detected.rootDirectory || '');
          setSavedEnvVars([]);
        }
      })
      .catch(() => {});

    if (currentUser.vercelConnected) {
      api
        .listVercelProjects()
        .then((res) => {
          if (!cancelled) setExistingProjects(res.projects);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [workspace, currentUser.vercelConnected]);

  function handleFrameworkChange(nextFramework: string) {
    setFramework(nextFramework);
    const preset = FRAMEWORK_OPTIONS.find((f) => f.value === nextFramework);
    if (preset) {
      setBuildCommand(preset.buildCommand);
      setOutputDirectory(preset.outputDirectory);
      setInstallCommand(preset.installCommand);
    }
  }

  function addPendingEnv() {
    const key = envKeyInput.trim();
    if (!key) return;
    setPendingEnvVars((prev) => [
      ...prev.filter((item) => item.key !== key),
      { key, value: envValueInput, target: ['production', 'preview'] },
    ]);
    setEnvKeyInput('');
    setEnvValueInput('');
  }

  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    try {
      const { user } = await api.linkVercelToken(tokenInput.trim());
      onUserUpdated?.(user);
      setTokenInput('');
      onToast(
        'success',
        L(
          'Token Vercel terenkripsi dan terhubung. Anda kini dapat mengatur & deploy langsung!',
          'Vercel token encrypted and linked. You can configure & deploy directly now!',
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal memverifikasi Token Vercel', 'Failed to verify Vercel token'),
      );
    } finally {
      setSavingToken(false);
    }
  }

  async function refreshExistingProjects() {
    setLoadingProjects(true);
    try {
      const res = await api.listVercelProjects();
      setExistingProjects(res.projects);
    } catch {
      onToast(
        'error',
        L('Tidak dapat memuat ulang daftar proyek Vercel.', 'Could not refresh Vercel projects.'),
      );
    } finally {
      setLoadingProjects(false);
    }
  }

  async function handleLinkExisting(projectId: string) {
    const selected = existingProjects.find((p) => p.id === projectId);
    if (!selected || !isLeader) return;
    setSubmitting(true);
    try {
      const res = await api.connectVercelProject(workspace.id, {
        projectId: selected.id,
        projectName: selected.name,
        autoDeployOnMerge,
      });
      onWorkspaceUpdated(res.workspace);
      setProjectName(selected.name);
      onToast(
        'success',
        L(
          `Proyek Vercel yang ada "${selected.name}" berhasil dihubungkan.`,
          `Linked existing Vercel project "${selected.name}".`,
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menghubungkan proyek Vercel', 'Failed to link Vercel project'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveSavedEnv(envId: string, keyName: string) {
    if (!isLeader) return;
    try {
      await api.deleteVercelEnvVar(workspace.id, envId);
      setSavedEnvVars((prev) => prev.filter((item) => item.id !== envId));
      onToast(
        'info',
        L(
          `Menghapus environment variable ${keyName} dari Vercel.`,
          `Removed environment variable ${keyName} from Vercel.`,
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menghapus environment variable', 'Failed to remove env variable'),
      );
    }
  }

  async function submitProvision(deployAfter: boolean) {
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat mengatur atau memicu deployment Vercel.',
          'Only Project Leader can configure or trigger Vercel deployments.',
        ),
      );
      return;
    }
    if (!projectName.trim()) {
      onToast(
        'error',
        L('Masukkan nama proyek Vercel terlebih dahulu.', 'Please enter a Vercel project name.'),
      );
      return;
    }

    const extraPending = envKeyInput.trim()
      ? [
          ...pendingEnvVars.filter((x) => x.key !== envKeyInput.trim()),
          { key: envKeyInput.trim(), value: envValueInput, target: ['production', 'preview'] as Array<'production' | 'preview'> },
        ]
      : pendingEnvVars;

    setSubmitting(true);
    setDeployingAfterSave(deployAfter);
    try {
      const result = await api.provisionVercelProject(workspace.id, {
        projectName: projectName.trim(),
        framework: framework || null,
        rootDirectory: rootDirectory.trim() || null,
        buildCommand: buildCommand.trim() || null,
        outputDirectory: outputDirectory.trim() || null,
        installCommand: installCommand.trim() || null,
        autoDeployOnMerge,
        environmentVariables: extraPending,
      });

      onWorkspaceUpdated(result.workspace);
      setSavedEnvVars(result.envVars);
      setPendingEnvVars([]);
      setEnvKeyInput('');
      setEnvValueInput('');

      onToast(
        'success',
        result.created
          ? L(
              `Proyek "${result.config.projectName}" berhasil dibuat langsung di Vercel & dikonfigurasi!`,
              `Project "${result.config.projectName}" created directly on Vercel & configured!`,
            )
          : L(
              `Pengaturan Vercel tersimpan untuk "${result.config.projectName}".`,
              `Vercel settings saved for "${result.config.projectName}".`,
            ),
      );

      if (deployAfter) {
        const { deployment } = await api.triggerDeployment(result.workspace.id, {
          branch: result.workspace.defaultBranch,
          commitMessage: `Deploy ${result.workspace.githubRepo || result.config.projectName} (${result.workspace.defaultBranch})`,
        });
        onDeploymentCreated?.(deployment);
        onToast(
          'info',
          L(
            'Snapshot diunggah ke Vercel! Sedang membangun deployment produksi...',
            'Snapshot uploaded to Vercel! Building production deployment...',
          ),
        );
      }
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal mengonfigurasi proyek Vercel', 'Failed to configure Vercel project'),
      );
    } finally {
      setSubmitting(false);
      setDeployingAfterSave(false);
    }
  }

  if (!currentUser.vercelConnected) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 space-y-3">
          <div className="text-xs font-semibold text-white flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {L(
                'Langkah 1: Hubungkan Token Vercel Anda sekali',
                'Step 1: Connect your Vercel Token once',
              )}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {L(
              'Setelah menghubungkan Vercel Personal Access Token sekali, Anda dapat mengatur build, Environment Variables, serta membuat/deploy proyek langsung dari UI CodePulse—tanpa perlu impor manual di vercel.com.',
              'After linking your Vercel Personal Access Token once, you can configure builds, env variables, and create/deploy projects straight from this CodePulse UI—no manual import on vercel.com needed.',
            )}
          </p>
          <form onSubmit={handleSaveToken} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={L(
                  'Tempel Vercel Personal Access Token Anda...',
                  'Paste your Vercel Personal Access Token...',
                )}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingToken || !tokenInput.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45 shrink-0"
            >
              {savingToken ? L('Menghubungkan...', 'Linking...') : L('Simpan Token', 'Save Token')}
            </button>
          </form>
        </div>

        <VercelTokenGuide compact />
      </div>
    );
  }

  const slugPreview =
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[._-]+|[._-]+$/g, '') || 'codepulse-app';

  return (
    <div className="space-y-4">
      {/* Header status strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-white">
            {L(
              'Konfigurasi & Provision Langsung di Vercel',
              'Configure & Provision Directly on Vercel',
            )}
          </span>
          {workspace.vercelProjectId && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-mono">
              <CheckCircle2 className="w-3 h-3" />
              {L('Terhubung', 'Linked')} ({workspace.vercelProjectName || slugPreview})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowExistingPicker((prev) => !prev)}
          className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200 cursor-pointer"
        >
          {showExistingPicker
            ? L('Sembunyikan Proyek yang Ada', 'Hide Existing Projects')
            : L('Atau pilih proyek Vercel yang ada', 'Or pick existing Vercel project')}
        </button>
      </div>

      {/* Optional existing Vercel project picker */}
      {showExistingPicker && (
        <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400">
              {L('Pilih dari proyek yang sudah ada di Vercel', 'Pick from existing projects on Vercel')}
            </span>
            <button
              type="button"
              disabled={loadingProjects}
              onClick={() => void refreshExistingProjects()}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{loadingProjects ? L('Menyinkronkan...', 'Syncing...') : L('Muat Ulang', 'Refresh')}</span>
            </button>
          </div>
          {existingProjects.length > 0 ? (
            <select
              value={workspace.vercelProjectId || ''}
              disabled={!isLeader || submitting}
              onChange={(e) => {
                if (e.target.value) void handleLinkExisting(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-200"
            >
              <option value="">
                {L('-- Pilih proyek Vercel yang ada --', '-- Select existing Vercel project --')}
              </option>
              {existingProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.framework || L('statis/web', 'static/web')})
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[11px] text-zinc-500">
              {L(
                'Belum ada proyek di Vercel—isi formulir di bawah dan CodePulse akan membuatnya secara otomatis untuk Anda.',
                'No existing projects on Vercel yet—fill the form below and CodePulse will create it automatically for you.',
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Vercel-style Deploy Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span>{L('Nama Proyek', 'Project Name')}</span>
            <span className="font-mono text-[10px] text-cyan-300">{slugPreview}.vercel.app</span>
          </label>
          <input
            type="text"
            value={projectName}
            disabled={!isLeader || submitting}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={L('nama-proyek-saya', 'my-project-name')}
            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              <span>{L('Preset Framework', 'Framework Preset')}</span>
            </span>
            {detectedLabel && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">
                {L('Terdeteksi:', 'Detected:')} {detectedLabel}
              </span>
            )}
          </label>
          <select
            value={framework}
            disabled={!isLeader || submitting}
            onChange={(e) => handleFrameworkChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          >
            {FRAMEWORK_OPTIONS.map((opt) => (
              <option key={opt.value || 'other'} value={opt.value}>
                {opt.value === ''
                  ? L('Lainnya / HTML Statis (Otomatis)', 'Other / Static HTML (Auto)')
                  : opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Collapsible Build & Output Settings (like Vercel Dashboard) */}
      <div className="rounded-xl bg-zinc-950/75 border border-white/8 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBuildOverrides((prev) => !prev)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-zinc-200 hover:bg-white/[0.02] cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>{L('Pengaturan Build dan Output', 'Build and Output Settings')}</span>
          </span>
          {showBuildOverrides ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>

        {showBuildOverrides && (
          <div className="px-3.5 pb-3.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/6">
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                {L('Perintah Build', 'Build Command')}
              </label>
              <input
                type="text"
                value={buildCommand}
                disabled={!isLeader || submitting}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder={L('Default (mis. npm run build)', 'Default (e.g. npm run build)')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                {L('Direktori Output', 'Output Directory')}
              </label>
              <input
                type="text"
                value={outputDirectory}
                disabled={!isLeader || submitting}
                onChange={(e) => setOutputDirectory(e.target.value)}
                placeholder={L('Default (mis. dist atau .next)', 'Default (e.g. dist or .next)')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                {L('Perintah Install', 'Install Command')}
              </label>
              <input
                type="text"
                value={installCommand}
                disabled={!isLeader || submitting}
                onChange={(e) => setInstallCommand(e.target.value)}
                placeholder={L('Default (npm install)', 'Default (npm install)')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                {L('Direktori Root', 'Root Directory')}
              </label>
              <input
                type="text"
                value={rootDirectory}
                disabled={!isLeader || submitting}
                onChange={(e) => setRootDirectory(e.target.value)}
                placeholder={L('./ (root repository)', './ (repository root)')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Environment Variables Section (like Vercel Env Vars) */}
      <div className="rounded-xl bg-zinc-950/75 border border-white/8 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-200">Environment Variables</span>
          <span className="text-[10px] font-mono text-zinc-500">
            {L('Terenkripsi di Vercel', 'Encrypted on Vercel')}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={envKeyInput}
            disabled={!isLeader || submitting}
            onChange={(e) => setEnvKeyInput(e.target.value)}
            placeholder={L('KEY (mis. VITE_API_URL)', 'KEY (e.g. VITE_API_URL)')}
            className="sm:w-44 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            value={envValueInput}
            disabled={!isLeader || submitting}
            onChange={(e) => setEnvValueInput(e.target.value)}
            placeholder={L('Nilai', 'Value')}
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            disabled={!isLeader || submitting || !envKeyInput.trim()}
            onClick={addPendingEnv}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium cursor-pointer disabled:opacity-45 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{L('Tambah', 'Add')}</span>
          </button>
        </div>

        {(pendingEnvVars.length > 0 || savedEnvVars.length > 0) && (
          <div className="space-y-1.5 pt-1">
            {pendingEnvVars.map((env) => (
              <div
                key={`pending-${env.key}`}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-between gap-2 text-xs font-mono"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-indigo-200 truncate">{env.key}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {L('menunggu disimpan', 'pending save')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPendingEnvVars((prev) => prev.filter((item) => item.key !== env.key))
                  }
                  className="text-zinc-400 hover:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {savedEnvVars.map((env) => (
              <div
                key={env.id}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-white/8 flex items-center justify-between gap-2 text-xs font-mono"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-zinc-200 truncate">{env.key}</span>
                  <span className="text-zinc-600">••••••••</span>
                  <span className="text-[10px] text-emerald-400">
                    {env.target.join(', ')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!isLeader}
                  onClick={() => void handleRemoveSavedEnv(env.id, env.key)}
                  className="text-zinc-500 hover:text-rose-300 cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto Deploy & Submit Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            disabled={!isLeader}
            checked={autoDeployOnMerge}
            onChange={(e) => setAutoDeployOnMerge(e.target.checked)}
          />
          <span>
            {L(
              'Auto-deploy ke Vercel segera setelah Setujui & Merge',
              'Auto-deploy to Vercel immediately after Approve & Merge',
            )}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitting || !isLeader}
            onClick={() => void submitProvision(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold transition cursor-pointer disabled:opacity-45"
          >
            {submitting && !deployingAfterSave ? (
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>
              {workspace.vercelProjectId
                ? L('Perbarui Konfigurasi Vercel', 'Update Vercel Config')
                : L('Buat & Simpan Konfigurasi', 'Create & Save Config')}
            </span>
          </button>

          {showDeployButton && (
            <button
              type="button"
              disabled={submitting || !isLeader}
              onClick={() => void submitProvision(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-45"
            >
              {submitting && deployingAfterSave ? (
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              <span>
                {workspace.vercelProjectId
                  ? L('Simpan & Deploy Sekarang', 'Save & Deploy Now')
                  : L('Buat di Vercel & Deploy', 'Create on Vercel & Deploy')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
