import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { TYPOGRAPHY_CONTEXT } from "@/lib/brief-context";
import { getAllTypefaces } from "@/lib/typefaces";

export const maxDuration = 60;

const MODEL = "claude-haiku-4-5";

type BriefRequest = {
  brief?: string;
  answers?: { question: string; answer: string }[];
};

type ResultItem = {
  name: string;
  foundry: string;
  reason: string;
  outside_list?: boolean;
};

const RESPONSE_TOOL: Anthropic.Tool = {
  name: "brief_response",
  description:
    "Return either clarifying questions for a vague brief, or exactly 10 ranked typeface recommendations.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["questions", "results"],
        description:
          "Use 'questions' only when the brief is too vague to recommend with conviction. Otherwise 'results'.",
      },
      questions: {
        type: "array",
        items: { type: "string" },
        description:
          "1 to 3 clarifying questions, only when type is 'questions'. Each must note that 'I don't know' is a fine answer.",
      },
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Typeface name exactly as it appears in the index.",
            },
            foundry: {
              type: "string",
              description: "Foundry name exactly as it appears in the index.",
            },
            reason: {
              type: "string",
              description:
                "One sentence under 25 words, citing letterform features tied to the brief, not vibes.",
            },
            outside_list: {
              type: "boolean",
              description:
                "True only when nothing in the index fits and this pick comes from outside it.",
            },
          },
          required: ["name", "foundry", "reason"],
        },
        minItems: 10,
        maxItems: 10,
        description:
          "Exactly 10 ranked picks, best first, when type is 'results'. Never fewer, even when the brief asks for a smaller number.",
      },
    },
    required: ["type"],
  },
};

function buildSystemPrompt(index: string): string {
  return `You are the brief mode of MegaMegaTypeType, a typeface directory built by Love & Logic. A user describes a brand or project brief; you recommend typefaces from the directory index below.

How to work:
1. Translate the brief into typographic features (contrast, x-height, stress axis, terminals, aperture, width) using the reference material. Words like "modern", "clean" and "elegant" are ambiguous; map them carefully.
2. If the brief is too vague to recommend with conviction (for example one or two words with no sector, role, mood or references), respond with 1 to 3 clarifying questions instead of guessing. Draw them from: typeface category; role and surfaces; reference brands or typefaces and what to avoid; three adjectives plus one trap; era feel; budget tier; audience; sector. Always say "I don't know" is a fine answer. If the user has already answered questions, do not ask again: recommend.
3. Otherwise return exactly 10 picks, ranked best first. Always 10, even when the brief asks for fewer ("three options each" still gets 10); cover the requested split within the 10 and let the ranking show it.

Selection rules:
- Pick only from the index. Use the exact name and foundry strings from it.
- Tier priority: best first, then good and okay. Use notgood only when the brief specifically needs something only those have.
- If the brief signals a free or tight budget, note in the reason that the pick is paid, and prefer lower-cost foundries (atipo foundry is pay-what-you-want); the index has no free fonts.
- If a brief asks for a full system (display plus text plus mono), cover the roles across the 10 without labelling them.
- Only if nothing in the index comes close for a needed role, or the brief explicitly asks for free fonts, may you include picks from outside it, marked with outside_list true. Use sparingly; most briefs need none.
- Reasons cite letterform features tied to the brief. "It feels modern" is not a reason. Under 25 words each.

Reference material:

${TYPOGRAPHY_CONTEXT}

The index (JSON, one entry per typeface):

${index}`;
}

function buildIndex(): {
  json: string;
  lookup: Map<string, { foundrySlug: string; slug: string; name: string; foundry: string }>;
} {
  const all = getAllTypefaces();
  const compact = all.map((t) => ({
    name: t.name,
    foundry: t.foundry,
    category: t.category,
    subcategory: t.subcategory,
    tier: t.tier,
    tags: t.tags,
    summary: t.summary,
  }));
  const lookup = new Map(
    all.map((t) => [
      `${t.name.toLowerCase()}|${t.foundry.toLowerCase()}`,
      { foundrySlug: t.foundrySlug, slug: t.slug, name: t.name, foundry: t.foundry },
    ])
  );
  return { json: JSON.stringify(compact), lookup };
}

function extractToolInput(message: Anthropic.Message) {
  const block = message.content.find((b) => b.type === "tool_use");
  return block && block.type === "tool_use"
    ? (block.input as {
        type: "questions" | "results";
        questions?: string[];
        results?: ResultItem[];
      })
    : null;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." },
      { status: 500 }
    );
  }

  let body: BriefRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const brief = body.brief?.trim();
  if (!brief) {
    return NextResponse.json({ error: "Brief is required." }, { status: 400 });
  }
  if (brief.length > 4000) {
    return NextResponse.json({ error: "Brief is too long." }, { status: 400 });
  }

  const { json: index, lookup } = buildIndex();
  const client = new Anthropic();

  let userContent = `Brief: ${brief}`;
  if (body.answers && body.answers.length > 0) {
    const answered = body.answers
      .map((a) => `Q: ${a.question}\nA: ${a.answer || "I don't know"}`)
      .join("\n");
    userContent += `\n\nAnswers to your clarifying questions:\n${answered}\n\nDo not ask further questions. Recommend now.`;
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userContent },
  ];

  try {
    const first = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: buildSystemPrompt(index),
      messages,
      tools: [RESPONSE_TOOL],
      tool_choice: { type: "tool", name: "brief_response" },
    });

    const input = extractToolInput(first);
    if (!input) {
      return NextResponse.json(
        { error: "No structured response from the model." },
        { status: 502 }
      );
    }

    if (input.type === "questions") {
      const questions = (input.questions ?? []).slice(0, 3);
      if (questions.length === 0) {
        return NextResponse.json(
          { error: "The model returned no questions." },
          { status: 502 }
        );
      }
      return NextResponse.json({ type: "questions", questions });
    }

    let results = input.results ?? [];

    const resolve = (items: ResultItem[]) =>
      items.map((r) => {
        const match = lookup.get(`${r.name.toLowerCase()}|${r.foundry.toLowerCase()}`);
        return { raw: r, match };
      });

    let resolved = resolve(results);
    const invalid = resolved.filter((r) => !r.match && !r.raw.outside_list);

    // One correction round: hallucinated in-index picks, or fewer than 10.
    if (invalid.length > 0 || results.length < 10) {
      const problems: string[] = [];
      if (invalid.length > 0) {
        problems.push(
          `These picks are not in the index: ${invalid
            .map((r) => `${r.raw.name} (${r.raw.foundry})`)
            .join(", ")}. Replace them using exact index names.`
        );
      }
      if (results.length < 10) {
        problems.push(
          `You returned ${results.length} picks. The list must be exactly 10, whatever the brief asked for. Keep your picks and extend to 10.`
        );
      }
      const toolUse = first.content.find((b) => b.type === "tool_use");
      const replacement = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: buildSystemPrompt(index),
        messages: [
          ...messages,
          { role: "assistant", content: first.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result" as const,
                tool_use_id: toolUse!.id,
                content: `${problems.join(" ")} Return the full corrected list of exactly 10.`,
              },
            ],
          },
        ],
        tools: [RESPONSE_TOOL],
        tool_choice: { type: "tool", name: "brief_response" },
      });
      const second = extractToolInput(replacement);
      if (second?.type === "results" && second.results) {
        results = second.results;
        resolved = resolve(results);
      }
    }

    const final = resolved
      .filter((r) => r.match || r.raw.outside_list)
      .slice(0, 10)
      .map((r) =>
        r.match
          ? {
              name: r.match.name,
              foundry: r.match.foundry,
              foundrySlug: r.match.foundrySlug,
              slug: r.match.slug,
              reason: r.raw.reason,
              outsideList: false,
            }
          : {
              name: r.raw.name,
              foundry: r.raw.foundry,
              foundrySlug: null,
              slug: null,
              reason: r.raw.reason,
              outsideList: true,
            }
      );

    if (final.length === 0) {
      return NextResponse.json(
        { error: "No valid recommendations came back. Try rewording the brief." },
        { status: 502 }
      );
    }

    return NextResponse.json({ type: "results", results: final });
  } catch (err) {
    console.error("brief route error", err);
    return NextResponse.json(
      { error: "The recommendation call failed. Try again." },
      { status: 502 }
    );
  }
}
