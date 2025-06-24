import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface AgentProcess {
  process: ChildProcess;
  agentPath: string;
  startedAt: Date;
  logs: string[];
  logListeners: Set<(log: string) => void>;
}

class AgentManager {
  private processes: Map<string, AgentProcess> = new Map();
  private readonly maxProcesses = 10; // Limit concurrent processes
  private readonly processTimeout = 5 * 60 * 1000; // 5 minutes

  async startAgent(agentPath: string): Promise<void> {
    // Check if we're at the process limit
    if (this.processes.size >= this.maxProcesses) {
      throw new Error('Maximum number of concurrent agents reached');
    }

    // Check if agent is already running
    if (this.processes.has(agentPath)) {
      console.log(`Agent already running for ${agentPath}`);
      return;
    }

    // Validate agent path
    if (!this.isValidAgentPath(agentPath)) {
      throw new Error('Invalid agent path');
    }

    // Get absolute path to the Python file
    const basePath = path.join(process.cwd(), '..');
    const fullPath = path.join(basePath, agentPath.startsWith('/') ? agentPath.slice(1) : agentPath);

    console.log(`Starting agent: ${fullPath}`);

    // Spawn the Python process
    const pythonProcess = spawn('python', [fullPath, 'dev'], {
      env: process.env,
      cwd: path.dirname(fullPath),
    });

    // Create agent process data
    const agentProcess: AgentProcess = {
      process: pythonProcess,
      agentPath,
      startedAt: new Date(),
      logs: [],
      logListeners: new Set(),
    };

    // Store the process
    this.processes.set(agentPath, agentProcess);

    // Handle process output
    pythonProcess.stdout.on('data', (data) => {
      const log = data.toString();
      console.log(`[${agentPath}] stdout: ${log}`);
      this.addLog(agentPath, log);
    });

    pythonProcess.stderr.on('data', (data) => {
      const log = data.toString();
      console.error(`[${agentPath}] stderr: ${log}`);
      this.addLog(agentPath, `[ERROR] ${log}`);
    });

    pythonProcess.on('error', (error) => {
      const errorMsg = `Failed to start process: ${error.message}`;
      console.error(`[${agentPath}] ${errorMsg}`);
      this.addLog(agentPath, `[ERROR] ${errorMsg}`);
      this.processes.delete(agentPath);
    });

    pythonProcess.on('exit', (code, signal) => {
      const exitMsg = `Process exited with code ${code} and signal ${signal}`;
      console.log(`[${agentPath}] ${exitMsg}`);
      this.addLog(agentPath, `[EXIT] ${exitMsg}`);
      this.processes.delete(agentPath);
    });

    // Set up automatic cleanup after timeout
    setTimeout(() => {
      if (this.processes.has(agentPath)) {
        console.log(`[${agentPath}] Process timeout, stopping agent`);
        this.stopAgent(agentPath);
      }
    }, this.processTimeout);
  }

  async stopAgent(agentPath: string): Promise<void> {
    const agentProcess = this.processes.get(agentPath);
    if (!agentProcess) {
      console.log(`No agent found for ${agentPath}`);
      return;
    }

    console.log(`Stopping agent ${agentPath}`);
    
    // Try graceful shutdown first
    agentProcess.process.kill('SIGTERM');
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (this.processes.has(agentPath)) {
        console.log(`Force killing agent ${agentPath}`);
        agentProcess.process.kill('SIGKILL');
        this.processes.delete(agentPath);
      }
    }, 5000);
  }

  async stopAllAgents(): Promise<void> {
    console.log('Stopping all agents...');
    const agentPaths = Array.from(this.processes.keys());
    await Promise.all(agentPaths.map(agentPath => this.stopAgent(agentPath)));
  }

  getRunningAgents(): Array<{ agentPath: string; startedAt: Date }> {
    return Array.from(this.processes.values()).map(({ agentPath, startedAt }) => ({
      agentPath,
      startedAt,
    }));
  }

  getLogs(agentPath: string): string[] {
    const process = this.processes.get(agentPath);
    return process ? [...process.logs] : [];
  }

  addLogListener(agentPath: string, listener: (log: string) => void): () => void {
    const process = this.processes.get(agentPath);
    if (!process) {
      return () => {};
    }

    process.logListeners.add(listener);
    
    // Return cleanup function
    return () => {
      process.logListeners.delete(listener);
    };
  }

  private addLog(agentPath: string, log: string): void {
    const process = this.processes.get(agentPath);
    if (!process) return;

    // Add timestamp
    const timestamp = new Date().toISOString();
    const formattedLog = `[${timestamp}] ${log}`;
    
    // Store log (keep last 1000 lines)
    process.logs.push(formattedLog);
    if (process.logs.length > 1000) {
      process.logs.shift();
    }

    // Notify listeners
    process.logListeners.forEach(listener => {
      listener(formattedLog);
    });
  }

  private isValidAgentPath(agentPath: string): boolean {
    // Only allow Python files from specific directories
    const allowedPaths = [
      '/basics/',
      '/complex-agents/',
      '/pipeline-stt/',
      '/pipeline-tts/',
      '/pipeline-llm/',
      '/flows/',
      '/realtime/',
      '/telephony/',
      '/tool_calling/',
      '/rag/',
    ];

    // Check if path ends with .py
    if (!agentPath.endsWith('.py')) {
      return false;
    }

    // Check if path starts with an allowed directory
    return allowedPaths.some(allowed => agentPath.startsWith(allowed));
  }
}

// Export singleton instance
export const agentManager = new AgentManager();

// Cleanup on process exit
process.on('SIGTERM', async () => {
  await agentManager.stopAllAgents();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await agentManager.stopAllAgents();
  process.exit(0);
});