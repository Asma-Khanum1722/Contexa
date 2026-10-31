import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { parseDocument } from "@/lib/parseDoc";
import { embedAndStore } from "@/lib/embed";
import { registerBot, getUserBotCount } from "@/lib/db";
import {
  AppError,
  FileTooLargeError,
  UnsupportedFileTypeError,
  ValidationError,
} from "@/lib/errors";
import { env } from "@/lib/env";
import { verifyAuth } from "@/lib/auth-server";
import { enforceRateLimit } from "@/lib/rateLimit";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "text/plain",
  "text/csv",
]);
const MAX_BOTS_PER_USER = 10;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Authenticate before anything else
  let user;
  try {
    user = await verifyAuth(req);
  } catch (err: any) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Enforce Rate Limit per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    await enforceRateLimit(`upload:${ip}`, 10, 60); // 10 uploads per minute max
  } catch (err: any) {
    return NextResponse.json({ error: "Too many upload requests. Please try again later." }, { status: 429 });
  }

  // 3. Enforce maximum bot limits
  const botCount = await getUserBotCount(user.uid);
  if (botCount >= MAX_BOTS_PER_USER) {
    return NextResponse.json(
      { error: `You have reached the maximum limit of ${MAX_BOTS_PER_USER} bots.` },
      { status: 403 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        const form = await req.formData();
        const files = form.getAll("files") as File[];
        const botId = (form.get("botId") as string | null) || nanoid(10);

        if (!files.length) {
          throw new ValidationError("No files provided.");
        }

        for (const file of files) {
          if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new FileTooLargeError(file.name, 25);
          }
          if (!ALLOWED_MIME.has(file.type)) {
            throw new UnsupportedFileTypeError(file.name);
          }
        }

        let totalChunks = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const filePct = (i / files.length) * 100;

          emit({
            stage: "parsing",
            pct: Math.round(filePct + 5),
            filename: file.name,
          });

          const buffer = Buffer.from(await file.arrayBuffer());
          const { text, method } = await parseDocument(buffer, file.name);

          emit({
            stage: "embedding",
            pct: Math.round(filePct + 50 / files.length),
            filename: file.name,
            method,
          });

          const docText = text && text.trim().length > 0 
            ? text 
            : `[Document ${file.name} - No extractable text found]`;

          const { chunksStored } = await embedAndStore({
            botId,
            docId: nanoid(8),
            text: docText,
            filename: file.name,
          });

          totalChunks += chunksStored;
        }

        const baseUrl = env("NEXT_PUBLIC_BASE_URL");
        const embedSnippet = `<script src="${baseUrl}/widget.js" data-bot="${botId}" data-origin="${baseUrl}"></script>`;

        const botName = (form.get("botName") as string | null) || `BOT-${botId.slice(0, 4).toUpperCase()}`;
        
        await registerBot({
          botId,
          userId: user.uid,
          name: botName,
          chunks: totalChunks,
          filenames: files.map(f => f.name),
          createdAt: Date.now(),
          themeColor: "#0084C7",
          avatarUrl: "",
        });

        emit({
          stage: "done",
          pct: 100,
          botId,
          chunksStored: totalChunks,
          embedSnippet,
        });
      } catch (err) {
        const appErr = AppError.from(err);
        emit({
          stage: "error",
          error: appErr.message,
          code: appErr.code,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Transfer-Encoding": "chunked",
    },
  });
}
