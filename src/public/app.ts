import { NowPlayingData } from '../cli/now-playing';

document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('loader');
  const setupContainer = document.getElementById('setup-container');
  const statusContainer = document.getElementById('status-container');
  const mainContainer = document.getElementById('main-container');

  if (!loader || !setupContainer || !statusContainer || !mainContainer) {
    console.error('Required elements not found in the DOM.');
    return;
  }

  try {
    const res = await fetch('/api/config/status');
    const data = await res.json();

    if (data.appId) {
      updateOauthLink(data.appId);
    }

    loader.classList.add('hidden');
    mainContainer.classList.add('container-sm');

    if (data.status === 'SETUP_NEEDED') {
      mainContainer.classList.remove('container-sm');
      setupContainer.classList.remove('hidden');
    } else if (data.status === 'AUTH_NEEDED') {
      const authUrlRes = await fetch('/api/auth/url');
      const { url } = await authUrlRes.json();
      const slackAuthButton = document.getElementById('slack-auth-button') as HTMLAnchorElement;
      if (slackAuthButton) {
        slackAuthButton.href = url;
      }
      mainContainer.classList.remove('container-sm');
      setupContainer.classList.remove('hidden');
      currentStep = 5; // Go to the last step (authentication)
      showStep(currentStep);
    } else if (data.status === 'READY') {
      statusContainer.classList.remove('hidden');
      connectWebSocket();
    }

  } catch (error) {
    loader.innerHTML = '<p>Could not connect to the server. Is it running? Refresh the page to try again.</p>';
  }
});

function connectWebSocket() {
  const ws = new WebSocket(`wss://${window.location.host}`);

  ws.onopen = () => {
    console.log('WebSocket connection established');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'NOW_PLAYING_UPDATE') {
        updateNowPlayingUI(message.data);
      }
      if (message.type === 'NOW_PLAYING_ERROR') {
        console.error('Error fetching Now Playing data:', message.error);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed. Reconnecting in 3 seconds...');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    ws.close();
  };
}

async function updateNowPlayingUI(data: NowPlayingData | null) {
  const nowPlayingContainer = document.getElementById('now-playing-container');
  const albumArt = document.getElementById('album-art') as HTMLImageElement;
  const trackTitle = document.getElementById('track-title');
  const artistName = document.getElementById('artist-name');

  if (!nowPlayingContainer || !albumArt || !trackTitle || !artistName) {
    return;
  }

  if (data && data.playing) {
    if (data.artworkData && data.artworkMimeType) {
      albumArt.src = `data:${data.artworkMimeType};base64,${data.artworkData}`;
    } else {
      albumArt.src = ''; // Or a fallback image
    }
    trackTitle.textContent = data.title;
    artistName.textContent = data.artist;
    nowPlayingContainer.classList.remove('hidden');
  } else {
    nowPlayingContainer.classList.add('hidden');
  }
}

function updateOauthLink(appId: string) {
  const oauthLinks = document.querySelectorAll('.oauth-dynamic-link') as NodeListOf<HTMLAnchorElement>;
  oauthLinks.forEach(link => {
    link.href = `https://api.slack.com/apps/${appId}/oauth`;
  });
}

// Setup Wizard Logic
const setupSteps = document.querySelectorAll('.setup-step');
const nextButtons = document.querySelectorAll('.next-step');
const prevButtons = document.querySelectorAll('.prev-step');
let currentStep = 0;

function showStep(stepIndex: number) {
  const mainTitle = document.querySelector('#setup-container > h1') as HTMLElement | null;
  const stepTitle = document.getElementById('setup-step-title');

  if (mainTitle && stepTitle) {
    const isLastStep = stepIndex === setupSteps.length - 1;
    mainTitle.classList.toggle('hidden', isLastStep);
    stepTitle.classList.toggle('hidden', isLastStep);
  }

  setupSteps.forEach((step, index) => {
    step.classList.toggle('hidden', index !== stepIndex);
  });
}

nextButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (currentStep < setupSteps.length - 1) {
      currentStep++;
      showStep(currentStep);
    }
  });
});

prevButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  });
});

document.getElementById('setupForm')?.addEventListener('submit', async function (event) {
  event.preventDefault();
  const appIdInput = document.getElementById('appId') as HTMLInputElement;
  const clientIdInput = document.getElementById('clientId') as HTMLInputElement;
  const clientSecretInput = document.getElementById('clientSecret') as HTMLInputElement;
  const responseDiv = document.getElementById('setup-response');

  if (!appIdInput || !clientIdInput || !clientSecretInput || !responseDiv) {
    return;
  }

  const appId = appIdInput.value;
  const clientId = clientIdInput.value;
  const clientSecret = clientSecretInput.value;

  responseDiv.textContent = 'Saving...';

  const res = await fetch('/api/config/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, clientId, clientSecret })
  });

  const result = await res.json();
  if (res.ok) {
    updateOauthLink(result.appId);
    responseDiv.textContent = ''; // Clear "Saving..." message
    if (currentStep < setupSteps.length - 1) {
      currentStep++;
      showStep(currentStep);
    }
  } else {
    responseDiv.textContent = `Error: ${result.error}`;
    responseDiv.style.color = '#d92626';
  }
});

document.getElementById('statusForm')?.addEventListener('submit', async function (event) {
  event.preventDefault();
  const statusTextInput = document.getElementById('statusText') as HTMLInputElement;
  const responseDiv = document.getElementById('response');

  if (!statusTextInput || !responseDiv) {
    return;
  }

  const statusText = statusTextInput.value;
  responseDiv.textContent = 'Setting status...';

  try {
    const response = await fetch('/set-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusText })
    });
    const result = await response.json();
    if (response.ok) {
      responseDiv.textContent = 'Status updated successfully!';
    } else {
      responseDiv.textContent = 'Error: ' + result.error;
    }
  } catch (error) {
    responseDiv.textContent = 'An unexpected error occurred.';
  }
});
