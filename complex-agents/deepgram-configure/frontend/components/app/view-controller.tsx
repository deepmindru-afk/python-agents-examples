'use client';

import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { KeytermPanel } from '@/components/app/keyterm-panel';
import { WelcomeView } from '@/components/app/welcome-view';
import { useKeytermRpc } from '@/hooks/useKeytermRpc';

const MotionWelcomeView = motion.create(WelcomeView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
}

export function ViewController({ appConfig }: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const { keyterms, addKeyterm, sending } = useKeytermRpc();

  return (
    <AnimatePresence mode="wait">
      {/* Welcome view */}
      {!isConnected && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStartCall={start}
        />
      )}
      {/* Session view */}
      {isConnected && (
        <motion.div key="session-view" {...VIEW_MOTION_PROPS} className="fixed inset-0 flex">
          {/* Main session area */}
          <div
            className="relative flex-1"
            style={
              {
                '--background': '#060d0b',
                '--card': '#0a1210',
              } as React.CSSProperties
            }
          >
            <AgentSessionView_01
              supportsChatInput={appConfig.supportsChatInput}
              supportsVideoInput={appConfig.supportsVideoInput}
              supportsScreenShare={appConfig.supportsScreenShare}
              isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
              audioVisualizerType={appConfig.audioVisualizerType}
              audioVisualizerColor={
                resolvedTheme === 'dark'
                  ? appConfig.audioVisualizerColorDark
                  : appConfig.audioVisualizerColor
              }
              audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
              audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
              audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
              audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
              audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
              audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
              audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
              className="h-full w-full"
            />
          </div>

          {/* Right panel — Keyterm configuration */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
            className="hidden w-80 flex-col border-l border-emerald-500/[0.06] bg-[#040a08] md:flex"
          >
            {/* Panel header */}
            <div className="border-b border-emerald-500/[0.06] px-5 py-4">
              <h2 className="text-sm font-semibold text-white/80">Speech Recognition</h2>
              <p className="mt-0.5 text-xs text-white/30">
                Boost transcription accuracy for specific terms
              </p>
            </div>

            {/* Keyterm input area */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <KeytermPanel keyterms={keyterms} sending={sending} onAddKeyterm={addKeyterm} />
            </div>

            {/* Panel footer */}
            <div className="border-t border-emerald-500/[0.06] px-5 py-3">
              <p className="text-[10px] text-white/20">
                Keyterms are sent to Deepgram STTv2 via{' '}
                <span className="font-mono text-emerald-500/40">update_options</span>
              </p>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
