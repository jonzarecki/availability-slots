// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'insertAvailability') {
    // Get the active element (should be an editable field)
    const activeElement = document.activeElement;
    
    if (activeElement && (activeElement.isContentEditable || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      // Send message to popup to generate availability
      chrome.runtime.sendMessage({ 
        action: 'getAvailability',
        duration: 30, // Default to 30 minutes
        days: 5 // Default to 5 days
      }, response => {
        if (response.error) {
          console.error('Error getting availability:', response.error);
          return;
        }

        // Get timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Get booking link from storage
        chrome.storage.sync.get(['bookingLink'], result => {
          // Format the message
          let message = `Would any of these time windows work for a 30 minute meeting (${timezone})?\n\n`;
          
          response.slots.forEach(slot => {
            message += `• ${slot}\n`;
          });

          if (result.bookingLink) {
            message += `\nFeel free to use this booking page if that's easier (also contains more availabilities):\n${result.bookingLink}`;
          }

          // Insert the message at cursor position
          if (activeElement.isContentEditable) {
            // For contentEditable elements (like Gmail compose)
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode(message);
            range.deleteContents();
            range.insertNode(textNode);
            
            // Move cursor to end
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // For regular input/textarea elements
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;
            const text = activeElement.value;
            
            activeElement.value = text.substring(0, start) + message + text.substring(end);
            
            // Move cursor to end of inserted text
            activeElement.selectionStart = activeElement.selectionEnd = start + message.length;
          }
        });
      });
    }
  }
}); 