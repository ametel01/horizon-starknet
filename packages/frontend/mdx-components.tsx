import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';

import { Callout } from '@features/docs';
import { CodeBlock } from '@features/docs';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings with proper styling
    h1: ({ children }) => (
      <h1 className="text-foreground mt-8 mb-4 text-3xl font-bold first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-foreground border-border mt-8 mb-4 border-b pb-2 text-2xl font-semibold">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-foreground mt-6 mb-3 text-xl font-semibold">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-foreground mt-4 mb-2 text-lg font-medium">{children}</h4>
    ),

    // Paragraphs and text
    p: ({ children }) => <p className="text-muted-foreground mb-4 leading-7">{children}</p>,
    strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,

    // Links - internal and external
    a: ({ href, children }) => {
      const isExternal = href?.startsWith('http');
      if (isExternal) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline underline-offset-4"
          >
            {children}
          </a>
        );
      }
      return (
        <Link
          href={href || '#'}
          className="text-primary hover:text-primary/80 underline underline-offset-4"
        >
          {children}
        </Link>
      );
    },

    // Lists
    ul: ({ children }) => (
      <ul className="text-muted-foreground my-4 ml-6 list-disc space-y-2">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="text-muted-foreground my-4 ml-6 list-decimal space-y-2">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,

    // Code
    code: ({ children, className }) => {
      // Check if this is a code block (has language class) or inline code
      const isCodeBlock = className?.includes('language-');
      if (isCodeBlock) {
        return <CodeBlock className={className}>{children}</CodeBlock>;
      }
      return (
        <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-sm">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-muted my-4 overflow-x-auto rounded-lg p-4">{children}</pre>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-border text-muted-foreground my-4 border-l-4 pl-4 italic">
        {children}
      </blockquote>
    ),

    // Tables
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto">
        <table className="border-border w-full border-collapse border">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-border border-b">{children}</tr>,
    th: ({ children }) => (
      <th className="border-border text-foreground border px-4 py-2 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-border text-muted-foreground border px-4 py-2">{children}</td>
    ),

    // Horizontal rule
    hr: () => <hr className="border-border my-8" />,

    // Custom components
    Callout,

    ...components,
  };
}
