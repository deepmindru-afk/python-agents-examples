import React, { useMemo } from 'react';
import { Track } from 'livekit-client';
import { AnimatePresence, motion } from 'motion/react';
import {
  type TrackReference,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { AgentTile } from './agent-tile';
import { AvatarTile } from './avatar-tile';
import { VideoTile } from './video-tile';

const MotionVideoTile = motion.create(VideoTile);
const MotionAgentTile = motion.create(AgentTile);
const MotionAvatarTile = motion.create(AvatarTile);

const animationProps = {
  initial: {
    opacity: 0,
    scale: 0,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0,
  },
  transition: {
    type: 'spring',
    stiffness: 675,
    damping: 75,
    mass: 1,
  },
};

const classNames = {
  // GRID
  grid: [
    'h-full w-full',
    'grid gap-x-2 place-content-center',
    'grid-cols-[1fr_1fr] grid-rows-[1fr_auto_1fr]',
  ],
  // Agent
  agentChatClosed: 'col-span-full row-start-2 flex items-center justify-center',
  agentChatOpenWithSecondTile: 'col-span-1 row-span-1 col-start-1 row-start-1',
  agentChatOpenWithoutSecondTile: 'col-span-1 row-span-1 col-start-1 row-start-1',
  // User's Tiles (camera/screen)
  secondTileChatOpen: 'col-span-1 row-span-1 col-start-2 row-start-1',
  secondTileChatClosed: 'col-span-full row-start-3',
};

interface DemoMediaTilesProps {
  chatOpen: boolean;
}

export function DemoMediaTiles({ chatOpen }: DemoMediaTilesProps) {
  const tracks = useTracks();
  const {
    state: agentState,
    audioTrack: agentAudioTrack,
    videoTrack: agentVideoTrack,
    agent: { isActive: isAgentActive = false } = {},
  } = useVoiceAssistant();
  const localParticipant = useLocalParticipant();

  const cameraTrack: TrackReference | undefined = useMemo(
    () =>
      tracks.find(
        (track) =>
          track.participant.sid === localParticipant.localParticipant.sid &&
          track.track?.kind === Track.Kind.Video &&
          track.track?.source === Track.Source.Camera
      ),
    [localParticipant, tracks]
  );

  const screenShareTrack: TrackReference | undefined = useMemo(
    () =>
      tracks.find(
        (track) =>
          track.participant.sid === localParticipant.localParticipant.sid &&
          track.track?.kind === Track.Kind.Video &&
          track.track?.source === Track.Source.ScreenShare
      ),
    [localParticipant, tracks]
  );

  const isCameraEnabled = Boolean(cameraTrack?.publication?.isMuted === false);
  const isScreenShareEnabled = Boolean(screenShareTrack?.publication?.isMuted === false);
  const isAvatar = Boolean(agentVideoTrack);
  const hasSecondTile = isCameraEnabled || isScreenShareEnabled;

  const agentLayoutTransition = chatOpen
    ? { ...animationProps.transition, delay: 0.2 }
    : animationProps.transition;

  const avatarLayoutTransition = chatOpen
    ? { ...animationProps.transition, delay: 0.3 }
    : animationProps.transition;

  const agentAnimate = {
    ...animationProps.animate,
    scale: chatOpen ? 1 : 3,
    transition: agentLayoutTransition,
  };
  const avatarAnimate = {
    ...animationProps.animate,
    transition: avatarLayoutTransition,
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-8 bottom-32 z-40 md:top-12 md:bottom-40">
      <div className="relative mx-auto h-full max-w-2xl px-4 md:px-0">
        <div className={cn(classNames.grid)}>
          {/* agent */}
          {isAgentActive && (
            <div
              className={cn([
                'grid',
                !chatOpen && classNames.agentChatClosed,
                chatOpen && hasSecondTile && classNames.agentChatOpenWithSecondTile,
                chatOpen && !hasSecondTile && classNames.agentChatOpenWithoutSecondTile,
              ])}
            >
              <AnimatePresence mode="popLayout">
                {!isAvatar && (
                  <MotionAgentTile
                    key="agent"
                    layoutId="agent"
                    {...animationProps}
                    animate={agentAnimate}
                    transition={agentLayoutTransition}
                    state={agentState}
                    audioTrack={agentAudioTrack}
                    className={cn(
                      chatOpen ? 'h-[90px] w-[90px]' : 'h-[200px] w-[200px] mx-auto'
                    )}
                  />
                )}
                {isAvatar && (
                  <MotionAvatarTile
                    key="avatar"
                    layoutId="avatar"
                    {...animationProps}
                    animate={avatarAnimate}
                    transition={avatarLayoutTransition}
                    videoTrack={agentVideoTrack}
                    className={cn(
                      chatOpen ? 'h-[90px] [&>video]:h-[90px] [&>video]:w-auto' : 'h-auto w-full'
                    )}
                  />
                )}
              </AnimatePresence>
            </div>
          )}

          <div
            className={cn([
              'grid',
              chatOpen && classNames.secondTileChatOpen,
              !chatOpen && classNames.secondTileChatClosed,
            ])}
          >
            {/* camera */}
            <AnimatePresence>
              {cameraTrack && isCameraEnabled && (
                <MotionVideoTile
                  key="camera"
                  layout="position"
                  layoutId="camera"
                  {...animationProps}
                  trackRef={cameraTrack}
                  transition={{
                    ...animationProps.transition,
                    delay: chatOpen ? 0 : 0.15,
                  }}
                  className="h-[90px]"
                />
              )}
              {/* screen */}
              {isScreenShareEnabled && (
                <MotionVideoTile
                  key="screen"
                  layout="position"
                  layoutId="screen"
                  {...animationProps}
                  trackRef={screenShareTrack}
                  transition={{
                    ...animationProps.transition,
                    delay: chatOpen ? 0 : 0.15,
                  }}
                  className="h-[90px]"
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}