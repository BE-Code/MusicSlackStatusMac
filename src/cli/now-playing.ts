import { exec } from "child_process";

export interface NowPlayingData {
  title: string;
  artist: string;
  album: string;
  isPlaying: boolean;
}

export function getNowPlaying(): Promise<NowPlayingData | null> {
  return new Promise((resolve, reject) => {
    const command = "media-control get";

    exec(command, (error, stdout, stderr) => {
      if (error) {
        // media-control exits with an error if no media is playing.
        resolve(null);
        return;
      }

      if (stderr) {
        reject(new Error(`Command stderr: ${stderr}`));
        return;
      }

      try {
        const nowPlayingData = JSON.parse(stdout);
        resolve({
          title: nowPlayingData.title,
          artist: nowPlayingData.artist,
          album: nowPlayingData.album,
          isPlaying: nowPlayingData.playbackRate > 0,
        });
      } catch (parseError) {
        reject(
          new Error(`Error parsing JSON output from media-control: ${parseError}`)
        );
      }
    });
  });
}
