import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChunkInput {
  chunk_id: string;
  text: string;
  start_char: number;
  end_char: number;
  level?: string;
  heading_path?: string | null;
}

interface ZeroClawResult {
  chunk_id: string;
  text: string;
  start_char: number;
  end_char: number;
  level?: string;
  heading_path?: string | null;
  // ZeroClaw fields
  verified: boolean;
  checksum: string;
  confidence: number;
  conflicts: string[];
  conflict_details: { chunk_id: string; reason: string }[];
  char_match: boolean;
  text_length: number;
  source_coverage: number; // % of source text this chunk covers
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createChecksum(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function verifyChunk(chunk: ChunkInput, fullText: string): { verified: boolean; confidence: number } {
  if (!chunk.text || !fullText) return { verified: false, confidence: 0 };

  const normalizedChunk = normalizeForMatch(chunk.text);
  const normalizedFull = normalizeForMatch(fullText);

  // Exact match
  if (normalizedFull.includes(normalizedChunk)) {
    return { verified: true, confidence: 1.0 };
  }

  // Partial match — check first and last 50 chars
  const head = normalizedChunk.slice(0, 50);
  const tail = normalizedChunk.slice(-50);
  const headMatch = normalizedFull.includes(head);
  const tailMatch = normalizedFull.includes(tail);

  if (headMatch && tailMatch) {
    return { verified: true, confidence: 0.85 };
  }
  if (headMatch || tailMatch) {
    return { verified: true, confidence: 0.6 };
  }

  // Fuzzy: check if 60%+ of words exist in source
  const chunkWords = normalizedChunk.split(/\s+/).filter(w => w.length > 3);
  if (chunkWords.length === 0) return { verified: false, confidence: 0 };
  const matchedWords = chunkWords.filter(w => normalizedFull.includes(w));
  const ratio = matchedWords.length / chunkWords.length;
  if (ratio > 0.6) {
    return { verified: true, confidence: Math.round(ratio * 100) / 100 };
  }

  return { verified: false, confidence: ratio };
}

// Sentiment-based conflict detection
const POSITIVE_SIGNALS = ["increase", "growth", "profit", "improvement", "gain", "rise", "positive", "success", "benefit", "advantage", "up"];
const NEGATIVE_SIGNALS = ["decrease", "loss", "decline", "reduction", "drop", "negative", "failure", "risk", "disadvantage", "down", "fell"];

function detectConflict(a: ChunkInput, b: ChunkInput): string | null {
  const textA = a.text.toLowerCase();
  const textB = b.text.toLowerCase();

  for (const pos of POSITIVE_SIGNALS) {
    for (const neg of NEGATIVE_SIGNALS) {
      if (textA.includes(pos) && textB.includes(neg)) {
        return `"${pos}" in chunk ${a.chunk_id.slice(0, 8)} vs "${neg}" in chunk ${b.chunk_id.slice(0, 8)}`;
      }
      if (textA.includes(neg) && textB.includes(pos)) {
        return `"${neg}" in chunk ${a.chunk_id.slice(0, 8)} vs "${pos}" in chunk ${b.chunk_id.slice(0, 8)}`;
      }
    }
  }
  return null;
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chunks, full_text } = body as { chunks: ChunkInput[]; full_text?: string };

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: "chunks array is required" }, { status: 400 });
    }

    const sourceText = full_text || "";
    const totalSourceChars = sourceText.length || 1;

    // Step 1: Verify + checksum each chunk
    const results: ZeroClawResult[] = chunks.map((chunk) => {
      const { verified, confidence } = verifyChunk(chunk, sourceText);
      const checksum = createChecksum(chunk.text || "");
      const charSpan = (chunk.end_char || 0) - (chunk.start_char || 0);
      const charMatch = charSpan > 0 && chunk.text?.length
        ? Math.abs(charSpan - chunk.text.length) <= 10
        : false;

      return {
        ...chunk,
        verified,
        checksum,
        confidence,
        char_match: charMatch,
        text_length: chunk.text?.length || 0,
        source_coverage: Math.round((charSpan / totalSourceChars) * 10000) / 100,
        conflicts: [],
        conflict_details: [],
      };
    });

    // Step 2: Pairwise conflict detection
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const reason = detectConflict(results[i], results[j]);
        if (reason) {
          results[i].conflicts.push(results[j].chunk_id);
          results[i].conflict_details.push({ chunk_id: results[j].chunk_id, reason });
          results[j].conflicts.push(results[i].chunk_id);
          results[j].conflict_details.push({ chunk_id: results[i].chunk_id, reason });
        }
      }
    }

    // Step 3: Build summary
    const verifiedCount = results.filter(r => r.verified).length;
    const conflictCount = results.filter(r => r.conflicts.length > 0).length;
    const avgConfidence = results.reduce((a, r) => a + r.confidence, 0) / results.length;
    const totalConflictPairs = results.reduce((a, r) => a + r.conflicts.length, 0) / 2;

    const summary = {
      total_chunks: results.length,
      verified_count: verifiedCount,
      unverified_count: results.length - verifiedCount,
      conflicting_chunks: conflictCount,
      conflict_pairs: Math.floor(totalConflictPairs),
      avg_confidence: Math.round(avgConfidence * 100) / 100,
      integrity_score: Math.round(
        ((verifiedCount / results.length) * 0.6 +
        ((results.length - conflictCount) / results.length) * 0.4) * 100
      ),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      summary,
      chunks: results,
    });
  } catch (err: any) {
    console.error("[zeroclaw] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
