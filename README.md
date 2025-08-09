# Music Slack Status

This web application syncs your currently playing music to your Slack status. The first time you run it, it will guide you through a one-time setup process in your browser.

## Installation

If you don't have Yarn installed:
```bash
./scripts/full-install.sh
```

If you already have Yarn:
```bash
yarn full-install
```

After installation completes, the app will automatically open in your browser to help you add it to Slack. Since the app runs locally with HTTPS, your browser will show a security warning about an "unsafe connection" or "not secure" site. This is normal for a locally running project.

To proceed:
- Look for an "Advanced" or "Show Details" button and click it
- Then click "Proceed to localhost (unsafe)" or "Visit this website" (it may be in small print)

Once the setup steps are finished, you can close the browser and the app will continue to run in the background.

> [!NOTE]
> To uninstall: `yarn uninstall-startup`

## Development Setup

```bash
yarn setup
yarn dev
```

The application will be running at `https://localhost:5001`.
