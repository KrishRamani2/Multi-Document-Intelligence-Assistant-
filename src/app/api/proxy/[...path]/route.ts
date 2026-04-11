import { NextRequest, NextResponse } from "next/server";

// Use env var for API URL, fallback to hardcoded for dev
const TARGET_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://jazmin-nongerminal-overclosely.ngrok-free.dev";

const PROXY_HEADERS = {
  "ngrok-skip-browser-warning": "true",
  "Access-Control-Allow-Origin": "*",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${TARGET_API}/${path}${search}`;

  console.log(`[Proxy GET] → ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      headers: { ...PROXY_HEADERS },
      // Don't follow redirects blindly — just pass through
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    let body: any;

    if (contentType.includes("application/json")) {
      body = await response.json();
      return NextResponse.json(body, { status: response.status });
    } else {
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { "Content-Type": contentType || "text/plain" },
      });
    }
  } catch (err: any) {
    console.error(`[Proxy GET] Error proxying ${targetUrl}:`, err.message);
    return NextResponse.json(
      { error: err.message, target: targetUrl },
      { status: 502 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${TARGET_API}/${path}${search}`;

  console.log(`[Proxy POST] → ${targetUrl}`);

  try {
    const body = await req.json();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...PROXY_HEADERS,
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();

      if (!response.ok) {
        console.error(`[Proxy POST] Upstream error ${response.status}:`, data);
        return NextResponse.json(
          { error: "Upstream error", detail: data, status: response.status },
          { status: response.status }
        );
      }

      return NextResponse.json(data, { status: response.status });
    } else {
      const text = await response.text();
      console.error(`[Proxy POST] Non-JSON response from upstream:`, text);

      if (!response.ok) {
        return NextResponse.json(
          { error: "Upstream error", detail: text, status: response.status },
          { status: response.status }
        );
      }

      return new NextResponse(text, {
        status: response.status,
        headers: { "Content-Type": contentType || "text/plain" },
      });
    }
  } catch (err: any) {
    console.error(`[Proxy POST] Error proxying ${targetUrl}:`, err.message);
    return NextResponse.json(
      { error: err.message, target: targetUrl },
      { status: 502 }
    );
  }
}
