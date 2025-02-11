// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'generateAvailability',
    title: 'Generate Availability Slots',
    contexts: ['editable'],
    documentUrlPatterns: ['*://*.google.com/*', '*://*.outlook.com/*']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'generateAvailability') {
    chrome.tabs.sendMessage(tab.id, { action: 'insertAvailability' });
  }
});

// Handle messages from popup and options pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);
  switch (request.action) {
    case 'authorize':
      console.log('Starting authorization process...');
      handleAuthorization(sendResponse);
      return true;
    case 'checkAuth':
      console.log('Checking auth status...');
      checkAuthStatus(sendResponse);
      return true;
    case 'getCalendars':
      console.log('Getting calendar list...');
      getCalendarList(sendResponse);
      return true;
    case 'getAvailability':
      console.log('Getting availability slots...');
      getAvailabilitySlots(request, sendResponse);
      return true;
  }
});

// Cache for auth token
let cachedToken = null;
let tokenExpiryTime = null;

// Cache for calendar events
const calendarEventsCache = {
  events: null,
  timestamp: null,
  timeMin: null,
  timeMax: null
};

// Cache expiration time in milliseconds (1 minute)
const CACHE_EXPIRATION = 60 * 1000;

// Helper function to round date to minute precision
function roundToMinute(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d.getTime();
}

async function getAuthToken() {
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    return cachedToken;
  }

  // Get new token
  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });

  // Cache the token for 45 minutes (Google tokens typically last 1 hour)
  cachedToken = token;
  tokenExpiryTime = Date.now() + (45 * 60 * 1000);
  
  return token;
}

async function clearTokens() {
  console.log('Clearing tokens...');
  try {
    const details = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ token });
        }
      });
    });

    if (details.token) {
      console.log('Found existing token, removing...');
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: details.token }, resolve);
      });
      console.log('Token removed');
    }
  } catch (error) {
    console.log('No existing token to clear:', error.message);
  }
}

async function handleAuthorization(sendResponse) {
  console.log('Starting handleAuthorization...');
  try {
    console.log('Clearing existing tokens...');
    await clearTokens();
    
    console.log('Requesting new token...');
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: true 
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
    
    console.log('Received new token:', !!token);
    
    console.log('Verifying token with API call...');
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('API response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token validation failed: ${errorData.error?.message || response.status}`);
    }
    
    console.log('Authorization successful');
    sendResponse({ success: true });
  } catch (error) {
    console.error('Authorization failed:', error);
    console.log('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    await clearTokens();
    sendResponse({ 
      success: false, 
      error: error.message,
      details: 'Please try these steps:\n1. Go to chrome://extensions\n2. Remove the extension\n3. Install it again\n4. Make sure you are signed into Chrome with your Google account'
    });
  }
}

async function checkAuthStatus(sendResponse) {
  console.log('Checking auth status...');
  try {
    console.log('Getting token...');
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
    
    console.log('Token received:', !!token);
    
    console.log('Verifying token...');
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('Verification response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Invalid token: ${errorData.error?.message || response.status}`);
    }
    
    console.log('Auth status check successful');
    sendResponse({ isAuthenticated: true });
  } catch (error) {
    console.error('Auth check failed:', error);
    console.log('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    await clearTokens();
    sendResponse({ isAuthenticated: false, error: error.message });
  }
}

async function getCalendarList(sendResponse) {
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });

    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch calendars');
    }
    
    const data = await response.json();
    sendResponse({ calendars: data.items });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// Add performance logging utility
function logTime(label, startTime) {
  const duration = performance.now() - startTime;
  console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
  return duration;
}

async function fetchCalendarEvents(token, calendar, timeMin, timeMax) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
    `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch calendar events: ${response.status}`);
  }
  
  const data = await response.json();
  return data.items || [];
}

async function getAvailabilitySlots(request, sendResponse) {
  const totalStartTime = performance.now();
  try {
    // Time token acquisition
    const tokenStartTime = performance.now();
    const token = await getAuthToken();
    logTime('Token acquisition', tokenStartTime);

    const { duration, days } = request;

    // Time settings retrieval
    const settingsStartTime = performance.now();
    const settings = await chrome.storage.sync.get([
      'selectedCalendars',
      'includeNoParticipants',
      'includeNoLocation',
      'includeAllDay'
    ]);
    logTime('Settings retrieval', settingsStartTime);

    if (!settings.selectedCalendars || settings.selectedCalendars.length === 0) {
      throw new Error('No calendars selected. Please select calendars in the extension settings.');
    }

    // Calculate time range
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    // Time calendar fetching
    const fetchStartTime = performance.now();
    let calendarResults;
    let cacheHit = false;
    const currentTime = Date.now();
    
    // Check if we have valid cached data with minute-level precision
    const isCacheValid = calendarEventsCache.events && 
                        calendarEventsCache.timestamp && 
                        (currentTime - calendarEventsCache.timestamp) < CACHE_EXPIRATION &&
                        roundToMinute(calendarEventsCache.timeMin) === roundToMinute(timeMin) &&
                        roundToMinute(calendarEventsCache.timeMax) === roundToMinute(timeMax);

    if (isCacheValid) {
      console.log('📦 Using cached calendar events');
      calendarResults = calendarEventsCache.events;
      cacheHit = true;
    } else {
      console.log('🔄 Fetching fresh calendar events');
      // Fetch events from all selected calendars in parallel
      const calendarPromises = settings.selectedCalendars.map(calendar =>
        fetchCalendarEvents(token, calendar, timeMin, timeMax)
      );

      // Wait for all calendar requests to complete
      calendarResults = await Promise.all(calendarPromises);
      
      // Update cache
      calendarEventsCache.events = calendarResults;
      calendarEventsCache.timestamp = currentTime;
      calendarEventsCache.timeMin = timeMin;
      calendarEventsCache.timeMax = timeMax;
      cacheHit = false;
    }
    
    const fetchDuration = logTime('Calendar events fetching', fetchStartTime);
    
    // Time event processing
    const processingStartTime = performance.now();
    
    // Combine and filter all events
    const allEvents = calendarResults.flat().filter(event => {
      if (!settings.includeAllDay && event.start.date) return false;
      if (!settings.includeNoParticipants && (!event.attendees || event.attendees.length === 0)) return false;
      if (!settings.includeNoLocation && !event.location && !event.hangoutLink) return false;
      return true;
    });

    // Sort events by start time
    allEvents.sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start.date);
      const bStart = new Date(b.start.dateTime || b.start.date);
      return aStart - bStart;
    });
    logTime('Event processing (filtering & sorting)', processingStartTime);

    // Time slot finding
    const slotFindingStartTime = performance.now();
    const availableSlots = findAvailableSlots(allEvents, duration, now, days);
    logTime('Finding available slots', slotFindingStartTime);
    
    const totalDuration = logTime('Total execution time', totalStartTime);
    
    // Log summary with cache details
    console.log('\n📊 Performance Summary:');
    console.table({
      'Number of calendars': settings.selectedCalendars.length,
      'Number of events (after filtering)': allEvents.length,
      'Number of available slots': availableSlots ? availableSlots.length : 0,
      'Total time (ms)': totalDuration.toFixed(2),
      'Cache hit': cacheHit,
      'Calendar fetch time (ms)': fetchDuration.toFixed(2),
      'Cache age (ms)': cacheHit ? currentTime - calendarEventsCache.timestamp : 'N/A'
    });

    if (!availableSlots || availableSlots.length === 0) {
      sendResponse({ slots: [], message: 'No available slots found in the selected time range.' });
    } else {
      sendResponse({ slots: availableSlots });
    }
  } catch (error) {
    console.error('Error in getAvailabilitySlots:', error);
    logTime('Total execution time (with error)', totalStartTime);
    sendResponse({ error: error.message, slots: [] });
  }
}

function findAvailableSlots(events, duration, startDate, days) {
  const slotStartTime = performance.now();
  const slots = [];
  const durationMs = duration * 60 * 1000;
  const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Working hours: 9 AM to 5 PM
  const workingHourStart = 9;
  const workingHourEnd = 17;

  // Time event preprocessing
  const preprocessStartTime = performance.now();
  const eventRanges = events
    .filter(event => {
      // Skip events with missing or invalid dates
      try {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        if (!start || !end) return false;
        const startDate = new Date(start);
        const endDate = new Date(end);
        return !isNaN(startDate) && !isNaN(endDate);
      } catch (e) {
        return false;
      }
    })
    .map(event => {
      const start = new Date(event.start.dateTime || event.start.date);
      const end = new Date(event.end.dateTime || event.end.date);
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);
  logTime('Event ranges preprocessing', preprocessStartTime);

  // Binary search to find potential conflicts
  function findConflicts(slotStart, slotEnd) {
    let left = 0;
    let right = eventRanges.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const event = eventRanges[mid];
      
      if (event.end <= slotStart) {
        left = mid + 1;
      }
      else if (event.start >= slotEnd) {
        right = mid - 1;
      }
      else {
        return true;
      }
    }
    
    const startIdx = Math.max(0, left - 1);
    const endIdx = Math.min(eventRanges.length - 1, right + 1);
    
    for (let i = startIdx; i <= endIdx; i++) {
      const event = eventRanges[i];
      if (slotStart < event.end && slotEnd > event.start) {
        return true;
      }
    }
    
    return false;
  }

  const slotsGenerationStartTime = performance.now();
  let currentDate = new Date(startDate);
  currentDate.setHours(workingHourStart, 0, 0, 0);

  let conflictChecks = 0;
  while (currentDate < endDate) {
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workingHourEnd, 0, 0, 0);

      while (currentDate < dayEnd) {
        const slotEnd = new Date(currentDate.getTime() + durationMs);
        
        conflictChecks++;
        if (!findConflicts(currentDate, slotEnd) && slotEnd <= dayEnd) {
          slots.push(formatTimeSlot(currentDate, slotEnd));
        }

        currentDate = new Date(currentDate.getTime() + 30 * 60 * 1000);
      }
    }
    
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    currentDate.setHours(workingHourStart, 0, 0, 0);
  }
  logTime('Slots generation', slotsGenerationStartTime);

  // Log slot finding statistics
  console.log('\n📈 Slot Finding Statistics:');
  console.table({
    'Total conflict checks': conflictChecks,
    'Found slots': slots.length,
    'Events processed': eventRanges.length
  });

  logTime('Total slot finding time', slotStartTime);
  return slots;
}

function formatTimeSlot(start, end) {
  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  
  return `${start.toLocaleString(undefined, options)} - ${end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  const exportedFunctions = {
    findAvailableSlots: (events, duration, startDate, days) => findAvailableSlots(events, duration, startDate, days),
    formatTimeSlot: (start, end) => formatTimeSlot(start, end),
    getAvailabilitySlots: (request, sendResponse) => getAvailabilitySlots(request, sendResponse),
    checkAuthStatus: (sendResponse) => checkAuthStatus(sendResponse),
    getCalendarList: (sendResponse) => getCalendarList(sendResponse)
  };
  module.exports = exportedFunctions;
} 