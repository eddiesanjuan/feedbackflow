// macOS-style large spinner component (12-segment)
const MacSpinnerLarge = () => (
  <div className="macos-spinner-large" aria-hidden="true">
    {[...Array(12)].map((_, i) => (
      <div key={i} className="macos-spinner-segment-large" />
    ))}
  </div>
)

export function ProcessingView() {
  return (
    <div
      className="view-transition flex flex-col items-center justify-center h-full p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Processing your recording"
    >
      <div className="mb-6">
        <MacSpinnerLarge />
      </div>

      <h2 className="text-xl font-medium text-theme-primary mb-2">Processing</h2>
      <p className="text-sm text-theme-tertiary text-center" aria-live="polite">
        Transcribing your feedback...
      </p>
      <p className="text-xs text-theme-muted text-center mt-1">
        This may take a few seconds
      </p>

      <div className="mt-6 w-full">
        <div
          className="h-1 bg-theme-secondary rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Processing progress"
          aria-valuetext="Processing in progress"
        >
          <div className="h-full w-1/3 progress-indeterminate" />
        </div>
      </div>
    </div>
  )
}
