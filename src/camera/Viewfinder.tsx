const corner = "absolute h-7 w-7 border-snow";

/** Viewfinder brackets (SNIPPETS L): 280px frame, bracket lock on mount, scan line while Gemini looks. */
export default function Viewfinder({ scanning = false }: { scanning?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[230px] flex justify-center">
      <div className="relative h-[280px] w-[280px] animate-[bracketLock_var(--dur-3)_var(--ease-pop)_both]">
        <div className={`${corner} top-0 left-0 rounded-tl-[8px] border-t-[3px] border-l-[3px]`} />
        <div className={`${corner} top-0 right-0 rounded-tr-[8px] border-t-[3px] border-r-[3px]`} />
        <div className={`${corner} bottom-0 left-0 rounded-bl-[8px] border-b-[3px] border-l-[3px]`} />
        <div className={`${corner} right-0 bottom-0 rounded-br-[8px] border-r-[3px] border-b-[3px]`} />
        {scanning && (
          <div className="absolute inset-x-2 top-0.5 h-0.5 animate-[scan_1.4s_var(--ease-loop)_infinite] rounded-[1px] bg-[linear-gradient(90deg,transparent,var(--moss-on-dark),transparent)] shadow-[0_0_18px_4px_var(--glass-tint-moss-dark)]" />
        )}
      </div>
    </div>
  );
}
