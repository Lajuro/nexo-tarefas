"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, CloudCheck, FolderOpen, HardDrive, RotateCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Campo } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/diversos";
import { suave } from "@/lib/animacoes";
import { ATALHOS } from "./navegacao";
import { Logo } from "./Logo";
import { Modal } from "@/components/comum";

function Palco({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-background p-6">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={suave} className="relative w-full max-w-[520px]">
        {children}
      </motion.div>
    </div>
  );
}

export function Carregando({ texto = "Abrindo o Nexo..." }: { texto?: string }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
      <Logo tamanho={44} className="animate-pulso-suave" />
      <span className="text-[13px] text-muted-foreground">{texto}</span>
    </div>
  );
}

export function Onboarding() {
  const { estado, configurarPasta } = useNexo();
  const [dir, setDir] = useState(estado?.sugestao ?? "");
  const [enviando, setEnviando] = useState(false);
  const usar = async () => {
    if (!dir.trim() || enviando) return;
    setEnviando(true);
    await configurarPasta(dir);
    setEnviando(false);
  };
  const pontos = [
    { icone: HardDrive, texto: "Tudo fica na sua máquina, em arquivos JSON e Markdown legíveis mesmo sem o app." },
    { icone: CloudCheck, texto: "Escolha uma pasta dentro do OneDrive e você ganha backup e histórico de graça." },
    { icone: ShieldCheck, texto: "Backup diário automático e lixeira: nada é apagado de verdade." },
  ];
  return (
    <Palco>
      <div className="rounded-2xl border bg-card p-8 shadow-lg">
        <Logo tamanho={48} />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Bem-vindo ao Nexo</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Seu cérebro de tarefas. Antes de começar, escolha a pasta onde seus dados vão morar.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {pontos.map((p) => (
            <li key={p.texto} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
              <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><p.icone className="size-3.5" /></span>
              {p.texto}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Campo rotulo="Caminho da pasta" dica="No Explorer, clique na barra de endereço da pasta, copie e cole aqui. Se a pasta não existir, eu crio.">
            <div className="relative">
              <FolderOpen className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={dir} onChange={(e) => setDir(e.target.value)} onKeyDown={(e) => e.key === "Enter" && usar()}
                placeholder="C:\Users\voce\OneDrive\Nexo" className="h-9 pl-8 font-mono text-xs" />
            </div>
          </Campo>
        </div>
        <Button size="lg" className="mt-5 w-full" disabled={!dir.trim() || enviando} onClick={usar}>
          {enviando ? "Preparando..." : <>Usar esta pasta <ArrowRight /></>}
        </Button>
      </div>
    </Palco>
  );
}

export function TelaErro({ mensagem, pasta, tentar }: { mensagem: string; pasta: string | null; tentar: () => void }) {
  return (
    <Palco>
      <div className="rounded-2xl border bg-card p-8 shadow-lg">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-destructive/12 text-destructive"><TriangleAlert className="size-5" /></span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Não consegui abrir seus dados</h1>
        <p className="mt-2 text-sm leading-relaxed texto-pre">{mensagem}</p>
        {pasta && <p className="mt-3 text-[13px] text-muted-foreground">Pasta: <code>{pasta}</code></p>}
        <p className="mt-2 text-[13px] text-muted-foreground">
          Nada foi alterado. Se o OneDrive estiver sincronizando, espere um pouco e tente de novo.
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={tentar}><RotateCw /> Tentar de novo</Button>
          <Button asChild variant="outline"><Link href="/configuracoes">Trocar pasta</Link></Button>
        </div>
      </div>
    </Palco>
  );
}

export function JanelaAtalhos({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  return (
    <Modal titulo="Atalhos de teclado" descricao="O Nexo foi feito para usar sem tirar a mão do teclado." aberto={aberto} fechar={fechar}>
      <ul className="flex flex-col">
        {ATALHOS.map((a) => (
          <li key={a.descricao} className="flex items-center justify-between gap-4 border-b py-2 text-[13px] last:border-0">
            <span>{a.descricao}</span>
            <span className="flex shrink-0 items-center gap-1">
              {a.teclas.map((t, i) => (
                <span key={t + i} className="flex items-center gap-1">
                  {i > 0 && a.teclas[0] === "G" && <span className="text-[11px] text-muted-foreground">depois</span>}
                  <Kbd>{t}</Kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
