'use client';

import { forwardRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ReceivedChatMessage } from '@livekit/components-react';
import { AgentControlBar } from '@/components/livekit/agent-control-bar/agent-control-bar';
import { ChatEntry } from '@/components/livekit/chat/chat-entry';
import { ChatMessageView } from '@/components/livekit/chat/chat-message-view';
import { DemoMediaTiles } from '@/components/livekit/demo-media-tiles';
import useChatAndTranscription from '@/hooks/useChatAndTranscription';
import { useDebugMode } from '@/hooks/useDebug';
import { cn } from '@/lib/utils';

interface DemoSessionViewProps {
  disabled: boolean;
  capabilities: {
    suportsChatInput: boolean;
    suportsVideoInput: boolean;
    suportsScreenShare: boolean;
  };
  sessionStarted: boolean;
}

// Custom SessionView for demos that respects column boundaries
export const DemoSessionView = forwardRef<HTMLDivElement, DemoSessionViewProps>(
  ({ disabled, capabilities, sessionStarted }, ref) => {
    const [chatOpen, setChatOpen] = useState(false);
    const { messages, send } = useChatAndTranscription();

    useDebugMode();

    async function handleSendMessage(message: string) {
      await send(message);
    }

    return (
      <main
        ref={ref}
        inert={disabled}
        className={cn(
          'absolute inset-0 overflow-hidden',
          !chatOpen && 'max-h-full'
        )}
      >
        <ChatMessageView
          className={cn(
            'mx-auto min-h-full w-full max-w-2xl px-3 pt-32 pb-40 transition-[opacity,translate] duration-300 ease-out md:px-0 md:pt-36 md:pb-48',
            chatOpen ? 'translate-y-0 opacity-100 delay-200' : 'translate-y-20 opacity-0'
          )}
        >
          <div className="space-y-3 whitespace-pre-wrap">
            <AnimatePresence>
              {messages.map((message: ReceivedChatMessage) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 1, height: 'auto', translateY: 0.001 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <ChatEntry hideName key={message.id} entry={message} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ChatMessageView>

        <div className="bg-background absolute top-0 right-0 left-0 h-32 md:h-36">
          {/* skrim */}
          <div className="from-background absolute bottom-0 left-0 h-12 w-full translate-y-full bg-gradient-to-b to-transparent" />
        </div>

        <DemoMediaTiles chatOpen={chatOpen} />

        <div className="bg-background absolute right-0 bottom-0 left-0 z-50 px-3 pt-2 pb-3 md:px-6 md:pb-6">
          <motion.div
            key="control-bar"
            initial={{ opacity: 0, translateY: '100%' }}
            animate={{
              opacity: sessionStarted ? 1 : 0,
              translateY: sessionStarted ? '0%' : '100%',
            }}
            transition={{ duration: 0.3, delay: sessionStarted ? 0.5 : 0, ease: 'easeOut' }}
          >
            <div className="relative z-10 mx-auto w-full max-w-2xl">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: sessionStarted && messages.length === 0 ? 1 : 0,
                  transition: {
                    ease: 'easeIn',
                    delay: messages.length > 0 ? 0 : 0.8,
                    duration: messages.length > 0 ? 0.2 : 0.5,
                  },
                }}
                aria-hidden={messages.length > 0}
                className={cn(
                  'absolute inset-x-0 -top-12 text-center',
                  sessionStarted && messages.length === 0 && 'pointer-events-none'
                )}
              >
                <p className="animate-text-shimmer inline-block !bg-clip-text text-sm font-semibold text-transparent">
                  Agent is listening, ask it a question
                </p>
              </motion.div>

              <AgentControlBar
                capabilities={capabilities}
                onChatOpenChange={setChatOpen}
                onSendMessage={handleSendMessage}
              />
            </div>
            {/* skrim */}
            <div className="from-background border-background absolute top-0 left-0 h-12 w-full -translate-y-full bg-gradient-to-t to-transparent" />
          </motion.div>
        </div>
      </main>
    );
  }
);