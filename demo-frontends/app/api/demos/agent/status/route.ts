import { NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

export async function GET() {
  try {
    const runningAgents = agentManager.getRunningAgents();

    return NextResponse.json({ 
      agents: runningAgents,
      count: runningAgents.length
    });
  } catch (error) {
    console.error('Error getting agent status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get agent status' },
      { status: 500 }
    );
  }
}