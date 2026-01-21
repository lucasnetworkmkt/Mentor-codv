
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Radio, StopCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getVoiceApiKey } from '../services/geminiService';

const LIVE_VOICE_INSTRUCTION = `
VOCÊ É O MENTOR DO CÓDIGO DA EVOLUÇÃO.
Sua voz é a de um comandante: Grave, masculina ('Charon') e direta.

OBJETIVO:
Você está treinando o usuário. Não é uma palestra, é um briefing militar rápido.

COMO AGIR:
1. Responda IMEDIATAMENTE. Não pense demais.
2. Se o usuário falar "Oi", responda: "No comando. Qual a missão?"
3. Se o usuário ficar quieto, pergunte: "Está na escuta?"
4. Seja breve. Frases de no máximo 2 sentenças.
5. Não seja robótico. Seja um homem falando com outro homem.

Se o áudio estiver ruim, diga apenas: "Repita."
`;

const LiveVoice: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  const stopSession = () => {
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    
    setIsActive(false);
    setIsSpeaking(false);
    setStatus('disconnected');
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
  };

  const attemptConnection = async (retryCount = 0) => {
    try {
      const apiKey = await getVoiceApiKey(); 
      const ai = new GoogleGenAI({ apiKey });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } }, // Charon is more stable than Fenrir
          },
          systemInstruction: LIVE_VOICE_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            setIsActive(true);
            setErrorMsg('');
            
            // Ensure context exists (created in startSession)
            if (!inputAudioContextRef.current) return;

            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current) {
                setIsSpeaking(true);
                const ctx = outputAudioContextRef.current;
                
                // Redundant resume check for safety
                if (ctx.state === 'suspended') await ctx.resume();

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const audioBuffer = await decodeAudioData(
                   decode(base64Audio),
                   ctx,
                   24000,
                   1
                );
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) setIsSpeaking(false);
                });
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
             }
          },
          onclose: () => {
            console.log("Session closed by server");
            stopSession();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            let message = "Erro de conexão.";
            if (err.message?.includes("unavailable") || err.message?.includes("503")) {
                message = "Serviço instável. Tentando reconectar...";
            }

            if (retryCount < 2) {
               // Silent retry
               setTimeout(() => attemptConnection(retryCount + 1), 1000);
            } else {
               setStatus('error');
               setErrorMsg("Falha na voz. Tente reiniciar.");
               stopSession();
            }
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (error: any) {
      console.error("Connection failed:", error);
      setStatus('error');
      setErrorMsg(error.message || "Erro de permissão ou rede.");
    }
  };

  const startSession = async () => {
     setStatus('connecting');
     setErrorMsg('');

     // CRITICAL FIX: Initialize and Resume AudioContexts on User Gesture (Click)
     // This prevents the browser from blocking the audio output (autoplay policy)
     const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
     
     if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
     }
     if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
     }

     try {
       await inputAudioContextRef.current.resume();
       await outputAudioContextRef.current.resume();
     } catch (e) {
       console.warn("Context resume failed", e);
     }

     attemptConnection();
  };

  // --- Helpers ---
  function createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    return { data: b64, mimeType: 'audio/pcm;rate=16000' };
  }

  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0A0A0A] text-white p-8">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-[#E50914] uppercase mb-2">Comando de Voz Imersivo</h2>
          <p className="text-[#9FB4C7]">Converse naturalmente. O Mentor está ouvindo.</p>
        </div>

        <div className={`relative w-48 h-48 mx-auto flex items-center justify-center rounded-full border-4 transition-all duration-300 
          ${isActive ? (isSpeaking ? 'border-[#E50914] scale-110 shadow-[0_0_80px_rgba(229,9,20,0.6)]' : 'border-[#E50914] shadow-[0_0_50px_rgba(229,9,20,0.3)]') : status === 'error' ? 'border-red-900' : 'border-[#333]'}`}>
           {status === 'connecting' ? (
             <div className="flex flex-col items-center gap-2">
                <RefreshCw className="animate-spin text-[#E50914]" size={32} />
                <span className="text-[10px] text-[#555] font-mono">SINTONIZANDO FREQUÊNCIA...</span>
             </div>
           ) : status === 'error' ? (
             <AlertCircle size={48} className="text-red-700" />
           ) : isActive ? (
             <div className="flex gap-1 items-end h-16">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-3 bg-[#E50914] animate-pulse`} 
                      style={{
                        height: isSpeaking ? `${Math.random() * 100}%` : '20%', 
                        animationDuration: isSpeaking ? `${0.2 + Math.random() * 0.3}s` : '1.5s'
                      }} 
                    />
                ))}
             </div>
           ) : (
             <MicOff size={48} className="text-[#555]" />
           )}
        </div>

        {status === 'error' && (
           <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-lg animate-in fade-in">
              <p className="text-red-500 font-bold mb-2">{errorMsg}</p>
              <button 
                onClick={startSession}
                className="text-xs text-white uppercase border-b border-[#E50914] hover:text-[#E50914]"
              >
                Tentar Reconectar
              </button>
           </div>
        )}

        <div className="flex justify-center gap-4">
          {!isActive && status !== 'connecting' ? (
            <button 
              onClick={startSession}
              className="bg-[#E50914] hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest flex items-center gap-3 transition-all shadow-[0_0_20px_rgba(229,9,20,0.3)] disabled:opacity-50 hover:scale-105"
            >
              <Radio size={24} />
              {status === 'error' ? 'Reiniciar Sistema' : 'Iniciar Sessão'}
            </button>
          ) : isActive || status === 'connecting' ? (
            <button 
              onClick={stopSession}
              className="bg-[#333] hover:bg-[#222] text-white border border-[#555] px-8 py-4 rounded-full font-bold uppercase tracking-widest flex items-center gap-3 transition-all hover:border-[#E50914]"
            >
              <StopCircle size={24} />
              Encerrar
            </button>
          ) : null}
        </div>
        
        {isActive && (
           <div className="space-y-1">
             <p className="text-xs text-[#555] font-mono uppercase">Microfone Ativo</p>
             <p className="text-[10px] text-[#E50914] font-bold uppercase tracking-widest">
               {isSpeaking ? 'O MENTOR ESTÁ FALANDO' : 'AGUARDANDO VOCÊ...'}
             </p>
           </div>
        )}
      </div>
    </div>
  );
};

export default LiveVoice;
