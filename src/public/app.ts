document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('loader');
  const setupContainer = document.getElementById('setup-container');
  const authContainer = document.getElementById('auth-container');
  const statusContainer = document.getElementById('status-container');
  const mainContainer = document.getElementById('main-container');

  if (!loader || !setupContainer || !authContainer || !statusContainer || !mainContainer) {
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
      authContainer.classList.remove('hidden');
    } else if (data.status === 'READY') {
      statusContainer.classList.remove('hidden');
    }

  } catch (error) {
    loader.innerHTML = '<p>Could not connect to the server. Is it running? Refresh the page to try again.</p>';
  }
});

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
