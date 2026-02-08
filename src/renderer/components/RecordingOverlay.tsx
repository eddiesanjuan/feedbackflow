/**
 * Recording Overlay Component
 *
 * A compact, draggable floating indicator showing:
 * - Recording duration (MM:SS)
 * - Pulsing red recording dot
 * - Stop button
 * - +1 badge animation on screenshot capture
 *
 * Design: Premium, minimal, non-intrusive (120x32px approx)
 * Position persists across sessions via localStorage
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CompactAudioIndicator } from './AudioWaveform';
import { HotkeyHint } from './HotkeyHint';

interface RecordingOverlayProps {
  duration: number; // seconds
  screenshotCount: number;
  onStop: () => void;
  isDarkMode?: boolean;
  audioLevel?: number;
  isVoiceActive?: boolean;
  manualShortcut?: string;
  toggleShortcut?: string;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'markupr-overlay-position';
const DEFAULT_POSITION: Position = { x: 20, y: 20 };
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 88;

export const RecordingOverlay: React.FC<RecordingOverlayProps> = ({
  duration,
  screenshotCount,
  onStop,
  isDarkMode = false,
  audioLevel = 0,
  isVoiceActive = false,
  manualShortcut = 'CommandOrControl+Shift+S',
  toggleShortcut = 'CommandOrControl+Shift+F',
}) => {
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [badgeKey, setBadgeKey] = useState(0);

  const prevCountRef = useRef(screenshotCount);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Format duration as MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Load persisted position on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Position;
        // Validate position is within viewport
        const maxX = Math.max(0, window.innerWidth - DEFAULT_WIDTH - 8);
        const maxY = Math.max(0, window.innerHeight - DEFAULT_HEIGHT - 8);
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY),
        });
      }
    } catch {
      // Use default position on error
    }
  }, []);

  // Save position when it changes (debounced)
  useEffect(() => {
    if (!isDragging) {
      const timeout = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
        } catch {
          // Ignore storage errors
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [position, isDragging]);

  // Show +1 badge animation when screenshot count increases
  useEffect(() => {
    if (screenshotCount > prevCountRef.current) {
      setShowBadge(true);
      setBadgeKey((prev) => prev + 1); // Force re-render for animation
      const timer = setTimeout(() => setShowBadge(false), 1200);
      prevCountRef.current = screenshotCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = screenshotCount;
  }, [screenshotCount]);

  // Handle mouse down for drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking the stop button
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  // Handle mouse move for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      // Calculate new position with bounds checking
      const overlayWidth = overlayRef.current?.offsetWidth || DEFAULT_WIDTH;
      const overlayHeight = overlayRef.current?.offsetHeight || DEFAULT_HEIGHT;
      const maxX = window.innerWidth - overlayWidth;
      const maxY = window.innerHeight - overlayHeight;

      setPosition({
        x: Math.min(Math.max(0, dragStartRef.current.posX + deltaX), maxX),
        y: Math.min(Math.max(0, dragStartRef.current.posY + deltaY), maxY),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Dynamic styles based on theme
  const theme = {
    bg: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    border: isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(209, 213, 219, 0.8)',
    text: isDarkMode ? '#f3f4f6' : '#1f2937',
    textMuted: isDarkMode ? '#9ca3af' : '#6b7280',
    hintBg: isDarkMode ? 'rgba(55, 65, 81, 0.45)' : 'rgba(226, 232, 240, 0.75)',
    stopBg: '#ff3b30',
    stopHover: '#d92f25',
    badgeBg: '#10b981',
    recordingDot: '#ef4444',
    micActive: '#0a84ff',
    micIdle: '#b6bbc6',
  };

  return (
    <>
      {/* Keyframe animations */}
      <style>
        {`
          @keyframes markupr-pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.6;
              transform: scale(0.95);
            }
          }

          @keyframes markupr-badge-pop {
            0% {
              transform: scale(0) translateY(0);
              opacity: 0;
            }
            20% {
              transform: scale(1.2) translateY(-2px);
              opacity: 1;
            }
            40% {
              transform: scale(1) translateY(-4px);
            }
            100% {
              transform: scale(0.8) translateY(-16px);
              opacity: 0;
            }
          }

        `}
      </style>

      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          display: 'grid',
          gap: 8,
          padding: '10px 12px',
          width: 'min(380px, calc(100vw - 24px))',
          backgroundColor: theme.bg,
          borderRadius: 16,
          boxShadow: `
            0 8px 16px rgba(20, 20, 22, 0.1),
            0 0 0 1px ${theme.border}
          `,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
          // Electron-specific: prevent window drag
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties & { WebkitAppRegion?: string }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Recording dot */}
          <div
            style={{
              position: 'relative',
              width: 10,
              height: 10,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: `2px solid ${theme.recordingDot}`,
                borderRadius: '50%',
                opacity: 0.25,
              }}
            />
            <div
              style={{
                position: 'relative',
                width: 10,
                height: 10,
                backgroundColor: theme.recordingDot,
                borderRadius: '50%',
                animation: 'markupr-pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>

          {/* Duration display */}
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: 13,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: theme.text,
              minWidth: 42,
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}
          >
            {formatDuration(duration)}
          </span>

          {/* Live microphone indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 999,
              padding: '2px 8px',
              background: theme.hintBg,
              color: theme.textMuted,
              fontSize: 11,
              fontWeight: 600,
              minWidth: 92,
            }}
          >
            <CompactAudioIndicator
              audioLevel={audioLevel}
              isVoiceActive={isVoiceActive}
              accentColor={theme.micActive}
              inactiveColor={theme.micIdle}
            />
            <span style={{ color: isVoiceActive ? theme.text : theme.textMuted }}>
              {isVoiceActive ? 'Mic active' : 'Listening'}
            </span>
          </div>

          {/* Screenshot count */}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: theme.textMuted,
              borderRadius: 999,
              padding: '2px 8px',
              background: theme.hintBg,
            }}
          >
            {screenshotCount} shots
          </span>

          {/* Stop button */}
          <button
            type="button"
            onClick={onStop}
            style={{
              padding: '5px 10px',
              backgroundColor: theme.stopBg,
              border: 'none',
              borderRadius: 12,
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.stopHover;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.stopBg;
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
          >
            Stop
          </button>
        </div>

        {/* Shortcut reminders */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: theme.textMuted,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 999,
              padding: '3px 8px',
              background: theme.hintBg,
            }}
          >
            Screenshot <HotkeyHint keys={manualShortcut} size="small" />
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 999,
              padding: '3px 8px',
              background: theme.hintBg,
            }}
          >
            Stop <HotkeyHint keys={toggleShortcut} size="small" />
          </span>
          <span
            style={{
              borderRadius: 999,
              padding: '3px 8px',
              background: theme.hintBg,
            }}
          >
            Auto capture on narration pauses
          </span>
        </div>

        {/* +1 Badge (animated, appears on screenshot) */}
        {showBadge && (
          <span
            key={badgeKey}
            style={{
              position: 'absolute',
              top: -8,
              right: 50,
              padding: '2px 6px',
              backgroundColor: theme.badgeBg,
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 10,
              animation: 'markupr-badge-pop 1.2s ease-out forwards',
              pointerEvents: 'none',
            }}
          >
            +1
          </span>
        )}
      </div>
    </>
  );
};

export default RecordingOverlay;
