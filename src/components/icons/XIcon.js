/**
 * XIcon — X (formerly Twitter) logo as a reusable SVG component.
 *
 * Props:
 *  @param {number|string} size        — Width & height in px (default: 24)
 *  @param {string}        color       — Stroke / fill color (default: "currentColor")
 *  @param {string}        fill        — Explicit fill override (default: "currentColor")
 *  @param {string}        className   — Extra CSS classes
 *  @param {object}        ...rest     — Any additional SVG attributes (aria-label, onClick, style, …)
 */
export default function XIcon({
  size = 24,
  color = "currentColor",
  fill = "currentColor",
  className = "",
  ...rest
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ?? color}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {/* Official X (Twitter) path */}
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L2.018 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}
