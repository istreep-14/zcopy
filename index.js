// Background script for Smart Zetamac Coach extension
// FIXED: Better error handling and logging

// Initialize Firebase API key in storage on extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Extension installed, setting up Firebase configuration...');
    
    // Check if API key is already stored
    const result = await chrome.storage.local.get(['firebase_apiKey']);
    
    if (!result.firebase_apiKey) {
      // For now, we'll need to manually set this or read from environment
      // In a production build, this would be injected during build process
      console.warn('Firebase API key not found in storage. Extension may not work properly.');
      console.log('Please set the Firebase API key using the setup process.');
    }
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getFirebaseConfig') {
    // Return Firebase configuration from storage
    chrome.storage.local.get(['firebase_apiKey']).then(result => {
      sendResponse({ apiKey: result.firebase_apiKey });
    });
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'postToAppsScript') {
    (async () => {
      try {
        const { url, payload } = request;
        if (!url) {
          console.error('Background script: Missing URL for Apps Script request');
          sendResponse({ ok: false, error: 'Missing URL' });
          return;
        }
        
        console.log('Background script making fetch request to:', url);
        console.log('Payload:', payload);
        
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        const text = await resp.text();
        console.log('Apps Script raw response:', {
          status: resp.status,
          statusText: resp.statusText,
          headers: Object.fromEntries(resp.headers.entries()),
          body: text
        });
        
        // Try to parse as JSON first
        let responseData;
        try {
          responseData = JSON.parse(text);
        } catch (parseError) {
          console.log('Response is not JSON, treating as text');
          responseData = { message: text };
        }
        
        if (!resp.ok) {
          console.error('Apps Script returned error status:', resp.status, text);
        }
        
        sendResponse({ 
          ok: resp.ok, 
          status: resp.status, 
          statusText: resp.statusText,
          body: text,
          data: responseData
        });
        
      } catch (fetchError) {
        console.error('Background script fetch error:', fetchError);
        sendResponse({ 
          ok: false, 
          error: String(fetchError),
          errorType: fetchError.name,
          errorMessage: fetchError.message
        });
      }
    })();
    return true; // async
  }
});
