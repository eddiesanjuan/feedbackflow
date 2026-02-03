/**
 * FeedbackFlow - Main App Component
 *
 * A minimal, floating UI that shows:
 * - Current recording status
 * - Live transcription preview
 * - Screenshot count
 * - Quick actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { SessionStatus } from '../shared/types';

const App: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [transcription, setTranscription] = useState<string>('');
  const [screenshotCount, setScreenshotCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Handle session toggle from global hotkey
  useEffect(() => {
    const unsubscribe = window.feedbackflow.onSessionStatus((data) => {
      if (data.action === 'toggle') {
        handleToggle();
      } else if (data.status) {
        setStatus(data.status);
      }
    });
    return unsubscribe;
  }, [status]);

  // Listen for transcription updates
  useEffect(() => {
    const unsubscribe = window.feedbackflow.onTranscriptionUpdate((data) => {
      setTranscription(data.text);
    });
    return unsubscribe;
  }, []);

  // Listen for screenshots
  useEffect(() => {
    const unsubscribe = window.feedbackflow.onScreenshotCaptured(() => {
      setScreenshotCount((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  // Listen for output ready
  useEffect(() => {
    const unsubscribe = window.feedbackflow.onOutputReady((data) => {
      setStatus('complete');
      // Auto-copy to clipboard
      window.feedbackflow.copyToClipboard(data.markdown);
    });
    return unsubscribe;
  }, []);

  // Listen for errors
  useEffect(() => {
    const unsubscribe = window.feedbackflow.onOutputError((err) => {
      setStatus('error');
      setError(err.message);
    });
    return unsubscribe;
  }, []);

  const handleToggle = useCallback(async () => {
    if (status === 'idle' || status === 'complete' || status === 'error') {
      // Start new session
      setStatus('recording');
      setTranscription('');
      setScreenshotCount(0);
      setError(null);
      await window.feedbackflow.startSession();
    } else if (status === 'recording') {
      // Stop session
      setStatus('processing');
      await window.feedbackflow.stopSession();
    }
  }, [status]);

  const getStatusColor = (): string => {
    switch (status) {
      case 'recording':
        return '#ef4444'; // red
      case 'processing':
        return '#f59e0b'; // amber
      case 'complete':
        return '#10b981'; // green
      case 'error':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'recording':
        return 'Recording...';
      case 'processing':
        return 'Processing...';
      case 'complete':
        return 'Copied to clipboard!';
      case 'error':
        return error || 'Error occurred';
      default:
        return 'Press Cmd+Shift+F to start';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Status indicator */}
        <div style={styles.statusRow}>
          <div
            style={{
              ...styles.statusDot,
              backgroundColor: getStatusColor(),
              boxShadow: status === 'recording' ? `0 0 8px ${getStatusColor()}` : 'none',
            }}
          />
          <span style={styles.statusText}>{getStatusText()}</span>
        </div>

        {/* Transcription preview */}
        {status === 'recording' && transcription && (
          <div style={styles.transcriptionPreview}>
            {transcription.slice(-100)}
            {transcription.length > 100 && '...'}
          </div>
        )}

        {/* Stats */}
        {(status === 'recording' || status === 'processing') && (
          <div style={styles.stats}>
            <span>{screenshotCount} screenshots</span>
          </div>
        )}

        {/* Action button */}
        <button
          style={{
            ...styles.button,
            backgroundColor: status === 'recording' ? '#ef4444' : '#3b82f6',
          }}
          onClick={handleToggle}
          disabled={status === 'processing'}
        >
          {status === 'recording' ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    WebkitAppRegion: 'drag' as any,
  },
  card: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    WebkitAppRegion: 'no-drag' as any,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    transition: 'all 0.2s ease',
  },
  statusText: {
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: 500,
  },
  transcriptionPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 1.5,
    maxHeight: 80,
    overflow: 'hidden',
  },
  stats: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: 'none',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

export default App;
