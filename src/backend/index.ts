import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import https from "https";
import open from "open";
import { WebSocketServer, WebSocket } from "ws";
import { NowPlayingManager } from "./now-playing/now-playing-manager";
import { NowPlayingData, NowPlayingEventType, Settings } from "../shared/types";
import { SlackManager } from "./slack-manager";
const FilterApi = Function("return import(\"bad-words\")")();
let nsfwFilter: any;
(async () => {
  const { Filter } = await FilterApi;
  nsfwFilter = new Filter();
})();

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

let SLACK_APP_ID = process.env.SLACK_APP_ID;
let SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
let SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = `https://localhost:${port}/oauth/redirect`;

let userSlackToken = process.env.SLACK_API_TOKEN;

let settings: Settings = {
  syncSlackStatus: process.env.SYNC_SLACK_STATUS !== 'false', // Default to true
  nsfwFilter: process.env.NSFW_FILTER !== 'false', // Default to true
};

const saveEnvFile = () => {
  let envContent = '';
  if (SLACK_APP_ID) envContent += `SLACK_APP_ID=${SLACK_APP_ID}\n`;
  if (SLACK_CLIENT_ID) envContent += `SLACK_CLIENT_ID=${SLACK_CLIENT_ID}\n`;
  if (SLACK_CLIENT_SECRET) envContent += `SLACK_CLIENT_SECRET=${SLACK_CLIENT_SECRET}\n`;
  if (userSlackToken) envContent += `SLACK_API_TOKEN=${userSlackToken}\n`;
  envContent += `SYNC_SLACK_STATUS=${settings.syncSlackStatus}\n`;
  envContent += `NSFW_FILTER=${settings.nsfwFilter}\n`;
  fs.writeFileSync('.env', envContent);
};

let slackManager: SlackManager | null = null;
if (userSlackToken) {
  slackManager = new SlackManager(userSlackToken);
}

app.use(cors());
app.use(express.json());

// Serve all static files from the `public` directory inside `compiled`
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get("/api/config/status", (req: Request, res: Response) => {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET || !SLACK_APP_ID) {
    return res.json({ status: "SETUP_NEEDED" });
  }
  if (!userSlackToken) {
    return res.json({ status: "AUTH_NEEDED", appId: SLACK_APP_ID });
  }
  res.json({ status: "READY", appId: SLACK_APP_ID });
});

app.post("/api/config/save", (req: Request, res: Response) => {
  const { appId, clientId, clientSecret } = req.body;

  if (!appId || !clientId || !clientSecret) {
    return res.status(400).json({ error: "App ID, Client ID, and Client Secret are required." });
  }

  try {
    // Update in-memory variables
    SLACK_APP_ID = appId;
    SLACK_CLIENT_ID = clientId;
    SLACK_CLIENT_SECRET = clientSecret;

    saveEnvFile();

    res.status(200).json({ message: "Configuration saved.", appId });
  } catch (error) {
    console.error("Error saving .env file:", error);
    res.status(500).json({ error: "Failed to save configuration." });
  }
});

app.get("/api/auth/url", (req: Request, res: Response) => {
  if (!SLACK_CLIENT_ID) {
    return res.status(500).json({ error: "SLACK_CLIENT_ID is not configured on the server." });
  }
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&user_scope=users.profile:write&redirect_uri=${SLACK_REDIRECT_URI}`;
  res.json({ url: authUrl });
});

app.get("/oauth/redirect", async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }

  try {
    const response = await axios.post("https://slack.com/api/oauth.v2.access", null, {
      params: {
        code,
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        redirect_uri: SLACK_REDIRECT_URI,
      },
    });

    if (response.data.ok) {
      const token = response.data.authed_user.access_token;
      userSlackToken = token;
      if (!userSlackToken) {
        return res.status(500).send("Error obtaining token.");
      }
      slackManager = new SlackManager(userSlackToken);

      saveEnvFile();
      res.redirect("/");
    } else {
      res.status(500).send(`Error obtaining token: ${response.data.error}`);
    }
  } catch (error) {
    console.error("OAuth Error:", error);
    res.status(500).send("An unexpected error occurred during authentication.");
  }
});

// This endpoint is deprecated in favor of /api/config/status, but kept for now.
app.get("/api/auth/status", (req: Request, res: Response) => {
  res.json({ hasToken: !!userSlackToken });
});

// Settings API endpoints
app.get("/api/settings", (req: Request, res: Response) => {
  res.json(settings);
});

app.post("/api/settings", (req: Request, res: Response) => {
  const updates: Partial<Settings> = req.body || {};
  const oldSettings = settings;

  // Reject empty payloads
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No settings provided" });
  }

  // Validate only provided keys
  if (
    ("syncSlackStatus" in updates && typeof updates.syncSlackStatus !== "boolean") ||
    ("nsfwFilter" in updates && typeof updates.nsfwFilter !== "boolean")
  ) {
    return res.status(400).json({ error: "Invalid settings format" });
  }

  if ("nsfwFilter" in updates && !nsfwFilter) {
    return res.status(500).json({ error: "NSFW filter not initialized" });
  }

  settings = { ...settings, ...updates };
  saveEnvFile();

  if ("nsfwFilter" in updates) {
    const currentNowPlayingData = nowPlayingManager.currentNowPlayingData;
    if (currentNowPlayingData) {
      updateStatusSong(currentNowPlayingData.title, currentNowPlayingData.artist);
      broadcastNowPlayingUpdate(currentNowPlayingData);
    }
  }

  if ("syncSlackStatus" in updates) {
    if (!settings.syncSlackStatus) {
      clearStatus();
    } else if (settings.syncSlackStatus) {
      const { title, artist } = nowPlayingManager.currentNowPlayingData || {};
      if (title && artist) {
        updateStatusSong(title, artist);
      }
    }
  }

  res.json({ success: true, settings });
});

const updateStatus = async (status: string) => {
  if (!slackManager || !settings.syncSlackStatus) return;
  // If status can be read, only update music statuses
  try {
    const { statusEmoji } = await slackManager.getStatus();
    if (statusEmoji && statusEmoji !== ":musical_note:") return;
  } catch (error) { }
  try {
    await slackManager.updateStatus(status, ":musical_note:");
  } catch (error) {
    console.error("Error updating Slack status:", error);
    throw error;
  }
}

const applyNSFWFilter = (text: string): string => {
  if (!settings.nsfwFilter) return text;
  if (!nsfwFilter) return text;
  return nsfwFilter.clean(text);
};

const updateStatusSong = (title: string, artist: string) => {
  const filteredTitle = applyNSFWFilter(title);
  const filteredArtist = applyNSFWFilter(artist);
  updateStatus(`${filteredTitle} - ${filteredArtist}`);
}

const clearStatus = async () => {
  try {
    const { statusEmoji } = await slackManager?.getStatus() || {};
    if (statusEmoji !== ":musical_note:") return;
    await slackManager?.clearStatus();
  } catch (error) {
    console.error("Error clearing Slack status:", error);
    throw error;
  }
}

// This must be last to ensure it doesn't interfere with other routes
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, "..", "certs", "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "..", "certs", "cert.pem")),
};

const server = https.createServer(sslOptions, app);
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

const broadcast = (data: any) => {
  const jsonData = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

const broadcastNowPlayingUpdate = (nowPlayingData: NowPlayingData) => {
  nowPlayingData.title = applyNSFWFilter(nowPlayingData.title);
  nowPlayingData.artist = applyNSFWFilter(nowPlayingData.artist);
  broadcast({
    type: NowPlayingEventType.NOW_PLAYING_UPDATE,
    data: nowPlayingData
  });
}

const nowPlayingManager = new NowPlayingManager(
  (nowPlayingData) => {
    broadcastNowPlayingUpdate(nowPlayingData);
    updateStatusSong(nowPlayingData.title, nowPlayingData.artist);
  },
  () => broadcast({ type: NowPlayingEventType.NOW_PLAYING_PAUSED }),
  () => {
    broadcast({ type: NowPlayingEventType.NOW_PLAYING_RESUMED });
    const { title, artist } = nowPlayingManager.currentNowPlayingData || {};
    if (title && artist) {
      updateStatusSong(title, artist);
    }
  },
);

nowPlayingManager.startPolling();

wss.on("connection", (ws: WebSocket) => {
  clients.add(ws);

  // Send the current "now playing" data if it exists
  const currentData = nowPlayingManager.currentNowPlayingData;
  if (currentData) {
    ws.send(
      JSON.stringify({
        type: NowPlayingEventType.NOW_PLAYING_UPDATE,
        data: currentData,
      })
    );
  }

  ws.on("close", () => {
    clients.delete(ws);
  });
});

server.listen(port, () => {
  if (process.env.NODE_ENV === "development") {
    console.log("Running in development mode");
  }

  const serverUrl = `https://localhost:${port}`;
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    console.log("-----------------------------------------------------------------");
    console.log("Slack App credentials not found.");
    console.log(`Please open ${serverUrl} in your browser to complete setup.`);
    console.log("-----------------------------------------------------------------");
  }
  console.log(`Server is running on ${serverUrl}`);

  // Open the browser automatically
  if (process.env.NODE_ENV !== "development") {
    open(serverUrl).catch((error) => {
      console.log("Could not automatically open browser:", error.message);
    });
  }
});
