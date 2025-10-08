import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Portal',
  pageTitle: 'Portal Voice Agent',
  pageDescription: 'A voice agent built with Portal',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: '/lk-logo.svg',
  accent: '#71055cff',
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#440430ff',
  startButtonText: 'Start call',
};
