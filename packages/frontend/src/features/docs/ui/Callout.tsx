import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react';

import { cn } from '@shared/lib/utils';

type CalloutType = 'info' | 'warning' | 'danger' | 'tip';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const calloutConfig: Record<
  CalloutType,
  { icon: React.ElementType; containerClass: string; iconClass: string }
> = {
  info: {
    icon: Info,
    containerClass: 'border-primary/20 bg-primary/5',
    iconClass: 'text-primary',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-warning/20 bg-warning/5',
    iconClass: 'text-warning',
  },
  danger: {
    icon: AlertCircle,
    containerClass: 'border-destructive/20 bg-destructive/5',
    iconClass: 'text-destructive',
  },
  tip: {
    icon: Lightbulb,
    containerClass: 'border-secondary/20 bg-secondary/5',
    iconClass: 'text-secondary-foreground',
  },
};

export function Callout({ type = 'info', title, children }: CalloutProps): React.ReactNode {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn('my-4 rounded-lg border p-4', config.containerClass)}>
      <div className="flex gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', config.iconClass)} />
        <div className="min-w-0 flex-1">
          {title && <p className="text-foreground mb-1 font-medium">{title}</p>}
          <div className="text-muted-foreground text-sm [&>p]:mb-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
