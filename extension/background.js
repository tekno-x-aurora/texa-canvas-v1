const isHttpUrl = (value) => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const fetchJson = async (url, idToken) => {
  const headers = {};
  if (idToken) headers.authorization = `Bearer ${idToken}`;

  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return await res.json();
};

const handleOpenTool = async (message) => {
  const origin = message.origin ? String(message.origin) : '';
  const toolId = message.toolId ? String(message.toolId) : '';
  const idToken = message.idToken ? String(message.idToken) : '';
  const fallbackTargetUrl = message.targetUrl ? String(message.targetUrl) : '';

  if (!origin || !toolId || !idToken) {
    return { ok: false, error: 'Missing required parameters' };
  }

  try {
    const endpoint = `${origin}/api/tools/get-injection-data?toolId=${encodeURIComponent(toolId)}`;
    const toolPayload = await fetchJson(endpoint, idToken);
    const tool = toolPayload && toolPayload.tool ? toolPayload.tool : null;

    const targetUrl = tool && tool.targetUrl ? String(tool.targetUrl) : fallbackTargetUrl;

    if (!isHttpUrl(targetUrl)) {
      return { ok: false, error: 'Invalid target URL' };
    }

    await chrome.tabs.create({ url: targetUrl });
    return { ok: true };
  } catch (error) {
    console.error('Error opening tool:', error);
    return { ok: false, error: error.message };
  }
};

const handleContentScriptMessage = async (message, sender) => {
  if (message.type === 'TEXA_OPEN_TOOL') {
    return await handleOpenTool(message);
  }
  
  if (message.type === 'TEXA_GET_TOOLS') {
    return await getAvailableTools(message.origin, message.idToken);
  }
  
  return null;
};

const getAvailableTools = async (origin, idToken) => {
  if (!origin || !idToken) {
    return { ok: false, error: 'Not authenticated' };
  }

  try {
    const endpoint = `${origin}/api/catalog`;
    const tools = await fetchJson(endpoint, idToken);
    return { ok: true, tools: Array.isArray(tools) ? tools : [] };
  } catch (error) {
    console.error('Error fetching tools:', error);
    return { ok: false, error: error.message };
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  (async () => {
    const result = await handleContentScriptMessage(message, sender);
    return result || { ok: false, error: 'Unknown message type' };
  })()
    .then(sendResponse)
    .catch((error) => {
      console.error('Background script error:', error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('TEXA Tools Manager installed');
});

chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked from tab:', tab.url);
});
