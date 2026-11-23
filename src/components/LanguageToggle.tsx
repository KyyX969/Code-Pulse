import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { type Locale, useLanguage } from '../lib/i18nContext.ts';

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

function IndonesiaFlagIcon({ className = 'w-4 h-3' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} rounded-[3px] ring-1 ring-white/15 shrink-0 overflow-hidden`}
      aria-hidden="true"
    >
      <rect width="24" height="8" fill="#DC2626" />
      <rect y="8" width="24" height="8" fill="#F8FAFC" />
    </svg>
  );
}

function EnglishFlagIcon({ className = 'w-4 h-3' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} rounded-[3px] ring-1 ring-white/15 shrink-0 overflow-hidden`}
      aria-hidden="true"
    >
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
      <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M12 0V16M0 8H24" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="2.8" />
    </svg>
  );
}

const LANGUAGE_OPTIONS: Array<{
  code: Locale;
  shortLabel: string;
  label: string;
  sublabel: string;
}> = [
  {
    code: 'id',
    shortLabel: 'ID',
    label: 'Indonesia',
    sublabel: 'Bahasa Indonesia',
  },
  {
    code: 'en',
    shortLabel: 'EN',
    label: 'English',
    sublabel: 'International',
  },
];

function FlagForLocale({ code, className }: { code: Locale; className?: string }) {
  return code === 'id' ? (
    <IndonesiaFlagIcon className={className} />
  ) : (
    <EnglishFlagIcon className={className} />
  );
}

export function LanguageToggle({ compact = false, className = '' }: LanguageToggleProps) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentOption =
    LANGUAGE_OPTIONS.find((item) => item.code === locale) ?? LANGUAGE_OPTIONS[0];

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={locale === 'id' ? 'Pilih Bahasa' : 'Select Language'}
        className={`inline-flex items-center gap-2 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border transition cursor-pointer ${
          open ? 'border-indigo-400/50 text-white' : 'border-white/12 hover:border-white/22 text-zinc-200'
        } ${compact ? 'px-2 py-1.5' : 'px-2.5 py-1.5'}`}
      >
        <FlagForLocale code={currentOption.code} className="w-[18px] h-3" />
        <span className="font-mono text-[11px] font-semibold tracking-wide">
          {currentOption.shortLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${
            open ? 'rotate-180 text-indigo-300' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label={locale === 'id' ? 'Daftar Bahasa' : 'Language Options'}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-48 rounded-xl bg-[#0c0e16]/98 border border-white/12 shadow-[0_18px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl p-1.5 z-50"
          >
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = opt.code === locale;
              return (
                <button
                  key={opt.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLocale(opt.code);
                    setOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between gap-2.5 text-left transition cursor-pointer ${
                    active
                      ? 'bg-indigo-500/15 border border-indigo-500/30 text-white'
                      : 'border border-transparent text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FlagForLocale code={opt.code} className="w-5 h-3.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight flex items-center gap-1.5">
                        <span>{opt.label}</span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {opt.shortLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">{opt.sublabel}</div>
                    </div>
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
