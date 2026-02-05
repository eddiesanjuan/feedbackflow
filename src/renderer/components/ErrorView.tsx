interface ErrorViewProps {
  error: string | null
  onReset: () => void
  onOpenSettings?: () => void
}

interface ErrorDetails {
  title: string
  message: string
  action: 'retry' | 'settings'
  actionLabel: string
}

function getErrorDetails(error?: string | null): ErrorDetails {
  if (!error) {
    return {
      title: 'Something went wrong',
      message: 'An unexpected error occurred',
      action: 'retry',
      actionLabel: 'Try Again'
    }
  }

  const lowerError = error.toLowerCase()

  // Microphone permission errors
  if (lowerError.includes('microphone') || lowerError.includes('permission') || lowerError.includes('access denied')) {
    return {
      title: 'Microphone Access Required',
      message: 'Please allow microphone access in System Settings > Privacy & Security > Microphone',
      action: 'retry',
      actionLabel: 'Try Again'
    }
  }

  // Whisper CLI not installed
  if (lowerError.includes('whisper') || lowerError.includes('command not found') || lowerError.includes('enoent')) {
    return {
      title: 'Whisper Not Installed',
      message: 'Install whisper-cpp: brew install whisper-cpp',
      action: 'retry',
      actionLabel: 'Try Again'
    }
  }

  // Model not downloaded or corrupted
  if (lowerError.includes('model') || lowerError.includes('download') || lowerError.includes('ggml')) {
    return {
      title: 'Model Not Ready',
      message: 'Please download the transcription model in Settings',
      action: 'settings',
      actionLabel: 'Go to Settings'
    }
  }

  // Audio recording errors
  if (lowerError.includes('audio') || lowerError.includes('recording') || lowerError.includes('sox')) {
    return {
      title: 'Recording Failed',
      message: 'Could not capture audio. Please check your microphone connection.',
      action: 'retry',
      actionLabel: 'Try Again'
    }
  }

  // Transcription timeout
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return {
      title: 'Transcription Timed Out',
      message: 'The recording was too long or processing took too long. Try a shorter recording.',
      action: 'retry',
      actionLabel: 'Try Again'
    }
  }

  // Network errors (for model download)
  if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('connection')) {
    return {
      title: 'Network Error',
      message: 'Could not connect to download the model. Check your internet connection.',
      action: 'retry',
      actionLabel: 'Try Again'
    }
  }

  // Default: show the raw error
  return {
    title: 'Something went wrong',
    message: error,
    action: 'retry',
    actionLabel: 'Try Again'
  }
}

export function ErrorView({ error, onReset, onOpenSettings }: ErrorViewProps) {
  const errorDetails = getErrorDetails(error)

  const handleAction = () => {
    if (errorDetails.action === 'settings' && onOpenSettings) {
      onOpenSettings()
    } else {
      onReset()
    }
  }

  return (
    <div
      className="view-transition flex flex-col items-center justify-center h-full p-6"
      role="alert"
      aria-live="assertive"
    >
      <div className="mb-6">
        <div className="w-16 h-16 rounded-full bg-orange-600 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      </div>

      <h2 className="text-xl font-medium text-theme-primary mb-2">{errorDetails.title}</h2>
      <p className="text-sm text-theme-tertiary text-center mb-6">
        {errorDetails.message}
      </p>

      <button
        onClick={handleAction}
        aria-label={`${errorDetails.actionLabel}, ${errorDetails.action === 'settings' ? 'open settings' : 'start a new recording'}`}
        className="w-full px-6 py-3 btn-macos btn-macos-secondary font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ring-offset-theme"
      >
        {errorDetails.actionLabel}
      </button>

      {/* Show secondary action if primary is settings */}
      {errorDetails.action === 'settings' && (
        <button
          onClick={onReset}
          className="mt-3 text-sm text-theme-muted hover:text-theme-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ring-offset-theme rounded px-2 py-1"
        >
          Try Again Instead
        </button>
      )}
    </div>
  )
}
