interface CodePulseLogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-7 h-7 p-1 rounded-lg',
  md: 'w-8 h-8 p-1 rounded-xl',
  lg: 'w-11 h-11 p-1.5 rounded-2xl',
};

/** Renders the CodePulse brand mark extracted from icon.jfif inside a dark glass badge. */
export function CodePulseLogo({
  size = 'md',
  animated = false,
  className = '',
}: CodePulseLogoProps) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} bg-[#0d121a] border border-cyan-500/25 shadow-lg shadow-cyan-500/10 flex items-center justify-center shrink-0 select-none ${
        animated ? 'animate-pulse' : ''
      } ${className}`.trim()}
    >
      <img
        src="/codepulse-icon.png"
        alt="CodePulse"
        draggable={false}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

