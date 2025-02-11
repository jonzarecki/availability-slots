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

// Cache for calendar events - store per calendar
const calendarEventsCache = new Map();

// Cache expiration time in milliseconds (1 minute)
const CACHE_EXPIRATION = 60 * 1000;

// Helper function to round date to minute precision
function roundToMinute(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d.getTime();
}

// Helper function to normalize time string to minute precision
function normalizeTimeString(timeString) {
  const date = new Date(timeString);
  date.setSeconds(0, 0);
  return date.toISOString();
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

// Helper function to check if cache is valid
function isCacheValid(calendar, timeMin, timeMax) {
  console.log('\n🔍 Checking cache for calendar:', calendar.id);
  const cacheEntry = calendarEventsCache.get(calendar.id);
  
  if (!cacheEntry) {
    console.log('❌ No cache entry found');
    return false;
  }
  
  const now = Date.now();
  const cacheAge = now - cacheEntry.timestamp;
  const isExpired = cacheAge >= CACHE_EXPIRATION;
  
  // Normalize time ranges for comparison
  const normalizedRequestedTimeMin = normalizeTimeString(timeMin);
  const normalizedRequestedTimeMax = normalizeTimeString(timeMax);
  const normalizedCachedTimeMin = normalizeTimeString(cacheEntry.timeMin);
  const normalizedCachedTimeMax = normalizeTimeString(cacheEntry.timeMax);
  
  // Compare time ranges
  console.log('Time range comparison:', {
    cached: {
      timeMin: normalizedCachedTimeMin,
      timeMax: normalizedCachedTimeMax
    },
    requested: {
      timeMin: normalizedRequestedTimeMin,
      timeMax: normalizedRequestedTimeMax
    }
  });
  
  const timeRangeMatch = normalizedCachedTimeMin === normalizedRequestedTimeMin && 
                        normalizedCachedTimeMax === normalizedRequestedTimeMax;
  
  console.log('Cache diagnostics:', {
    hasEvents: cacheEntry.events !== null,
    cacheAge: `${(cacheAge / 1000).toFixed(1)}s`,
    isExpired,
    timeRangeMatch
  });

  const isValid = cacheEntry.events !== null &&
                 !isExpired &&
                 timeRangeMatch;

  console.log(isValid ? '✅ Cache valid' : '❌ Cache invalid');
  return isValid;
}

async function fetchCalendarEvents(token, calendar, timeMin, timeMax) {
  console.log(`\n📅 Processing calendar: ${calendar.id}`);
  
  // Check if we have valid cached events
  if (isCacheValid(calendar, timeMin, timeMax)) {
    console.log('💾 Using cached events');
    const cachedEvents = calendarEventsCache.get(calendar.id).events;
    console.log(`Found ${cachedEvents.length} events in cache`);
    return cachedEvents;
  }

  console.log('🌐 Fetching fresh events from API');
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
  const events = data.items || [];
  console.log(`Fetched ${events.length} events from API`);

  // Update cache for this calendar
  console.log('💾 Updating cache');
  calendarEventsCache.set(calendar.id, {
    events,
    timestamp: Date.now(),
    timeMin,
    timeMax
  });

  return events;
}

async function getAvailabilitySlots(request, sendResponse) {
  const startTime = performance.now();
  let fetchDuration = 0;
  let cacheHits = 0;
  
  try {
    console.log('\n📅 Processing availability request - Full request:', request);
    console.log('Request parameters:', {
      timeMin: request.timeMin,
      timeMax: request.timeMax,
      duration: request.duration,
      days: request.days,
      settings: request.settings
    });

    // Ensure timeMin and timeMax are properly formatted and normalized ISO strings
    const timeMin = normalizeTimeString(request.timeMin);
    const timeMax = normalizeTimeString(request.timeMax);

    const settings = await chrome.storage.sync.get([
      'selectedCalendars',
      'includeNoParticipants',
      'includeNoLocation',
      'includeAllDay'
    ]);

    // Merge request settings with stored settings
    const mergedSettings = {
      ...settings,
      ...(request.settings || {})
    };

    // Get events from all selected calendars
    const allEvents = [];
    const token = await getAuthToken();
    const fetchStartTime = performance.now();

    for (const calendar of settings.selectedCalendars || []) {
      const events = await fetchCalendarEvents(token, calendar, timeMin, timeMax);
      if (calendarEventsCache.get(calendar.id)?.events === events) {
        cacheHits++;
      }
      allEvents.push(...events);
    }

    fetchDuration = performance.now() - fetchStartTime;

    // Find available slots
    const slots = findAvailableSlots(
      allEvents,
      request.duration,
      new Date(timeMin),
      request.days,
      mergedSettings
    );

    const totalDuration = performance.now() - startTime;

    // Log performance summary
    console.log('\n📊 Performance Summary:');
    console.table({
      'Number of calendars': settings.selectedCalendars?.length || 0,
      'Number of events (after filtering)': allEvents.length,
      'Number of available slots': slots?.length || 0,
      'Total time (ms)': totalDuration.toFixed(2),
      'Cache hits': cacheHits,
      'Calendar fetch time (ms)': fetchDuration.toFixed(2),
      'Cache hit ratio': `${((cacheHits / (settings.selectedCalendars?.length || 1)) * 100).toFixed(1)}%`
    });

    sendResponse({ slots });
  } catch (error) {
    console.error('Error getting availability:', error);
    const totalDuration = performance.now() - startTime;
    
    // Log error performance summary
    console.log('\n❌ Error Performance Summary:');
    console.table({
      'Total time until error (ms)': totalDuration.toFixed(2),
      'Calendar fetch time (ms)': fetchDuration.toFixed(2),
      'Cache hits before error': cacheHits,
      'Error message': error.message
    });
    
    sendResponse({ error: error.message });
  }
}

function findAvailableSlots(events = [], duration = 30, startDate = new Date(), days = 5, settings = {}) {
  // Default settings
  const defaultSettings = {
    includeAllDay: false,
    includeNoLocation: true,
    maxSlots: 0,
    diversify: false
  };
  settings = { ...defaultSettings, ...settings };

  const slotStartTime = performance.now();
  const durationMs = duration * 60 * 1000;
  startDate = new Date(startDate); // Ensure startDate is a Date object
  const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

  // Working hours: 9 AM to 5 PM
  const workingHourStart = 9;
  const workingHourEnd = 17;

  // Time event preprocessing
  const preprocessStartTime = performance.now();
  const eventRanges = (events || [])
    .filter(event => event && event.start && event.end) // Filter out malformed events
    .map(event => {
      try {
        const start = new Date(event.start.dateTime || event.start.date);
        const end = new Date(event.end.dateTime || event.end.date);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
        return { start, end, event }; // Include original event for filtering
      } catch (error) {
        console.warn('Error processing event:', error);
        return null;
      }
    })
    .filter(range => range !== null) // Remove failed conversions
    .filter(({ event }) => {
      try {
        // Apply calendar settings filters
        if (event.start.date && !settings.includeAllDay) return false;
        if (!settings.includeNoLocation && !event.location && !event.hangoutLink) return false;
        // Consider events as busy if transparency is undefined (default) or 'opaque'
        // Only busy events should block time slots
        // Free events (transparency: 'transparent') should not block time slots
        return event.transparency !== 'transparent';
      } catch (error) {
        console.warn('Error filtering event:', error);
        return false;
      }
    })
    .sort((a, b) => a.start - b.start);
  logTime('Event ranges preprocessing', preprocessStartTime);

  // Binary search to find potential conflicts
  function findConflicts(slotStart, slotEnd) {
    // If no events, there can't be conflicts
    if (eventRanges.length === 0) return false;

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

  let conflictChecks = 0;
  const slotsByDay = {};
  let slots = [];
  
  // Initialize currentDate to start of working hours on startDate
  let currentDate = new Date(startDate);
  currentDate.setHours(workingHourStart, 0, 0, 0);
  
  // Process each day
  let daysProcessed = 0;
  while (currentDate < endDate && daysProcessed < days) {
    // Skip weekends
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      currentDate.setHours(workingHourStart, 0, 0, 0);
      continue;
    }

    const dayStart = new Date(currentDate);
    const dayEnd = new Date(currentDate);
    dayStart.setHours(workingHourStart, 0, 0, 0);
    dayEnd.setHours(workingHourEnd, 0, 0, 0);

    // Skip to next day if we're past the end time for today
    if (currentDate > dayEnd) {
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      currentDate.setHours(workingHourStart, 0, 0, 0);
      continue;
    }

    // Start from the later of dayStart or currentDate
    const slotStart = new Date(Math.max(dayStart.getTime(), currentDate.getTime()));

    // Group slots by day for diversification
    const day = formatTimeSlot(slotStart, slotStart).split(',')[0];
    if (!slotsByDay[day]) slotsByDay[day] = [];

    // Calculate max slots per day based on settings
    const maxSlotsPerDay = settings?.maxSlots > 0
      ? Math.ceil(settings.maxSlots / 2) // Allow up to half of maxSlots per day
      : Infinity;

    while (slotStart < dayEnd) {
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      
      conflictChecks++;
      if (!findConflicts(slotStart, slotEnd) && slotEnd <= dayEnd) {
        const slot = formatTimeSlot(slotStart, slotEnd);
        
        // Only add the slot if we haven't exceeded maxSlotsPerDay
        if (slotsByDay[day].length < maxSlotsPerDay) {
          slotsByDay[day].push(slot);
        }

        // Break early if we have enough slots and not diversifying
        if (!settings?.diversify && settings?.maxSlots > 0 && 
            Object.values(slotsByDay).flat().length >= settings.maxSlots) {
          break;
        }
      }
      
      slotStart.setTime(slotStart.getTime() + 30 * 60 * 1000);
    }

    // Break early if we have enough slots and not diversifying
    if (!settings?.diversify && settings?.maxSlots > 0 && 
        Object.values(slotsByDay).flat().length >= settings.maxSlots) {
      break;
    }
    
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    currentDate.setHours(workingHourStart, 0, 0, 0);
    daysProcessed++;
  }

  // Handle maxSlots and diversification
  console.log('\n🔍 Debug - Settings:', {
    maxSlots: settings?.maxSlots,
    diversify: settings?.diversify,
    totalSlots: Object.values(slotsByDay).flat().length,
    daysAvailable: Object.keys(slotsByDay).length
  });

  if (settings?.maxSlots > 0) {
    console.log('\n🔍 Diversification Debug:');
    console.log('Total days available:', Object.keys(slotsByDay).length);
    console.log('Days:', Object.keys(slotsByDay));
    console.log('Max slots requested:', settings.maxSlots);
    console.log('Slots per day:', Object.entries(slotsByDay).map(([day, slots]) => `${day}: ${slots.length}`));
    
    const totalAvailableSlots = Object.values(slotsByDay).flat().length;
    
    // If we have fewer slots than maxSlots, return all available slots
    if (totalAvailableSlots <= settings.maxSlots) {
      slots = Object.values(slotsByDay).flat();
    } else if (settings.diversify) {
      const days = Object.keys(slotsByDay).sort((a, b) => a.localeCompare(b));
      const diverseSlots = [];
      
      // Calculate how many slots to take per day
      let remainingSlots = settings.maxSlots;
      
      // Take slots from each day
      for (const day of days) {
        if (remainingSlots <= 0) break;
        
        const daySlots = slotsByDay[day];
        const daysLeft = days.length - days.indexOf(day);
        const isLastDay = daysLeft === 1;
        
        // For all days except the last one, take floor(remainingSlots / daysLeft)
        // For the last day, take all remaining slots
        const slotsToTake = isLastDay
          ? remainingSlots
          : Math.min(
              Math.floor(remainingSlots / daysLeft), // Distribute remaining slots evenly
              daySlots.length
            );
        
        console.log(`\nProcessing ${day}:`);
        console.log('- Days left:', daysLeft);
        console.log('- Remaining slots:', remainingSlots);
        console.log('- Available slots for day:', daySlots.length);
        console.log('- Slots to take:', slotsToTake);
        
        diverseSlots.push(...daySlots.slice(0, slotsToTake));
        remainingSlots -= slotsToTake;
        
        console.log('- Total slots collected so far:', diverseSlots.length);
        console.log('- Remaining slots after:', remainingSlots);
      }
      
      console.log('\nFinal Results:');
      console.log('Total slots collected:', diverseSlots.length);
      console.log('Slots per day:', diverseSlots.reduce((acc, slot) => {
        const day = slot.split(',')[0];
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {}));
      
      slots = diverseSlots;
    } else {
      // If not diversifying, just take the first maxSlots slots
      slots = Object.values(slotsByDay)
        .flat()
        .slice(0, settings.maxSlots);
    }
  } else {
    slots = Object.values(slotsByDay).flat();
  }

  // Sort all slots by time within their days
  slots.sort((a, b) => {
    const [dayA, timeA] = a.split(', ');
    const [dayB, timeB] = b.split(', ');
    if (dayA === dayB) {
      return new Date(`2024-01-01 ${timeA.split(' - ')[0]}`).getTime() -
             new Date(`2024-01-01 ${timeB.split(' - ')[0]}`).getTime();
    }
    return dayA.localeCompare(dayB);
  });

  // Log slot finding statistics
  console.log('\n📈 Slot Finding Statistics:');
  console.table({
    'Total conflict checks': conflictChecks,
    'Found slots': slots.length,
    'Days with slots': new Set(slots.map(s => s.split(',')[0])).size,
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
    findAvailableSlots: (events, duration, startDate, days, settings) => findAvailableSlots(events, duration, startDate, days, settings),
    formatTimeSlot: (start, end) => formatTimeSlot(start, end),
    getAvailabilitySlots: (request, sendResponse) => getAvailabilitySlots(request, sendResponse),
    checkAuthStatus: (sendResponse) => checkAuthStatus(sendResponse),
    getCalendarList: (sendResponse) => getCalendarList(sendResponse)
  };
  module.exports = exportedFunctions;
} 