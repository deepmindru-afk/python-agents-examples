import { NextRequest, NextResponse } from 'next/server';
import { appDemoManager } from '@/lib/app-demo-manager';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const demoKey = searchParams.get('demoKey');

    if (!demoKey) {
      return NextResponse.json(
        { error: 'demoKey is required' },
        { status: 400 }
      );
    }

    const logs = await appDemoManager.getAppDemoLogs(demoKey);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Failed to get app demo logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get app demo logs' },
      { status: 500 }
    );
  }
}