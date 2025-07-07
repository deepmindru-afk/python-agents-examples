import { NextResponse, NextRequest } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

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
    } else if (currentDir.endsWith('demo-frontends')) {
      // We're running from demo-frontends, need to go up one level
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: agentPath, code } = body;
    
    if (!agentPath || !code) {
      return new NextResponse('Missing path or code parameter', { status: 400 });
    }
    
    // Construct the full path to the Python file
    const currentDir = process.cwd();
    console.log('PUT - Current directory:', currentDir);
    console.log('PUT - Agent path received:', agentPath);
    
    let basePath: string;
    if (currentDir.includes('agent-starter-react')) {
      basePath = path.join(currentDir, '..');
    } else if (currentDir.endsWith('demo-frontends')) {
      basePath = path.join(currentDir, '..');
    } else if (currentDir.endsWith('demo-monolith')) {
      basePath = currentDir;
    } else {
      basePath = path.join(currentDir, 'demo-monolith');
    }
    
    console.log('PUT - Base path:', basePath);
    
    const fullPath = path.join(basePath, agentPath.startsWith('/') ? agentPath.slice(1) : agentPath);
    console.log('PUT - Full path to write:', fullPath);
    
    // Security check: ensure the path doesn't escape our directory
    const normalizedPath = path.normalize(fullPath);
    const normalizedBase = path.normalize(basePath);
    if (!normalizedPath.startsWith(normalizedBase)) {
      return new NextResponse('Invalid path', { status: 403 });
    }
    
    // Additional security check: only allow writing to .py files
    if (!normalizedPath.endsWith('.py')) {
      return new NextResponse('Can only edit Python files', { status: 403 });
    }
    
    // Write the file
    console.log(`Writing to file: ${normalizedPath} at ${new Date().toISOString()}`);
    console.log(`Code length: ${code.length} characters`);
    
    // Use writeFileSync for immediate write
    const fs = await import('fs');
    fs.writeFileSync(normalizedPath, code, 'utf-8');
    
    // Touch the file to ensure modification time changes
    const now = new Date();
    fs.utimesSync(normalizedPath, now, now);
    
    // Verify the file was written
    const writtenContent = fs.readFileSync(normalizedPath, 'utf-8');
    console.log(`File written, verification read ${writtenContent.length} characters`);
    console.log(`Content matches: ${writtenContent === code}`);
    
    // Small delay to ensure filesystem sync
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response = NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      path: normalizedPath,
      codeLength: code.length 
    });
    
    // Add cache control headers to prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    
    return response;
  } catch (error) {
    console.error('Error writing agent code:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}