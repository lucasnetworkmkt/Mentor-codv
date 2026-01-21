
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração de CORS para permitir requisições de qualquer origem (necessário para separar front/back)
app.use(cors({
    origin: '*', 
    methods: ['POST', 'GET', 'OPTIONS']
}));

app.use(express.json());

// --- LÓGICA DO GEMINI ---

const API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter((key) => !!key);

const getClient = (apiKey) => new GoogleGenAI({ apiKey });

async function executeWithFallback(operation) {
  let lastError = null;
  for (const apiKey of API_KEYS) {
    if (!apiKey) continue;
    try {
      return await operation(apiKey);
    } catch (error) {
      console.error(`Chave falhou: ...${apiKey.slice(-4)}`);
      lastError = error;
      if (error?.status === 400) throw error;
    }
  }
  throw new Error(`Serviço Indisponível. Erro: ${lastError?.message}`);
}

// --- ROTA UNIFICADA (Idêntica à Netlify) ---
// Isso permite que o frontend use sempre o mesmo endpoint "/.netlify/functions/chat"
// independente de estar na Netlify ou na HostGator.

app.post('/.netlify/functions/chat', async (req, res) => {
    try {
        const { action, payload } = req.body;

        // ACTION: CHAT
        if (action === "chat") {
            const { history, message, systemInstruction } = payload;
            const responseText = await executeWithFallback(async (apiKey) => {
                const ai = getClient(apiKey);
                const contents = [...history, { role: 'user', parts: [{ text: message }] }];
                
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
            return res.json({ text: responseText });
        }

        // ACTION: MENTAL MAP
        if (action === "mental_map") {
            const { topic } = payload;
            const prompt = `Crie um MAPA MENTAL ESTRUTURADO em formato de ÁRVORE DE TEXTO (ASCII) sobre: "${topic}". Regras: Use ├──, └──, │. Sem markdown blocks. Estilo Hacker.`;
            
            const mapText = await executeWithFallback(async (apiKey) => {
                const ai = getClient(apiKey);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ text: prompt }] }
                });
                return response.text;
            });
            return res.json({ text: mapText });
        }

        // ACTION: GET VOICE KEY
        if (action === "get_voice_key") {
            const key = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
            if (!key) return res.status(500).json({ error: "No keys configured" });
            return res.json({ apiKey: key });
        }

        return res.status(400).json({ error: "Ação desconhecida" });

    } catch (error) {
        console.error("Erro no Servidor:", error);
        res.status(500).json({ error: error.message || "Erro Interno" });
    }
});

// Health Check
app.get('/', (req, res) => {
    res.send('Mentor Backend Online. Endpoint: /.netlify/functions/chat');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Rota ativa: http://localhost:${PORT}/.netlify/functions/chat`);
});
