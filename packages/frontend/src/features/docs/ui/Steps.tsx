import { cn } from '@shared/lib/utils';

interface StepsProps {
  children: React.ReactNode;
  className?: string;
}

export function Steps({ children, className }: StepsProps): React.ReactNode {
  return (
    <div className={cn('border-border my-6 ml-4 space-y-6 border-l-2 pl-6', className)}>
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
      {step !== undefined && step > 0 && (
        <div className="bg-primary text-primary-foreground absolute -left-10 flex size-7 items-center justify-center rounded-full text-sm font-medium">
          {step}
        </div>
      )}
      <h3 className="text-foreground mb-2 font-medium">{title}</h3>
      <div className="text-muted-foreground space-y-2 text-sm">{children}</div>
    </div>
  );
}
