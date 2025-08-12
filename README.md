# Music Slack Status

This web application syncs your currently playing music to your Slack status. The first time you run it, it will guide you through a one-time setup process in your browser.

## Installation

### 1. Get the code (non git users)

- [Download the repository](https://github.com/BE-Code/MusicSlackStatusMac/archive/refs/heads/main.zip) as a ZIP from GitHub
- Open Downloads in finder and double click the zip file
- Open a terminal and run
    ```
    cd ~/Downloads/MusicSlackStatusMac-main
    ```


### 2. Run the install script

- If you don't have Yarn installed:
    ```bash
    ./scripts/full-install.sh
    ```

- If you do have Yarn:
    ```bash
    yarn full-install
    ```

### 3. Connect to slack

After installation completes, the app will open in your browser to help you connect it to Slack.

Since the app runs locally with HTTPS, your browser will show a security warning about an "unsafe connection" or "not secure" site. This is normal for a locally running project.

To proceed:
- Look for an "Advanced" or "Show Details" button and click it
- Then click "Proceed to localhost (unsafe)" or "Visit this website" (it may be in small print)

Once the setup steps are finished, you are welcome to close the browser and the app will continue to run in the background. You can also bookmark the page to come back to it later and adjust settings.

## Uninstalling
If you need to uninstall the app run `yarn uninstall-startup`.

## Development Setup

```bash
yarn setup
yarn dev
```

The application will be running at `https://localhost:5001`.
