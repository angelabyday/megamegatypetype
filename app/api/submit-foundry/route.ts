import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    await resend.emails.send({
      from: "MegaMegaTypeType <submissions@megamegatypetype.xyz>",
      to: "angela@loveandlogic.co.uk",
      subject: "Foundry submission",
      text: `A foundry was submitted for review:\n\n${url}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return NextResponse.json({ error: "email failed" }, { status: 500 });
  }
}
