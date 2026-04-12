import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";

// Force Node.js runtime — pdfjs-dist needs it
export const runtime = "nodejs";
export const maxDuration = 60; // allow up to 60s for large PDFs

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChunkItem {
  chunk_id: string;
  text: string;
  start_char: number;
  end_char: number;
  heading_path?: string | null;
  level?: string;
  isTable?: boolean;
}

interface HighlightRequest {
  pdf_url: string;
  chunks: ChunkItem[];
}

// ─── Text Normalization ─────────────────────────────────────────────────────

function normalizeText(text: string): string {
  if (!text) return "";
  return text.toLowerCase().replace(/\s+/g, "");
}

// ─── Merge adjacent line-rects into clean highlight boxes ────────────────────

interface CharRect {
  char: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function mergeRectangles(charRects: CharRect[]): CharRect[] {
  if (charRects.length === 0) return [];

  // Sort by y descending (bottom-up), then by x ascending
  charRects.sort((a, b) => {
    if (Math.abs(b.y - a.y) > 5) return b.y - a.y;
    return a.x - b.x;
  });

  const merged: CharRect[] = [];
  let current = { ...charRects[0] };

  for (let i = 1; i < charRects.length; i++) {
    const next = charRects[i];
    // Same line check (within 5px y difference)
    if (Math.abs(current.y - next.y) <= 5) {
      const minX = Math.min(current.x, next.x);
      const maxX = Math.max(current.x + current.width, next.x + next.width);
      current.x = minX;
      current.width = maxX - minX;
      current.height = Math.max(current.height, next.height);
      current.y = Math.min(current.y, next.y);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

// ─── Main POST Handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: HighlightRequest = await req.json();
    const { pdf_url, chunks } = body;

    if (!pdf_url) {
      return NextResponse.json({ error: "pdf_url is required" }, { status: 400 });
    }
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: "chunks array is required" }, { status: 400 });
    }

    console.log(`[highlight-pdf] Downloading PDF from: ${pdf_url}`);

    // ── Download the PDF ───────────────────────────────────────────────────
    const pdfResponse = await fetch(pdf_url);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download PDF: ${pdfResponse.status}` },
        { status: 502 }
      );
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    console.log(`[highlight-pdf] PDF downloaded (${pdfBytes.length} bytes). Processing ${chunks.length} chunks.`);

    // ── Load with pdf-lib (for drawing) ──────────────────────────────────
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pdfLibPages = pdfDoc.getPages();

    // ── Load with pdfjs-dist (for text coordinates) ─────────────────────
    // pdfjs-dist is in serverExternalPackages, so it loads directly from
    // node_modules without Turbopack bundling — worker paths resolve correctly.
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfArrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdfJsDoc = await loadingTask.promise;
    const numPages = pdfJsDoc.numPages;

    console.log(`[highlight-pdf] PDF has ${numPages} page(s).`);

    // ── Pre-extract all page text positions ──────────────────────────────
    const pagesInfo: {
      pageIdx: number;
      normalizedStr: string;
      charRects: CharRect[];
    }[] = [];

    for (let p = 1; p <= numPages; p++) {
      const page = await pdfJsDoc.getPage(p);
      const textContent = await page.getTextContent();

      let normalizedPageStr = "";
      const charRects: CharRect[] = [];

      for (const item of textContent.items as any[]) {
        if (!item.str || item.str.trim() === "") continue;

        const charWidth = item.width / item.str.length;
        const height = item.height;

        for (let i = 0; i < item.str.length; i++) {
          const c = item.str[i];
          if (/\s/.test(c)) continue; // skip spaces for normalized matching

          normalizedPageStr += c.toLowerCase();
          charRects.push({
            char: c,
            x: item.transform[4] + i * charWidth,
            y: item.transform[5],
            width: charWidth,
            height: Math.abs(item.transform[3]) || height || 12,
          });
        }
      }

      pagesInfo.push({ pageIdx: p - 1, normalizedStr: normalizedPageStr, charRects });
    }

    // ── Highlight each chunk ────────────────────────────────────────────
    const HIGHLIGHT_COLOR = rgb(1, 1, 0); // Yellow
    const TABLE_COLOR = rgb(0.2, 0.6, 1); // Blue
    const HIGHLIGHT_OPACITY = 0.4;
    const PADDING = 2;

    const stats = {
      total_chunks: chunks.length,
      highlighted: 0,
      missing: 0,
      pages_processed: numPages,
    };

    for (const chunk of chunks) {
      if (!chunk.text) {
        stats.missing++;
        continue;
      }

      const queryStr = normalizeText(chunk.text);
      if (!queryStr) {
        stats.missing++;
        continue;
      }

      let found = false;

      for (const pInfo of pagesInfo) {
        const matchIndex = pInfo.normalizedStr.indexOf(queryStr);
        if (matchIndex !== -1) {
          const rectsToHighlight: CharRect[] = [];
          for (let i = 0; i < queryStr.length; i++) {
            const rect = pInfo.charRects[matchIndex + i];
            if (rect) rectsToHighlight.push(rect);
          }

          const mergedRects = mergeRectangles(rectsToHighlight);
          const pdfLibPage = pdfLibPages[pInfo.pageIdx];

          for (const r of mergedRects) {
            pdfLibPage.drawRectangle({
              x: r.x - PADDING,
              y: r.y - PADDING,
              width: r.width + PADDING * 2,
              height: r.height + PADDING * 2,
              color: chunk.isTable ? TABLE_COLOR : HIGHLIGHT_COLOR,
              opacity: HIGHLIGHT_OPACITY,
            });
          }

          found = true;
          stats.highlighted++;
          break; // found on this page, move to next chunk
        }
      }

      if (!found) {
        stats.missing++;
      }
    }

    // ── Black-out [REDACTED] text across all pages ──────────────────────
    const REDACTED_COLOR = rgb(0, 0, 0); // Black
    const redactedNormalized = normalizeText("[REDACTED]"); // "redacted"
    let redactedCount = 0;

    for (const pInfo of pagesInfo) {
      let searchStart = 0;
      while (true) {
        const idx = pInfo.normalizedStr.indexOf(redactedNormalized, searchStart);
        if (idx === -1) break;

        const rectsToBlack: CharRect[] = [];
        for (let i = 0; i < redactedNormalized.length; i++) {
          const rect = pInfo.charRects[idx + i];
          if (rect) rectsToBlack.push(rect);
        }

        const mergedRects = mergeRectangles(rectsToBlack);
        const pdfLibPage = pdfLibPages[pInfo.pageIdx];

        for (const r of mergedRects) {
          pdfLibPage.drawRectangle({
            x: r.x - PADDING,
            y: r.y - PADDING,
            width: r.width + PADDING * 2,
            height: r.height + PADDING * 2,
            color: REDACTED_COLOR,
            opacity: 1, // fully opaque black bar
          });
        }

        redactedCount++;
        searchStart = idx + redactedNormalized.length;
      }
    }

    console.log(`[highlight-pdf] Done. Stats:`, { ...stats, redacted_markers: redactedCount });

    // ── Save & return the highlighted PDF ────────────────────────────────
    const outputBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(outputBytes);

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="highlighted_document.pdf"',
        "X-Highlight-Stats": JSON.stringify(stats),
      },
    });
  } catch (err: any) {
    console.error("[highlight-pdf] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
