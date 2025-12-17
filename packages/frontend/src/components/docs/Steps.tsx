import { cn } from '@/lib/utils';

interface StepsProps {
  children: React.ReactNode;
  className?: string;
}

export function Steps({ children, className }: StepsProps): React.ReactNode {
  return (
    <div className={cn('my-6 ml-4 border-l-2 border-border pl-6 space-y-6', className)}>
      {children}
    </div>
  );
}

interface StepProps {
  title: string;
  step?: number;
  children: React.ReactNode;
}

export function Step({ title, step, children }: StepProps): React.ReactNode {
  return (
    <div className="relative">
      {step && (
        <div className="absolute -left-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
          {step}
        </div>
      )}
      <h3 className="text-foreground font-medium mb-2">{title}</h3>
      <div className="text-muted-foreground text-sm space-y-2">{children}</div>
    </div>
  );
}
