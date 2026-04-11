import { DeepgramClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
        return NextResponse.json({ error: "Deepgram API key is not configured" }, { status: 500 });
    }

    const deepgram = new DeepgramClient({ apiKey });
    const buffer = Buffer.from(await audioFile.arrayBuffer());

    let result: any;
    try {
      result = await deepgram.listen.v1.media.transcribeFile(
        buffer,
        {
          model: "nova-2",
          smartFormat: true, // snake_case is converted in new SDK, or use as any
        } as any
      );
    } catch (error: any) {
       console.error("Deepgram Error:", error);
       return NextResponse.json({ error: "Deepgram API Error" }, { status: 500 });
    }

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}
