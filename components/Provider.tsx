"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { toast as sonner } from "sonner";
import { Categoria, Dados, EstadoApp, LinkDoc, Tarefa, normalizarTarefa } from "@/lib/tipos";

type Toast = { texto: string; tipo: "ok" | "erro" | "info" };

interface Ctx {
  estado: EstadoApp | null;
  dados: Dados | null;
  erro: string | null;
  recarregar: () => Promise<void>;
  criarTarefa: (t: Tarefa) => Promise<Tarefa | null>;
  atualizarTarefa: (id: string, fn: (t: Tarefa) => Tarefa) => Promise<Tarefa | null>;
  excluirTarefa: (id: string) => Promise<boolean>;
  salvarCategorias: (fn: (items: Categoria[]) => Categoria[]) => Promise<boolean>;
  salvarLinks: (fn: (items: LinkDoc[]) => LinkDoc[]) => Promise<boolean>;
  enviarArquivo: (f: File) => Promise<{ arquivo: string; nomeArquivo: string; tamanho: number } | null>;
  toast: (texto: string, tipo?: Toast["tipo"]) => void;
  configurarPasta: (dir: string) => Promise<boolean>;
}

const Contexto = createContext<Ctx | null>(null);

export function useNexo() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useNexo fora do Provider");
  return c;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.erro || `Erro ${r.status}`) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return j as T;
}

export function Provider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoApp | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<Dados | null>(null);
  const filas = useRef(new Map<string, Promise<unknown>>());
  ref.current = dados;

  // Avisos passam pelo Sonner (o <Toaster/> fica em components/Raiz.tsx).
  const toast = useCallback((texto: string, tipo: Toast["tipo"] = "ok") => {
    if (tipo === "erro") sonner.error(texto, { duration: 7000 });
    else if (tipo === "info") sonner(texto, { duration: 3200 });
    else sonner.success(texto, { duration: 2600 });
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const e = await req<EstadoApp>("/api/estado");
      setEstado(e);
      if (e.configurado && !e.erro) {
        const d = await req<Dados>("/api/dados");
        setDados(d);
        ref.current = d;
      }
      setErro(e.erro);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Enfileira gravações do mesmo recurso para nunca disputarem a mesma revisão.
  const enfileirar = useCallback(<T,>(chave: string, fn: () => Promise<T>): Promise<T> => {
    const anterior = filas.current.get(chave) || Promise.resolve();
    const prox = anterior.catch(() => {}).then(fn);
    filas.current.set(chave, prox);
    return prox;
  }, []);

  const falha = useCallback(
    async (e: unknown) => {
      const err = e as Error & { status?: number };
      toast(err.message, "erro");
      if (err.status === 409) await recarregar();
    },
    [recarregar, toast],
  );

  const gravarTarefa = useCallback(async (t: Tarefa, revEsperada: number | null) => {
    const salva = await req<Tarefa>(`/api/tarefas/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefa: t, revEsperada }),
    });
    setDados((d) => {
      if (!d) return d;
      const existe = d.tarefas.some((x) => x.id === salva.id);
      const nd = {
        ...d,
        tarefas: existe ? d.tarefas.map((x) => (x.id === salva.id ? salva : x)) : [...d.tarefas, salva],
      };
      ref.current = nd;
      return nd;
    });
    return salva;
  }, []);

  const criarTarefa = useCallback(
    (t: Tarefa) =>
      enfileirar(`t:${t.id}`, async () => {
        try {
          return await gravarTarefa(normalizarTarefa(t), null);
        } catch (e) {
          await falha(e);
          return null;
        }
      }),
    [enfileirar, falha, gravarTarefa],
  );

  const atualizarTarefa = useCallback(
    (id: string, fn: (t: Tarefa) => Tarefa) =>
      enfileirar(`t:${id}`, async () => {
        const atual = ref.current?.tarefas.find((x) => x.id === id);
        if (!atual) return null;
        try {
          return await gravarTarefa(fn(structuredClone(atual)), atual.rev);
        } catch (e) {
          await falha(e);
          return null;
        }
      }),
    [enfileirar, falha, gravarTarefa],
  );

  const excluirTarefa = useCallback(
    async (id: string) => {
      try {
        await req(`/api/tarefas/${id}`, { method: "DELETE" });
        setDados((d) => (d ? { ...d, tarefas: d.tarefas.filter((t) => t.id !== id) } : d));
        toast("Tarefa movida para a lixeira (dá pra restaurar em Configurações).");
        return true;
      } catch (e) {
        await falha(e);
        return false;
      }
    },
    [falha, toast],
  );

  const salvarColecao = useCallback(
    <T,>(nome: "categorias" | "links", fn: (items: T[]) => T[]) =>
      enfileirar(nome, async () => {
        const d = ref.current;
        if (!d) return false;
        const col = d[nome] as unknown as { rev: number; items: T[] };
        if (col.rev < 0) {
          toast(`O arquivo ${nome}.json não pôde ser lido. Corrija antes de editar.`, "erro");
          return false;
        }
        try {
          const nova = await req<{ rev: number; items: T[] }>(`/api/${nome}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: fn(structuredClone(col.items)), revEsperada: col.rev }),
          });
          setDados((dd) => {
            if (!dd) return dd;
            const nd = { ...dd, [nome]: nova } as Dados;
            ref.current = nd;
            return nd;
          });
          return true;
        } catch (e) {
          await falha(e);
          return false;
        }
      }),
    [enfileirar, falha, toast],
  );

  const salvarCategorias = useCallback(
    (fn: (items: Categoria[]) => Categoria[]) => salvarColecao<Categoria>("categorias", fn),
    [salvarColecao],
  );
  const salvarLinks = useCallback(
    (fn: (items: LinkDoc[]) => LinkDoc[]) => salvarColecao<LinkDoc>("links", fn),
    [salvarColecao],
  );

  const enviarArquivo = useCallback(
    async (f: File) => {
      const fd = new FormData();
      fd.append("arquivo", f);
      try {
        return await req<{ arquivo: string; nomeArquivo: string; tamanho: number }>("/api/arquivos", {
          method: "POST",
          body: fd,
        });
      } catch (e) {
        await falha(e);
        return null;
      }
    },
    [falha],
  );

  const configurarPasta = useCallback(
    async (dir: string) => {
      try {
        await req("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataDir: dir }),
        });
        await recarregar();
        toast("Pasta de dados configurada.");
        return true;
      } catch (e) {
        toast((e as Error).message, "erro");
        return false;
      }
    },
    [recarregar, toast],
  );

  return (
    <Contexto.Provider
      value={{
        estado, dados, erro, recarregar, criarTarefa, atualizarTarefa, excluirTarefa,
        salvarCategorias, salvarLinks, enviarArquivo, toast, configurarPasta,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
