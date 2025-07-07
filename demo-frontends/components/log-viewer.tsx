'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface LogViewerProps {
  agentPath?: string;
  demoKey?: string;
  isAppDemo?: boolean;
  className?: string;
}

export function LogViewer({ agentPath, demoKey, isAppDemo, className }: LogViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (!agentPath) return;

    // Always use EventSource for Python agent logs
    const eventSource = new EventSource(`/api/demos/agent/logs?agentPath=${encodeURIComponent(agentPath)}`);

    eventSource.onopen = () => {
      setConnected(true);
      console.log('Connected to log stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev, data.log]);
      } catch (error) {
        console.error('Failed to parse log data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setConnected(false);
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [agentPath]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Detect manual scroll
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      autoScrollRef.current = isAtBottom;
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!agentPath) {
    return null;
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-t">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Agent Logs</h3>
          <div className={cn(
            "w-2 h-2 rounded-full",
            connected ? "bg-green-500" : "bg-red-500"
          )} />
        </div>
        <button
          onClick={clearLogs}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-black/95 p-4 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground">Waiting for logs...</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={cn(
                "whitespace-pre-wrap break-all",
                log.includes('[ERROR]') && "text-red-400",
                log.includes('[EXIT]') && "text-yellow-400",
                !log.includes('[ERROR]') && !log.includes('[EXIT]') && "text-green-400"
              )}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}