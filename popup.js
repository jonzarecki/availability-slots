document.addEventListener('DOMContentLoaded', async function() {
  const availabilityText = document.getElementById('availabilityText');
  const openOptionsButton = document.getElementById('openOptions');
  const copyStatus = document.getElementById('copyStatus');

  // Generate availability immediately when popup opens
  try {
    // Get settings from storage
    const settings = await chrome.storage.sync.get([
      'duration',
      'days',
      'bookingLink'
    ]);

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
      availabilityText.value = `Error: ${response.error}`;
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
    availabilityText.value = `Error: ${error.message}`;
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

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for older browsers
      availabilityText.select();
      document.execCommand('copy');
    }
  }
}); 