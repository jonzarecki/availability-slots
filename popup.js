document.addEventListener('DOMContentLoaded', async function() {
  const availabilityText = document.getElementById('availabilityText');
  const openOptionsButton = document.getElementById('openOptions');
  const copyStatus = document.getElementById('copyStatus');

  // Check authentication status first
  try {
    const authResponse = await chrome.runtime.sendMessage({ action: 'checkAuth' });
    
    if (!authResponse.isAuthenticated) {
      console.log('Not authenticated, requesting authorization...');
      const authResult = await chrome.runtime.sendMessage({ action: 'authorize' });
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authorization failed');
      }
    }

    // Now that we're authenticated, get availability
    // Get settings from storage
    const settings = await chrome.storage.sync.get([
      'duration',
      'days',
      'bookingLink',
      'selectedCalendars'
    ]);

    // Check if calendars are selected
    if (!settings.selectedCalendars || settings.selectedCalendars.length === 0) {
      throw new Error('No calendars selected. Please go to extension settings and select at least one calendar.');
    }

    // Use default values if not set
    const duration = settings.duration || 30;
    const days = settings.days || 5;
    const bookingLink = settings.bookingLink || '';

    // Get the user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Get free slots from the background script
    const response = await chrome.runtime.sendMessage({
      action: 'getAvailability',
      duration: parseInt(duration),
      days: parseInt(days)
    });

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.slots || response.slots.length === 0) {
      availabilityText.value = `No availability found in the next ${days} days for a ${duration} minute meeting.\n\n`;
      if (bookingLink) {
        availabilityText.value += `Please use my booking page for more options:\n${bookingLink}`;
      }
      return;
    }

    // Format the availability message
    let message = `Would any of these time windows work for a ${duration} minute meeting (${timezone})?\n\n`;
    
    // Format each time slot
    response.slots.forEach(slot => {
      message += `• ${slot}\n`;
    });

    if (bookingLink) {
      message += `\nFeel free to use this booking page if that's easier (also contains more availabilities):\n${bookingLink}`;
    }

    // Update textarea and copy to clipboard
    availabilityText.value = message;
    await copyToClipboard(message);
    
    // Show copy status
    copyStatus.classList.add('show');
    setTimeout(() => {
      copyStatus.classList.remove('show');
    }, 2000);

  } catch (error) {
    console.error('Error:', error);
    availabilityText.value = `Error: ${error.message}\n\nPlease try:\n1. Click the extension icon again\n2. Make sure you're signed into Chrome with your Google account\n3. Go to extension settings and select your calendars`;
  }

  // Add click handler for the settings button
  openOptionsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Add click handler for the textarea to copy again
  availabilityText.addEventListener('click', async function() {
    if (availabilityText.value && !availabilityText.value.startsWith('Error:')) {
      await copyToClipboard(availabilityText.value);
      copyStatus.classList.add('show');
      setTimeout(() => {
        copyStatus.classList.remove('show');
      }, 2000);
    }
  });
});

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.getElementById('availabilityText');
    textarea.select();
    document.execCommand('copy');
  }
} 