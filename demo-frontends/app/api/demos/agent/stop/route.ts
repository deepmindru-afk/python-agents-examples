import { NextResponse, NextRequest } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

export async function POST(request: NextRequest) {
  try {
    const { agentPath } = await request.json();

    if (!agentPath) {
      return NextResponse.json(
        { error: 'Missing agentPath' },
        { status: 400 }
      );
    }

    await agentManager.stopAgent(agentPath);

    return NextResponse.json({ 
      success: true,
      message: `Agent stopped: ${agentPath}` 
    });
  } catch (error) {
    console.error('Error stopping agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop agent' },
      { status: 500 }
    );
  }
}