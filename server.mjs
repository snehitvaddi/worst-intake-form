// server.mjs — serves the form and judges "prove you are human" poses with Claude.
//
//   npm install
//   node server.mjs            ->  http://localhost:4173
//
// Credentials: the Anthropic SDK reads ANTHROPIC_API_KEY (or an `ant auth login`
// profile) on its own. With no credentials the /api/pose-check route answers 503 and
// the page falls back to a fake judge, so the form still works.
//
// The camera frame is sent to the Anthropic API for this one request and is never
// written to disk or logged.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4173;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const POSES = ["elephant", "giraffe", "flamingo", "t-rex", "teapot"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    human_visible: { type: "boolean", description: "A real person is visible in the photo." },
    pose_score: { type: "integer", description: "0-100: how well the person's pose resembles the requested animal or object." },
    comment: { type: "string", description: "One short, playful sentence for the patient. Tease the pose, never the person's body or appearance." },
  },
  required: ["human_visible", "pose_score", "comment"],
  additionalProperties: false,
};

let client = null;
try {
  client = new Anthropic();
} catch {
  console.warn("[pose-check] No Anthropic credentials found. The page will use its fake judge.");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function poseCheck(req, res) {
  if (!client) return sendJson(res, 503, { error: "no_credentials" });

  let pose, image;
  try {
    ({ pose, image } = JSON.parse(await readBody(req)));
  } catch {
    return sendJson(res, 400, { error: "bad_request" });
  }
  const match = typeof image === "string" && image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!POSES.includes(pose) || !match) return sendJson(res, 400, { error: "bad_request" });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low", format: { type: "json_schema", schema: VERDICT_SCHEMA } },
      system:
        "You are the deadpan judge of a joke CAPTCHA on a parody patient intake form. " +
        "A webcam photo shows someone trying to prove they are human by posing as an animal or object. " +
        "Judge only the pose. Be generous: any visible attempt (an arm as a trunk, a stretched neck, one leg up, " +
        "tiny arms, a hand on the hip) deserves a decent score. Keep the comment kind and funny.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: match[1] } },
            { type: "text", text: `Requested pose: ${pose}. Score how well this person is doing it.` },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return sendJson(res, 502, { error: "declined" });
    const text = response.content.find((block) => block.type === "text");
    const verdict = JSON.parse(text.text);
    sendJson(res, 200, {
      pass: verdict.human_visible && verdict.pose_score >= 50,
      score: verdict.pose_score,
      human: verdict.human_visible,
      comment: verdict.comment,
      judge: "claude",
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.warn("[pose-check] Credentials were rejected.");
      return sendJson(res, 503, { error: "no_credentials" });
    }
    if (err instanceof Anthropic.RateLimitError) return sendJson(res, 429, { error: "rate_limited" });
    if (err instanceof Anthropic.APIError) {
      console.warn("[pose-check] API error", err.status);
      return sendJson(res, 502, { error: "judge_unavailable" });
    }
    console.warn("[pose-check] failed:", err.message);
    sendJson(res, 502, { error: "judge_unavailable" });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.normalize(path.join(ROOT, rel));
  const hidden = rel.split("/").some((part) => part.startsWith(".") || part === "node_modules");
  if (!file.startsWith(ROOT + path.sep) || hidden) {
    res.writeHead(404);
    return res.end("Not found");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/pose-check") return poseCheck(req, res);
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
    res.writeHead(405);
    res.end();
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Worst intake form ever: http://localhost:${PORT}`);
  });
