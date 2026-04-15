/**
 * PhantomIcon — Phantom wallet logo as a reusable SVG component.
 *
 * Props:
 *  @param {number|string} size        — Width & height in px (default: 24)
 *  @param {string}        color       — Fill color (default: "currentColor")
 *  @param {string}        className   — Extra CSS classes
 *  @param {object}        ...rest     — Any additional SVG attributes (aria-label, onClick, style, …)
 */
export default function PhantomIcon({
  size = 24,
  color = "currentColor",
  className = "",
  ...rest
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.78 16.95c-1.26 1.928-3.37 4.37-6.177 4.37C2.276 21.32 1 20.774 1 18.4 1 12.356 9.252 3 16.909 3 21.265 3 23 6.022 23 9.454c0 4.405-2.858 9.442-5.7 9.442-.902 0-1.344-.496-1.344-1.281 0-.205.034-.427.102-.666-.97 1.656-2.841 3.193-4.594 3.193-1.276 0-1.923-.802-1.923-1.93 0-.41.085-.836.239-1.263m6.595-7.615c0 1-.59 1.5-1.25 1.5-.67 0-1.25-.5-1.25-1.5s.58-1.5 1.25-1.5c.66 0 1.25.5 1.25 1.5m3.75 0c0 1-.59 1.5-1.25 1.5-.67 0-1.25-.5-1.25-1.5s.58-1.5 1.25-1.5c.66 0 1.25.5 1.25 1.5"
      />
    </svg>
  );
}