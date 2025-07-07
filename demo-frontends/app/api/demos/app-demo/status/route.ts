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

    const status = await appDemoManager.getAppDemoStatus(demoKey);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get app demo status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get app demo status' },
      { status: 500 }
    );
  }
}