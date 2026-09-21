export function WalkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="13.5" cy="5.5" r="1.5" fill="currentColor" />
      <path
        fill="currentColor"
        d="M9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.2L7 12v6h2v-4.4z"
      />
    </svg>
  );
}

export function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="12" y1="1.5" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22.5" y2="12" />
        <line x1="4.4" y1="4.4" x2="6.1" y2="6.1" />
        <line x1="17.9" y1="17.9" x2="19.6" y2="19.6" />
        <line x1="4.4" y1="19.6" x2="6.1" y2="17.9" />
        <line x1="17.9" y1="6.1" x2="19.6" y2="4.4" />
      </g>
    </svg>
  );
}

export function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a9 9 0 1 0 11.1 11.1z"
      />
    </svg>
  );
}

export function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-8 1.66-8 4.4V21h16v-2.6c0-2.74-4.7-4.4-8-4.4z"
      />
    </svg>
  );
}

export function ForkKnifeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.8 3h1.8v6H3.8zM6.8 3h1.8v6H6.8zM9.8 3h1.8v6H9.8zM3.8 9H11.6L8.6 13H6.8ZM6.8 13h1.8v9H6.8zM17 3c-1.1 0-2 1.34-2 3v6c0 1.66.9 3 2 3v6h2V3z"
      />
    </svg>
  );
}

export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
      />
    </svg>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zm17.71-10.04a1 1 0 0 0 0-1.42l-2.5-2.5a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 3.75z"
      />
    </svg>
  );
}

export function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6 0 1.06-.28 2.06-.76 2.92l1.47 1.47A7.93 7.93 0 0 0 20 13c0-4.42-3.58-8-8-8zm-6 8c0-1.06.28-2.06.76-2.92L5.29 8.61A7.93 7.93 0 0 0 4 13c0 4.42 3.58 8 8 8v3l5-4-5-4v3c-3.31 0-6-2.69-6-6z"
      />
    </svg>
  );
}

export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z" />
    </svg>
  );
}
