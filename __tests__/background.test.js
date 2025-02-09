describe('Background Script', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset modules before each test
    jest.resetModules();
  });

  test('should create context menu on installation', () => {
    require('../background.js');
    
    // Simulate extension installation
    const callback = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
    callback();
    
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({
      id: 'generateAvailability',
      title: 'Generate Availability Slots',
      contexts: ['editable'],
      documentUrlPatterns: ['*://*.google.com/*', '*://*.outlook.com/*']
    });
  });

  test('should handle context menu clicks', () => {
    require('../background.js');
    
    // Get the click handler
    const clickHandler = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
    
    // Simulate click with correct menuItemId
    clickHandler(
      { menuItemId: 'generateAvailability' },
      { id: 123 }
    );
    
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      { action: 'insertAvailability' }
    );
  });

  test('should not send message for other menu items', () => {
    require('../background.js');
    
    // Get the click handler
    const clickHandler = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
    
    // Simulate click with wrong menuItemId
    clickHandler(
      { menuItemId: 'someOtherAction' },
      { id: 123 }
    );
    
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
}); 