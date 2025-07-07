import { NextRequest, NextResponse } from 'next/server';
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

    await appDemoManager.stopAppDemo(demoKey);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Failed to stop app demo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop app demo' },
      { status: 500 }
    );
  }
}