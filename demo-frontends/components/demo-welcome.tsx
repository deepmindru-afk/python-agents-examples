import { forwardRef } from 'react';
import { CodeBlockIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { DemoConfig } from '@/app/demos/demo-config';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';

interface DemoWelcomeProps {
  disabled: boolean;
  startButtonText: string;
  onStartCall: () => void;
  demo: DemoConfig;
}

export const DemoWelcome = forwardRef<HTMLDivElement, DemoWelcomeProps>(
  ({ disabled, startButtonText, onStartCall, demo }, ref) => {
    return (
      <div
        ref={ref}
        inert={disabled}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-8"
      >
        <Link
          href="/demos"
          className="absolute top-8 left-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Back to demos
        </Link>
        
        <CodeBlockIcon size={64} className="mx-auto mb-4" />
        <h1 className="font-semibold text-2xl">{demo.name}</h1>
        <p className="text-muted-foreground max-w-prose pt-2 font-medium">
          {demo.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mt-4">
          {demo.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
        
        {demo.agentPath && (
          <p className="text-xs text-muted-foreground mt-4">
            Agent: <code className="bg-muted px-1 py-0.5 rounded">{demo.agentPath}</code>
          </p>
        )}
        
        <Button variant="primary" size="lg" onClick={onStartCall} className="mt-8 w-64 font-mono">
          {startButtonText}
        </Button>
      </div>
    );
  }
);