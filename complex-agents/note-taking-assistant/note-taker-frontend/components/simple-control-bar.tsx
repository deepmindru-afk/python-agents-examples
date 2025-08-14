'use client';

import React from 'react';
import { Track } from 'livekit-client';
import { useTrackToggle, useRoomContext } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { MicrophoneIcon, MicrophoneSlashIcon, PhoneDisconnectIcon } from '@phosphor-icons/react/dist/ssr';

export const SimpleControlBar = () => {
  const { buttonProps: micButtonProps, enabled: micEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  const room = useRoomContext();

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mic toggle button */}
      <Button
        {...micButtonProps}
        size="lg"
        className={`rounded-full p-4 ${
          micEnabled 
            ? "bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-300" 
            : "bg-red-500 hover:bg-red-600 text-white"
        }`}
      >
        {micEnabled ? <MicrophoneIcon size={24} /> : <MicrophoneSlashIcon size={24} />}
      </Button>

      {/* Leave call button */}
      <Button
        onClick={() => room.disconnect()}
        size="lg"
        className="rounded-full px-6 py-4 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white"
      >
        <PhoneDisconnectIcon size={24} />
        <span>Leave Call</span>
      </Button>
    </div>
  );
};