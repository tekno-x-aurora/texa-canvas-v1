export {};

interface TEXAExtensionInterface {
  ready: boolean;
  version: string;
  openTool: (toolId: string, targetUrl: string) => void;
  getStatus: () => {
    ready: boolean;
    version: string;
    connected: boolean;
  };
}

declare global {
  interface Window {
    TEXAExtension?: TEXAExtensionInterface;
  }
}