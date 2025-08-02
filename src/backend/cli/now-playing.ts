import { exec } from "child_process";
import { NowPlayingData } from "../../shared/types";

// Uses https://github.com/ungive/media-control to get the now playing data.

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
        resolve(nowPlayingData);
      } catch (parseError) {
        reject(
          new Error(`Error parsing JSON output from media-control: ${parseError}`)
        );
      }
    });
  });
}
