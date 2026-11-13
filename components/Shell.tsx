"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useNexo } from "./Provider";
import { TarefaForm } from "./TarefaForm";
import { PlanejarDia } from "./rotina/PlanejarDia";

const NAV = [
  { href: "/", nome: "Hoje", icone: "▦" },
  { href: "/tarefas", nome: "Tarefas", icone: "▦" },
  { href: "/pendencias", nome: "Pendências", icone: "☑" },
  { href: "/categorias", nome: "Categorias", icone: "◫" },
  { href: "/pessoas", nome: "Pessoas", icone: "◉" },
  { href: "/links", nome: "Links e docs", icone: "⛓" },
  { href: "/relatorios", nome: "Relatórios", icone: "✎" },
  { href: "/configuracoes", nome: "Configurações", icone: "⚙" },
];

export function abrirNovaTarefa(categoriaId?: string | null) {
  window.dispatchEvent(new CustomEvent("nexo:nova-tarefa", { detail: { categoriaId } }));
}

/** Abre o ritual "Planejar o dia" de qualquer lugar. */
export function abrirPlanejarDia() {
  window.dispatchEvent(new CustomEvent("nexo:planejar-dia"));
}

export function Shell({ children }: { children: ReactNode }) {
  const { estado, dados, erro, recarregar } = useNexo();
  const pathname = usePathname();
  const [nova, setNova] = useState<{ aberto: boolean; cat?: string | null }>({ aberto: false });
  const [ritual, setRitual] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const abrir = (e: Event) => setNova({ aberto: true, cat: (e as CustomEvent).detail?.categoriaId });
    const atalhos = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const digitando = ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable;
      if (digitando || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector(".modal-fundo")) return;
      if (e.key === "/") {
        e.preventDefault();
        buscaRef.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        setNova({ aberto: true });
      }
    };
    const planejar = () => setRitual(true);
    window.addEventListener("nexo:planejar-dia", planejar);
    window.addEventListener("nexo:nova-tarefa", abrir);
    window.addEventListener("keydown", atalhos);
    return () => {
      window.removeEventListener("nexo:planejar-dia", planejar);
      window.removeEventListener("nexo:nova-tarefa", abrir);
      window.removeEventListener("keydown", atalhos);
    };
  }, []);

  if (!estado) return <div className="carregando">Carregando...</div>;
  if (!estado.configurado) return <Onboarding />;
  if (estado.erro || erro) {
    return (
      <div className="tela-cheia">
        <div className="cartao-erro">
          <h1>Não consegui abrir seus dados</h1>
          <p>{estado.erro || erro}</p>
          <p className="sutil">Pasta: <code>{estado.dataDir}</code></p>
          <p className="sutil">Nada foi alterado. Se o OneDrive estiver sincronizando, espere um pouco e tente de novo.</p>
          <div className="acoes">
            <button className="btn primario" onClick={recarregar}>Tentar de novo</button>
            <Link className="btn" href="/configuracoes">Trocar pasta</Link>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
        <Link href="/" className="mb-2 px-2 text-sm font-semibold">Nexo</Link>
        {NAV.map((n) => {
          const ativo = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={`rounded-md px-2 py-1.5 text-[13px] ${ativo ? "bg-sidebar-accent font-medium text-foreground" : ""}`}>
              {n.nome}
            </Link>
          );
        })}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {dados ? <div className="min-h-0 flex-1">{children}</div> : <div className="p-6 text-muted-foreground">Lendo seus dados...</div>}
      </main>
      <TarefaForm aberto={nova.aberto} categoriaInicial={nova.cat} fechar={() => setNova({ aberto: false })} />
      <PlanejarDia aberto={ritual} fechar={() => setRitual(false)} />
    </div>
  );
}

function Onboarding() {
  const { estado, configurarPasta } = useNexo();
  const [dir, setDir] = useState(estado?.sugestao ?? "");
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="tela-cheia">
      <div className="onboarding">
        <span className="logo grande">N</span>
        <h1>Bem-vindo ao Nexo</h1>
        <p>
          Primeiro, escolha a pasta onde seus dados vão morar. Pode ser uma pasta dentro do OneDrive, assim você ganha
          backup automático. Tudo fica em arquivos JSON e Markdown, legíveis mesmo sem o app.
        </p>
        <label className="campo">
          <span className="rotulo">Caminho da pasta</span>
          <input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="C:\Users\voce\OneDrive\Nexo" />
          <span className="dica">
            Dica: no Explorer, clique na barra de endereço da pasta, copie e cole aqui. Se a pasta não existir, eu crio.
          </span>
        </label>
        <button
          className="btn primario"
          disabled={!dir.trim() || enviando}
          onClick={async () => {
            setEnviando(true);
            await configurarPasta(dir);
            setEnviando(false);
          }}
        >
          {enviando ? "Preparando..." : "Usar esta pasta"}
        </button>
      </div>
    </div>
  );
}
