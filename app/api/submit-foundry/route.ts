import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const { url, foundry } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const subject = foundry ? `Missing typeface reported — ${foundry}` : "Foundry submission";
  const text = foundry
    ? `A missing typeface was reported for ${foundry}:\n\n${url}`
    : `A foundry was submitted for review:\n\n${url}`;

  try {
    await resend.emails.send({
      from: "MegaMegaTypeType <submissions@megamegatypetype.xyz>",
      to: "angela@loveandlogic.co.uk",
      subject,
      text,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return NextResponse.json({ error: "email failed" }, { status: 500 });
  }
}
