import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const cx = 90;
  const cy = 90;
  const r = 74;
  const w = 17;

  const spokes = Array.from({ length: 6 }, (_, k) => {
    const angle = (k * 30 * Math.PI) / 180;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx - r * Math.cos(angle);
    const y2 = cy - r * Math.sin(angle);
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="white" stroke-width="${w}" stroke-linecap="round"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="black"/>${spokes}</svg>`;

  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        width={180}
        height={180}
        alt=""
      />
    ),
    { ...size }
  );
}
