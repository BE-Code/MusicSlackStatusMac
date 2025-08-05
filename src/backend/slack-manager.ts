import { WebClient } from '@slack/web-api';

const SLACK_STATUS_TEXT_MAX_LENGTH = 100;

export class SlackManager {
  private slack: WebClient;

  constructor(token: string) {
    if (!token) {
      throw new Error('Slack token not provided.');
    }
    this.slack = new WebClient(token);
  }

  public async updateStatus(statusText: string, statusEmoji: string): Promise<void> {
    try {
      const expiration = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes from now

      await this.slack.users.profile.set({
        profile: {
          status_text: statusText.slice(0, SLACK_STATUS_TEXT_MAX_LENGTH),
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

  public async getStatus(): Promise<{ statusText: string, statusEmoji: string }> {
    try {
      const response = await this.slack.users.profile.get({});
      const { status_text: statusText = '', status_emoji: statusEmoji = '' } = response.profile || {};
      return { statusText, statusEmoji };
    } catch (error) {
      console.error('Error getting slack status:', error);
      throw error;
    }
  }
}
