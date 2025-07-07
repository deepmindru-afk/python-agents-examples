import { NextRequest, NextResponse } from 'next/server';
import { demos } from '@/app/demos/demo-config';
import { appDemoManager } from '@/lib/app-demo-manager';

export async function POST(req: NextRequest) {
  try {
    const { demoKey } = await req.json();

    if (!demoKey) {
      return NextResponse.json(
        { error: 'demoKey is required' },
        { status: 400 }
      );
    }

    const demo = demos[demoKey];
    if (!demo || demo.type !== 'app' || !demo.appPath) {
      return NextResponse.json(
        { error: 'Invalid app demo' },
        { status: 400 }
      );
    }

    await appDemoManager.startAppDemo(
      demoKey,
      demo.appPath,
      demo.appPort || 3001
    );

    const status = await appDemoManager.getAppDemoStatus(demoKey);

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Failed to start app demo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start app demo' },
      { status: 500 }
    );
  }
}