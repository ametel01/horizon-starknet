import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps): React.ReactNode {
  // Extract language from className (e.g., "language-typescript")
  const language = className?.replace('language-', '') || 'text';

  return (
    <div className="relative">
      {language !== 'text' && (
        <span className="text-muted-foreground absolute right-3 top-2 text-xs">{language}</span>
      )}
      <code className={cn('block font-mono text-sm', className)}>{children}</code>
    </div>
  );
}
