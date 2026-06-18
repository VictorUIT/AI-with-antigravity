// Global state
let releaseEntries = [];
let selectedItem = null;
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const syncTimeSpan = document.getElementById('sync-time');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterTags = document.querySelectorAll('.filter-tag');
const feedLoader = document.getElementById('feed-loader');
const emptyState = document.getElementById('empty-state');
const releasesFeed = document.getElementById('releases-feed');
const errorAlert = document.getElementById('error-alert');
const errorMessage = document.getElementById('error-message');
const warningAlert = document.getElementById('warning-alert');
const warningMessage = document.getElementById('warning-message');
const toastContainer = document.getElementById('toast-container');

// Composer DOM Elements
const composerEmpty = document.getElementById('composer-empty');
const composerContent = document.getElementById('composer-content');
const selectedDateSpan = document.getElementById('selected-date');
const selectedTypeSpan = document.getElementById('selected-type');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const tweetCharWarning = document.getElementById('tweet-char-warning');
const xPreviewText = document.getElementById('x-preview-text');
const tweetShareBtn = document.getElementById('tweet-share-btn');
const tweetCopyBtn = document.getElementById('tweet-copy-btn');
const copyBtnText = document.getElementById('copy-btn-text');

// Analytics DOM Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statFixes = document.getElementById('stat-fixes');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
    setupEventListeners();
    addComposerCloseButton();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Real-time search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
        applyFiltersAndSearch();
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });

    // Category filters
    filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilter = tag.getAttribute('data-filter');
            applyFiltersAndSearch();
        });
    });

    // Composer textarea input listener
    tweetTextarea.addEventListener('input', () => {
        updateTweetPreview();
    });

    // Tweet action
    tweetShareBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(xUrl, '_blank', 'noopener,noreferrer');
        showToast('Opening sharing dialog on X...');
    });

    // Copy action
    tweetCopyBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            // Success animation
            const iconCopy = tweetCopyBtn.querySelector('.icon-copy');
            const iconCheck = tweetCopyBtn.querySelector('.icon-check');
            
            iconCopy.style.display = 'none';
            iconCheck.style.display = 'inline-block';
            copyBtnText.textContent = 'Copied!';
            tweetCopyBtn.classList.add('btn-success');
            
            showToast('Post copied to clipboard successfully!');
            
            setTimeout(() => {
                iconCopy.style.display = 'inline-block';
                iconCheck.style.display = 'none';
                copyBtnText.textContent = 'Copy Post Text';
                tweetCopyBtn.classList.remove('btn-success');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy text. Please select and copy manually.', 'error');
        });
    });
}

// Add Composer Close button dynamically for mobile devices
function addComposerCloseButton() {
    const composerHeader = document.querySelector('.composer-header');
    if (composerHeader) {
        const closeBtn = document.createElement('button');
        closeBtn.id = 'composer-close-btn';
        closeBtn.className = 'composer-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'var(--text-secondary)';
        closeBtn.style.fontSize = '1.75rem';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.marginLeft = 'auto';
        closeBtn.style.display = 'flex';
        closeBtn.style.alignItems = 'center';
        closeBtn.style.justifyContent = 'center';
        closeBtn.style.padding = '0 0.5rem';
        
        composerHeader.appendChild(closeBtn);
        
        closeBtn.addEventListener('click', () => {
            document.body.classList.remove('composer-open');
            // Deselect card
            document.querySelectorAll('.release-item-card').forEach(card => {
                card.classList.remove('selected-active');
            });
            selectedItem = null;
            composerEmpty.style.display = 'flex';
            composerContent.style.display = 'none';
        });
    }
}

// Fetch Release Notes from backend
async function fetchReleaseNotes(forceRefresh = false) {
    // Show loading skeleton
    feedLoader.style.display = 'flex';
    releasesFeed.style.display = 'none';
    emptyState.style.display = 'none';
    
    if (forceRefresh) {
        refreshBtn.classList.add('spinning');
        refreshBtn.disabled = true;
    }
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Unknown error occurred while fetching release notes.');
        }
        
        releaseEntries = data.entries;
        
        // Hide alerts
        errorAlert.style.display = 'none';
        warningAlert.style.display = 'none';
        
        // Show offline warning if returned cached details with a warning
        if (data.warning) {
            warningAlert.style.display = 'flex';
            warningMessage.textContent = data.warning;
        }
        
        // Update synchronization time
        const syncDate = new Date(data.fetched_at * 1000);
        syncTimeSpan.textContent = syncDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Calculate and display stats
        calculateStats();
        
        // Render feed
        renderFeed();
        
        if (forceRefresh) {
            showToast('Feed refreshed successfully!');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        errorAlert.style.display = 'flex';
        errorMessage.textContent = error.message || 'Could not synchronize with the BigQuery Release RSS Feed.';
        showToast('Error refreshing release notes.', 'error');
        
        // If we don't have local entries, show empty state
        if (releaseEntries.length === 0) {
            emptyState.style.display = 'flex';
        }
    } finally {
        feedLoader.style.display = 'none';
        if (forceRefresh) {
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
}

// Calculate feed metrics
function calculateStats() {
    let totalItems = 0;
    let featuresCount = 0;
    let fixesCount = 0;
    
    releaseEntries.forEach(entry => {
        entry.items.forEach(item => {
            totalItems++;
            if (item.type.toLowerCase() === 'feature') {
                featuresCount++;
            } else {
                fixesCount++;
            }
        });
    });
    
    statTotal.textContent = totalItems;
    statFeatures.textContent = featuresCount;
    statFixes.textContent = fixesCount;
}

// Render the timeline feed
function renderFeed() {
    releasesFeed.innerHTML = '';
    
    // Filter & search entries
    const filteredEntries = getFilteredData();
    
    if (filteredEntries.length === 0) {
        emptyState.style.display = 'flex';
        releasesFeed.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    releasesFeed.style.display = 'flex';
    
    filteredEntries.forEach((entry, index) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'timeline-group';
        groupEl.style.animationDelay = `${index * 0.05}s`;
        
        groupEl.innerHTML = `
            <div class="timeline-node"></div>
            <div class="timeline-date-header">
                <h3>${entry.date}</h3>
                <a href="${entry.link}" class="original-feed-link" target="_blank" rel="noopener noreferrer">
                    Official Notes
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                </a>
            </div>
            <div class="timeline-items-list"></div>
        `;
        
        const itemsListEl = groupEl.querySelector('.timeline-items-list');
        
        entry.items.forEach(item => {
            const itemEl = document.createElement('div');
            const typeClass = item.type.toLowerCase();
            const badgeClass = `badge-${typeClass}`;
            
            itemEl.className = `release-item-card category-${typeClass}`;
            if (selectedItem && selectedItem.id === item.id) {
                itemEl.classList.add('selected-active');
            }
            
            itemEl.innerHTML = `
                <div class="card-header-bar">
                    <span class="badge ${badgeClass}">${item.type}</span>
                    <button class="quick-tweet-btn" title="Compose post on X for this update">
                        <!-- X/Twitter Icon -->
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </button>
                </div>
                <div class="card-content-body">
                    ${item.html}
                </div>
            `;
            
            // Event listener for card selection
            itemEl.addEventListener('click', (e) => {
                // Ignore if clicked on a link inside the card
                if (e.target.tagName === 'A') {
                    return;
                }
                
                // Remove previous active selection
                document.querySelectorAll('.release-item-card').forEach(card => {
                    card.classList.remove('selected-active');
                });
                
                itemEl.classList.add('selected-active');
                selectReleaseItem(entry, item);
            });
            
            // Event listener for quick tweet button
            const quickTweet = itemEl.querySelector('.quick-tweet-btn');
            quickTweet.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card selection click event
                
                // Select first
                document.querySelectorAll('.release-item-card').forEach(card => {
                    card.classList.remove('selected-active');
                });
                itemEl.classList.add('selected-active');
                
                selectReleaseItem(entry, item);
                
                // Immediately open X/Twitter dialog (in addition to opening panel)
                const text = tweetTextarea.value;
                const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                window.open(xUrl, '_blank', 'noopener,noreferrer');
                showToast('Launching X post composer...');
            });
            
            itemsListEl.appendChild(itemEl);
        });
        
        releasesFeed.appendChild(groupEl);
    });
}

// Get filtered and searched entries list
function getFilteredData() {
    const results = [];
    
    releaseEntries.forEach(entry => {
        const matchedItems = entry.items.filter(item => {
            // Category filter
            const matchesCategory = currentFilter === 'all' || item.type.toLowerCase() === currentFilter.toLowerCase();
            
            // Search keyword filter
            const matchesSearch = !searchQuery || 
                item.text.toLowerCase().includes(searchQuery) || 
                item.type.toLowerCase().includes(searchQuery) ||
                entry.date.toLowerCase().includes(searchQuery);
                
            return matchesCategory && matchesSearch;
        });
        
        if (matchedItems.length > 0) {
            // Clone entry structure but with only matching items
            results.push({
                ...entry,
                items: matchedItems
            });
        }
    });
    
    return results;
}

// Trigger filter application
function applyFiltersAndSearch() {
    renderFeed();
}

// Select a release item to load into the X Composer
function selectReleaseItem(entry, item) {
    selectedItem = {
        date: entry.date,
        type: item.type,
        text: item.text,
        link: entry.link,
        id: `${entry.date}-${item.type}-${item.text.substring(0, 15)}` // pseudo-unique ID
    };
    
    // Show composer details
    selectedDateSpan.textContent = entry.date;
    selectedTypeSpan.textContent = item.type;
    
    // Assign badge design to composer type span
    selectedTypeSpan.className = `badge badge-${item.type.toLowerCase()}`;
    
    // Generate default tweet text
    const defaultText = generateDefaultTweet(entry.date, item.type, item.text, entry.link);
    tweetTextarea.value = defaultText;
    
    // Update active UI elements
    composerEmpty.style.display = 'none';
    composerContent.style.display = 'flex';
    
    // Trigger mobile slide up
    document.body.classList.add('composer-open');
    
    updateTweetPreview();
}

// Generate the pre-composed Tweet text
function generateDefaultTweet(date, type, text, link) {
    // Clean text: strip extra spaces
    let cleanText = text.trim();
    
    // Create base tweet templates
    const prefix = `BigQuery Update (${date})\n📢 [${type}]: `;
    const suffix = `\n\nRead more: ${link}\n#BigQuery #GoogleCloud`;
    
    const availableChars = 280 - prefix.length - suffix.length;
    
    // Truncate text if it's too long
    if (cleanText.length > availableChars) {
        cleanText = cleanText.substring(0, availableChars - 3) + '...';
    }
    
    return `${prefix}${cleanText}${suffix}`;
}

// Update character counter and X post mockup preview
function updateTweetPreview() {
    const text = tweetTextarea.value;
    const charCount = text.length;
    
    // Counter display
    charCounter.textContent = `${charCount} / 280`;
    
    // Style counter based on limit
    charCounter.className = 'char-counter';
    if (charCount > 250 && charCount <= 280) {
        charCounter.classList.add('warning');
        tweetCharWarning.style.display = 'none';
        tweetShareBtn.disabled = false;
    } else if (charCount > 280) {
        charCounter.classList.add('danger');
        tweetCharWarning.style.display = 'block';
        // We still allow clicking to post on X because X will handle it, but we warn the user
    } else {
        tweetCharWarning.style.display = 'none';
        tweetShareBtn.disabled = false;
    }
    
    // Render text with links styled inside the X preview container
    renderXPreviewText(text);
}

// Render text into X preview formatting links as clickable
function renderXPreviewText(text) {
    if (!text) {
        xPreviewText.innerHTML = '';
        return;
    }
    
    // Simple HTML escape
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
    // Format hashtags
    escaped = escaped.replace(/(#[a-zA-Z0-9_]+)/g, '<span class="x-link">$1</span>');
    
    // Format URLs
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<span class="x-link">$1</span>');
    
    // Format release badges/names in brackets if any
    escaped = escaped.replace(/\[(Feature|Fix|Change|Deprecation|General)\]/g, '<strong>[$1]</strong>');
    
    xPreviewText.innerHTML = escaped;
}

// Show standard toast notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Select toast icon
    let icon = '';
    if (type === 'success') {
        icon = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
    } else {
        icon = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        `;
    }
    
    toast.innerHTML = `
        ${icon}
        <span class="toast-message">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after animation finishes
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

// Add CSS keyframe for toast exit
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes toastOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(-50px); opacity: 0; }
}
.x-link {
    color: var(--x-blue);
    cursor: pointer;
}
.x-link:hover {
    text-decoration: underline;
}
.btn-success {
    background-color: rgba(16, 185, 129, 0.15) !important;
    color: #34d399 !important;
    border-color: rgba(16, 185, 129, 0.3) !important;
}
`;
document.head.appendChild(styleSheet);
