import { NowPlayingData, NowPlayingEventType, Settings } from '../../shared/types';

document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('loader');
  const setupContainer = document.getElementById('setup-container');
  const nowPlayingContainer = document.getElementById('now-playing-container');
  const mainContainer = document.getElementById('main-container');

  if (!loader || !setupContainer || !nowPlayingContainer || !mainContainer) {
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
    } else     if (data.status === 'READY') {
      nowPlayingContainer.classList.remove('hidden');
      connectWebSocket();
    } else {
      // This case should not be reached, but it's good practice to handle it.
      console.error('Unknown status received from server:', data.status);
      loader.innerHTML = '<p>An unknown error occurred. Please check the console.</p>';
    }

  } catch (error) {
    console.error('Error fetching or processing config status:', error);
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
      console.log(message);
      switch (message.type) {
        case NowPlayingEventType.NOW_PLAYING_UPDATE:
          updateNowPlayingUI(message.data);
          break;
        case NowPlayingEventType.NOW_PLAYING_PAUSED:
          showPlayPause(false);
          break;
        case NowPlayingEventType.NOW_PLAYING_RESUMED:
          showPlayPause(true);
          break;
        default:
          console.error('Unknown message type:', message.type);
          break;
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

function updateNowPlayingUI(data: NowPlayingData | null) {
  const nowPlayingContainer = document.getElementById('now-playing-container');
  const albumArt = document.getElementById('album-art') as HTMLImageElement;
  const trackTitle = document.getElementById('track-title');
  const artistName = document.getElementById('artist-name');

  if (!nowPlayingContainer || !albumArt || !trackTitle || !artistName) {
    return;
  }

  if (data) {
    if (data.artworkData && data.artworkMimeType) {
      albumArt.src = `data:${data.artworkMimeType};base64,${data.artworkData}`;
    } else {
      // Set a transparent 1x1 pixel image to prevent broken image icon
      albumArt.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    trackTitle.textContent = data.title;
    artistName.textContent = data.artist;

    nowPlayingContainer.classList.remove('hidden');
    showPlayPause(data.playing);
  } else {
    // If no data, hide the entire container
    nowPlayingContainer.classList.add('hidden');
  }
}

function showPlayPause(isPlaying: boolean) {
  const record = document.getElementById('record');
  if (record) {
    if (isPlaying) {
      record.classList.add('playing');
    } else {
      record.classList.remove('playing');
    }
  }
}

function updateOauthLink(appId: string) {
  const oauthLinks = document.querySelectorAll('.oauth-dynamic-link') as NodeListOf<HTMLAnchorElement>;
  oauthLinks.forEach(link => {
    link.href = `https://api.slack.com/apps/${appId}/oauth`;
  });
}

async function updateSettings(partial: Partial<Settings>): Promise<boolean> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    });

    if (!response.ok) {
      throw new Error('Failed to save settings');
    }

    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
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

// Settings Expandable Logic
document.addEventListener('DOMContentLoaded', async () => {
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsContent = document.getElementById('settings-content');
  const settingsArrow = document.getElementById('settings-arrow');
  const syncSlackStatusCheckbox = document.getElementById('sync-slack-status') as HTMLInputElement;
  const nsfwFilterCheckbox = document.getElementById('nsfw-filter') as HTMLInputElement;

  if (settingsToggle && settingsContent && settingsArrow) {
    settingsToggle.addEventListener('click', () => {
      const isExpanded = settingsContent.classList.contains('expanded');

      if (isExpanded) {
        settingsContent.classList.remove('expanded');
        settingsArrow.classList.remove('rotated');
      } else {
        settingsContent.classList.add('expanded');
        settingsArrow.classList.add('rotated');
      }
    });
  }

  if (syncSlackStatusCheckbox) {
    // Load settings from backend
    try {
      const response = await fetch('/api/settings');
      const settings: Settings = await response.json();
      syncSlackStatusCheckbox.checked = settings.syncSlackStatus;
      if (nsfwFilterCheckbox) {
        nsfwFilterCheckbox.checked = settings.nsfwFilter;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Fallback to default if API fails
      syncSlackStatusCheckbox.checked = true;
      if (nsfwFilterCheckbox) {
        nsfwFilterCheckbox.checked = true;
      }
    }

    // Save setting when changed
    syncSlackStatusCheckbox.addEventListener('change', async () => {
      const newSettings: Partial<Settings> = {
        syncSlackStatus: syncSlackStatusCheckbox.checked
      };

      const ok = await updateSettings(newSettings);
      if (!ok) {
        syncSlackStatusCheckbox.checked = !syncSlackStatusCheckbox.checked;
      } else {
        console.log('Settings saved:', newSettings);
      }
    });
  }

  if (nsfwFilterCheckbox) {
    // Save NSFW filter setting when changed
    nsfwFilterCheckbox.addEventListener('change', async () => {
      const newSettings: Partial<Settings> = {
        nsfwFilter: nsfwFilterCheckbox.checked
      };

      const ok = await updateSettings(newSettings);
      if (!ok) {
        nsfwFilterCheckbox.checked = !nsfwFilterCheckbox.checked;
      } else {
        console.log('Settings saved:', newSettings);
      }
    });
  }
});


