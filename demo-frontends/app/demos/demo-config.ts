export interface DemoConfig {
  name: string;
  description: string;
  tags: string[];
  type?: 'component' | 'app'; // Default is 'component' for backward compatibility
  agentPath?: string;
  capabilities: {
    suportsChatInput: boolean;
    suportsVideoInput: boolean;
    suportsScreenShare: boolean;
  };
  customComponent?: string;
  appPath?: string; // Path to the app frontend directory (for type: 'app')
  appPort?: number; // Port to run the app on (for type: 'app')
}

export const demos: Record<string, DemoConfig> = {
  'keyword-detection': {
    name: 'Keyword Detection',
    description: 'Detect specific keywords in real-time speech',
    tags: ['STT', 'Pipeline'],
    agentPath: '/pipeline-stt/keyword-detection/keyword_detection.py',
    capabilities: {
      suportsChatInput: false,
      suportsVideoInput: false,
      suportsScreenShare: false,
    },
  },
  'transcriber': {
    name: 'Real-time Transcriber',
    description: 'Live speech-to-text transcription',
    tags: ['STT', 'Pipeline'],
    agentPath: '/pipeline-stt/transcriber/transcriber.py',
    capabilities: {
      suportsChatInput: false,
      suportsVideoInput: false,
      suportsScreenShare: false,
    },
  },
  'tts-comparison': {
    name: 'TTS Comparison',
    description: 'Compare different TTS providers side by side',
    tags: ['TTS', 'Pipeline'],
    agentPath: '/pipeline-tts/tts_comparison/tts_comparison.py',
    capabilities: {
      suportsChatInput: true,
      suportsVideoInput: false,
      suportsScreenShare: false,
    },
  },
  'vision': {
    name: 'Vision Agent',
    description: 'AI agent that can see and analyze visual content',
    tags: ['Vision', 'Complex'],
    agentPath: '/complex-agents/vision/agent.py',
    capabilities: {
      suportsChatInput: true,
      suportsVideoInput: true,
      suportsScreenShare: true,
    },
  },
  'nutrition-assistant': {
    name: 'Nutrition Assistant',
    description: 'Track nutrition and get dietary advice',
    tags: ['Complex', 'Database'],
    agentPath: '/complex-agents/nutrition-assistant/agent.py',
    capabilities: {
      suportsChatInput: true,
      suportsVideoInput: false,
      suportsScreenShare: false,
    },
    customComponent: 'NutritionDemo',
  },
  'ivr-agent': {
    name: 'IVR Agent',
    description: 'Interactive Voice Response system',
    tags: ['Complex', 'Telephony'],
    agentPath: '/complex-agents/ivr-agent/agent.py',
    capabilities: {
      suportsChatInput: true,
      suportsVideoInput: false,
      suportsScreenShare: false,
    },
  },
  'teleprompter': {
    name: 'Teleprompter',
    description: 'Real-time teleprompter with AI assistance',
    tags: ['Complex', 'TTS'],
    type: 'app',
    agentPath: '/complex-agents/teleprompter/cartesia-ink.py',
    appPath: '/complex-agents/teleprompter/teleprompter-frontend',
    appPort: 3001, // Run on a different port to avoid conflicts
    capabilities: {
      suportsChatInput: true,
      suportsVideoInput: false,
      suportsScreenShare: false,
    },
  },
  'uninterruptable': {
    name: 'Uninterruptable Agent',
    description: 'Agent that completes its response without interruption',
    tags: ['Basics'],
    agentPath: '/basics/uninterruptable/uninterruptable.py',
    capabilities: {
      suportsChatInput: true,
      suportsVideoInput: false,
      suportsScreenShare: false,
    },
  },
};