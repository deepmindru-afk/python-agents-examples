import { NextRequest, NextResponse } from 'next/server';
import { demos } from '@/app/demos/demo-config';

// Proxy handler for app demo API routes
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ demo: string; path: string[] }> }
) {
  return handleDemoApiRequest(req, params, 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ demo: string; path: string[] }> }
) {
  return handleDemoApiRequest(req, params, 'POST');
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ demo: string; path: string[] }> }
) {
  return handleDemoApiRequest(req, params, 'PUT');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ demo: string; path: string[] }> }
) {
  return handleDemoApiRequest(req, params, 'DELETE');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ demo: string; path: string[] }> }
) {
  return handleDemoApiRequest(req, params, 'PATCH');
}

async function handleDemoApiRequest(
  req: NextRequest,
  params: { params: Promise<{ demo: string; path: string[] }> },
  method: string
) {
  const { demo: demoKey, path } = await params.params;
  const demo = demos[demoKey];

  if (!demo || demo.type !== 'app') {
    return NextResponse.json(
      { error: 'Demo not found or not an app demo' },
      { status: 404 }
    );
  }

  // For app demos, proxy the request to the app's own API
  const appPort = demo.appPort || 3001;
  const apiPath = path.join('/');
  const targetUrl = `http://localhost:${appPort}/api/${apiPath}`;

  try {
    // Prepare the request options
    const requestOptions: RequestInit = {
      method,
      headers: {},
    };

    // Copy headers from the original request
    req.headers.forEach((value, key) => {
      // Skip host header as it should be for the target
      if (key.toLowerCase() !== 'host') {
        requestOptions.headers![key] = value;
      }
    });

    // Handle request body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const contentType = req.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        requestOptions.body = JSON.stringify(await req.json());
      } else if (contentType?.includes('text/')) {
        requestOptions.body = await req.text();
      } else {
        // For other content types, pass the body as-is
        requestOptions.body = await req.arrayBuffer();
      }
    }

    // Make the proxy request
    const response = await fetch(targetUrl, requestOptions);

    // Create a new response with the proxied data
    const responseBody = await response.arrayBuffer();
    
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error(`Failed to proxy request to demo ${demoKey}:`, error);
    return NextResponse.json(
      { error: 'Failed to proxy request to app demo' },
      { status: 500 }
    );
  }
}