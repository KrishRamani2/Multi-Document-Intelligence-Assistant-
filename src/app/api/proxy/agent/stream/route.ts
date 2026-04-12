import { NextRequest } from "next/server";

// Dedicated SSE proxy for /agent/stream — streams raw bytes through
const TARGET_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://jazmin-nongerminal-overclosely.ngrok-free.dev";

const PROXY_HEADERS = {
  "ngrok-skip-browser-warning": "true",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  const targetUrl = `${TARGET_API}/agent/stream`;
  console.log(`[SSE Proxy] → ${targetUrl}`);

  try {
    const body = await req.json();

    const upstreamRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...PROXY_HEADERS,
      },
      body: JSON.stringify(body),
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      console.error(`[SSE Proxy] Upstream error ${upstreamRes.status}:`, errorText);
      return new Response(
        JSON.stringify({ error: "Upstream error", detail: errorText }),
        { status: upstreamRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!upstreamRes.body) {
      return new Response(
        JSON.stringify({ error: "No body from upstream" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pipe the SSE stream straight through
    return new Response(upstreamRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error(`[SSE Proxy] Error:`, err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
