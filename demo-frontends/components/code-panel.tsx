'use client';

import { useState, useEffect } from 'react';
import { Code, FileText, Copy, Check, Terminal, PencilSimple, X, FloppyDisk } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { SyntaxHighlighter } from '@/components/syntax-highlighter';
import { LogViewer } from '@/components/log-viewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodePanelProps {
  agentPath?: string;
  demoKey?: string;
  isAppDemo?: boolean;
  className?: string;
}

type ViewMode = 'code' | 'readme' | 'logs';

export function CodePanel({ agentPath, demoKey, isAppDemo, className }: CodePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [code, setCode] = useState<string>('');
  const [readme, setReadme] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Fetch code when component mounts or agentPath changes
  useEffect(() => {
    if (agentPath && viewMode === 'code' && !code) {
      setLoading(true);
      setError(null);
      
      const url = new URL('/api/agent-code', window.location.origin);
      url.searchParams.set('path', agentPath);
      
      fetch(url.toString())
        .then(res => {
          if (!res.ok) throw new Error('Failed to load code');
          return res.json();
        })
        .then(data => {
          setCode(data.code);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [agentPath, viewMode, code]);

  // Fetch README when switching to readme view
  useEffect(() => {
    if (agentPath && viewMode === 'readme' && !readme) {
      setLoading(true);
      setError(null);
      
      // Extract directory from agent path
      const dir = agentPath.substring(0, agentPath.lastIndexOf('/'));
      const readmePath = `${dir}/README.md`;
      
      const url = new URL('/api/agent-code', window.location.origin);
      url.searchParams.set('path', readmePath);
      
      fetch(url.toString())
        .then(res => {
          if (!res.ok) throw new Error('No README found');
          return res.json();
        })
        .then(data => {
          setReadme(data.code);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [agentPath, viewMode, readme]);

  const handleCopyCode = async () => {
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    }
  };

  const handleSaveCode = async () => {
    if (!agentPath || !editedCode) return;
    
    setSaving(true);
    setError(null);
    
    try {
      console.log(`Saving code to ${agentPath} at ${new Date().toISOString()}`);
      
      const response = await fetch(`/api/agent-code?t=${Date.now()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          path: agentPath,
          code: editedCode,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save code');
      }
      
      const result = await response.json();
      console.log(`Save completed at ${new Date().toISOString()}`, result);
      
      // Update the displayed code
      setCode(editedCode);
      setIsEditing(false);
      setEditedCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save code');
    } finally {
      setSaving(false);
    }
  };

  if (!agentPath) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No agent code available
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with toggle buttons */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">
            {viewMode === 'code' ? 'Agent Code' : viewMode === 'readme' ? 'README' : 'Agent Logs'}
          </h2>
          <p className="text-sm text-muted-foreground">{agentPath}</p>
        </div>
        <div className="flex gap-2">
          {viewMode === 'code' && code && !isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  setEditedCode(code);
                }}
                className="gap-2"
              >
                <PencilSimple size={16} />
                Edit
              </Button>
            </>
          )}
          {viewMode === 'code' && isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditedCode('');
                }}
                className="gap-2"
              >
                <X size={16} />
                Cancel
              </Button>
              <Button
                variant={editedCode.trim() !== code.trim() ? "primary" : "outline"}
                size="sm"
                onClick={handleSaveCode}
                disabled={saving || editedCode.trim() === code.trim()}
                className="gap-2"
              >
                <FloppyDisk size={16} />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
          <Button
            variant={viewMode === 'code' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('code')}
            className="gap-2"
          >
            <Code size={16} />
            Code
          </Button>
          <Button
            variant={viewMode === 'readme' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('readme')}
            className="gap-2"
          >
            <FileText size={16} />
            README
          </Button>
          <Button
            variant={viewMode === 'logs' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('logs')}
            className="gap-2"
          >
            <Terminal size={16} />
            Logs
          </Button>
        </div>
      </div>
      
      {/* Content area */}
      {viewMode === 'logs' ? (
        <LogViewer 
          agentPath={agentPath} 
          className="flex-1" 
        />
      ) : (
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading {viewMode}...</p>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">{error}</p>
            </div>
          )}
          
          {!loading && !error && viewMode === 'code' && code && (
            <div className="rounded-lg overflow-hidden h-full [&_.cm-editor]:h-full">
              <CodeMirror
                value={isEditing ? editedCode : code}
                onChange={(value) => {
                  if (isEditing) {
                    setEditedCode(value);
                  }
                }}
                theme={oneDark}
                extensions={[python()]}
                height="100%"
                readOnly={!isEditing}
                editable={isEditing}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  dropCursor: isEditing,
                  allowMultipleSelections: true,
                  indentOnInput: isEditing,
                  bracketMatching: true,
                  closeBrackets: isEditing,
                  autocompletion: isEditing,
                  rectangularSelection: true,
                  crosshairCursor: isEditing,
                  highlightSelectionMatches: true,
                  searchKeymap: true,
                }}
              />
            </div>
          )}
          
          {!loading && !error && viewMode === 'readme' && readme && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 mt-6">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-2xl font-bold mb-3 mt-5">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xl font-bold mb-2 mt-4">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-lg font-bold mb-2 mt-3">{children}</h4>,
                  h5: ({ children }) => <h5 className="text-base font-bold mb-1 mt-2">{children}</h5>,
                  h6: ({ children }) => <h6 className="text-sm font-bold mb-1 mt-2">{children}</h6>,
                  p: ({ children }) => <p className="mb-4">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="ml-4">{children}</li>,
                  pre: ({ children }) => (
                    <pre className="bg-muted rounded-lg p-4 overflow-x-auto my-4">{children}</pre>
                  ),
                  code: ({ node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const inline = node?.position?.start.line === node?.position?.end.line;
                    return !inline && match ? (
                      <SyntaxHighlighter
                        code={String(children).replace(/\n$/, '')}
                        language={match[1]}
                        className="text-sm !bg-[#2d2d2d] !m-0"
                      />
                    ) : (
                      <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {readme}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}