import { Mic, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div
      ref={ref}
      className="min-h-svh bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950"
    >
      <section className="flex min-h-svh flex-col items-center justify-center text-center">
        {/* Icon */}
        <div className="relative mb-6">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-lg shadow-emerald-500/5">
            <Mic className="size-7 text-emerald-400" />
          </div>
          <div className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-md bg-emerald-500/25">
            <Sparkles className="size-3 text-emerald-300" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-white/90">
          Deepgram Keyterm Demo
        </h1>
        <p className="text-muted-foreground mb-1 max-w-sm text-sm leading-relaxed">
          Test real-time STT keyterm boosting with Deepgram Flux. Add terms during a live
          conversation and hear the difference.
        </p>

        {/* Example terms */}
        <div className="mt-4 mb-8 flex flex-wrap justify-center gap-1.5">
          {['Sulfamethoxazole', 'Lisinopril', 'Metformin'].map((term) => (
            <span
              key={term}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-white/30"
            >
              {term}
            </span>
          ))}
        </div>

        <Button
          size="lg"
          onClick={onStartCall}
          className="w-56 rounded-full bg-emerald-600 font-mono text-xs font-bold tracking-wider text-white uppercase hover:bg-emerald-500"
        >
          {startButtonText}
        </Button>
      </section>
    </div>
  );
};
