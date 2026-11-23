import { ExternalLink, HelpCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18nContext.ts';

interface VercelTokenGuideProps {
  compact?: boolean;
  className?: string;
}

export function VercelTokenGuide({ compact = false, className = '' }: VercelTokenGuideProps) {
  const { L } = useLanguage();

  const steps = [
    {
      step: '1',
      text: (
        <>
          {L('Masuk ke akun Vercel Anda lalu buka ', 'Log in to your Vercel account and open ')}
          <a
            href="https://vercel.com/account/tokens"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 underline underline-offset-2 font-medium"
          >
            <span>Account Settings → Tokens</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          .
        </>
      ),
    },
    {
      step: '2',
      text: (
        <>
          {L('Klik ', 'Click ')}
          <strong className="text-zinc-200">Create Token</strong>
          {L(', beri nama (mis. ', ', give it a name (e.g. ')}
          <code className="px-1 py-0.5 rounded bg-white/5 font-mono text-[11px] text-cyan-300">
            CodePulse
          </code>
          {L(
            '), pilih cakupan akun atau tim Anda, lalu salin token yang dihasilkan.',
            '), choose your account or team scope, and copy the generated token.',
          )}
        </>
      ),
    },
    {
      step: '3',
      text: (
        <>
          {L('Tempel token ke kolom ', 'Paste the token into ')}
          <code className="px-1 py-0.5 rounded bg-white/5 font-mono text-[11px] text-zinc-200">
            Vercel Personal Access Token
          </code>{' '}
          {L('lalu klik ', 'and click ')}
          <strong className="text-zinc-200">{L('Simpan Token', 'Save Token')}</strong>{' '}
          {L('hingga statusnya berubah menjadi ', 'until the status turns ')}
          <strong className="text-emerald-300">{L('Terhubung', 'Linked')}</strong>.
        </>
      ),
    },
    {
      step: '4',
      text: (
        <>
          {L('Buka tab ', "Open your project's ")}
          <strong className="text-zinc-200">{L('Deployment', 'Deployments')}</strong>{' '}
          {L(
            'pada proyek Anda di CodePulse untuk mengatur framework, perintah build, direktori output, dan Environment Variables secara langsung—tanpa perlu impor manual di vercel.com.',
            'tab inside CodePulse to configure framework, build command, output directory, and env variables directly—no manual import on vercel.com required.',
          )}
        </>
      ),
    },
  ];

  return (
    <div
      className={`rounded-xl bg-zinc-950/90 border border-white/8 ${
        compact ? 'p-3.5 space-y-2.5' : 'p-4 space-y-3'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
            {L(
              'Cara mendapatkan & menghubungkan Token Vercel',
              'How to get & connect a Vercel token',
            )}
          </span>
        </div>
        <a
          href="https://vercel.com/account/tokens"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-indigo-200 shrink-0"
        >
          <span>{L('Buka Token Vercel', 'Open Vercel Tokens')}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <ol className="space-y-1.5 text-xs text-zinc-400 leading-relaxed">
        {steps.map((item) => (
          <li key={item.step} className="flex items-start gap-2">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono text-indigo-300 flex items-center justify-center shrink-0">
              {item.step}
            </span>
            <span>{item.text}</span>
          </li>
        ))}
      </ol>

      <div className="pt-2 border-t border-white/6 text-[11px] text-zinc-500 leading-relaxed">
        <strong className="text-zinc-300">{L('Opsional:', 'Optional:')}</strong>{' '}
        {L(
          'Jika belum terhubung atau belum ada proyek Vercel yang dipilih, deployment akan otomatis berjalan di pipeline simulasi CodePulse sehingga Gatekeeper dan Deployment tetap dapat diuji.',
          "When unlinked or no Vercel project is selected, deployments automatically run in CodePulse's simulated pipeline so Gatekeeper and Deployments can still be tested.",
        )}
      </div>
    </div>
  );
}

