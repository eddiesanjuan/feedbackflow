/**
 * Screen Capture Module
 *
 * Handles:
 * - Full screen capture using Electron's desktopCapturer
 * - Screenshot timing based on voice pause detection
 * - Image compression and storage
 */

import { desktopCapturer, screen } from 'electron';
import type { Screenshot } from '../../shared/types';

export class CaptureManager {
  private screenshots: Screenshot[] = [];

  /**
   * Capture the current screen
   */
  async captureScreen(): Promise<Screenshot> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().size,
    });

    const primarySource = sources[0];
    if (!primarySource) {
      throw new Error('No screen source available');
    }

    const screenshot: Screenshot = {
      id: `screenshot-${Date.now()}`,
      timestamp: Date.now(),
      imagePath: '', // TODO: Save to temp directory
      base64: primarySource.thumbnail.toDataURL(),
      width: primarySource.thumbnail.getSize().width,
      height: primarySource.thumbnail.getSize().height,
    };

    this.screenshots.push(screenshot);
    return screenshot;
  }

  /**
   * Get all captured screenshots
   */
  getScreenshots(): Screenshot[] {
    return [...this.screenshots];
  }

  /**
   * Clear all screenshots
   */
  clear(): void {
    this.screenshots = [];
  }
}

export default CaptureManager;
