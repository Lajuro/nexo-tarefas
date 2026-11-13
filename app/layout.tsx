import type { Metadata } from "next";
import "./globals.css";
import { Provider } from "@/components/Provider";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Nexo · cérebro de tarefas",
  description: "Organizador de tarefas offline-first",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Provider>
          <Shell>{children}</Shell>
        </Provider>
      </body>
    </html>
  );
}
