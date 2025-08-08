import { NowPlayingData } from "../../shared/types";
import { getNowPlaying } from "./now-playing-mac";

export class NowPlayingManager {
  private lastNowPlayingData: NowPlayingData | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private onSongChanged: (data: NowPlayingData) => void,
    private onSongPaused: () => void,
    private onSongResumed: () => void,
    private macPollingRate = 2000,
  ) { }

  public get currentNowPlayingData(): NowPlayingData | null {
    return this.lastNowPlayingData;
  }

  public startPolling() {
    this.stopPolling();

    // Initial check
    this.checkForUpdates();

    this.pollingInterval = setInterval(
      () => this.checkForUpdates(),
      this.macPollingRate
    );
  }

  public stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async checkForUpdates() {
    const nowPlayingData = await getNowPlaying();
    if (process.env.NODE_ENV === "development") {
      const { artworkData, ...rest } = nowPlayingData || {};
      console.log(nowPlayingData ? { ...rest, artworkData: artworkData?.length } : {});
    }

    // Music stopped entirely
    if (!nowPlayingData) {
      if (this.lastNowPlayingData) {
        this.lastNowPlayingData.playing = false;
        this.onSongPaused();
      }
      return;
    }

    // Ignore audio that is not music
    if (!nowPlayingData.album) return;

    // It's the first song (or the first time we've seen the song)
    if (!this.lastNowPlayingData ||
      this.lastNowPlayingData.title !== nowPlayingData.title ||
      this.lastNowPlayingData.artist !== nowPlayingData.artist ||
      this.lastNowPlayingData.album !== nowPlayingData.album
    ) {
      this.lastNowPlayingData = nowPlayingData;
      this.onSongChanged(this.lastNowPlayingData);
      return;
    }

    // Adding missing artwork
    if (!this.lastNowPlayingData.artworkData) {
      this.lastNowPlayingData.artworkData = nowPlayingData.artworkData;
      this.lastNowPlayingData.artworkMimeType = nowPlayingData.artworkMimeType;
      this.onSongChanged(this.lastNowPlayingData);
    }

    // Play/pause state changed
    if (this.lastNowPlayingData.playing !== nowPlayingData.playing) {
      this.lastNowPlayingData.playing = nowPlayingData.playing;
      if (this.lastNowPlayingData.playing) {
        this.onSongResumed();
      } else {
        this.onSongPaused();
      }
    }
  }
}
