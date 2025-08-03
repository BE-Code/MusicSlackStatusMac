import { WebClient } from '@slack/web-api';

export class SlackManager {
  private slack: WebClient;

  constructor(token: string) {
    if (!token) {
      throw new Error('Slack token not provided.');
    }
    this.slack = new WebClient(token);
  }

  public async updateStatus(statusText: string, statusEmoji = ":musical_note:"): Promise<void> {
    try {
      const expiration = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes from now

      await this.slack.users.profile.set({
        profile: {
          status_text: statusText,
          status_emoji: statusEmoji,
          status_expiration: expiration,
        },
      });
    } catch (error) {
      console.error('Error updating slack status:', error);
      throw error;
    }
  }

  public async clearStatus(): Promise<void> {
    try {
      await this.slack.users.profile.set({
        profile: {
          status_text: '',
          status_emoji: '',
        },
      });
    } catch (error) {
      console.error('Error clearing slack status:', error);
      throw error;
    }
  }
}
