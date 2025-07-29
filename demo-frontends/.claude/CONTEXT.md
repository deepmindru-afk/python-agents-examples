# Demo-Frontends App Demo Integration Context

## Overview
This document describes the enhanced architecture that allows demo-frontends to support both simple component demos and full Next.js application demos. The teleprompter was successfully integrated as the first app demo.

## Architecture Overview

### Demo Types
- **Component demos**: Simple React components that use the shared demo infrastructure
- **App demos**: Full Next.js applications that run in their own process and are embedded via iframe

### Key Components

1. **Demo Configuration** (`app/demos/demo-config.ts`)
   - Added `type?: 'component' | 'app'` field
   - Added `appPath?: string` for the app's directory path
   - Added `appPort?: number` for the port to run the app on

2. **App Demo Manager** (`lib/app-demo-manager.ts`)
   - Manages spawning/terminating Next.js app processes
   - Handles dependency installation (pnpm install)
   - Captures logs from app processes
   - Auto-terminates after 30 minutes
   - Uses `npx next dev` directly to avoid package.json script parsing issues

3. **API Routes**
   - `/api/demos/app-demo/start` - Starts an app demo process
   - `/api/demos/app-demo/stop` - Stops an app demo
   - `/api/demos/app-demo/status` - Gets running status
   - `/api/demos/app-demo/logs` - Retrieves app logs (not currently used)
   - `/api/demos/[demo]/[...path]` - Proxy for demo-specific API routes

4. **DemoWrapper Updates** (`components/demo-wrapper.tsx`)
   - Detects app demos and renders them in iframes
   - Starts both the Python agent AND the app frontend
   - Shows loading state while app starts up

## Adding a New App Demo

### 1. Update Demo Configuration

```typescript
// In app/demos/demo-config.ts
'your-demo-key': {
  name: 'Your Demo Name',
  description: 'Description of your demo',
  tags: ['Tag1', 'Tag2'],
  type: 'app',  // Important: marks this as an app demo
  agentPath: '/path/to/your/agent.py',  // Python agent
  appPath: '/path/to/your/frontend',    // Next.js app directory
  appPort: 3002,
  capabilities: {
    suportsChatInput: true,
    suportsVideoInput: false,
    suportsScreenShare: false,
  },
},
```

### 2. Ensure App Compatibility

The app frontend should:
- Be a Next.js application with a `package.json`
- Use pnpm as the package manager (have a `pnpm-lock.yaml`)
- Have a `dev` script in package.json
- Handle its own LiveKit connection (will receive env vars)

### 3. Environment Variables

The app will receive these environment variables from the parent:
- `NEXT_PUBLIC_LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL`
- `PORT`

### 4. Important Implementation Details

1. **Process Spawning**: Uses `npx next dev --turbopack -p [port]` to avoid issues with npm script argument parsing

2. **Working Directory**: The app is started from its own directory, so all relative paths in the app work correctly

3. **Logs**: The Python agent logs are shown in the Code Panel's log viewer, NOT the app frontend logs

4. **Lifecycle**:
   - When demo loads: Python agent starts + App frontend starts
   - When demo unmounts: Both processes are terminated
   - App auto-terminates after 30 minutes

## Known Issues and Solutions

### Issue 1: Process exits with code 0/1
**Cause**: Package.json scripts with arguments don't parse correctly
**Solution**: Use `npx next dev` directly instead of `pnpm run dev`

### Issue 2: Missing environment variables
**Cause**: Child process doesn't inherit parent env vars
**Solution**: Explicitly pass LiveKit env vars in spawn options

### Issue 3: Incorrect working directory
**Cause**: Relative paths in app fail
**Solution**: Set `cwd` to the app's directory in spawn options

## Testing a New App Demo

1. Add the configuration to `demo-config.ts`
2. Ensure your app has all dependencies installed
3. Start the demo-frontends server
4. Navigate to `/demos/your-demo-key`
5. Check server logs for any spawning errors
6. Verify both Python agent and frontend start correctly

## Future Enhancements

1. **App Demo Logs**: Currently we only show Python logs. Could add a toggle for app logs.
2. **Health Checks**: Add endpoint to verify app is ready before showing iframe
3. **Dynamic Ports**: Auto-assign ports instead of hardcoding
4. **Build Support**: Support for production builds, not just dev mode
5. **Error Recovery**: Better error messages and recovery when app fails to start

## File Structure for App Demos

```
complex-agents/
└── your-demo/
    ├── your_agent.py         # Python agent
    ├── README.md             # Documentation (shown in Code Panel)
    └── your-frontend/        # Next.js app
        ├── package.json
        ├── pnpm-lock.yaml
        ├── app/              # Next.js app directory
        └── ...
```

The README.md and Python agent code are displayed in the Code Panel just like regular demos.