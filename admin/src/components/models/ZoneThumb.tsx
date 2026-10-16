/**
 * A zone's shape: its layer used as a mask, filled with the default color (or gray without one).
 * The layer itself is light gray shading on transparency, which is nearly invisible as a plain image.
 */
export function ZoneThumb({
  layerUrl,
  color,
  label,
  className = 'h-14 w-24',
}: {
  layerUrl: string | null;
  color: string | null;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-bg ${className}`}
    >
      {layerUrl ? (
        <div
          role="img"
          aria-label={label}
          className="size-full"
          style={{
            backgroundColor: color ?? '#6b6b6b',
            maskImage: `url("${layerUrl}")`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
          }}
        />
      ) : (
        <span className="text-xs text-muted">Sin capa</span>
      )}
    </div>
  );
}
