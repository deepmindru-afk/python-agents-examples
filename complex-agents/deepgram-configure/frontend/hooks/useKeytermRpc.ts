'use client';

import { useCallback, useState } from 'react';
import { useSessionContext } from '@livekit/components-react';
import { ParticipantKind } from 'livekit-client';

export function useKeytermRpc() {
  const session = useSessionContext();
  const [keyterms, setKeyterms] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const addKeyterm = useCallback(
    async (term: string) => {
      if (!term.trim() || !session.room) return;

      setSending(true);
      try {
        // Find the agent participant
        const participants = Array.from(session.room.remoteParticipants.values());
        const agent = participants.find((p) => p.kind === ParticipantKind.AGENT);
        if (!agent) {
          console.warn('No agent participant found');
          return;
        }

        const response = await session.room.localParticipant.performRpc({
          destinationIdentity: agent.identity,
          method: 'stt.add_keyterm',
          payload: JSON.stringify({ term: term.trim() }),
        });

        const result = JSON.parse(response);
        if (result.ok && result.keyterms) {
          setKeyterms(result.keyterms);
        }
      } catch (err) {
        console.error('Failed to add keyterm:', err);
      } finally {
        setSending(false);
      }
    },
    [session.room]
  );

  return { keyterms, addKeyterm, sending };
}
