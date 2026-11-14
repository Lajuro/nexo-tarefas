"use client";

// Gravação automática de um texto com título (página de conhecimento): grava sozinho 1,5 s depois de o usuário
// parar de digitar, ao sair da tela e quando a janela vai para o fundo. Enquanto não chega à pasta de dados,
// o texto fica no navegador (mesma gaveta das folhas do bloco de notas, lib/rascunhos.ts) e é regravado
// na próxima abertura. É a mesma lógica do EditorNota, que continua com a dele (já testada).

import { useCallback, useEffect, useRef, useState } from "react";
import { apagarNotaPendente, gravarNotaPendente, lerNotaPendente } from "@/lib/rascunhos";

const ESPERA_MS = 1500;
export type Situacao = "salvo" | "pendente" | "salvando" | "erro";
interface Valor { titulo: string; texto: string }

export function useGravacao(
  id: string,
  salvoAgora: Valor | null,
  /** Grava na pasta de dados. `existe` diz se o item já foi gravado alguma vez (senão, é criação). */
  persistir: (v: Valor, existe: boolean) => Promise<boolean>,
) {
  const [inicio] = useState(() => {
    const p = lerNotaPendente(id);
    const salvo = { titulo: salvoAgora?.titulo ?? "", texto: salvoAgora?.texto ?? "" };
    const pendente = p && (p.titulo !== salvo.titulo || p.texto !== salvo.texto) ? p : null;
    return { salvo, pendente };
  });
  const [valor, setValor] = useState<Valor>({ titulo: inicio.pendente?.titulo ?? inicio.salvo.titulo, texto: inicio.pendente?.texto ?? inicio.salvo.texto });
  const [situacao, setSituacao] = useState<Situacao>(inicio.pendente ? "pendente" : "salvo");
  const atual = useRef(valor);
  atual.current = valor;
  const salvo = useRef(inicio.salvo);
  const existe = useRef(!!salvoAgora);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gravando = useRef<Promise<boolean> | null>(null);
  const persistirRef = useRef(persistir);
  persistirRef.current = persistir;

  const gravar = useCallback(async (): Promise<boolean> => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
    if (gravando.current) await gravando.current;
    const v = { ...atual.current };
    if (v.titulo === salvo.current.titulo && v.texto === salvo.current.texto) return true;
    // em branco e nunca gravado: não cria nada
    if (!existe.current && !v.titulo.trim() && !v.texto.trim()) {
      apagarNotaPendente(id);
      return true;
    }
    setSituacao("salvando");
    const tarefa = persistirRef.current(v, existe.current);
    gravando.current = tarefa;
    const ok = await tarefa;
    gravando.current = null;
    if (!ok) {
      setSituacao("erro");
      return false;
    }
    salvo.current = v;
    existe.current = true;
    if (atual.current.titulo === v.titulo && atual.current.texto === v.texto) {
      apagarNotaPendente(id);
      setSituacao("salvo");
    } else setSituacao("pendente"); // digitou mais enquanto gravava: o próximo ciclo pega
    return true;
  }, [id]);

  const mudar = useCallback((parte: Partial<Valor>) => {
    const prox = { ...atual.current, ...parte };
    atual.current = prox;
    setValor(prox);
    gravarNotaPendente(id, prox.titulo, prox.texto);
    setSituacao("pendente");
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => void gravar(), ESPERA_MS);
  }, [id, gravar]);

  useEffect(() => {
    if (inicio.pendente) void gravar();
    const aoEsconder = () => { if (document.visibilityState === "hidden") void gravar(); };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      void gravar();
    };
  }, [gravar, inicio.pendente]);

  useEffect(() => {
    if (situacao === "pendente" && !relogio.current) relogio.current = setTimeout(() => void gravar(), ESPERA_MS);
  }, [situacao, gravar]);

  return { valor, mudar, situacao, gravar, existe: existe.current };
}
