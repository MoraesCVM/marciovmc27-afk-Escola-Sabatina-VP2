'use client';

import React, { useState } from 'react';
import { Bot, Send, Sparkles, User, RefreshCw, BookOpen, Lightbulb, Heart, Shield, Copy, Check } from 'lucide-react';

export const AiAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
    {
      sender: 'ai',
      text: 'Olá! Sou o Assistente de Inteligência Artificial da Escola Sabatina Pro (potencializado pelo Gemini 3.6 Flash).\n\nComo posso ajudar sua classe ou diretoria hoje? Você pode pedir resumos de lição, perguntas de debate para professores, programas de 13º Sábado, estratégias para o Projeto Maná ou mensagens de encorajamento para os membros.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const quickPrompts = [
    '📖 Resumo da Lição e pontos principais para o professor',
    '❓ 5 Perguntas reflexivas para motivar o debate na classe',
    '🎯 Ideia criativa para o programa de 13º Sábado',
    '❤️ Estratégia de acolhimento para visitantes e inativos',
    '🍞 Mensagem de incentivo ao Projeto Maná no púlpito',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = textToSend || inputPrompt;
    if (!prompt.trim() || isLoading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: prompt, time: userTime },
    ]);

    if (!textToSend) setInputPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { sender: 'ai', text: `Aviso: ${data.error}`, time: aiTime },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'ai', text: data.text, time: aiTime },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Ocorreu um erro de conexão ao consultar o Assistente Gemini. Verifique sua conexão e tente novamente.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#4a121f] via-[#6b1d2f] to-[#2c0911] text-white p-4 sm:p-5 rounded-2xl shadow-md space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-[#d4af37] to-[#fff2a8] text-gray-950 rounded-xl shadow-xs">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black flex items-center gap-2">
              Assistente IA Escola Sabatina Pro
              <span className="text-[10px] bg-[#d4af37] text-gray-950 font-bold px-2 py-0.5 rounded-full uppercase">
                Gemini 3.6 Flash
              </span>
            </h2>
            <p className="text-xs text-rose-100/80">
              Inteligência Artificial teológica e pedagógica para professores e diretores da Escola Sabatina.
            </p>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 no-scrollbar">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-medium whitespace-nowrap transition-all text-rose-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Box */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs flex flex-col h-[520px] overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${
                msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-[#6b1d2f] text-white'
                    : 'bg-gradient-to-br from-[#d4af37] to-[#c5a028] text-gray-950'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 space-y-2 shadow-xs text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#6b1d2f] text-white rounded-tr-xs'
                    : 'bg-white border border-gray-200/90 text-gray-800 rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                <div className="flex items-center justify-between text-[10px] pt-1 opacity-75 border-t border-current/10">
                  <span>{msg.time}</span>
                  {msg.sender === 'ai' && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.text, index)}
                      className="hover:underline flex items-center gap-1 font-medium"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copiar resposta
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 p-2">
              <div className="w-4 h-4 border-2 border-[#6b1d2f] border-t-transparent rounded-full animate-spin" />
              <span>Assistente Gemini elaborando resposta teológica...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-gray-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Digite sua dúvida teológica, lição ou ideia de programa..."
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f] focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="px-4 py-2.5 bg-[#6b1d2f] hover:bg-[#4a121f] disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
