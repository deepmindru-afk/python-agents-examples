'use client';

import * as React from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { toastAlert } from '@/components/alert-toast';
import { DemoSessionView } from '@/components/demo-session-view';
import { Toaster } from '@/components/ui/sonner';
import { DemoWelcome } from '@/components/demo-welcome';
import { DemoLayout } from '@/components/demo-layout';
import { CodePanel } from '@/components/code-panel';
import useDemoConnectionDetails from '@/hooks/useDemoConnectionDetails';
import type { AppConfig } from '@/lib/types';
import { DemoConfig } from '@/app/demos/demo-config';

const MotionSessionView = motion.create(DemoSessionView);
const MotionWelcome = motion.create(DemoWelcome);

interface DemoWrapperProps {
  demoKey: string;
  demo: DemoConfig;
  appConfig: AppConfig;
}

export default function DemoWrapper({ demoKey, demo, appConfig }: DemoWrapperProps) {
  const [sessionStarted, setSessionStarted] = React.useState(false);
  const [appDemoUrl, setAppDemoUrl] = React.useState<string | null>(null);
  const [appDemoLoading, setAppDemoLoading] = React.useState(false);
  const { startButtonText } = appConfig;

  const connectionDetails = useDemoConnectionDetails({ 
    demoKey, 
    agentPath: demo.agentPath
  });

  const room = React.useMemo(() => new Room(), []);

  // Start app demo if this is an app type demo
  React.useEffect(() => {
    if (demo.type !== 'app') return;

    console.log(`Starting app demo: ${demoKey}`);
    setAppDemoLoading(true);

    const startAppDemo = async () => {
      try {
        const response = await fetch('/api/demos/app-demo/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demoKey }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to start app demo');
        }

        const { status } = await response.json();
        if (status.url) {
          setAppDemoUrl(status.url);
        }
      } catch (error) {
        console.error('Failed to start app demo:', error);
        toastAlert({
          title: 'Failed to start app demo',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setAppDemoLoading(false);
      }
    };

    startAppDemo();

    // Cleanup: stop app demo on unmount
    return () => {
      console.log(`Stopping app demo: ${demoKey}`);
      fetch('/api/demos/app-demo/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoKey }),
      }).catch(error => {
        console.error('Failed to stop app demo:', error);
      });
    };
  }, [demo.type, demoKey]);

  // Start agent on component mount
  React.useEffect(() => {
    if (!demo.agentPath) return;

    console.log(`Starting agent for demo: ${demoKey}`);
    
    const startAgent = async () => {
      try {
        const response = await fetch('/api/demos/agent/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentPath: demo.agentPath,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to start agent');
        }
        
        console.log('Agent started successfully');
      } catch (error) {
        console.error('Failed to start agent:', error);
        toastAlert({
          title: 'Failed to start agent',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    startAgent();

    // Cleanup: stop agent on unmount
    return () => {
      if (demo.agentPath) {
        console.log(`Stopping agent for demo: ${demoKey}`);
        fetch('/api/demos/agent/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentPath: demo.agentPath }),
        }).catch(error => {
          console.error('Failed to stop agent:', error);
        });
      }
    };
  }, [demo.agentPath, demoKey]);

  React.useEffect(() => {
    const onDisconnected = () => {
      setSessionStarted(false);
    };
    const onMediaDevicesError = (error: Error) => {
      toastAlert({
        title: 'Encountered an error with your media devices',
        description: `${error.name}: ${error.message}`,
      });
    };
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room]);

  React.useEffect(() => {
    if (sessionStarted && room.state === 'disconnected' && connectionDetails) {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: true,
        }),
        room.connect(connectionDetails.serverUrl, connectionDetails.participantToken),
      ]).catch((error) => {
        toastAlert({
          title: 'There was an error connecting to the agent',
          description: `${error.name}: ${error.message}`,
        });
      });
    }
    return () => {
      room.disconnect();
    };
  }, [room, sessionStarted, connectionDetails]);

  // Render app demo in iframe if it's an app type
  if (demo.type === 'app') {
    return (
      <DemoLayout
        codePanel={
          <CodePanel 
            agentPath={demo.agentPath} 
            demoKey={demoKey}
            isAppDemo={true}
          />
        }
      >
        <div className="relative h-full w-full">
          {appDemoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Starting app demo...</p>
              </div>
            </div>
          )}
          
          {appDemoUrl && !appDemoLoading && (
            <iframe
              src={appDemoUrl}
              className="h-full w-full border-0"
              allow="camera; microphone"
              title={`${demo.name} Demo`}
            />
          )}

          <Toaster />
        </div>
      </DemoLayout>
    );
  }

  // Standard component demo rendering
  return (
    <DemoLayout
      codePanel={<CodePanel agentPath={demo.agentPath} />}
    >
      <div className="relative h-full w-full">
        <MotionWelcome
          key="welcome"
          startButtonText={startButtonText}
          onStartCall={() => setSessionStarted(true)}
          disabled={sessionStarted}
          demo={demo}
          initial={{ opacity: 0 }}
          animate={{ opacity: sessionStarted ? 0 : 1 }}
          transition={{ duration: 0.5, ease: 'linear', delay: sessionStarted ? 0 : 0.5 }}
        />

        <RoomContext.Provider value={room}>
          <RoomAudioRenderer />
          <StartAudio label="Start Audio" />
          <MotionSessionView
            key="session-view"
            capabilities={demo.capabilities}
            sessionStarted={sessionStarted}
            disabled={!sessionStarted}
            initial={{ opacity: 0 }}
            animate={{ opacity: sessionStarted ? 1 : 0 }}
            transition={{
              duration: 0.5,
              ease: 'linear',
              delay: sessionStarted ? 0.5 : 0,
            }}
          />
        </RoomContext.Provider>

        <Toaster />
      </div>
    </DemoLayout>
  );
}