import { cn } from '@/shared/ui/cn';

interface FreeCutLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: {
    icon: 'w-5 h-5',
    text: 'text-base',
    gap: 'gap-1.5',
  },
  md: {
    icon: 'w-7 h-7',
    text: 'text-xl',
    gap: 'gap-2',
  },
  lg: {
    icon: 'w-10 h-10',
    text: 'text-3xl',
    gap: 'gap-3',
  },
};

import { Sparkles } from 'lucide-react';

export function FreeCutLogo({ variant = 'full', size = 'md', className }: FreeCutLogoProps) {
  const config = sizeConfig[size];

  if (variant === 'icon') {
    return <Sparkles className={cn(config.icon, 'text-primary', className)} />;
  }

  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <Sparkles className={cn(config.icon, 'text-primary')} />
      <span
        className={cn(
          config.text,
          'font-semibold tracking-tight text-foreground'
        )}
      >
        alMotion
      </span>
    </div>
  );
}

