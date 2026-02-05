import { useState, useEffect, useCallback } from "react";
import type { TranscriptionConfig } from "../types/api";

/**
 * IPC response structure from main process
 */
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Valid preferred tier values
 */
const VALID_PREFERRED_TIERS = ["whisper_local", "macos_dictation", "none"] as const;

/**
 * Valid whisper model values
 */
const VALID_WHISPER_MODELS = ["tiny", "base", "small", "medium"] as const;

/**
 * Type guard to validate IPC response structure
 */
function isIPCResponse<T>(value: unknown): value is IPCResponse<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as IPCResponse).success === "boolean"
  );
}

/**
 * Type guard to validate TranscriptionConfig structure
 */
function isTranscriptionConfig(value: unknown): value is TranscriptionConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.preferredTier === "string" &&
    VALID_PREFERRED_TIERS.includes(obj.preferredTier as typeof VALID_PREFERRED_TIERS[number]) &&
    typeof obj.whisperModel === "string" &&
    VALID_WHISPER_MODELS.includes(obj.whisperModel as typeof VALID_WHISPER_MODELS[number]) &&
    typeof obj.language === "string"
  );
}

export function useTranscription() {
  const [isModelReady, setIsModelReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [config, setConfig] = useState<TranscriptionConfig | null>(null);

  useEffect(() => {
    // Check if model is ready with validation
    window.api.invoke("transcription:isModelReady").then((response) => {
      if (!isIPCResponse<boolean>(response)) {
        console.error("Invalid IPC response for transcription:isModelReady");
        return;
      }
      if (!response.success) {
        console.error("Failed to check model ready:", response.error);
        return;
      }
      if (typeof response.data !== "boolean") {
        console.error("Invalid model ready data type:", response.data);
        return;
      }
      setIsModelReady(response.data);
    });

    // Get config with validation
    window.api.invoke("transcription:getConfig").then((response) => {
      if (!isIPCResponse<TranscriptionConfig>(response)) {
        console.error("Invalid IPC response for transcription:getConfig");
        return;
      }
      if (!response.success) {
        console.error("Failed to get config:", response.error);
        return;
      }
      if (!isTranscriptionConfig(response.data)) {
        console.error("Invalid config structure:", response.data);
        return;
      }
      setConfig(response.data);
    });

    // Listen for download progress with validation
    const unsubscribe = window.api.on(
      "transcription:downloadProgress",
      (data: unknown) => {
        if (typeof data !== "number") {
          console.error("Invalid download progress data type:", data);
          return;
        }
        setDownloadProgress(data);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const downloadModel = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    const result = await window.api.invoke("transcription:downloadModel");
    setIsDownloading(false);
    if (result) {
      setIsModelReady(true);
    }
    return result as boolean;
  }, []);

  const updateConfig = useCallback(
    async (newConfig: Partial<TranscriptionConfig>) => {
      await window.api.invoke("transcription:setConfig", newConfig);
      setConfig((prev) => (prev ? { ...prev, ...newConfig } : null));

      if (newConfig.whisperModel) {
        setIsModelReady(false);
      }

      const ready = await window.api.invoke("transcription:isModelReady");
      setIsModelReady(ready as boolean);
    },
    [],
  );

  return {
    isModelReady,
    isDownloading,
    downloadProgress,
    config,
    downloadModel,
    updateConfig,
  };
}
