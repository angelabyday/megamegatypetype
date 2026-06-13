import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const cx = 16;
  const cy = 16;
  const r = 13;
  const w = 3;

  // 6-spoked asterisk: arms at 0°, 30°, 60°, 90°, 120°, 150°
  const spokes = Array.from({ length: 6 }, (_, k) => {
    const angle = (k * 30 * Math.PI) / 180;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx - r * Math.cos(angle);
    const y2 = cy - r * Math.sin(angle);
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="white" stroke-width="${w}" stroke-linecap="round"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="black"/>${spokes}</svg>`;

  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        width={32}
        height={32}
        alt=""
      />
    ),
    { ...size }
  );
}
