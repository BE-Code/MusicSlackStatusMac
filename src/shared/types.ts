export interface NowPlayingData {
  playing: boolean;
  title: string;
  artist: string;
  album: string;
  artworkMimeType: string | null;
  artworkData: string | null;
}
