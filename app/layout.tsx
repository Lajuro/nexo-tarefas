import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Provider } from "@/components/Provider";
import { Raiz } from "@/components/Raiz";
import { SCRIPT_APARENCIA } from "@/lib/aparencia";
import { SCRIPT_TEMA } from "@/lib/tema";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Nexo · cérebro de tarefas",
  description: "Organizador de tarefas offline-first",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_APARENCIA }} />
      </head>
      <body>
        <Raiz>
          <Provider>
            <Shell>{children}</Shell>
          </Provider>
        </Raiz>
      </body>
    </html>
  );
}
