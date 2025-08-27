import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gbrabbit.hearthchat',
  appName: 'hearth-chat-app',
  webDir: 'build',
  server: {
    allowNavigation: [
      'port-0-hearth-chat-meq4jsqba77b2805.sel5.cloudtype.app',
      '*.sel5.cloudtype.app',
      'hearthchat.kozow.com'
    ]
  },
  android: {
    webContentsDebuggingEnabled: true,
    allowMixedContent: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
