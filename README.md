# Availability Slots Chrome Extension

A Chrome extension that helps you quickly share your availability from Google Calendar. Perfect for scheduling meetings and responding to availability requests.
[Store Link](https://chromewebstore.google.com/detail/availability-slots/hifjjfcaijgndblbjnkhadkaajbkkipj).

## Features

- 🗓️ Integrates with Google Calendar
- ⚡ Quick access through context menu in Gmail and Outlook
- 🕒 Customizable time slots and duration
- 🌍 Timezone-aware availability sharing
- 🔗 Optional booking link integration
- ⚙️ Flexible calendar selection and filtering options

## Setup Instructions

1. Clone or download this repository
2. Get a Google OAuth 2.0 Client ID:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Calendar API
   - Go to Credentials
   - Create an OAuth 2.0 Client ID for Chrome Extension
   - Add your extension ID to the authorized origins
3. Replace `${YOUR_CLIENT_ID}` in `manifest.json` with your actual OAuth 2.0 Client ID
4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## Usage

1. Click the extension icon to open the popup
2. First time setup:
   - Click "Calendar Settings"
   - Connect your Google Calendar
   - Select which calendars to include
   - Configure calendar settings (event filtering)
   - Save your settings
3. Optional: Add your booking page URL in the popup
4. To use:
   - Method 1: Click the extension icon, set duration and days to look ahead, click "Generate Availability"
   - Method 2: Right-click in any editable field in Gmail or Outlook and select "Generate Availability Slots"

## Calendar Settings

- Select which calendars to include in availability calculation
- Configure whether to:
  - Include events without participants
  - Include events without conferencing/location
  - Include all-day events

## Development

The extension is built using:
- Manifest V3
- Google Calendar API
- Chrome Extension APIs (identity, storage, contextMenus)
- Jest for testing

### Files Structure

- `manifest.json`: Extension configuration
- `popup.html/js`: Extension popup interface
- `options.html/js`: Calendar settings page
- `background.js`: Background service worker
- `content.js`: Content script for webpage integration
- `tests/`: Test files
  - `integration/`: Integration tests
  - `jest.setup.js`: Jest configuration and mocks

### Testing

The project uses Jest for testing:
```bash
# Run tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run tests for CI
npm run test:ci
```

Tests are automatically run on GitHub Actions for every push and pull request.
Coverage reports are automatically uploaded to Codecov.

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests to verify setup:
   ```bash
   npm test
   ```

## Privacy

The extension only requests necessary permissions:
- Google Calendar API access (read-only)
- Storage for settings
- Context menu for quick access
- Active tab for inserting availability

No data is sent to any third-party servers. All calendar processing happens locally within the extension. 
