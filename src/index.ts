import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import https from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import { getNowPlaying, NowPlayingData } from './cli/now-playing';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

let SLACK_APP_ID = process.env.SLACK_APP_ID;
let SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
let SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = `https://localhost:${port}/oauth/redirect`;

let userSlackToken = process.env.SLACK_API_TOKEN;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/config/status', (req: Request, res: Response) => {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET || !SLACK_APP_ID) {
    return res.json({ status: 'SETUP_NEEDED' });
  }
  if (!userSlackToken) {
    return res.json({ status: 'AUTH_NEEDED', appId: SLACK_APP_ID });
  }
  res.json({ status: 'READY', appId: SLACK_APP_ID });
});

app.post('/api/config/save', (req: Request, res: Response) => {
  const { appId, clientId, clientSecret } = req.body;

  if (!appId || !clientId || !clientSecret) {
    return res.status(400).json({ error: 'App ID, Client ID, and Client Secret are required.' });
  }

  const envContent = `SLACK_APP_ID=${appId}\nSLACK_CLIENT_ID=${clientId}\nSLACK_CLIENT_SECRET=${clientSecret}\n`;

  try {
    fs.writeFileSync('.env', envContent);

    // Update in-memory variables
    SLACK_APP_ID = appId;
    SLACK_CLIENT_ID = clientId;
    SLACK_CLIENT_SECRET = clientSecret;

    res.status(200).json({ message: 'Configuration saved.', appId });
  } catch (error) {
    console.error('Error saving .env file:', error);
    res.status(500).json({ error: 'Failed to save configuration.' });
  }
});

app.get('/api/auth/url', (req: Request, res: Response) => {
  if (!SLACK_CLIENT_ID) {
    return res.status(500).json({ error: 'SLACK_CLIENT_ID is not configured on the server.' });
  }
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&user_scope=users.profile:write&redirect_uri=${SLACK_REDIRECT_URI}`;
  res.json({ url: authUrl });
});

app.get('/oauth/redirect', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
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

      // In a real app, encrypt and store this token securely.
      // For this local app, we'll append it to the .env file.
      fs.appendFileSync('.env', `\nSLACK_API_TOKEN=${token}`);

      res.redirect('/');
    } else {
      res.status(500).send(`Error obtaining token: ${response.data.error}`);
    }
  } catch (error) {
    console.error('OAuth Error:', error);
    res.status(500).send('An unexpected error occurred during authentication.');
  }
});

// This endpoint is deprecated in favor of /api/config/status, but kept for now.
app.get('/api/auth/status', (req: Request, res: Response) => {
  res.json({ hasToken: !!userSlackToken });
});

app.post('/set-status', async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!userSlackToken) {
    return res.status(401).json({ error: 'Not authenticated. Please add to Slack first.' });
  }

  try {
    const expiration = Math.floor(Date.now() / 1000) + 10 * 60; // 30 minutes from now
    const response = await axios.post(
      'https://slack.com/api/users.profile.set',
      {
        profile: {
          status_text: status,
          status_emoji: ':headphones:',
          status_expiration: expiration,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${userSlackToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );

    if (response.data.ok) {
      res.status(200).json({ message: 'Status updated successfully!' });
    } else {
      res.status(500).json({ error: `Failed to set status: ${response.data.error}` });
    }
  } catch (error) {
    console.error('Error setting Slack status:', error);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'cert.pem')),
};

const server = https.createServer(sslOptions, app);
const wss = new WebSocketServer({ server });

let lastTrack: NowPlayingData | null = null;

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(data: any) {
  const jsonData = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

setInterval(async () => {
  try {
    const nowPlayingData = await getNowPlaying();

    // Check if the track has changed
    if (JSON.stringify(nowPlayingData) !== JSON.stringify(lastTrack)) {
      lastTrack = nowPlayingData;
      broadcast({ type: 'NOW_PLAYING_UPDATE', data: lastTrack });
    }
  } catch (error) {
    console.error('Error polling for Now Playing data:', error);
    broadcast({ type: 'NOW_PLAYING_ERROR', error: 'Failed to fetch Now Playing data.' });
  }
}, 3000); // Poll every 3 seconds

server.listen(port, () => {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    console.log('-----------------------------------------------------------------');
    console.log('Slack App credentials not found.');
    console.log(`Please open https://localhost:${port} in your browser to complete setup.`);
    console.log('-----------------------------------------------------------------');
  }
  console.log(`Server is running on https://localhost:${port}`);
});
