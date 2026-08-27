export function Logo({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  if (iconOnly) {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <linearGradient id="logo-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <path d="M11 4C9.34315 4 8 5.34315 8 7V25C8 26.6569 9.34315 28 11 28H21C22.6569 28 24 26.6569 24 25V11L17 4H11Z" fill="url(#logo-grad)" fillOpacity="0.2"/>
        <path d="M17 4V9C17 10.1046 17.8954 11 19 11H24L17 4Z" fill="url(#logo-grad)"/>
        <path d="M16 13C16 15.2091 17.7909 17 20 17C17.7909 17 16 18.7909 16 21C16 18.7909 14.2091 17 12 17C14.2091 17 16 15.2091 16 13Z" fill="url(#logo-grad)"/>
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-7 h-7 shrink-0"
      >
        <defs>
          <linearGradient id="logo-grad-full" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <path d="M11 4C9.34315 4 8 5.34315 8 7V25C8 26.6569 9.34315 28 11 28H21C22.6569 28 24 26.6569 24 25V11L17 4H11Z" fill="url(#logo-grad-full)" fillOpacity="0.25"/>
        <path d="M17 4V9C17 10.1046 17.8954 11 19 11H24L17 4Z" fill="url(#logo-grad-full)"/>
        <path d="M16 13C16 15.2091 17.7909 17 20 17C17.7909 17 16 18.7909 16 21C16 18.7909 14.2091 17 12 17C14.2091 17 16 15.2091 16 13Z" fill="url(#logo-grad-full)"/>
      </svg>
      <span className="font-brand font-bold text-xl tracking-tight leading-none bg-gradient-to-r from-gray-900 via-indigo-950 to-indigo-800 dark:from-white dark:via-gray-100 dark:to-indigo-200 bg-clip-text text-transparent">
        Contexa
      </span>
    </div>
  );
}
