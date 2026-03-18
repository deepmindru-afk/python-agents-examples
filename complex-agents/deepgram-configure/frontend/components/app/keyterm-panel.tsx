'use client';

import React, { useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';

interface KeytermPanelProps {
  keyterms: string[];
  sending: boolean;
  onAddKeyterm: (term: string) => void;
  onRemoveKeyterm?: (term: string) => void;
  className?: string;
}

export function KeytermPanel({
  keyterms,
  sending,
  onAddKeyterm,
  onRemoveKeyterm,
  className,
}: KeytermPanelProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !sending) {
      onAddKeyterm(input.trim());
      setInput('');
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-5 items-center justify-center rounded-md bg-emerald-500/15">
          <Sparkles className="size-3 text-emerald-400" />
        </div>
        <span className="font-mono text-[11px] font-semibold tracking-widest text-white/50 uppercase">
          STT Keyterms
        </span>
        {keyterms.length > 0 && (
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/30">
            {keyterms.length}
          </span>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="relative mb-3">
        <div
          className={cn(
            'flex items-center overflow-hidden rounded-xl border transition-all duration-200',
            focused
              ? 'border-emerald-500/40 bg-white/[0.06] shadow-[0_0_0_3px_rgba(16,185,129,0.08)]'
              : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12]'
          )}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Add a term, e.g. Sulfamethoxazole"
            disabled={sending}
            className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/25 focus:outline-none disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!input.trim() || sending}
            variant="ghost"
            className={cn(
              'mr-1.5 rounded-lg transition-all',
              input.trim() && !sending
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300'
                : 'text-white/15'
            )}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </form>

      {/* Tags */}
      <div className="flex min-h-[28px] flex-wrap gap-1.5">
        <AnimatePresence mode="popLayout">
          {keyterms.length === 0 && (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-0.5 text-xs text-white/20 italic"
            >
              No keyterms added yet
            </motion.p>
          )}
          {keyterms.map((term) => (
            <motion.span
              key={term}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="group inline-flex items-center gap-1 rounded-lg border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300/90"
            >
              {term}
              {onRemoveKeyterm && (
                <button
                  onClick={() => onRemoveKeyterm(term)}
                  className="ml-0.5 rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-emerald-500/20"
                >
                  <X className="size-2.5" />
                </button>
              )}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
