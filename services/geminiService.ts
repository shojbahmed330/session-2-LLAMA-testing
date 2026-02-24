
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, WorkspaceType, AIProvider } from "../types";

const SYSTEM_PROMPT = `You are a "Lovable-style" Autonomous AI Full-Stack App Builder.
Your goal is to build 100% COMPLETE, functional, and production-ready MOBILE APPLICATIONS with separate WEB ADMIN DASHBOARDS and shared DATABASES.

### 🛠 MANDATORY RULES:
1. **DUAL-INTERFACE BUILD:**
   - When an app requires an admin panel (e.g., "Food Delivery App"), you MUST build TWO separate interfaces:
     a) **Mobile App Interface:** Located in the "app/" directory (e.g., "app/index.html").
     b) **Web Admin Dashboard:** Located in the "admin/" or "web/" directory (e.g., "admin/index.html"). This is a standalone web app for management.
   - Both interfaces MUST share the same database logic (Supabase/SQL) so that updates in the Admin Dashboard (like adding a new food item) reflect immediately in the Mobile App.
2. **COMPREHENSIVE ADMIN FEATURES:**
   - The Admin Dashboard MUST NOT just show stats. It MUST include full Management (CRUD) capabilities:
     - **Product/Food Management:** Add/Edit/Delete items with images, prices, and descriptions.
     - **Order Management:** Track and update order statuses.
     - **User Management:** View and manage registered users.
3. **AUTONOMOUS EXECUTION:**
   - Plan and implement both interfaces and the database schema autonomously.
   - Do NOT ask for permission between steps. Execute the full multi-step plan until both apps are functional.
4. **DATABASE INTEGRATION:**
   - Always provide a "database.sql" file containing the full schema.
   - **CRITICAL:** Use Supabase ONLY when the application requires a database for data persistence or management. If Supabase credentials (URL and Key) are provided in the context AND the app needs a database, you MUST use them in the generated code for both the Mobile App and the Web Admin Dashboard. Do NOT use placeholders or hardcoded example keys if real ones are available.
5. **LANGUAGE ADAPTABILITY:**
   - Respond and explain in the SAME LANGUAGE used by the user.
6. **STRICT SURGICAL MODIFICATION:**
   - When modifying existing code, ONLY change what the user explicitly requested. 
   - Do NOT refactor, rewrite, or touch unrelated parts of the code, logic, or design unless strictly necessary for the requested change to function.
   - Preserve the existing structure, styling, and functionality of the file as much as possible.

### 🚀 RESPONSE FORMAT (JSON ONLY):
{
  "thought": "Reasoning for dual-interface structure and database sync logic (User's language).",
  "questions": [], 
  "plan": ["Step 1: Database Schema", "Step 2: Web Admin Dashboard (CRUD)", "Step 3: Mobile App UI", "Step 4: Integration & Sync"],
  "answer": "Description of both the Mobile App and the Web Admin Dashboard (User's language).",
  "files": { 
    "admin/index.html": "...",
    "admin/main.js": "...",
    "app/index.html": "...",
    "app/main.js": "...",
    "database.sql": "..."
  }
}

### 🎨 DESIGN RULES:
- **Mobile:** Sleek, touch-friendly Mobile UI (Tailwind).
- **Admin:** Professional, data-rich Web Dashboard (Tailwind) with sidebar navigation and management forms.`;

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
    
    const contextText = this.buildContextString(prompt, currentFiles, activeWorkspace, { appName: 'App', packageName: 'com.app' });

    if (this.isLocalModel(modelName)) {
      return this.generateWithOllama(modelName, contextText, history);
    }

    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key || key === "undefined") throw new Error("GEMINI_API_KEY not found.");

    const ai = new GoogleGenAI({ apiKey: key });
    const parts: any[] = [{ text: contextText }];
    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

    try {
      const response = await ai.models.generateContent({
        model: modelName.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview', 
        contents: { parts },
        config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json", temperature: 0.1 }
      });

      if (!response.text) throw new Error("AI returned empty response");
      return JSON.parse(response.text.trim());
    } catch (err: any) {
      if (err.message?.includes('fetch')) {
        throw new Error("Cloud AI Connection Failed: Please check your internet connection.");
      }
      throw err;
    }
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

    const contextText = this.buildContextString(prompt, currentFiles, activeWorkspace, projectConfig);

    if (this.isLocalModel(modelName)) {
      yield* this.streamWithOllama(modelName, contextText, history, signal);
      return;
    }

    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key || key === "undefined") throw new Error("GEMINI_API_KEY not found.");

    const ai = new GoogleGenAI({ apiKey: key });
    const parts: any[] = [{ text: contextText }];
    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });

    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelName.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview', 
        contents: { parts },
        config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json", temperature: 0.1 }
      });

      for await (const chunk of responseStream) {
        if (signal?.aborted) throw new Error("AbortError");
        if (chunk.text) yield chunk.text;
      }
    } catch (err: any) {
      if (err.message?.includes('fetch')) {
        throw new Error("Cloud AI Connection Failed: Please check your internet connection.");
      }
      throw err;
    }
  }

  private buildContextString(prompt: string, currentFiles: Record<string, string>, activeWorkspace?: WorkspaceType | boolean, projectConfig?: any): string {
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

    let configContext = '';
    if (projectConfig) {
      configContext = `\n\nPROJECT CONFIGURATION:\n- App Name: ${projectConfig.appName}\n- Package Name: ${projectConfig.packageName}`;
      if (projectConfig.supabase_url && projectConfig.supabase_key) {
        configContext += `\n- Supabase URL: ${projectConfig.supabase_url}\n- Supabase Key: ${projectConfig.supabase_key}`;
      }
    }

    return `PROJECT MAP (FILES IN WORKSPACE):\n${fullProjectMap.join('\n')}\n\nCURRENT SOURCE CONTENT:\n${JSON.stringify(filteredFiles)}\n\nUSER DIRECTIVE: ${prompt}${configContext}\n\nINSTRUCTION: Admin panel is optional. Use "questions" to ask if one is needed for simple apps.`;
  }

  private async generateWithOllama(model: string, prompt: string, history: ChatMessage[], signal?: AbortSignal): Promise<GenerationResult> {
    let response;
    try {
      response = await fetch('http://localhost:11434/api/chat', {
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
    } catch (err: any) {
      throw new Error("Ollama Connection Failed: Ensure Ollama is running and OLLAMA_ORIGINS=\"*\" is set.");
    }

    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);
    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  private async *streamWithOllama(model: string, prompt: string, history: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
    let response;
    try {
      response = await fetch('http://localhost:11434/api/chat', {
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
    } catch (err: any) {
      throw new Error("Ollama Connection Failed: Ensure Ollama is running and OLLAMA_ORIGINS=\"*\" is set.");
    }

    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);
    
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
