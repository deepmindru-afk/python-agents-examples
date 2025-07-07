import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface AppDemoProcess {
  process: ChildProcess;
  port: number;
  startTime: number;
  logs: string[];
}

class AppDemoManager {
  private processes: Map<string, AppDemoProcess> = new Map();
  private readonly MAX_LOG_LINES = 1000;
  private readonly PROCESS_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  async startAppDemo(demoKey: string, appPath: string, port: number): Promise<void> {
    // Check if already running
    if (this.processes.has(demoKey)) {
      console.log(`App demo ${demoKey} is already running`);
      return;
    }

    const fullPath = path.join(process.cwd(), '..', appPath);
    
    console.log(`Starting app demo ${demoKey} at ${fullPath} on port ${port}`);

    // Install dependencies if needed
    const installProcess = spawn('pnpm', ['install'], {
      cwd: fullPath,
      env: { ...process.env },
    });

    await new Promise((resolve, reject) => {
      installProcess.on('close', (code) => {
        if (code === 0) {
          resolve(void 0);
        } else {
          reject(new Error(`pnpm install failed with code ${code}`));
        }
      });
    });

    // Start the Next.js app directly using npx to avoid script parsing issues
    const appProcess = spawn('npx', ['next', 'dev', '--turbopack', '-p', port.toString()], {
      cwd: fullPath,
      env: {
        ...process.env,
        PORT: port.toString(),
        // Pass through LiveKit environment variables
        NEXT_PUBLIC_LIVEKIT_URL: process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL,
        LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
        LIVEKIT_URL: process.env.LIVEKIT_URL,
      },
      stdio: ['ignore', 'pipe', 'pipe'], // Explicitly capture stdout and stderr
    });

    const appDemoProcess: AppDemoProcess = {
      process: appProcess,
      port,
      startTime: Date.now(),
      logs: [],
    };

    // Capture logs
    appProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      console.log(`[${demoKey}] stdout:`, lines.join('\n'));
      appDemoProcess.logs.push(...lines);
      if (appDemoProcess.logs.length > this.MAX_LOG_LINES) {
        appDemoProcess.logs = appDemoProcess.logs.slice(-this.MAX_LOG_LINES);
      }
    });

    appProcess.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      console.error(`[${demoKey}] stderr:`, lines.join('\n'));
      appDemoProcess.logs.push(...lines.map(line => `[ERROR] ${line}`));
      if (appDemoProcess.logs.length > this.MAX_LOG_LINES) {
        appDemoProcess.logs = appDemoProcess.logs.slice(-this.MAX_LOG_LINES);
      }
    });

    appProcess.on('error', (error) => {
      console.error(`App demo ${demoKey} process error:`, error);
      this.processes.delete(demoKey);
    });

    appProcess.on('exit', (code) => {
      console.log(`App demo ${demoKey} process exited with code ${code}`);
      this.processes.delete(demoKey);
    });

    this.processes.set(demoKey, appDemoProcess);

    // Set up auto-termination
    setTimeout(() => {
      if (this.processes.has(demoKey)) {
        console.log(`Auto-terminating app demo ${demoKey} after timeout`);
        this.stopAppDemo(demoKey);
      }
    }, this.PROCESS_TIMEOUT);

    // Wait for the app to be ready
    console.log(`Waiting for app demo ${demoKey} to be ready...`);
    
    // Check if process is still running after a short delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!this.processes.has(demoKey)) {
      throw new Error(`App demo ${demoKey} process exited unexpectedly`);
    }
    
    // Wait a bit more for the server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  async stopAppDemo(demoKey: string): Promise<void> {
    const appDemo = this.processes.get(demoKey);
    if (!appDemo) {
      console.log(`App demo ${demoKey} is not running`);
      return;
    }

    console.log(`Stopping app demo ${demoKey}`);
    
    // Try graceful shutdown first
    appDemo.process.kill('SIGTERM');
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (this.processes.has(demoKey)) {
        appDemo.process.kill('SIGKILL');
        this.processes.delete(demoKey);
      }
    }, 5000);
  }

  async getAppDemoStatus(demoKey: string): Promise<{ running: boolean; port?: number; url?: string }> {
    const appDemo = this.processes.get(demoKey);
    if (!appDemo) {
      return { running: false };
    }

    return {
      running: true,
      port: appDemo.port,
      url: `http://localhost:${appDemo.port}`,
    };
  }

  async getAppDemoLogs(demoKey: string): Promise<string[]> {
    const appDemo = this.processes.get(demoKey);
    if (!appDemo) {
      return [];
    }

    return [...appDemo.logs];
  }

  async stopAllAppDemos(): Promise<void> {
    const promises = Array.from(this.processes.keys()).map(demoKey => 
      this.stopAppDemo(demoKey)
    );
    await Promise.all(promises);
  }
}

// Export singleton instance
export const appDemoManager = new AppDemoManager();

// Cleanup on process exit
process.on('SIGINT', async () => {
  console.log('Cleaning up app demos...');
  await appDemoManager.stopAllAppDemos();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Cleaning up app demos...');
  await appDemoManager.stopAllAppDemos();
  process.exit(0);
});