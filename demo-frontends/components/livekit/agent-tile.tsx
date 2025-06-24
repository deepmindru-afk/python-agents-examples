import { forwardRef } from 'react';
import { AgentState, BarVisualizer, TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';

interface AgentAudioTileProps {
  state: AgentState;
  audioTrack: TrackReference;
  className?: string;
}

export const AgentTile = forwardRef<HTMLDivElement, AgentAudioTileProps>(
  ({ state, audioTrack, className }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-center justify-center', className)}>
        <BarVisualizer
          barCount={5}
          state={state}
          options={{ minHeight: 16 }}
          trackRef={audioTrack}
          className="agent-visualizer"
        />
      </div>
    );
  }
);
