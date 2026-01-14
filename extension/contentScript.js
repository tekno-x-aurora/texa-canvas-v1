const STORAGE_KEYS = {
  TEXA_ORIGIN: 'texa_origin',
  TEXA_TOKEN: 'texa_token',
  TEXA_USER: 'texa_user'
};

class TEXAContentScript {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.detectTEXADashboard();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.source !== 'TEXA_DASHBOARD') return;

      this.handleDashboardMessage(message);
    });
  }

  async handleDashboardMessage(message) {
    if (message.type === 'TEXA_OPEN_TOOL') {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TEXA_OPEN_TOOL',
          origin: message.origin,
          toolId: message.toolId,
          idToken: message.idToken,
          targetUrl: message.targetUrl
        });

        window.postMessage({
          source: 'TEXA_EXTENSION',
          type: 'TEXA_TOOL_RESPONSE',
          success: response && response.ok,
          error: response && response.error
        }, '*');

      } catch (error) {
        console.error('Error handling open tool:', error);
        window.postMessage({
          source: 'TEXA_EXTENSION',
          type: 'TEXA_TOOL_RESPONSE',
          success: false,
          error: error.message
        }, '*');
      }
    }
  }

  detectTEXADashboard() {
    const currentUrl = window.location.href;
    const isTEXADashboard = currentUrl.includes('localhost') || 
                          currentUrl.includes('vercel.app') ||
                          currentUrl.includes('texa');

    if (isTEXADashboard) {
      this.injectHelperScript();
    }
  }

  injectHelperScript() {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        window.TEXAExtension = {
          ready: true,
          version: '1.0.0',
          
          openTool: function(toolId, targetUrl) {
            const origin = window.location.origin;
            const idToken = window.localStorage.getItem('firebaseIdToken');
            
            window.postMessage({
              source: 'TEXA_DASHBOARD',
              type: 'TEXA_OPEN_TOOL',
              origin: origin,
              toolId: toolId,
              idToken: idToken,
              targetUrl: targetUrl
            }, '*');
          },
          
          getStatus: function() {
            return {
              ready: true,
              version: '1.0.0',
              connected: true
            };
          }
        };

        window.dispatchEvent(new CustomEvent('TEXA_EXTENSION_READY'));
      })();
    `;
    
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  async saveAuthData(origin, idToken, userData) {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TEXA_ORIGIN]: origin,
        [STORAGE_KEYS.TEXA_TOKEN]: idToken,
        [STORAGE_KEYS.TEXA_USER]: userData
      });
    } catch (error) {
      console.error('Error saving auth data:', error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new TEXAContentScript());
} else {
  new TEXAContentScript();
}