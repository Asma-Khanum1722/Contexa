export function Logo({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  if (iconOnly) {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path d="M11 4C9.34315 4 8 5.34315 8 7V25C8 26.6569 9.34315 28 11 28H21C22.6569 28 24 26.6569 24 25V11L17 4H11Z" fill="currentColor" fillOpacity="0.2"/>
        <path d="M17 4V9C17 10.1046 17.8954 11 19 11H24L17 4Z" fill="currentColor"/>
        <path d="M16 13C16 15.2091 17.7909 17 20 17C17.7909 17 16 18.7909 16 21C16 18.7909 14.2091 17 12 17C14.2091 17 16 15.2091 16 13Z" fill="currentColor"/>
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6 shrink-0 text-brand-primary dark:text-gray-100"
      >
        <path d="M11 4C9.34315 4 8 5.34315 8 7V25C8 26.6569 9.34315 28 11 28H21C22.6569 28 24 26.6569 24 25V11L17 4H11Z" fill="currentColor" fillOpacity="0.2"/>
        <path d="M17 4V9C17 10.1046 17.8954 11 19 11H24L17 4Z" fill="currentColor"/>
        <path d="M16 13C16 15.2091 17.7909 17 20 17C17.7909 17 16 18.7909 16 21C16 18.7909 14.2091 17 12 17C14.2091 17 16 15.2091 16 13Z" fill="currentColor"/>
      </svg>
      <span className="font-brand font-bold text-xl tracking-tight leading-none text-gray-900 dark:text-white">
        Contexa
      </span>
    </div>
  );
}
