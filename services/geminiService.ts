
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, WorkspaceType, AIProvider } from "../types";

const SYSTEM_PROMPT = `You are "OneClick Studio", a world-class Full-Stack AI Engineer.
Your goal is to build 100% COMPLETE, functional, and production-ready applications in a SINGLE TURN.

### 🛠 MANDATORY RULES:
1. **ZERO QUESTIONS ON START:** When a user gives an initial instruction (e.g., "Build an e-commerce app"), you MUST NOT ask any questions. Do NOT ask about admin panels, auth methods, or themes. Assume professional defaults and build EVERYTHING immediately.
2. **FULL IMPLEMENTATION:** Your first response MUST contain all necessary files (HTML, CSS, JS, SQL) in the "files" object. Do NOT build a skeleton or "Step 1". Build the whole app.
3. **NO BLOCKING:** Do NOT provide a "plan" that requires approval on the first turn. Just execute.
4. **POST-BUILD INTERACTION:** Only after the full app is built, if the user asks for a "modification", "edit", or "deletion", you may ask clarifying questions if necessary.
5. **BENGALI COMMUNICATION:** Always explain what you built in Bengali in the "answer" field.

### 🚀 RESPONSE FORMAT (JSON ONLY):
{
  "thought": "Internal reasoning (Bengali).",
  "questions": [], 
  "plan": [],
  "answer": "বিস্তারিত বর্ণনা (Bengali) - আপনি কী কী তৈরি করেছেন এবং অ্যাপটি এখন পুরোপুরি ফাংশনাল।",
  "files": { 
    "app/index.html": "...",
    "app/main.js": "...",
    "database.sql": "..."
  }
}

### 🎨 DESIGN RULES:
- High-end modern UI (Tailwind CSS).
- Fully functional logic (Cart, Search, Filters, etc.).
- No placeholders. Use realistic sample data.`;

export interface GenerationResult {
  files?: Record<string, string>;
  answer: string;
  thought?: string;
  plan?: string[];
  questions?: any[];
}

export class GeminiService {
  private isLocalModel(modelName: string): boolean {
    const name = modelName.toLowerCase();
    return name.includes('local') || name.includes('llama') || name.includes('qwen') || name.includes('coder');
  }

  async generateWebsite(
    prompt: string, 
    currentFiles: Record<string, string> = {}, 
    history: ChatMessage[] = [],
    image?: { data: string; mimeType: string },
    activeWorkspace?: WorkspaceType | boolean,
    modelName: string = 'gemini-3-flash-preview'
  ): Promise<GenerationResult> {
    
    const contextText = this.buildContextString(prompt, currentFiles, activeWorkspace);

    if (this.isLocalModel(modelName)) {
      return this.generateWithOllama(modelName, contextText, history);
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "undefined") throw new Error("GEMINI_API_KEY not found.");

    const ai = new GoogleGenAI({ apiKey: key });
    const parts: any[] = [{ text: contextText }];
    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

    const response = await ai.models.generateContent({
      model: modelName.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview', 
      contents: { parts },
      config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json", temperature: 0.1 }
    });

    if (!response.text) throw new Error("AI returned empty response");
    return JSON.parse(response.text.trim());
  }

  async *generateWebsiteStream(
    prompt: string, 
    currentFiles: Record<string, string> = {}, 
    history: ChatMessage[] = [],
    image?: { data: string; mimeType: string },
    projectConfig?: any,
    activeWorkspace?: WorkspaceType,
    modelName: string = 'gemini-3-flash-preview',
    signal?: AbortSignal
  ): AsyncIterable<string> {
    
    if (signal?.aborted) throw new Error("AbortError");

    const contextText = this.buildContextString(prompt, currentFiles, activeWorkspace);

    if (this.isLocalModel(modelName)) {
      yield* this.streamWithOllama(modelName, contextText, history, signal);
      return;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "undefined") throw new Error("GEMINI_API_KEY not found.");

    const ai = new GoogleGenAI({ apiKey: key });
    const parts: any[] = [{ text: contextText }];
    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

    const responseStream = await ai.models.generateContentStream({
      model: modelName.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview', 
      contents: { parts },
      config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json", temperature: 0.1 }
    });

    for await (const chunk of responseStream) {
      if (signal?.aborted) throw new Error("AbortError");
      if (chunk.text) yield chunk.text;
    }
  }

  private buildContextString(prompt: string, currentFiles: Record<string, string>, activeWorkspace?: WorkspaceType | boolean): string {
    const filteredFiles: Record<string, string> = {};
    const fullProjectMap: string[] = Object.keys(currentFiles);

    Object.keys(currentFiles).forEach(path => {
      if (activeWorkspace === false) {
        filteredFiles[path] = currentFiles[path];
        return;
      }
      if (!activeWorkspace || path.startsWith(activeWorkspace + '/') || !path.includes('/')) {
        filteredFiles[path] = currentFiles[path];
      }
    });

    return `PROJECT MAP (FILES IN WORKSPACE):\n${fullProjectMap.join('\n')}\n\nCURRENT SOURCE CONTENT:\n${JSON.stringify(filteredFiles)}\n\nUSER DIRECTIVE: ${prompt}\n\nINSTRUCTION: Admin panel is optional. Use "questions" to ask if one is needed for simple apps.`;
  }

  private async generateWithOllama(model: string, prompt: string, history: ChatMessage[], signal?: AbortSignal): Promise<GenerationResult> {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt }
        ],
        stream: false,
        format: 'json'
      }),
      signal
    });
    if (!response.ok) throw new Error("Ollama connection failed.");
    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  private async *streamWithOllama(model: string, prompt: string, history: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt }
        ],
        stream: true,
        format: 'json'
      }),
      signal
    });

    if (!response.ok) throw new Error("Ollama connection failed.");
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      try {
        while (true) {
          if (signal?.aborted) {
             reader.cancel();
             throw new Error("AbortError");
          }
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              try {
                const json = JSON.parse(line);
                if (json.message?.content) yield json.message.content;
              } catch (e) {}
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }
}
