import { cn } from '@shared/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps): React.ReactNode {
  return (
    <div className="border-border my-6 overflow-x-auto rounded-lg border">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }): React.ReactNode {
  return <thead className="bg-muted/50">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }): React.ReactNode {
  return <tbody className="divide-border divide-y">{children}</tbody>;
}

export function TableRow({ children }: { children: React.ReactNode }): React.ReactNode {
  return <tr>{children}</tr>;
}

export function TableHead({ children }: { children: React.ReactNode }): React.ReactNode {
  return <th className="text-foreground px-4 py-3 text-left font-medium">{children}</th>;
}

export function TableCell({ children }: { children: React.ReactNode }): React.ReactNode {
  return <td className="text-muted-foreground px-4 py-3">{children}</td>;
}
