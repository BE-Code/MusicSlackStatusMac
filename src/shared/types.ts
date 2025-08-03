const enum NowPlayingEventType {
  NOW_PLAYING_UPDATE = "NOW_PLAYING_UPDATE",
  NOW_PLAYING_PAUSED = "NOW_PLAYING_PAUSED",
  NOW_PLAYING_RESUMED = "NOW_PLAYING_RESUMED",
}

interface NowPlayingData {
  playing: boolean;
  title: string;
  artist: string;
  album: string;
  artworkMimeType: string | null;
  artworkData: string | null;
}

export { NowPlayingEventType, NowPlayingData };
