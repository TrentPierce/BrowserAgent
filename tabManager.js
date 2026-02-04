class TabManager {
    constructor() {
        this.tabs = new Map();
        this.activeTabId = null;
        this.nextTabId = 1;
        this.tabBar = null;
        this.webviewContainer = null;
    }

    init() {
        this.createTabBar();
        this.createWebviewContainer();
        // Create first tab
        this.createTab('https://www.google.com');
    }

    createTabBar() {
        // Create tab bar
        this.tabBar = document.createElement('div');
        this.tabBar.id = 'tab-bar';
        this.tabBar.className = 'tab-bar';
        
        // Create new tab button
        const newTabBtn = document.createElement('button');
        newTabBtn.className = 'new-tab-btn';
        newTabBtn.innerHTML = '+';
        newTabBtn.title = 'New Tab';
        newTabBtn.addEventListener('click', () => {
            this.createTab('https://www.google.com');
        });
        
        // Create tabs container
        this.tabsContainer = document.createElement('div');
        this.tabsContainer.className = 'tabs-container';
        
        this.tabBar.appendChild(this.tabsContainer);
        this.tabBar.appendChild(newTabBtn);
        
        // Insert after nav bar
        const navBar = document.getElementById('nav-bar');
        navBar.parentNode.insertBefore(this.tabBar, navBar.nextSibling);
    }

    createWebviewContainer() {
        this.webviewContainer = document.createElement('div');
        this.webviewContainer.id = 'webview-container';
        this.webviewContainer.className = 'webview-container';
        
        // Replace existing webview
        const oldWebview = document.getElementById('browser-view');
        if (oldWebview) {
            oldWebview.parentNode.replaceChild(this.webviewContainer, oldWebview);
        }
    }

    createTab(url = 'https://www.google.com') {
        const tabId = `tab-${this.nextTabId++}`;
        
        // Create webview
        const webview = document.createElement('webview');
        webview.id = `webview-${tabId}`;
        webview.className = 'browser-webview';
        webview.src = url;
        webview.setAttribute('nodeintegration', 'true');
        webview.style.width = '100%';
        webview.style.height = '100%';
        webview.style.display = 'none';
        
        // Create tab element
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.tabId = tabId;
        
        // Tab content (title + close button)
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        
        const tabTitle = document.createElement('span');
        tabTitle.className = 'tab-title';
        tabTitle.textContent = 'Loading...';
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });
        
        tabContent.appendChild(tabTitle);
        tabContent.appendChild(closeBtn);
        tab.appendChild(tabContent);
        
        // Tab click event
        tab.addEventListener('click', () => {
            this.switchToTab(tabId);
        });
        
        // Add to containers
        this.tabsContainer.appendChild(tab);
        this.webviewContainer.appendChild(webview);
        
        // Store tab data
        this.tabs.set(tabId, {
            id: tabId,
            webview: webview,
            tabElement: tab,
            title: 'Loading...',
            url: url,
            agent: null,
            isActive: false
        });
        
        // Set up webview events
        this.setupWebviewEvents(tabId, webview);
        
        // Switch to new tab
        this.switchToTab(tabId);
        
        return tabId;
    }

    setupWebviewEvents(tabId, webview) {
        const tabData = this.tabs.get(tabId);
        
        webview.addEventListener('did-navigate', (e) => {
            if (tabData.isActive) {
                this.updateUrlBar(e.url);
            }
            tabData.url = e.url;
        });
        
        webview.addEventListener('did-navigate-in-page', (e) => {
            if (tabData.isActive) {
                this.updateUrlBar(e.url);
            }
            tabData.url = e.url;
        });
        
        webview.addEventListener('page-title-updated', (e) => {
            tabData.title = e.title || 'New Tab';
            const titleEl = tabData.tabElement.querySelector('.tab-title');
            if (titleEl) {
                titleEl.textContent = this.truncateTitle(tabData.title);
            }
            tabData.tabElement.title = tabData.title;
        });
        
        webview.addEventListener('page-favicon-updated', (e) => {
            // Could update favicon here
        });
    }

    switchToTab(tabId) {
        if (this.activeTabId === tabId) return;
        
        // Deactivate current tab
        if (this.activeTabId) {
            const currentTab = this.tabs.get(this.activeTabId);
            if (currentTab) {
                currentTab.isActive = false;
                currentTab.tabElement.classList.remove('active');
                currentTab.webview.style.display = 'none';
            }
        }
        
        // Activate new tab
        const newTab = this.tabs.get(tabId);
        if (newTab) {
            newTab.isActive = true;
            newTab.tabElement.classList.add('active');
            newTab.webview.style.display = 'block';
            this.activeTabId = tabId;
            this.updateUrlBar(newTab.url);
            
            // Notify main process of tab switch
            if (window.ipcRenderer) {
                window.ipcRenderer.send('tab-switched', tabId);
            }
        }
    }

    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        // Stop agent if running
        if (window.ipcRenderer) {
            window.ipcRenderer.send('stop-agent', tabId);
        }
        
        // Remove elements
        tab.tabElement.remove();
        tab.webview.remove();
        
        // Remove from map
        this.tabs.delete(tabId);
        
        // Switch to another tab if this was active
        if (this.activeTabId === tabId) {
            const remainingTabs = Array.from(this.tabs.keys());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[remainingTabs.length - 1]);
            } else {
                // Create new tab if none left
                this.createTab();
            }
        }
    }

    updateUrlBar(url) {
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.value = url;
        }
    }

    getActiveTab() {
        return this.tabs.get(this.activeTabId);
    }

    getActiveWebview() {
        const activeTab = this.getActiveTab();
        return activeTab ? activeTab.webview : null;
    }

    navigateTo(url) {
        const activeTab = this.getActiveTab();
        if (activeTab && activeTab.webview) {
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            activeTab.webview.loadURL(url);
        }
    }

    truncateTitle(title, maxLength = 20) {
        if (title.length <= maxLength) return title;
        return title.substring(0, maxLength - 3) + '...';
    }

    getAllTabs() {
        return Array.from(this.tabs.values());
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabManager;
} else {
    window.TabManager = TabManager;
}
