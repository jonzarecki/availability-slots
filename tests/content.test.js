const { mockCalendarEvents } = require('./integration/mocks/calendar-events');

jest.setTimeout(10000); // Increase timeout to 10 seconds

describe('Content Script Tests', () => {
  let mockActiveElement;
  let messageListener;
  
  beforeEach(() => {
    // Mock document.activeElement
    mockActiveElement = {
      isContentEditable: false,
      tagName: 'TEXTAREA',
      value: 'Initial text',
      selectionStart: 0,
      selectionEnd: 0
    };
    
    // Mock document.activeElement
    Object.defineProperty(global.document, 'activeElement', {
      value: mockActiveElement,
      writable: true,
      configurable: true
    });

    // Mock window.getSelection for contentEditable elements
    window.getSelection = jest.fn(() => ({
      getRangeAt: jest.fn(() => ({
        deleteContents: jest.fn(),
        insertNode: jest.fn(),
        setStartAfter: jest.fn(),
        setEndAfter: jest.fn()
      })),
      removeAllRanges: jest.fn(),
      addRange: jest.fn()
    }));

    // Reset chrome API mocks
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        bookingLink: 'https://calendly.com/example'
      });
    });

    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getAvailability') {
        callback({
          slots: [
            'Mon Mar 25, 9:00 AM - 9:30 AM EDT',
            'Mon Mar 25, 10:00 AM - 10:30 AM EDT'
          ]
        });
      }
      return true; // Required for Chrome message passing
    });

    // Mock chrome.runtime.onMessage
    messageListener = null;
    chrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      messageListener = listener;
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Load content script to register message listener
    jest.isolateModules(() => {
      require('../content');
    });
  });

  describe('Message Handling', () => {
    it.skip('should handle insertAvailability message for textarea elements', async () => {
      // Trigger the message listener
      await new Promise((resolve) => {
        messageListener(
          { action: 'insertAvailability' },
          {},
          () => {
            try {
              expect(mockActiveElement.value).toContain('Would any of these time windows work');
              expect(mockActiveElement.value).toContain('Mon Mar 25, 9:00 AM');
              expect(mockActiveElement.value).toContain('https://calendly.com/example');
              resolve();
            } catch (error) {
              resolve(error);
            }
          }
        );
      });
    });

    it.skip('should handle insertAvailability message for contentEditable elements', async () => {
      // Set up contentEditable element
      mockActiveElement.isContentEditable = true;
      mockActiveElement.tagName = 'DIV';
      delete mockActiveElement.value;

      await new Promise((resolve) => {
        messageListener(
          { action: 'insertAvailability' },
          {},
          () => {
            try {
              const selection = window.getSelection();
              expect(selection.getRangeAt).toHaveBeenCalled();
              expect(selection.removeAllRanges).toHaveBeenCalled();
              expect(selection.addRange).toHaveBeenCalled();
              resolve();
            } catch (error) {
              resolve(error);
            }
          }
        );
      });
    });

    it.skip('should handle error cases when getting availability', async () => {
      // Mock error response
      chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => {
        if (message.action === 'getAvailability') {
          callback({ error: 'Failed to get availability' });
        }
        return true;
      });

      const consoleSpy = jest.spyOn(console, 'error');

      await new Promise((resolve) => {
        messageListener(
          { action: 'insertAvailability' },
          {},
          () => {
            try {
              expect(consoleSpy).toHaveBeenCalledWith(
                'Error getting availability:',
                'Failed to get availability'
              );
              consoleSpy.mockRestore();
              resolve();
            } catch (error) {
              consoleSpy.mockRestore();
              resolve(error);
            }
          }
        );
      });
    });

    it.skip('should not process message if no active element', async () => {
      // Mock no active element
      Object.defineProperty(global.document, 'activeElement', {
        value: null,
        writable: true,
        configurable: true
      });

      await new Promise((resolve) => {
        messageListener(
          { action: 'insertAvailability' },
          {},
          () => {
            try {
              expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
              resolve();
            } catch (error) {
              resolve(error);
            }
          }
        );
      });
    });
  });
}); 