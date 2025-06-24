import { NextResponse, NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentPath = searchParams.get('path');
    
    if (!agentPath) {
      return new NextResponse('Missing path parameter', { status: 400 });
    }
    
    // Construct the full path to the Python file
    // The __filename approach doesn't work in ES modules, so we use import.meta.url
    // From the error, we know the file should be at:
    // /Users/shayne/Development/Livekit/Demos/mono-demo/demo-monolith/pipeline-stt/...
    
    const currentDir = process.cwd();
    console.log('Current directory:', currentDir);
    
    // Based on the error message, we need to ensure we're looking in demo-monolith
    let basePath: string;
    if (currentDir.includes('agent-starter-react')) {
      // We're running from inside agent-starter-react
      basePath = path.join(currentDir, '..');
    } else if (currentDir.endsWith('demo-monolith')) {
      // We're already in demo-monolith
      basePath = currentDir;
    } else {
      // We might be in mono-demo, so we need to go into demo-monolith
      basePath = path.join(currentDir, 'demo-monolith');
    }
    
    const fullPath = path.join(basePath, agentPath.startsWith('/') ? agentPath.slice(1) : agentPath);
    console.log('Looking for file at:', fullPath);
    
    // Security check: ensure the path doesn't escape our directory
    const normalizedPath = path.normalize(fullPath);
    const normalizedBase = path.normalize(basePath);
    if (!normalizedPath.startsWith(normalizedBase)) {
      return new NextResponse('Invalid path', { status: 403 });
    }
    
    // Read the file
    const code = await readFile(normalizedPath, 'utf-8');
    
    return NextResponse.json({ code });
  } catch (error) {
    console.error('Error reading agent code:', error);
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return new NextResponse('File not found', { status: 404 });
    }
    return new NextResponse('Internal server error', { status: 500 });
  }
}