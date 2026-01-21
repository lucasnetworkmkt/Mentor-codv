
import { GoogleGenAI } from "@google/genai";

// Load keys from server-side environment variables
const API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter((key) => !!key); // Filter out undefined keys

const getClient = (apiKey) => new GoogleGenAI({ apiKey });

// Helper to execute with fallback
async function executeWithFallback(operation) {
  let lastError = null;

  for (const apiKey of API_KEYS) {
    if (!apiKey) continue;
    try {
      return await operation(apiKey);
    } catch (error) {
      console.error(`API Key ending in ...${apiKey.slice(-4)} failed.`);
      lastError = error;
      
      // If it's a client error (like 400 Bad Request), don't retry, it's our fault not the key
      if (error?.status === 400) throw error;
      
      // Continue to next key for other errors (429, 500, etc)
    }
  }
  throw new Error(`Service Unavailable: All API keys failed. Last error: ${lastError?.message}`);
}

export const handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { action, payload } = JSON.parse(event.body);

    // ACTION: CHAT
    if (action === "chat") {
      const { history, message, systemInstruction } = payload;
      
      const responseText = await executeWithFallback(async (apiKey) => {
        const ai = getClient(apiKey);
        const contents = [
          ...history,
          { role: 'user', parts: [{ text: message }] }
        ];

        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            thinkingConfig: { thinkingBudget: 2048 },
          }
        });
        return response.text;
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ text: responseText }),
      };
    }

    // ACTION: MENTAL MAP
    if (action === "mental_map") {
      const { topic } = payload;
      
      const prompt = `
      Crie um MAPA MENTAL ESTRUTURADO em formato de ÁRVORE DE TEXTO (ASCII/Tree Style) sobre: "${topic}".
      
      REGRAS VISUAIS:
      - Use caracteres ASCII para conectar: ├──, └──, │.
      - Não use Markdown code blocks (\`\`\`), apenas o texto puro.
      - Seja hierárquico, direto e focado em EXECUÇÃO.
      - Limite a 3 níveis de profundidade.
      - Estilo "Hacker/Terminal".
      `;

      const mapText = await executeWithFallback(async (apiKey) => {
        const ai = getClient(apiKey);
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [{ text: prompt }] }
        });
        return response.text;
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ text: mapText }),
      };
    }

    // ACTION: GET KEY (For Client-side Voice)
    // Warning: This exposes a key to the client, but it's necessary for the current LiveVoice implementation
    // which uses WebSockets directly from the browser.
    if (action === "get_voice_key") {
        // Return a random key to distribute load
        const key = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
        if (!key) throw new Error("No API keys configured");
        
        return {
            statusCode: 200,
            body: JSON.stringify({ apiKey: key })
        };
    }

    return { statusCode: 400, body: "Unknown action" };

  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};
