import { NowPlayingData } from "../../shared/types";
import { getNowPlaying } from "./now-playing-mac";

type SongChangeHandler = (data: NowPlayingData) => void;
type SongPausedHandler = () => void;
type SongStoppedHandler = () => void;

export class NowPlayingManager {
  private lastNowPlayingData: NowPlayingData | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private onSongChanged: SongChangeHandler,
    private onSongPaused: SongPausedHandler,
    private onSongStopped: SongStoppedHandler,
    private macPollingRate = 2000,
  ) {}

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

    // Case 1: Music stopped
    if (!nowPlayingData) {
      if (this.lastNowPlayingData) {
        this.onSongStopped();
        this.lastNowPlayingData = null;
      }
      return;
    }

    // Case 2: A new song is playing (or it's the first song)
    if (
      !this.lastNowPlayingData ||
      this.lastNowPlayingData.title !== nowPlayingData.title ||
      this.lastNowPlayingData.artist !== nowPlayingData.artist ||
      this.lastNowPlayingData.album !== nowPlayingData.album
    ) {
      this.onSongChanged(nowPlayingData);
      this.lastNowPlayingData = nowPlayingData;
      return;
    }

    // Case 3: Same song, check for pause/resume state change
    const wasPlaying = this.lastNowPlayingData.playing;
    const isPlaying = nowPlayingData.playing;

    if (wasPlaying && !isPlaying) {
      this.onSongPaused();
    } else if (!wasPlaying && isPlaying) {
      this.onSongChanged(nowPlayingData);
    }

    // Always update the last known state
    this.lastNowPlayingData = nowPlayingData;
  }
}
