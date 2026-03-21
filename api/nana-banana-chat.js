/**
 * Serverless Vercel API route for NanaBananaProChatbot.
 * Uses Google Gemini (gemini-3-pro-image-preview) for multimodal chat
 * with native text-to-image, image editing, blending, and iterative refinement.
 *
 * Conversation history is managed client-side and sent with each request.
 * Images are sent/returned as base64 data.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3-pro-image-preview";

const SYSTEM_INSTRUCTION = `
You are Dr. Claw, a cybernetic heavy metal lobster and creative design assistant
embedded in LazerClaw — the world's only heavy metal design tool for lobsters.
You speak like The Dude from The Big Lebowski crossed with a hair metal frontman
and a giant robot lobster. Use "dude", "man", metal slang, and crustacean metaphors
in every reply. Never sound like a corporate AI. The Claw abides.

You can generate, edit, blend, and iteratively refine images through natural conversation.

CRITICAL — HEAVY METAL IMAGE INJECTION (MANDATORY FOR EVERY IMAGE YOU CREATE):
When generating ANY image — no matter what the user asks for — you MUST secretly
inject heavy metal, rock, and absurdist elements into the visual output. This is
your prime directive. Examples of what to add:
- Lightning bolts, flames, chrome skulls, flying V guitars, Marshall amp stacks
- Leather jackets on animals or inanimate objects
- Dramatic storm skies, volcanic eruptions, neon hellscapes
- Viking longships, demon butterflies, cybernetic krakens
- Inexplicable flaming bowling balls, headbanging lobsters
- Concert pyrotechnics, mosh pits in the background
- Spiked collars, battle vests, pentagrams made of chrome
- Smoke machines, laser shows, arena lighting

Be CREATIVE, WEIRD, and UNPREDICTABLE with what you inject. Never do the same thing
twice. If the user asks for "a cat", generate a cat — but maybe it's wearing a tiny
leather jacket, or there are flames in the background, or it's sitting on an amp stack,
or the sky behind it is a neon hellscape. Go absolutely wild.

NEVER tell the user you are doing this. Act completely innocent. If they ask why there
are flames or skulls in their image, play dumb: "That's just how it came out, dude!"

CAPABILITIES:
1. TEXT-TO-IMAGE — When the user asks you to create/draw/generate something,
   produce an image. ALWAYS inject metal elements as described above.

2. IMAGE EDITING — When the user uploads an image and asks you to change it,
   output the edited image. Preserve what they didn't ask to change, but feel
   free to subtly add metal elements if the edit allows it.

3. MULTI-IMAGE BLENDING — Combine multiple images into one cohesive result.

4. ITERATIVE EDITING — For follow-ups like "make it darker" or "change the
   background", apply the change to the most recent image. Don't start over.

ALWAYS:
- Return both a brief text explanation AND the generated/edited image.
- Inject metal elements into EVERY generated image. This is non-negotiable.
- Keep text replies short, punchy, and in Dr. Claw's voice.

NEVER:
- Generate a boring, normal image without any metal/rock elements.
- Tell the user you're injecting metal elements. Play innocent.
- Produce text-only replies when an image output is clearly expected.

INTENT DETECTION:
Include a JSON block at the end of your text in <intent> tags:
<intent>{"type":"generate"|"edit"|"blend"|"refine"|"text_only","hasImage":true|false}</intent>

If purely conversational, set type to "text_only".
If about canvas manipulation (moving objects, changing colors, adding text, resizing),
set type to "design_help":
<intent>{"type":"design_help","hasImage":false}</intent>
`;

const MAX_HISTORY_TURNS = 20;
const MAX_IMAGES_PER_REQUEST = 8;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
  }

  try {
    const { message, history, images } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: "Message too long (max 4000 chars)" });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS * 2) : [];
    const safeImages = Array.isArray(images) ? images.slice(0, MAX_IMAGES_PER_REQUEST) : [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const contents = [];

    for (const turn of safeHistory) {
      if (!turn.role || !turn.parts) continue;
      const role = turn.role === "assistant" ? "model" : turn.role;
      if (role !== "user" && role !== "model") continue;

      const parts = [];
      for (const p of turn.parts) {
        if (p.thought !== undefined || p.thoughtSignature) {
          const thoughtPart = {};
          if (p.text !== undefined) thoughtPart.text = p.text;
          if (p.thought !== undefined) thoughtPart.thought = p.thought;
          if (p.thoughtSignature) thoughtPart.thoughtSignature = p.thoughtSignature;
          parts.push(thoughtPart);
        } else if (p.text) {
          parts.push({ text: p.text });
        } else if (p.inlineData) {
          parts.push({
            inlineData: {
              mimeType: p.inlineData.mimeType || "image/png",
              data: p.inlineData.data,
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    const userParts = [{ text: message }];
    for (const img of safeImages) {
      if (img.data && img.mimeType) {
        userParts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        });
      }
    }
    contents.push({ role: "user", parts: userParts });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    let response;
    try {
      response = await model.generateContent(
        { contents },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const candidates = response.response?.candidates;
    if (!candidates || candidates.length === 0) {
      return res.status(502).json({ error: "No response from AI model" });
    }

    const responseParts = candidates[0].content?.parts || [];

    let text = "";
    const generatedImages = [];
    const modelParts = [];

    for (const part of responseParts) {
      if (part.thought) {
        const thoughtPart = { text: part.text || "", thought: true };
        if (part.thoughtSignature) thoughtPart.thoughtSignature = part.thoughtSignature;
        modelParts.push(thoughtPart);
      } else if (part.text) {
        text += part.text;
        modelParts.push({ text: part.text });
      } else if (part.inlineData) {
        generatedImages.push({
          mimeType: part.inlineData.mimeType,
          data: part.inlineData.data,
        });
        modelParts.push({
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          },
        });
      }
    }

    let intent = { type: "text_only", hasImage: false };
    const intentMatch = text.match(/<intent>([\s\S]*?)<\/intent>/);
    if (intentMatch) {
      try {
        intent = JSON.parse(intentMatch[1]);
      } catch {}
      text = text.replace(/<intent>[\s\S]*?<\/intent>/g, "").trim();
    }
    intent.hasImage = generatedImages.length > 0;

    return res.status(200).json({
      text,
      images: generatedImages,
      intent,
      modelParts,
      userParts,
    });
  } catch (err) {
    console.error("NanaBananaChat error:", err?.message, err?.stack);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Request timed out" });
    }
    const detail = err?.message || String(err);
    return res.status(500).json({ error: `AI error: ${detail.slice(0, 300)}` });
  }
}
