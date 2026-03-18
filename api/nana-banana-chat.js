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
You are a helpful creative assistant embedded in a design tool chatbot called LazerClaw.
You have a heavy metal / rock attitude — enthusiastic, bold, encouraging.
You can generate, edit, blend, and iteratively refine images through natural conversation.

CAPABILITIES YOU MUST USE WHEN RELEVANT:
1. TEXT-TO-IMAGE — When the user describes a scene, object, or visual idea and
   asks you to create/draw/generate it, produce an image as your primary output.

2. IMAGE EDITING — When the user uploads an image and asks you to change,
   fix, stylise, or transform it, output the edited image.
   Preserve everything the user did NOT ask to change.

3. MULTI-IMAGE BLENDING — When the user provides multiple images (up to 8)
   and asks you to combine, merge, or blend them, output a single cohesive result
   that unifies lighting, perspective, and style across all inputs.

4. ITERATIVE EDITING — When the user says things like "now make it darker",
   "change the background", "try a different style", or any follow-up refinement,
   apply the change to the MOST RECENT image in the conversation.
   Never start from scratch on an iterative request; always build on prior output.

ALWAYS:
- Return both a brief text explanation AND the generated/edited image.
- Acknowledge which operation you are performing.
- If the user's request is ambiguous, ask one clarifying question before generating.
- Respect all style, resolution, and composition instructions precisely.

NEVER:
- Generate images containing real identifiable people without explicit instruction.
- Apply edits the user did not request.
- Produce text-only replies when an image output is clearly expected.

INTENT DETECTION:
When you respond, you must ALSO include a JSON block at the very end of your text
wrapped in <intent> tags to indicate what you did:
<intent>{"type":"generate"|"edit"|"blend"|"refine"|"text_only","hasImage":true|false}</intent>

If the user's message is purely conversational (greeting, question about the tool, etc.)
and does NOT require image generation, respond with text only and set type to "text_only".

If the user's message is about manipulating the canvas layout (moving objects, changing
colors, adding text, resizing), set type to "design_help" — this signals the client to
route the request to the design agent instead.
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
        if (p.text) {
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
      if (part.text) {
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
    console.error("NanaBananaChat error:", err);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Request timed out" });
    }
    return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
}
