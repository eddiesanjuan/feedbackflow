import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { logger } from "../utils/logger";

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  format: "wav" | "mp3";
}

const DEFAULT_CONFIG: AudioConfig = {
  sampleRate: 16000,
  channels: 1,
  format: "wav",
};

export class AudioService extends EventEmitter {
  private config: AudioConfig;
  private recordingProcess: ChildProcess | null = null;
  private currentPath: string | null = null;
  private isRecording = false;
  private recordingsDir: string;

  constructor(config: Partial<AudioConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.recordingsDir = join(app.getPath("userData"), "recordings");
    this.ensureRecordingsDir();
  }

  private ensureRecordingsDir(): void {
    if (!existsSync(this.recordingsDir)) {
      mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  async startRecording(sessionId: string): Promise<string> {
    if (this.isRecording) {
      throw new Error("Already recording");
    }

    const filename = `${sessionId}.${this.config.format}`;
    const outputPath = join(this.recordingsDir, filename);
    this.currentPath = outputPath;

    try {
      return await this.startWithRec(outputPath);
    } catch (err) {
      const isMissingBinary =
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT";
      if (isMissingBinary) {
        return this.startWithFfmpeg(outputPath);
      }
      throw err;
    }
  }

  private async startWithRec(outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use sox/rec for audio recording (preferred)
      // Falls back to ffmpeg if rec is not available
      const args = [
        "-q",
        "-r",
        String(this.config.sampleRate),
        "-c",
        String(this.config.channels),
        "-b",
        "16",
        "-e",
        "signed-integer",
        "-t",
        "coreaudio",
        "default",
        outputPath,
      ];

      let settled = false;
      const markStarted = () => {
        if (settled) return;
        settled = true;
        this.isRecording = true;
        this.emit("started", outputPath);
        resolve(outputPath);
      };

      const handleError = (error: Error) => {
        if (settled) return;
        settled = true;
        this.isRecording = false;
        this.recordingProcess = null;
        reject(error);
      };

      try {
        this.recordingProcess = spawn("rec", args, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (error) {
        handleError(error as Error);
        return;
      }

      this.recordingProcess.once("spawn", markStarted);
      this.recordingProcess.once("error", handleError);

      this.recordingProcess.stderr?.on("data", (data) => {
        const str = data.toString();
        if (str.includes("error") || str.includes("Error")) {
          logger.error("Recording error:", str);
        }
      });
    });
  }

  private async startWithFfmpeg(outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        "-f",
        "avfoundation",
        "-i",
        ":0",
        "-ar",
        String(this.config.sampleRate),
        "-ac",
        String(this.config.channels),
        "-y",
        outputPath,
      ];

      let settled = false;
      const markStarted = () => {
        if (settled) return;
        settled = true;
        this.isRecording = true;
        this.emit("started", outputPath);
        resolve(outputPath);
      };

      const handleError = (error: Error) => {
        if (settled) return;
        settled = true;
        this.isRecording = false;
        this.recordingProcess = null;
        const isMissingBinary =
          error instanceof Error &&
          "code" in error &&
          (error as NodeJS.ErrnoException).code === "ENOENT";
        if (isMissingBinary) {
          reject(
            new Error(
              "Audio recording failed. Please ensure ffmpeg is installed (brew install ffmpeg) and microphone access is granted.",
            ),
          );
        } else {
          reject(error);
        }
      };

      try {
        this.recordingProcess = spawn("ffmpeg", args, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (error) {
        handleError(error as Error);
        return;
      }

      this.recordingProcess.once("spawn", markStarted);
      this.recordingProcess.once("error", handleError);
    });
  }

  async stopRecording(): Promise<string | null> {
    if (!this.isRecording || !this.recordingProcess) {
      return this.currentPath;
    }

    return new Promise((resolve) => {
      const path = this.currentPath;
      const process = this.recordingProcess;
      let didCleanup = false;
      let timeoutId: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (didCleanup) return;
        didCleanup = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.isRecording = false;
        this.recordingProcess = null;
        this.emit("stopped", path);
        resolve(path);
      };

      if (!process) {
        cleanup();
        return;
      }

      process.once("close", cleanup);
      process.once("exit", cleanup);

      // Send SIGTERM for graceful shutdown
      process.kill("SIGTERM");

      // Force kill after timeout
      timeoutId = setTimeout(() => {
        if (this.recordingProcess && !this.recordingProcess.killed) {
          this.recordingProcess.kill("SIGKILL");
        }
        cleanup();
      }, 2000);
    });
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  getCurrentPath(): string | null {
    return this.currentPath;
  }

  async checkMicrophonePermission(): Promise<boolean> {
    // On macOS, we need microphone permission
    // This will be checked when we try to start recording
    // For now, return true and handle the error if permission is denied
    return true;
  }

  destroy(): void {
    if (this.recordingProcess) {
      this.recordingProcess.kill("SIGKILL");
      this.recordingProcess = null;
    }
    this.isRecording = false;
    this.removeAllListeners();
  }
}
