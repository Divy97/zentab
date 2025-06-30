export default defineBackground(() => {
  // console.log('zenTab background script initialized');

  // Session storage keys
  const STORAGE_KEYS = {
    IS_ACTIVE: 'isSessionActive',
    END_TIME: 'sessionEndTime',
    MODE: 'domainMode', // 'allow' or 'block'
    DOMAINS: 'domains',
    START_TIME: 'sessionStartTime'
  };

  // Check if a domain should be blocked
  function shouldBlockDomain(url: string, mode: 'allow' | 'block', domains: string[]): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const isInList = domains.some(domain => {
        const cleanDomain = domain.toLowerCase().trim();
        return hostname === cleanDomain || hostname.endsWith('.' + cleanDomain);
      });

      return mode === 'allow' ? !isInList : isInList;
    } catch {
      return false;
    }
  }

  // Handle tab updates (navigation)
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
      // Ignore non-web pages
      if (!tab.url.startsWith('http')) {
        return;
      }

      const storage = await browser.storage.local.get([
        STORAGE_KEYS.IS_ACTIVE,
        STORAGE_KEYS.END_TIME,
        STORAGE_KEYS.MODE,
        STORAGE_KEYS.DOMAINS
      ]);

      const isActive = storage[STORAGE_KEYS.IS_ACTIVE];
      const endTime = storage[STORAGE_KEYS.END_TIME];
      
      // Check if session has expired
      if (isActive && endTime && Date.now() > endTime) {
        await endSession();
        return;
      }

      if (isActive && storage[STORAGE_KEYS.MODE] && storage[STORAGE_KEYS.DOMAINS]) {
        const shouldBlock = shouldBlockDomain(
          tab.url,
          storage[STORAGE_KEYS.MODE],
          storage[STORAGE_KEYS.DOMAINS]
        );

        if (shouldBlock) {
          // Redirect to blocking page
          const blockingUrl = browser.runtime.getURL('/blocked.html') + 
            `?url=${encodeURIComponent(tab.url)}&domain=${encodeURIComponent(new URL(tab.url).hostname)}`;
          browser.tabs.update(tabId, { url: blockingUrl });
        }
      }
    }
  });

  // Listen for messages from popup and content scripts
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          case 'START_SESSION':
            await startSession(message.mode, message.domains, message.duration);
            sendResponse({ success: true });
            break;
          
          case 'END_SESSION':
            await endSession();
            sendResponse({ success: true });
            break;
          
          case 'EXTEND_SESSION':
            await extendSession(message.minutes);
            sendResponse({ success: true });
            break;
          
          case 'REDUCE_SESSION':
            await reduceSession(message.minutes);
            sendResponse({ success: true });
            break;
          
          case 'GET_SESSION_STATUS':
            const status = await getSessionStatus();
            sendResponse(status);
            break;
          
          case 'ADD_DOMAIN':
            await addDomain(message.domain);
            sendResponse({ success: true });
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    
    return true; // Keep the message channel open for async response
  });

  async function startSession(mode: 'allow' | 'block', domains: string[], durationMinutes: number) {
    const now = Date.now();
    const endTime = now + (durationMinutes * 60 * 1000);
    
    await browser.storage.local.set({
      [STORAGE_KEYS.IS_ACTIVE]: true,
      [STORAGE_KEYS.START_TIME]: now,
      [STORAGE_KEYS.END_TIME]: endTime,
      [STORAGE_KEYS.MODE]: mode,
      [STORAGE_KEYS.DOMAINS]: domains
    });

    // console.log('Session started:', { mode, domains, durationMinutes });
  }

  async function endSession() {
    await browser.storage.local.remove([
      STORAGE_KEYS.IS_ACTIVE,
      STORAGE_KEYS.START_TIME,
      STORAGE_KEYS.END_TIME,
      STORAGE_KEYS.MODE,
      STORAGE_KEYS.DOMAINS
    ]);

    // console.log('Session ended');
  }

  async function extendSession(minutes: number) {
    const storage = await browser.storage.local.get([STORAGE_KEYS.END_TIME]);
    const currentEndTime = storage[STORAGE_KEYS.END_TIME];
    
    if (currentEndTime) {
      const newEndTime = currentEndTime + (minutes * 60 * 1000);
      await browser.storage.local.set({ [STORAGE_KEYS.END_TIME]: newEndTime });
    }
  }

  async function reduceSession(minutes: number) {
    const storage = await browser.storage.local.get([STORAGE_KEYS.END_TIME]);
    const currentEndTime = storage[STORAGE_KEYS.END_TIME];
    
    if (currentEndTime) {
      const newEndTime = Math.max(Date.now() + 60000, currentEndTime - (minutes * 60 * 1000)); // Minimum 1 minute remaining
      await browser.storage.local.set({ [STORAGE_KEYS.END_TIME]: newEndTime });
    }
  }

  async function getSessionStatus() {
    const storage = await browser.storage.local.get([
      STORAGE_KEYS.IS_ACTIVE,
      STORAGE_KEYS.START_TIME,
      STORAGE_KEYS.END_TIME,
      STORAGE_KEYS.MODE,
      STORAGE_KEYS.DOMAINS
    ]);

    // console.log('Background: Retrieved storage:', storage);

    const isActive = storage[STORAGE_KEYS.IS_ACTIVE];
    const endTime = storage[STORAGE_KEYS.END_TIME];
    
    // Check if session has expired
    if (isActive && endTime && Date.now() > endTime) {
      // console.log('Background: Session expired, ending session');
      await endSession();
      return { isActive: false };
    }

    const status = {
      isActive: storage[STORAGE_KEYS.IS_ACTIVE] || false,
      startTime: storage[STORAGE_KEYS.START_TIME],
      endTime: storage[STORAGE_KEYS.END_TIME],
      mode: storage[STORAGE_KEYS.MODE],
      domains: storage[STORAGE_KEYS.DOMAINS]
    };

    // console.log('Background: Returning status:', status);
    return status;
  }

  async function addDomain(newDomain: string) {
    if (!newDomain) return;

    const storage = await browser.storage.local.get([STORAGE_KEYS.DOMAINS]);
    const currentDomains = storage[STORAGE_KEYS.DOMAINS] || [];
    
    // Avoid adding duplicates
    const lowerCaseDomain = newDomain.toLowerCase().trim();
    if (!currentDomains.some(d => d.toLowerCase() === lowerCaseDomain)) {
      const updatedDomains = [...currentDomains, lowerCaseDomain];
      await browser.storage.local.set({ [STORAGE_KEYS.DOMAINS]: updatedDomains });
      // console.log(`Domain added: ${lowerCaseDomain}. New list:`, updatedDomains);
    }
  }
});
