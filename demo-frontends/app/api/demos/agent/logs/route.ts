import { NextRequest } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentPath = searchParams.get('agentPath');

  if (!agentPath) {
    return new Response('Missing agentPath', { status: 400 });
  }

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial logs
  const existingLogs = agentManager.getLogs(agentPath);
  existingLogs.forEach(log => {
    writer.write(encoder.encode(`data: ${JSON.stringify({ log })}\n\n`));
  });

  // Set up real-time log listener
  const cleanup = agentManager.addLogListener(agentPath, (log) => {
    writer.write(encoder.encode(`data: ${JSON.stringify({ log })}\n\n`));
  });

  // Clean up on disconnect
  request.signal.addEventListener('abort', () => {
    cleanup();
    writer.close();
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}