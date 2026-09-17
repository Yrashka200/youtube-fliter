# YouTube Feed Filter

A lightweight Chrome extension for filtering and customizing the YouTube feed.

The extension can hide videos by category, language, keywords, Shorts, or watch status. It also allows you to change the size of video cards in the YouTube feed.

## Features

* Enable or disable the filter.
* Hide videos by category:

  * Games
  * Sports
  * Politics
  * Music
  * News
  * Movies
  * Technology
  * Crypto
  * Kids
* Hide videos by detected language:

  * Russian
  * English
* Hide YouTube Shorts.
* Hide already watched videos.
* Add custom keywords to block specific content.
* Change video card size:

  * Default
  * Small — 6 videos per row
  * Medium — 4 videos per row
  * Large — 2 videos per row
  * Cinema — 1 video per row
* Save settings automatically.
* Check for extension updates.

Filtering is performed automatically when YouTube content changes or when navigating between pages.

## Installation

The extension can be installed manually as an unpacked Chrome extension.

### 1. Clone the repository

```bash
git clone https://github.com/Yrashka200/youtube-fliter.git
cd youtube-fliter
```

### 2. Open Chrome Extensions

Open the following page in Google Chrome:

```text
chrome://extensions/
```

### 3. Enable Developer Mode

Enable **Developer mode** in the top-right corner.

### 4. Load the extension

Click **Load unpacked** and select the repository folder:

```text
youtube-fliter/
```

The folder must contain `manifest.json`.

### 5. Open YouTube

Open or reload:

```text
https://www.youtube.com/
```

Click the **YouTube Feed Filter** icon in the Chrome toolbar to configure the filters.

## Usage

Open the extension popup and configure the required options.

### Category filtering

Select the categories you want to hide. The extension detects categories using predefined keywords found in video titles, channels, and descriptions.

### Language filtering

Enable **Hide Russian** or **Hide English** to hide videos based on detected language.

### Custom keywords

Enter a word or phrase in **Custom block words** and click `+`.

For example:

```text
standup
minecraft
politics
```

Videos containing these keywords will be hidden.

### Other filters

You can also enable:

* **Hide Shorts**
* **Hide watched videos**

### Video size

Choose how many videos should be displayed per row:

| Mode    | Videos per row  |
| ------- | --------------- |
| Default | YouTube default |
| Small   | 6               |
| Medium  | 4               |
| Large   | 2               |
| Cinema  | 1               |

## Permissions

The extension uses Chrome permissions for:

* Storing user settings.
* Accessing the active YouTube tab.
* Running the content filter on YouTube.
* Checking for extension updates.

The extension uses Manifest V3.

## License

This project is licensed under the MIT License.
