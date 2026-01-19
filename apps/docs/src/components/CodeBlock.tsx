import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = 'bash',
  filename,
  showLineNumbers = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.trim().split('\n');

  return (
    <div className="relative group">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-industrial-bg border border-b-0 border-industrial-border rounded-t-lg">
          <span className="text-xs font-mono text-muted-foreground">{filename}</span>
          <span className="text-xs font-mono text-warning/50">{language}</span>
        </div>
      )}
      <div
        className={cn(
          'relative bg-industrial-bg border border-industrial-border overflow-hidden',
          filename ? 'rounded-b-lg' : 'rounded-lg'
        )}
      >
        <button
          onClick={copyToClipboard}
          className={cn(
            'absolute top-3 right-3 p-2 rounded-md transition-all',
            'bg-industrial-card/80 border border-industrial-border',
            'text-muted-foreground hover:text-warning hover:border-warning/50',
            'opacity-0 group-hover:opacity-100 focus:opacity-100'
          )}
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        <pre className="p-4 overflow-x-auto text-sm">
          <code className="font-mono">
            {lines.map((line, idx) => (
              <div key={idx} className="flex">
                {showLineNumbers && (
                  <span className="select-none text-muted-foreground/50 w-8 flex-shrink-0 text-right pr-4">
                    {idx + 1}
                  </span>
                )}
                <span className="text-gray-300">{highlightLine(line, language)}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Simple syntax highlighting
function highlightLine(line: string, language: string): React.ReactNode {
  if (language === 'bash' || language === 'shell') {
    // Highlight commands, flags, and strings
    return line.split(/(\s+)/).map((part, idx) => {
      if (part.startsWith('--')) {
        return <span key={idx} className="text-amber-400">{part}</span>;
      }
      if (part.startsWith('-') && part.length === 2) {
        return <span key={idx} className="text-amber-400">{part}</span>;
      }
      if (part === 'bun' || part === 'npm' || part === 'git') {
        return <span key={idx} className="text-warning">{part}</span>;
      }
      if (part === 'run' || part === 'install' || part === 'build') {
        return <span key={idx} className="text-emerald-400">{part}</span>;
      }
      if (part.startsWith('"') || part.startsWith("'")) {
        return <span key={idx} className="text-amber-300">{part}</span>;
      }
      return part;
    });
  }

  if (language === 'json') {
    // Highlight JSON keys and values
    if (line.includes(':')) {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':');
      return (
        <>
          <span className="text-warning">{key}</span>
          <span className="text-gray-500">:</span>
          <span className="text-amber-300">{value}</span>
        </>
      );
    }
    return line;
  }

  if (language === 'typescript' || language === 'ts') {
    // Basic TypeScript highlighting
    const keywords = ['const', 'let', 'var', 'function', 'return', 'import', 'from', 'export', 'type', 'interface', 'async', 'await'];
    let result = line;
    
    return line.split(/(\s+|[{}()[\];,])/).map((part, idx) => {
      if (keywords.includes(part)) {
        return <span key={idx} className="text-purple-400">{part}</span>;
      }
      if (part.startsWith('"') || part.startsWith("'") || part.startsWith('`')) {
        return <span key={idx} className="text-amber-300">{part}</span>;
      }
      if (/^\d+$/.test(part)) {
        return <span key={idx} className="text-warning">{part}</span>;
      }
      return part;
    });
  }

  return line;
}
