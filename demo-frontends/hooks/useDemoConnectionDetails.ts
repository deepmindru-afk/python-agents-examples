import { useEffect, useState } from 'react';
import { ConnectionDetails } from '@/app/api/connection-details/route';

interface UseDemoConnectionDetailsProps {
  demoKey: string;
  agentPath?: string;
}

export default function useDemoConnectionDetails({ demoKey, agentPath }: UseDemoConnectionDetailsProps) {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);

  useEffect(() => {
    const url = new URL('/api/demos/connection-details', window.location.origin);
    url.searchParams.set('demo', demoKey);
    if (agentPath) {
      url.searchParams.set('agentPath', agentPath);
    }

    fetch(url.toString())
      .then((res) => res.json())
      .then((data) => {
        setConnectionDetails(data);
      });
  }, [demoKey, agentPath]);

  return connectionDetails;
}