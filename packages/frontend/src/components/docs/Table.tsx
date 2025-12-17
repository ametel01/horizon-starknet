import { cn } from '@/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps): React.ReactNode {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }): React.ReactNode {
  return <thead className="bg-muted/50">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }): React.ReactNode {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({ children }: { children: React.ReactNode }): React.ReactNode {
  return <tr>{children}</tr>;
}

export function TableHead({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <th className="px-4 py-3 text-left font-medium text-foreground">{children}</th>
  );
}

export function TableCell({ children }: { children: React.ReactNode }): React.ReactNode {
  return <td className="px-4 py-3 text-muted-foreground">{children}</td>;
}
