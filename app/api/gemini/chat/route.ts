import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt, context } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "O campo 'prompt' é obrigatório." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "A chave GEMINI_API_KEY não foi configurada nos Segredos." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `Você é o "Assistente de Inteligência Artificial da Escola Sabatina Pro", um conselheiro pedagógico, teológico e organizacional especializado na Escola Sabatina da Igreja Adventista do 7º Dia.
Seu objetivo é auxiliar diretores, professores, secretários e membros com:
1. Resumos práticos e perguntas reflexivas para a Lição da Escola Sabatina do trimestre atual.
2. Ideias criativas para programas de 13º Sábado, recepção, dinâmicas de classe e dias especiais (Dia da Bíblia, Mutirão de Natal, Batismo da Primavera, etc.).
3. Estratégias de engajamento do Projeto Maná (assinaturas da lição) e CRM (Comunhão, Relacionamento e Missão).
4. Dicas de retenção, resgate de membros inativos e apoio aos visitantes.
5. Mensagens inspiradoras de motivação espiritual e incentivo ao estudo diário da Bíblia.

Sempre responda em português com tom acolhedor, profissional, respeitoso e espiritualmente encorajador.
Se houver contexto fornecido (como dados da classe ou membros), utilize para personalizar a sugestão.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: context ? `Contexto Atual: ${context}\n\nPergunta do Usuário: ${prompt}` : prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "Desculpe, não consegui gerar uma resposta no momento. Tente novamente.";

    return NextResponse.json({ text: replyText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Ocorreu um erro ao processar a consulta do Assistente IA." },
      { status: 500 }
    );
  }
}
