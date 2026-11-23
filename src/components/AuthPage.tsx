import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Info,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import type { PublicUser, SystemCapabilities } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { CodePulseLogo } from './CodePulseLogo.tsx';
import { GitHubIcon } from './GitHubIcon.tsx';
import { LanguageToggle } from './LanguageToggle.tsx';

export interface AuthNotice {
  tone: 'error' | 'info';
  message: string;
}

interface AuthPageProps {
  mode: 'login' | 'register';
  initialNotice?: AuthNotice | null;
  capabilities: SystemCapabilities | null;
  onCapabilitiesLoaded?: (caps: SystemCapabilities) => void;
  onSwitchMode: (mode: 'login' | 'register') => void;
  onAuthenticated: (user: PublicUser, isNewAccount: boolean) => void;
  onBackToLanding: () => void;
}

export function AuthPage({
  mode,
  initialNotice = null,
  capabilities,
  onCapabilitiesLoaded,
  onSwitchMode,
  onAuthenticated,
  onBackToLanding,
}: AuthPageProps) {
  const { L } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingGithub, setCheckingGithub] = useState(false);
  const [notice, setNotice] = useState<AuthNotice | null>(initialNotice);

  useEffect(() => {
    if (capabilities !== null) return;
    let cancelled = false;
    api
      .getMe()
      .then((me) => {
        if (!cancelled) onCapabilitiesLoaded?.(me.capabilities);
      })
      .catch(() => {
        // Backend may still be offline; handled on explicit action
      });
    return () => {
      cancelled = true;
    };
  }, [capabilities, onCapabilitiesLoaded]);

  function switchAuthMode(nextMode: 'login' | 'register') {
    if (nextMode === mode) return;
    setNotice(null);
    onSwitchMode(nextMode);
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      const { user } = await api.login({ email: email.trim(), password });
      onAuthenticated(user, false);
    } catch (err) {
      setNotice({
        tone: 'error',
        message: err instanceof Error ? err.message : L('Gagal masuk ke akun', 'Sign in failed'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      const { user } = await api.register({
        email: email.trim(),
        password,
        username: username.trim(),
        displayName: displayName.trim(),
        role: 'member',
      });
      onAuthenticated(user, true);
    } catch (err) {
      setNotice({
        tone: 'error',
        message:
          err instanceof Error ? err.message : L('Gagal membuat akun', 'Account creation failed'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const githubHref =
    mode === 'login' ? '/api/auth/github?intent=login' : '/api/auth/github?intent=register';

  async function handleGitHubCheckAndRedirect() {
    setNotice(null);
    if (capabilities && !capabilities.githubOAuthConfigured) {
      setNotice({
        tone: 'error',
        message: L(
          'GitHub OAuth membutuhkan GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET di .env. Silakan gunakan Email & Kata Sandi di bawah.',
          'GitHub OAuth requires GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in .env. Please use Email & Password below.',
        ),
      });
      return;
    }

    setCheckingGithub(true);
    try {
      const me = await api.getMe();
      onCapabilitiesLoaded?.(me.capabilities);
      if (me.capabilities.githubOAuthConfigured) {
        window.location.href = githubHref;
        return;
      }
      setNotice({
        tone: 'error',
        message: L(
          'GitHub OAuth membutuhkan GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET di .env. Silakan gunakan Email & Kata Sandi di bawah.',
          'GitHub OAuth requires GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in .env. Please use Email & Password below.',
        ),
      });
    } catch {
      const isLocal =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setNotice({
        tone: 'error',
        message: isLocal
          ? L(
              'Server backend API (port 4000) tidak merespons. Pastikan Anda menjalankan "npm run dev" (API + WEB), lalu coba lagi.',
              'Backend API server (port 4000) is not responding. Make sure you started both servers with "npm run dev", then try again.',
            )
          : L(
              'Layanan API server sedang tidak merespons. Silakan muat ulang halaman atau coba beberapa saat lagi.',
              'The API service is temporarily unavailable. Please refresh the page or try again shortly.',
            ),
      });
    } finally {
      setCheckingGithub(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#06070b] text-zinc-100 flex flex-col justify-between relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[780px] h-[420px] rounded-full bg-indigo-600/12 blur-[140px]" />
        <div className="bg-cp-grid absolute inset-0 opacity-75" />
      </div>

      {/* Minimal Top Bar */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-2.5 text-left cursor-pointer group"
        >
          <CodePulseLogo size="md" />
          <span className="font-bold tracking-tight text-white text-base">CodePulse</span>
        </button>

        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/[0.05] text-xs font-medium text-zinc-300 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{L('Kembali ke Ringkasan', 'Back to Overview')}</span>
          </button>
        </div>
      </header>

      {/* Centered Auth Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px] space-y-5"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="text-center space-y-2.5"
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border bg-white/[0.03] border-white/10 text-zinc-300">
                {mode === 'login' ? (
                  <>
                    <Lock className="w-3 h-3 text-cyan-400" />
                    <span>{L('Akses Akun Terdaftar', 'Existing Account Access')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>{L('Akun Baru • Pengaturan Terpandu', 'New Account • Guided Setup')}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {mode === 'login'
                  ? L('Selamat datang kembali', 'Welcome back')
                  : L('Buat akun Anda', 'Create your account')}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                {mode === 'login'
                  ? L(
                      'Langsung kembali ke workspace, review Gatekeeper, dan deployment Anda.',
                      'Jump straight back into your workspaces, Gatekeeper reviews, and deployments.',
                    )
                  : L(
                      'Buat identitas developer, lalu luncurkan workspace pertama Anda dalam 2 langkah cepat.',
                      'Create a developer identity, then launch your first workspace in 2 quick steps.',
                    )}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="cp-panel rounded-2xl p-6 sm:p-7 space-y-5">
            {/* Explicit Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-950/90 border border-white/8">
              <button
                type="button"
                onClick={() => switchAuthMode('login')}
                className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {L('Masuk', 'Sign In')}
              </button>
              <button
                type="button"
                onClick={() => switchAuthMode('register')}
                className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  mode === 'register'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {L('Daftar', 'Sign Up')}
              </button>
            </div>

            {/* Sign-Up Only: 3-step onboarding preview strip */}
            {mode === 'register' && (
              <div className="px-3 py-2 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/20 flex items-center justify-between gap-2 text-[10px] font-mono text-indigo-200/90">
                <span className="text-white font-semibold">{L('1. Akun', '1. Account')}</span>
                <span className="text-zinc-600">→</span>
                <span>{L('2. Hubungkan Stack', '2. Connect Stack')}</span>
                <span className="text-zinc-600">→</span>
                <span>{L('3. Workspace Pertama', '3. First Workspace')}</span>
              </div>
            )}

            <AnimatePresence>
              {notice && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
                    notice.tone === 'info'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {notice.tone === 'info' ? (
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{notice.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Intent-Specific GitHub OAuth CTA */}
            <div className="space-y-1.5">
              {capabilities?.githubOAuthConfigured ? (
                <a
                  href={githubHref}
                  className={`w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border font-semibold text-xs transition ${
                    mode === 'register'
                      ? 'bg-zinc-900 hover:bg-zinc-800 border-indigo-500/35 text-white shadow-[0_0_24px_-8px_rgba(99,102,241,0.45)]'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-white/12 text-zinc-100'
                  }`}
                >
                  <GitHubIcon className="w-4 h-4" />
                  <span>
                    {mode === 'login'
                      ? L('Masuk dengan GitHub', 'Sign in with GitHub')
                      : L('Daftar dengan GitHub', 'Sign up with GitHub')}
                  </span>
                  {mode === 'register' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      {L('Tercepat', 'Fastest')}
                    </span>
                  )}
                </a>
              ) : (
                <button
                  type="button"
                  disabled={checkingGithub}
                  onClick={() => void handleGitHubCheckAndRedirect()}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-900 border border-white/10 text-zinc-300 font-medium text-xs transition cursor-pointer disabled:opacity-50"
                >
                  <GitHubIcon className="w-4 h-4" />
                  <span>
                    {checkingGithub
                      ? L('Menghubungkan ke GitHub...', 'Connecting to GitHub...')
                      : mode === 'login'
                        ? L('Masuk dengan GitHub', 'Sign in with GitHub')
                        : L('Daftar dengan GitHub', 'Sign up with GitHub')}
                  </span>
                </button>
              )}
              <p className="text-[11px] text-zinc-500 text-center">
                {mode === 'login'
                  ? L(
                      'Untuk akun CodePulse yang sudah terhubung dengan GitHub.',
                      'For existing CodePulse accounts linked to GitHub.',
                    )
                  : L(
                      'Membuat akun baru dengan sinkronisasi repository langsung & membuka onboarding.',
                      'Creates a new account with live repo sync & launches onboarding.',
                    )}
              </p>
            </div>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-white/10" />
              <span className="px-3 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                {mode === 'login'
                  ? L('Atau masuk dengan email', 'Or sign in with email')
                  : L('Atau daftar dengan email', 'Or register with email')}
              </span>
              <div className="flex-grow border-t border-white/10" />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {mode === 'login' ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={handleLoginSubmit}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {L('Email Kerja', 'Work Email')}
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={L('anda@perusahaan.com', 'you@company.com')}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {L('Kata Sandi', 'Password')}
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={L('Masukkan kata sandi Anda', 'Enter your password')}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {submitting
                        ? L('Sedang masuk...', 'Signing in...')
                        : L('Masuk ke Konsol', 'Sign In to Console')}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={handleRegisterSubmit}
                  className="space-y-3.5"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        {L('Nama Lengkap', 'Full Name')}
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={L('Nama Lengkap Anda', 'Your Full Name')}
                        className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        {L('Username', 'Handle')}
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder={L('handle-anda', 'your-handle')}
                          className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {L('Email Kerja', 'Work Email')}
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={L('anda@perusahaan.com', 'you@company.com')}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {L('Kata Sandi', 'Password')}
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={L('Min. 6 karakter', 'Min. 6 characters')}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {submitting
                        ? L('Membuat Akun...', 'Creating Account...')
                        : L('Buat Akun & Mulai Pengaturan', 'Create Account & Start Setup')}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="pt-2 border-t border-white/[0.07] text-center text-xs text-zinc-400">
              {mode === 'login' ? (
                <>
                  <span>{L('Baru di CodePulse? ', 'New to CodePulse? ')}</span>
                  <button
                    type="button"
                    onClick={() => switchAuthMode('register')}
                    className="text-indigo-300 hover:text-indigo-200 font-semibold transition cursor-pointer"
                  >
                    {L('Buat akun baru', 'Create an account')}
                  </button>
                </>
              ) : (
                <>
                  <span>{L('Sudah punya akun? ', 'Already have an account? ')}</span>
                  <button
                    type="button"
                    onClick={() => switchAuthMode('login')}
                    className="text-indigo-300 hover:text-indigo-200 font-semibold transition cursor-pointer"
                  >
                    {L('Masuk sekarang', 'Sign in instead')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {L(
                'Dilindungi Vault AES-256-GCM & sesi HTTP-only bertanda tangan',
                'Protected by AES-256-GCM vault & signed HTTP-only sessions',
              )}
            </span>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 py-5 text-center text-[11px] text-zinc-600">
        {L('CodePulse — Hub Rekayasa Perangkat Lunak Enterprise', 'CodePulse Enterprise Engineering Hub')}
      </footer>
    </div>
  );
}
