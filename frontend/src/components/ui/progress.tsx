export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
      <div className="h-2 rounded-full bg-[var(--accent)] transition-all duration-[var(--dur-medium)] ease-[var(--ease-out)]" style={{ width: `${value}%` }} />
    </div>
  );
}
