import { NextResponse } from "next/server";
import { Resend } from "resend";
import { emailLimiter, getClientIp } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const { success } = await emailLimiter.limit(getClientIp(request));
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { name, foundry, email, reason } = await request.json();

  if (!foundry || !reason) {
    return NextResponse.json({ error: "foundry and reason required" }, { status: 400 });
  }
  if (typeof foundry !== "string" || foundry.length > 200) {
    return NextResponse.json({ error: "foundry too long" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.length > 2000) {
    return NextResponse.json({ error: "reason too long" }, { status: 400 });
  }
  if (name && (typeof name !== "string" || name.length > 200)) {
    return NextResponse.json({ error: "name too long" }, { status: 400 });
  }
  if (email && (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 200)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: "MegaMegaTypeType <submissions@send.megamegatypetype.xyz>",
      to: "angela@loveandlogic.co.uk",
      subject: `Takedown / correction request — ${foundry}`,
      text: [
        `Foundry / typeface: ${foundry}`,
        `Reason: ${reason}`,
        name ? `Name: ${name}` : null,
        email ? `Reply to: ${email}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      replyTo: email || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return NextResponse.json({ error: "email failed" }, { status: 500 });
  }
}
