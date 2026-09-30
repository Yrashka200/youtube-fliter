# YouTube Feed Filter

> A lightweight and configurable Chrome extension for controlling, filtering, and optimizing the YouTube browsing experience.

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome\&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Version](https://img.shields.io/badge/version-1.4.0-blue)](https://github.com/Yrashka200/youtube-fliter)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Overview

**YouTube Feed Filter** is a browser extension designed to give users greater control over the content displayed on YouTube.

The extension works directly inside YouTube and provides a centralized interface for filtering unwanted content, managing personal filtering profiles, controlling video presentation, blocking advertisements, and applying performance-oriented optimizations.

Unlike traditional browser extensions that focus on a single filtering rule, YouTube Feed Filter combines multiple controls into one configurable tool.

### Key capabilities

* Filter videos by predefined categories
* Filter content using custom keywords
* Detect and filter Russian and English content
* Hide YouTube Shorts
* Hide already watched videos
* Customize video layout and size
* Block multiple types of advertisements
* Apply YouTube performance optimizations
* Create and switch between filtering profiles
* Persist settings using browser storage
* Receive extension notifications
* Check for new versions and view the changelog

---

## Features

### Content Filtering

YouTube Feed Filter can analyze YouTube video cards and remove content that matches the user's configured filtering rules.

Supported content categories include:

* Gaming
* Sports
* Politics
* Music
* News
* Movies
* Technology
* Cryptocurrency
* Kids content
* Shorts

The extension uses keyword-based matching to identify relevant content. The built-in keyword dictionary contains both English and Russian terms.

Custom keywords can also be configured for more precise filtering.

---

### Language Filtering

The extension includes lightweight language detection based on the textual content of YouTube videos.

Currently, the filtering logic can identify:

* English content
* Russian content
* Unknown / unsupported language

This makes it possible to reduce unwanted content based on language without requiring an external API or remote language-processing service.

---

### Shorts Filtering

YouTube Shorts can be hidden independently from other filtering rules.

This is useful for users who prefer a traditional long-form YouTube feed and want to remove short-form content from their browsing experience.

---

### Watched Video Filtering

The extension can automatically hide videos that have already been watched.

This helps keep recommendation feeds focused on content that has not yet been viewed.

---

### Video Layout Control

YouTube Feed Filter provides controls for changing the presentation and size of YouTube video elements.

The extension can apply a custom video-size configuration directly to the YouTube interface without modifying the underlying video content.

---

### Advertisement Blocking

The extension includes several advertisement-blocking mechanisms.

Depending on the selected configuration, it can target:

* Video advertisements
* Banner advertisements
* Popup advertisements
* Advertisement-related network requests

Advertisement-related rules are implemented using Chrome's `declarativeNetRequest` API.

The extension therefore does not rely exclusively on DOM manipulation for advertisement filtering.

---

### Performance Optimization

YouTube Feed Filter includes optional optimization features intended to reduce unnecessary UI and rendering overhead.

Available optimization controls include:

* Animation optimization
* Video optimization
* Visual effects optimization
* DOM-related optimization
* Optimized content scanning
* General optimization mode

These settings can be enabled independently depending on the desired balance between performance and visual behavior.

---

### Filtering Profiles

Users can maintain multiple filtering profiles.

Profiles make it possible to create different configurations for different use cases.

For example:

```text
Work
 ├── Hide gaming
 ├── Hide Shorts
 ├── Hide watched videos
 └── Enable performance optimization

Personal
 ├── Allow gaming
 ├── Hide politics
 ├── Hide watched videos
 └── Standard video size

Minimal
 ├── Hide Shorts
 ├── Hide advertisements
 └── Default content filtering
```

A profile can be selected directly from the extension interface.

---

### Persistent Configuration

Extension settings are stored locally using the browser's storage capabilities.

This allows preferences such as filtering rules, profiles, video layout settings, advertisement controls, and optimization settings to persist between browser sessions.

---

### Updates and Changelog

The extension includes an update-checking mechanism that compares the installed version with the version published in the GitHub repository.

The project can retrieve:

* Current remote version information
* Changelog information
* Repository update information

Users can also access changelog information directly from the extension interface.

---

## How It Works

The extension is built around Chrome's **Manifest V3** architecture.

At a high level, the application consists of four main layers:

```text
┌──────────────────────────────┐
│         YouTube Page         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│        content.js            │
│                              │
│  • Detect video elements     │
│  • Analyze content           │
│  • Apply filters             │
│  • Hide unwanted elements    │
│  • Apply UI optimizations    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│         Browser Storage      │
│                              │
│  • Settings                  │
│  • Profiles                  │
│  • Filtering rules           │
└──────────────┬───────────────┘
               ▲
               │
┌──────────────┴───────────────┐
│          popup.html          │
│          popup.js            │
│                              │
│  User configuration UI       │
└──────────────────────────────┘

               +
               
┌──────────────────────────────┐
│       background.js          │
│                              │
│  Background extension logic  │
│  and browser events          │
└──────────────────────────────┘

               +

┌──────────────────────────────┐
│   declarativeNetRequest      │
│                              │
│   Network-level ad rules     │
└──────────────────────────────┘
```

The extension injects `content.js` and `styles.css` into YouTube pages and uses a background service worker for extension-level background operations.

---

## Installation

The project can currently be installed manually as an unpacked Chrome extension.

### Requirements

* Google Chrome or another Chromium-based browser
* Git
* A local copy of this repository

No Node.js, npm, build system, or external dependencies are required for the current repository structure.

### 1. Clone the repository

```bash
git clone https://github.com/Yrashka200/youtube-fliter.git
```

### 2. Open the Extensions page

Open:

```text
chrome://extensions/
```

Alternatively:

1. Open Chrome
2. Go to **Extensions**
3. Enable **Developer mode**

### 3. Load the extension

Click:

**Load unpacked**

Select the cloned project directory:

```text
youtube-fliter/
```

Chrome will load the extension immediately.

### 4. Open YouTube

Navigate to:

```text
https://www.youtube.com/
```

The extension will automatically inject its filtering and customization functionality into YouTube pages.

---

## Configuration

Click the **YouTube Feed Filter** extension icon in the browser toolbar to open the configuration interface.

The popup provides access to the extension's settings and profile management.

A typical configuration workflow is:

```text
Open Extension
      │
      ▼
Select Profile
      │
      ▼
Configure Filters
      │
      ├── Categories
      ├── Keywords
      ├── Language
      ├── Shorts
      └── Watched Videos
      │
      ▼
Configure Display
      │
      └── Video Size
      │
      ▼
Configure Ads
      │
      ├── Video Ads
      ├── Banners
      ├── Popups
      └── Network Rules
      │
      ▼
Configure Optimization
      │
      └── Performance Options
```

---

## Project Structure

```text
youtube-fliter/
│
├── manifest.json
│
├── background.js
│
├── content.js
│
├── popup.html
├── popup.js
├── styles.css
│
├── updater.js
│
├── welcome.html
├── welcome.js
│
├── LICENSE
└── README.md
```

### `manifest.json`

Defines the Chrome extension configuration, permissions, host permissions, content scripts, popup, background service worker, and network filtering rules.

The project uses **Manifest V3**.

### `content.js`

The core of the extension.

Responsible for:

* Detecting YouTube video elements
* Reading video metadata
* Applying category filters
* Applying keyword filters
* Detecting language
* Hiding Shorts
* Hiding watched content
* Applying video-size settings
* Applying advertisement-related UI rules
* Applying performance optimizations

### `popup.html`

Defines the extension's configuration interface.

It contains the user-facing controls for managing profiles, filters, settings, updates, notifications, and other extension functionality.

### `popup.js`

Controls the popup interface and communicates configuration changes to the extension.

### `styles.css`

Contains styles injected into YouTube pages to support the extension's visual behavior and filtering states.

### `background.js`

Acts as the extension's Manifest V3 background service worker.

### `updater.js`

Provides the update-checking functionality and retrieves version information from the project's GitHub repository.

### `welcome.html` / `welcome.js`

Provide the extension's welcome / onboarding experience.

---

## Permissions

The extension requests several Chrome permissions required for its functionality.

### `storage`

Used to persist user settings and filtering configuration.

### `activeTab`

Provides access to the currently active browser tab when required by the extension.

### `alarms`

Used for scheduled background operations.

### `notifications`

Used for extension notifications.

### `declarativeNetRequest`

Used to apply network-level advertisement filtering rules.

The extension also declares access to YouTube and several Google-related domains required for its filtering functionality and update mechanism.

---

## Privacy

YouTube Feed Filter is designed to operate locally in the browser.

The core filtering process is performed directly on the YouTube page by the extension.

The project does not require a separate backend server or API key for its core filtering functionality.

User configuration is stored using browser storage rather than requiring an external account.

> Always review the extension permissions and source code before installing any manually loaded browser extension.

---

## Performance Considerations

YouTube is a highly dynamic web application. Its DOM structure can change as users navigate between pages, load additional videos, open recommendations, or interact with the player.

To handle this environment, the extension includes:

* DOM scanning
* Processed-element tracking
* Dynamic content detection
* Virtualization-related logic
* Warm-up handling
* Batched processing
* Multiple optimization modes

The implementation also explicitly handles different YouTube video-card structures and related-content containers.

---

## Development

Because the project consists of browser-native HTML, CSS, and JavaScript files, development does not require a traditional frontend build pipeline.

### Local development

Clone the repository:

```bash
git clone https://github.com/Yrashka200/youtube-fliter.git
cd youtube-fliter
```

Then load the directory through:

```text
chrome://extensions/
```

with **Developer mode** enabled.

After modifying extension files:

1. Save your changes.
2. Return to `chrome://extensions/`.
3. Click **Reload** for the extension.
4. Refresh YouTube.

---

## Debugging

For debugging the content script:

1. Open YouTube.
2. Open Chrome DevTools.
3. Select the **Console** tab.
4. Inspect messages generated by the extension.

For popup-related issues:

1. Open the extension popup.
2. Right-click inside the popup.
3. Select **Inspect**.

For background-service-worker issues:

1. Open `chrome://extensions/`.
2. Locate **YouTube Feed Filter**.
3. Open the extension's service worker inspection window.

---

## Limitations

YouTube frequently changes its frontend implementation, DOM structure, CSS classes, and internal components.

Because this extension interacts directly with the YouTube interface, some filtering behavior may require maintenance after significant YouTube UI changes.

The extension should therefore be considered a client-side customization layer rather than an official YouTube feature.

---

## Roadmap

Potential future improvements include:

* More advanced filtering rules
* Additional language detection
* More granular channel filtering
* Improved keyword matching
* Additional profile management features
* More detailed statistics
* Enhanced performance controls
* Improved update management
* Better compatibility with future YouTube UI changes

---

## Contributing

Contributions are welcome.

Before submitting a pull request:

1. Fork the repository.
2. Create a dedicated branch.

```bash
git checkout -b feature/my-improvement
```

3. Implement and test your changes.
4. Verify the extension in Chrome.
5. Commit your changes.

```bash
git commit -m "Add my improvement"
```

6. Push the branch.

```bash
git push origin feature/my-improvement
```

7. Open a Pull Request.

When contributing, please keep changes focused and avoid introducing unnecessary dependencies.

---

## License

This project is distributed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for the complete license text.

---

## Disclaimer

YouTube Feed Filter is an independent third-party browser extension and is not affiliated with, sponsored by, or officially endorsed by YouTube or Google.

YouTube is a trademark of Google LLC.

The extension modifies the client-side presentation and behavior of the YouTube website. YouTube's website structure and policies may change over time, which can affect compatibility.

---

## Repository

**GitHub:**
https://github.com/Yrashka200/youtube-fliter

**Author:**
Yrashka200

---

## Support

If you encounter a bug or have a feature request, please open an issue in the GitHub repository.

When reporting a problem, include:

* Browser and version
* Operating system
* Extension version
* YouTube page where the issue occurs
* Active filtering profile
* Steps to reproduce the problem
* Relevant console errors, if available

Providing this information significantly improves the ability to reproduce and resolve the issue.

---



The extension uses Manifest V3.

## License

This project is licensed under the MIT License.
