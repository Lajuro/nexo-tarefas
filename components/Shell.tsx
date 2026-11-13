"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useNexo } from "./Provider";
import { TarefaForm } from "./TarefaForm";
import { passosAbertos, STATUS_ABERTOS } from "@/lib/tipos";

const NAV = [
  { href: "/", nome: "Painel", icone: "▦" },
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

export function Shell({ children }: { children: ReactNode }) {
  const { estado, dados, erro, recarregar } = useNexo();
  const pathname = usePathname();
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState<{ aberto: boolean; cat?: string | null }>({ aberto: false });
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
    window.addEventListener("nexo:nova-tarefa", abrir);
    window.addEventListener("keydown", atalhos);
    return () => {
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

  const abertas = dados?.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status)).length ?? 0;
  const pend = dados?.tarefas.reduce((n, t) => n + (STATUS_ABERTOS.includes(t.status) ? passosAbertos(t).length : 0), 0) ?? 0;

  return (
    <div className="app">
      <aside className="lateral">
        <Link href="/" className="marca">
          <span className="logo">N</span>
          <span>
            <strong>Nexo</strong>
            <small>cérebro de tarefas</small>
          </span>
        </Link>
        <form
          className="busca-global"
          onSubmit={(e) => {
            e.preventDefault();
            if (busca.trim()) router.push(`/busca?q=${encodeURIComponent(busca.trim())}`);
          }}
        >
          <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar em tudo  ( / )" />
        </form>
        <button className="btn primario largo" onClick={() => setNova({ aberto: true })}>
          + Nova tarefa <kbd>N</kbd>
        </button>
        <nav>
          {NAV.map((n) => {
            const ativo = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={ativo ? "ativo" : ""}>
                <span className="ico">{n.icone}</span>
                {n.nome}
                {n.href === "/" && abertas > 0 && <span className="contador">{abertas}</span>}
                {n.href === "/pendencias" && pend > 0 && <span className="contador">{pend}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="lateral-rodape" title={estado.dataDir ?? ""}>
          <span className="ponto-ok" /> Dados locais
          <small>{estado.dataDir}</small>
        </div>
      </aside>
      <main className="conteudo">
        {estado.somenteLeitura && (
          <div className="aviso erro">
            Estes dados foram gravados por uma versão mais nova do Nexo (formato v{estado.schemaDados}). Estou em modo
            somente leitura para não estragar nada. Atualize o app.
          </div>
        )}
        {!!dados?.avisos.length && (
          <div className="aviso">
            <strong>Atenção com alguns arquivos:</strong>
            <ul>{dados.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
        {dados ? children : <div className="carregando">Lendo seus dados...</div>}
      </main>
      <TarefaForm aberto={nova.aberto} categoriaInicial={nova.cat} fechar={() => setNova({ aberto: false })} />
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
