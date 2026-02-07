/**
 * ImageOptimizer - Optimize screenshots for the Claude Vision API
 *
 * Resizes images to Claude's recommended max dimension (1568px) and converts
 * large PNGs to JPEG to reduce token usage. Uses Electron's built-in nativeImage
 * so no external dependencies are needed.
 */

import { nativeImage } from 'electron';
import type { Screenshot } from '../SessionController';
import type { OptimizedImage, ImageOptimizeOptions } from './types';
import { DEFAULT_IMAGE_OPTIMIZE_OPTIONS, AIPipelineError } from './types';

/**
 * Optimize a single screenshot buffer for the Claude Vision API.
 *
 * 1. Resize to fit within maxWidth (maintaining aspect ratio)
 * 2. If the PNG exceeds pngToJpegThreshold, convert to JPEG at jpegQuality
 */
export function optimizeScreenshot(
  buffer: Buffer,
  width: number,
  height: number,
  options: ImageOptimizeOptions = DEFAULT_IMAGE_OPTIMIZE_OPTIONS,
): OptimizedImage & { _id: string } {
  const image = nativeImage.createFromBuffer(buffer);

  if (image.isEmpty()) {
    throw new AIPipelineError(
      'Failed to create nativeImage from screenshot buffer',
      'IMAGE_OPTIMIZATION_FAILED',
    );
  }

  // Resize if wider than maxWidth (maintain aspect ratio)
  let resized = image;
  let finalWidth = width;
  let finalHeight = height;

  if (width > options.maxWidth) {
    const scale = options.maxWidth / width;
    finalWidth = Math.round(width * scale);
    finalHeight = Math.round(height * scale);
    resized = image.resize({ width: finalWidth, height: finalHeight, quality: 'best' });
  }

  // Start with PNG
  let data = resized.toPNG();
  let mediaType: 'image/png' | 'image/jpeg' = 'image/png';

  // Convert to JPEG if PNG exceeds threshold
  if (data.length > options.pngToJpegThreshold) {
    data = resized.toJPEG(options.jpegQuality);
    mediaType = 'image/jpeg';
  }

  return {
    data,
    mediaType,
    originalScreenshotId: '', // Caller sets this
    width: finalWidth,
    height: finalHeight,
    _id: '', // Caller sets this
  };
}

/**
 * Batch-optimize screenshots for the Claude Vision API.
 *
 * - Processes all screenshots through resize/compress
 * - If more than maxScreenshots exist, selects an evenly-spaced subset
 *   prioritizing manual/voice-command triggered screenshots
 * - Returns optimized images ready for the API content blocks
 */
export function optimizeForAPI(
  screenshots: Screenshot[],
  options: Partial<ImageOptimizeOptions> = {},
): OptimizedImage[] {
  const opts: ImageOptimizeOptions = { ...DEFAULT_IMAGE_OPTIMIZE_OPTIONS, ...options };

  if (screenshots.length === 0) {
    return [];
  }

  // Select which screenshots to include
  const selected = selectScreenshots(screenshots, opts.maxScreenshots);

  // Optimize each selected screenshot
  const optimized: OptimizedImage[] = [];

  for (const screenshot of selected) {
    try {
      const result = optimizeScreenshot(
        screenshot.buffer,
        screenshot.width,
        screenshot.height,
        opts,
      );

      optimized.push({
        data: result.data,
        mediaType: result.mediaType,
        originalScreenshotId: screenshot.id,
        width: result.width,
        height: result.height,
      });
    } catch (error) {
      // Skip screenshots that fail to optimize (per design doc: "If still fails, skip that screenshot")
      console.warn(
        `[ImageOptimizer] Failed to optimize screenshot ${screenshot.id}, skipping:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return optimized;
}

/**
 * Select which screenshots to send when the count exceeds the maximum.
 *
 * Strategy (from AI_PIPELINE_DESIGN.md):
 * 1. Always include manual/voice-command triggered screenshots
 * 2. From remaining pause-triggered ones, select evenly spaced to stay under max
 */
function selectScreenshots(screenshots: Screenshot[], max: number): Screenshot[] {
  if (screenshots.length <= max) {
    return screenshots;
  }

  // Separate priority screenshots (manual, voice-command) from pause-triggered
  const priority: Screenshot[] = [];
  const pauseTriggered: Screenshot[] = [];

  for (const s of screenshots) {
    if (s.trigger === 'manual' || s.trigger === 'voice-command') {
      priority.push(s);
    } else {
      pauseTriggered.push(s);
    }
  }

  // If priority screenshots alone exceed max, take evenly spaced from priority
  if (priority.length >= max) {
    return evenlySpaced(priority, max);
  }

  // Fill remaining slots with evenly spaced pause-triggered screenshots
  const remainingSlots = max - priority.length;
  const selectedPause = evenlySpaced(pauseTriggered, remainingSlots);

  // Merge and sort by timestamp to maintain chronological order
  const merged = [...priority, ...selectedPause];
  merged.sort((a, b) => a.timestamp - b.timestamp);

  return merged;
}

/**
 * Select evenly spaced items from an array.
 */
function evenlySpaced<T>(items: T[], count: number): T[] {
  if (items.length <= count) {
    return items;
  }

  const result: T[] = [];
  const step = (items.length - 1) / (count - 1);

  for (let i = 0; i < count; i++) {
    const index = Math.round(i * step);
    result.push(items[index]);
  }

  return result;
}
