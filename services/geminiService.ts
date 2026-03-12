import { GoogleGenAI } from "@google/genai";
import { Exhibit } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash-preview'; 

/**
 * Scans text for legal exhibits (Exhibit A, Exhibit 1, etc.)
 */
export const scanForExhibits = (text: string, blockId: string, timestamp: string): Exhibit[] => {
    const regex = /(?:Exhibit|Ex\.)\s+([A-Z0-9]+)/gi;
    const matches = [...text.matchAll(regex)];
    
    return matches.map((match, idx) => ({
        id: `ex_${blockId}_${idx}`,
        label: match[0],
        description: "Automatically detected",
        detectedAtBlockId: blockId,
        timestamp: timestamp
    }));
};

/**
 * Streams transcription from an audio/video file.
 * Returns a generator that yields text chunks.
 */
export async function* streamTranscription(fileBase64: string, mimeType: string) {
  const prompt = `
    Role: High-Precision Legal Transcription Engine.
    Task: Transcribe audio VERBATIM. Identify speakers/roles.
    Output: Stream of JSON objects (one per line). NO markdown.
    
    JSON Schema:
    {
      "speakerName": "string",
      "role": "WITNESS" | "ATTORNEY_PLAINTIFF" | "ATTORNEY_DEFENSE" | "THE_COURT",
      "text": "string",
      "confidence": number (0-1),
      "isQuestion": boolean
    }
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: fileBase64 } }
          ]
        }
      ],
      config: {
        temperature: 0.1, // Highly deterministic
        // We do not set responseMimeType to 'application/json' because we want a line-delimited stream, 
        // and strictly enforcing JSON array mode might delay the stream chunks or cause formatting issues with huge arrays.
      }
    });

    for await (const chunk of responseStream) {
       yield chunk.text;
    }

  } catch (error) {
    console.error("Gemini Streaming Error:", error);
    throw error;
  }
}