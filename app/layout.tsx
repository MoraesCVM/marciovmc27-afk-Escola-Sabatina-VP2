import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Escola Sabatina VP 2',
  description: 'Sistema completo de gestão da Escola Sabatina - Membros, Chamada Semanal, Classes e Unidades, Projeto Maná, Calendário 2026 e Assistente IA.',
  openGraph: {
    title: 'Escola Sabatina VP 2',
    description: 'Sistema completo de gestão da Escola Sabatina - Membros, Chamada Semanal, Classes e Unidades, Projeto Maná, Calendário 2026 e Assistente IA.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
