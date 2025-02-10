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

async function getAvailabilitySlots(request, sendResponse) {
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

    const { duration, days } = request;

    // Get selected calendars and settings
    const settings = await chrome.storage.sync.get([
      'selectedCalendars',
      'includeNoParticipants',
      'includeNoLocation',
      'includeAllDay'
    ]);

    if (!settings.selectedCalendars || settings.selectedCalendars.length === 0) {
      throw new Error('No calendars selected. Please select calendars in the extension settings.');
    }

    // Calculate time range
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    // Get events from all selected calendars
    const allEvents = [];
    for (const calendar of settings.selectedCalendars) {
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
      
      if (!data.items) {
        console.warn(`No items found for calendar ${calendar.name}`);
        continue;
      }
      
      // Filter events based on settings
      const filteredEvents = data.items.filter(event => {
        if (!settings.includeAllDay && event.start.date) return false;
        if (!settings.includeNoParticipants && (!event.attendees || event.attendees.length === 0)) return false;
        if (!settings.includeNoLocation && !event.location && !event.hangoutLink) return false;
        return true;
      });
      
      allEvents.push(...filteredEvents);
    }

    // Sort events by start time
    allEvents.sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start.date);
      const bStart = new Date(b.start.dateTime || b.start.date);
      return aStart - bStart;
    });

    // Find available slots
    const availableSlots = findAvailableSlots(allEvents, duration, now, days);
    
    if (!availableSlots || availableSlots.length === 0) {
      sendResponse({ slots: [], message: 'No available slots found in the selected time range.' });
    } else {
      sendResponse({ slots: availableSlots });
    }
  } catch (error) {
    console.error('Error in getAvailabilitySlots:', error);
    sendResponse({ error: error.message, slots: [] });
  }
}

function findAvailableSlots(events, duration, startDate, days) {
  const slots = [];
  const durationMs = duration * 60 * 1000;
  const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Working hours: 9 AM to 5 PM
  const workingHourStart = 9;
  const workingHourEnd = 17;

  let currentDate = new Date(startDate);
  currentDate.setHours(workingHourStart, 0, 0, 0);

  while (currentDate < endDate) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workingHourEnd, 0, 0, 0);

      while (currentDate < dayEnd) {
        const slotEnd = new Date(currentDate.getTime() + durationMs);
        
        // Check if slot overlaps with any event
        const hasConflict = events.some(event => {
          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);
          return (currentDate < eventEnd && slotEnd > eventStart);
        });

        if (!hasConflict && slotEnd <= dayEnd) {
          slots.push(formatTimeSlot(currentDate, slotEnd));
        }

        // Move to next 30-minute increment
        currentDate = new Date(currentDate.getTime() + 30 * 60 * 1000);
      }
    }
    
    // Move to next day
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    currentDate.setHours(workingHourStart, 0, 0, 0);
  }

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