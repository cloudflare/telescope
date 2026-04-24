/**
 * Type declarations for the ffmpeg package (v0.0.4)
 * This package has no official TypeScript types
 */

declare module 'ffmpeg' {
  interface ExtractFrameOptions {
    frame_rate?: number;
    file_name?: string;
    number?: number;
    every_n_frames?: number;
    every_n_seconds?: number;
    every_n_percentage?: number;
    keep_pixel_aspect_ratio?: boolean;
    keep_aspect_ratio?: boolean;
    size?: string;
    padding_color?: string;
  }

  interface Video {
    /**
     * Extract frames from video to JPEG images
     * @param destinationPath - Directory to save frames
     * @param options - Extraction options
     * @param callback - Callback with error and file paths
     */
    fnExtractFrameToJPG(
      destinationPath: string,
      options: ExtractFrameOptions,
      callback: (error: Error | null, files: string[]) => void,
    ): void;

    /**
     * Metadata about the video
     */
    metadata: {
      duration?: {
        seconds: number;
      };
      video?: {
        fps: number;
        codec: string;
        resolution: {
          w: number;
          h: number;
        };
      };
      audio?: {
        codec: string;
        sample_rate: number;
        channels: number;
      };
    };
  }

  /**
   * FFmpeg class for video processing
   */
  class FFmpeg {
    /**
     * Create a new FFmpeg instance
     * @param videoPath - Path to the video file
     */
    constructor(videoPath: string);

    /**
     * Process the video and get a Video object
     * @param successCallback - Called with Video object on success
     * @param errorCallback - Called with Error on failure
     */
    then(
      successCallback: (video: Video) => void | Promise<string[]>,
      errorCallback?: (error: Error) => void,
    ): Promise<string[]>;
  }

  export = FFmpeg;
}
