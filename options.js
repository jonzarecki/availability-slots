document.addEventListener('DOMContentLoaded', function() {
  const authorizeButton = document.getElementById('authorize');
  const authStatus = document.getElementById('authStatus');
  const calendarList = document.getElementById('calendarList');
  const saveButton = document.getElementById('save');
  
  // Settings inputs
  const includeNoParticipants = document.getElementById('includeNoParticipants');
  const includeNoLocation = document.getElementById('includeNoLocation');
  const includeAllDay = document.getElementById('includeAllDay');
  const durationSelect = document.getElementById('duration');
  const daysSelect = document.getElementById('days');
  const bookingLinkInput = document.getElementById('bookingLink');

  // Load all saved settings
  chrome.storage.sync.get([
    'selectedCalendars',
    'includeNoParticipants',
    'includeNoLocation',
    'includeAllDay',
    'duration',
    'days',
    'bookingLink'
  ], function(result) {
    includeNoParticipants.checked = result.includeNoParticipants || false;
    includeNoLocation.checked = result.includeNoLocation || false;
    includeAllDay.checked = result.includeAllDay || false;
    
    if (result.duration) {
      durationSelect.value = result.duration;
    }
    if (result.days) {
      daysSelect.value = result.days;
    }
    if (result.bookingLink) {
      bookingLinkInput.value = result.bookingLink;
    }
  });

  // Check authentication status on load
  checkAuthStatus();

  authorizeButton.addEventListener('click', async function() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'authorize' });
      if (response.success) {
        authStatus.textContent = 'Successfully connected to Google Calendar';
        authStatus.className = 'status success';
        loadCalendars();
      } else {
        throw new Error(response.error || 'Failed to connect to Google Calendar');
      }
    } catch (error) {
      authStatus.textContent = error.message;
      authStatus.className = 'status error';
    }
  });

  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // Force a reflow to trigger the animation
    toast.offsetHeight;
    
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  saveButton.addEventListener('click', function() {
    // Get all selected calendars
    const selectedCalendars = Array.from(document.querySelectorAll('.calendar-item input[type="checkbox"]:checked'))
      .map(checkbox => ({
        id: checkbox.dataset.calendarId,
        name: checkbox.dataset.calendarName
      }));

    if (selectedCalendars.length === 0) {
      showToast('Please select at least one calendar', 'error');
      return;
    }

    // Save all settings
    chrome.storage.sync.set({
      selectedCalendars,
      includeNoParticipants: includeNoParticipants.checked,
      includeNoLocation: includeNoLocation.checked,
      includeAllDay: includeAllDay.checked,
      duration: durationSelect.value,
      days: daysSelect.value,
      bookingLink: bookingLinkInput.value
    }, function() {
      if (chrome.runtime.lastError) {
        showToast('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showToast('Settings saved successfully!');
      }
    });
  });

  async function checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      if (response.isAuthenticated) {
        authStatus.textContent = 'Connected to Google Calendar';
        authStatus.className = 'status success';
        loadCalendars();
      } else {
        authStatus.textContent = 'Not connected to Google Calendar';
        authStatus.className = 'status error';
      }
    } catch (error) {
      authStatus.textContent = error.message;
      authStatus.className = 'status error';
    }
  }

  async function loadCalendars() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCalendars' });
      if (response.calendars) {
        // Get previously selected calendars
        chrome.storage.sync.get(['selectedCalendars'], function(result) {
          const selectedCalendarIds = (result.selectedCalendars || []).map(cal => cal.id);
          
          // Clear existing list
          calendarList.innerHTML = '';
          
          // Add calendars to the list
          response.calendars.forEach(calendar => {
            const calendarItem = document.createElement('div');
            calendarItem.className = 'calendar-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedCalendarIds.includes(calendar.id);
            checkbox.dataset.calendarId = calendar.id;
            checkbox.dataset.calendarName = calendar.summary;
            
            const label = document.createElement('label');
            label.textContent = calendar.summary;
            
            calendarItem.appendChild(checkbox);
            calendarItem.appendChild(label);
            calendarList.appendChild(calendarItem);
          });
        });
      }
    } catch (error) {
      const errorDiv = document.createElement('div');
      errorDiv.textContent = `Error loading calendars: ${error.message}`;
      errorDiv.className = 'status error';
      calendarList.appendChild(errorDiv);
    }
  }
}); 