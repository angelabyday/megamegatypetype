import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const { name, foundry, email, reason } = await request.json();

  if (!foundry || !reason) {
    return NextResponse.json({ error: "foundry and reason required" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: "MegaMegaTypeType <submissions@megamegatypetype.xyz>",
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
