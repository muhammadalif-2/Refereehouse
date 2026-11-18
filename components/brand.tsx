export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 13a6 6 0 0 1 6-6h11v5h-5.2A6 6 0 1 1 3 13Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle
            cx="9"
            cy="13"
            r="2.3"
            stroke="currentColor"
            strokeWidth="1.65"
          />
          <path
            d="M17 7v5M19 4l1-1M22 7l1-1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="brand-text">
        Referee<span>House</span>
      </span>
    </div>
  );
}
