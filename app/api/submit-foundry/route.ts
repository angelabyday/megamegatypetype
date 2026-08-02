import { NextResponse } from "next/server";
import { Resend } from "resend";
import { emailLimiter, getClientIp } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const { success } = await emailLimiter.limit(getClientIp(request));
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { url, foundry, email } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  if (url.length > 2000) {
    return NextResponse.json({ error: "url too long" }, { status: 400 });
  }
  if (foundry && typeof foundry === "string" && foundry.length > 200) {
    return NextResponse.json({ error: "foundry too long" }, { status: 400 });
  }
  if (email && (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 200)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const subject = foundry ? `Missing typeface reported — ${foundry}` : "Foundry submission";
  const text = foundry
    ? `A missing typeface was reported for ${foundry}:\n\n${url}`
    : `A foundry was submitted for review:\n\n${url}`;

  try {
    await resend.emails.send({
      from: "MegaMegaTypeType <submissions@send.megamegatypetype.xyz>",
      to: "angela@loveandlogic.co.uk",
      subject,
      text: text + (email ? `\n\nReply to: ${email}` : ""),
      replyTo: email || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return NextResponse.json({ error: "email failed" }, { status: 500 });
  }
}
