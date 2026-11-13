"use client";

// Editor de uma folha do bloco de notas: título e texto livre, sem escolher tarefa nem campo.
// Grava sozinho na pasta de dados um instante depois de o usuário parar de digitar. Nesse
// intervalo o texto fica também no navegador (lib/rascunhos.ts), para não se perder com F5,
// janela fechada ou travamento.

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Check, CloudOff, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { apagarNotaPendente, gravarNotaPendente, lerNotaPendente } from "@/lib/rascunhos";
import { Nota, agoraISO, normalizarNota } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ESPERA_MS = 1500;

type Situacao = "salvo" | "pendente" | "salvando" | "erro";

export function EditorNota({
  id, nota, aoOrganizar, aoArquivar, aoExcluir,
}: {
  /** Id da folha. Se `nota` não existir ainda, a folha é criada com este id na primeira gravação. */
  id: string;
  nota: Nota | null;
  aoOrganizar: (n: Nota) => void;
  aoArquivar: (id: string) => void;
  aoExcluir: (n: Nota) => void;
}) {
  const { salvarNotas, estado } = useNexo();
  const somenteLeitura = !!estado?.somenteLeitura;
  // O que ficou no navegador sem chegar à pasta de dados (se houver) vale mais que o que está salvo.
  const [inicio] = useState(() => {
    const p = lerNotaPendente(id);
    const salvo = { titulo: nota?.titulo ?? "", texto: nota?.texto ?? "" };
    const pendente = p && (p.titulo !== salvo.titulo || p.texto !== salvo.texto) ? p : null;
    return { salvo, pendente };
  });
  const [titulo, setTitulo] = useState(inicio.pendente?.titulo ?? inicio.salvo.titulo);
  const [texto, setTexto] = useState(inicio.pendente?.texto ?? inicio.salvo.texto);
  const [situacao, setSituacao] = useState<Situacao>(inicio.pendente ? "pendente" : "salvo");

  const atual = useRef({ titulo, texto });
  atual.current = { titulo, texto };
  const salvo = useRef(inicio.salvo);
  const existe = useRef(!!nota);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gravando = useRef<Promise<boolean> | null>(null);

  const gravar = useCallback(async (): Promise<boolean> => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
    if (gravando.current) await gravando.current;
    const v = { ...atual.current };
    if (v.titulo === salvo.current.titulo && v.texto === salvo.current.texto) return true;
    // Folha em branco que nunca foi gravada: não cria nada.
    if (!existe.current && !v.titulo.trim() && !v.texto.trim()) {
      apagarNotaPendente(id);
      return true;
    }
    setSituacao("salvando");
    const agora = agoraISO();
    const tarefa = salvarNotas((items) =>
      items.some((n) => n.id === id)
        ? items.map((n) => (n.id === id ? { ...n, titulo: v.titulo, texto: v.texto, atualizadaEm: agora } : n))
        : [normalizarNota({ id, titulo: v.titulo, texto: v.texto, criadaEm: agora, atualizadaEm: agora }), ...items],
    );
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
    } else {
      setSituacao("pendente"); // digitou mais enquanto gravava: o próximo ciclo pega
    }
    return true;
  }, [id, salvarNotas]);

  const agendar = useCallback(() => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => void gravar(), ESPERA_MS);
  }, [gravar]);

  function mudar(campo: "titulo" | "texto", valor: string) {
    const prox = { ...atual.current, [campo]: valor };
    if (campo === "titulo") setTitulo(valor);
    else setTexto(valor);
    gravarNotaPendente(id, prox.titulo, prox.texto);
    setSituacao("pendente");
    agendar();
  }

  // Havia texto no navegador que não chegou ao disco: grava já. E ao sair da folha, ou quando a
  // janela vai para o fundo, não espera o relógio.
  useEffect(() => {
    if (inicio.pendente) void gravar();
    const aoEsconder = () => { if (document.visibilityState === "hidden") void gravar(); };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      void gravar();
    };
  }, [gravar, inicio.pendente]);

  // Enquanto digita e a gravação anterior ainda rodava, sobra um "pendente" sem relógio: agenda.
  useEffect(() => {
    if (situacao === "pendente" && !relogio.current) agendar();
  }, [situacao, agendar]);

  const vazia = !titulo.trim() && !texto.trim();
  const montarNota = (): Nota => ({ ...(nota ?? normalizarNota({ id })), titulo, texto });

  return (
    <div data-slot="editor-nota" className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-6 pt-5">
        <Input
          value={titulo}
          onChange={(e) => mudar("titulo", e.target.value)}
          disabled={somenteLeitura}
          placeholder="Título (opcional). Ex.: Reunião das 10h"
          aria-label="Título da folha"
          className="h-9 text-sm font-medium"
        />
        <Textarea
          autoFocus
          value={texto}
          onChange={(e) => mudar("texto", e.target.value)}
          disabled={somenteLeitura}
          placeholder={"Escreva solto, do seu jeito. Pode misturar assuntos e tarefas na mesma folha.\n\nEx.: marina liberou o acesso ao repo. squad topou o piloto, começa segunda. auditoria pediu evidência dos acessos até dia 20."}
          aria-label="Texto da folha"
          className="min-h-0 flex-1 resize-none text-sm leading-relaxed"
        />
      </div>
      <footer className="flex flex-wrap items-center gap-2 px-6 py-3">
        <span data-slot="nota-situacao" data-situacao={situacao} role="status"
          className={cn("mr-auto inline-flex items-center gap-1.5 text-[11px] sem-selecao", situacao === "erro" ? "text-alerta" : "text-muted-foreground")}>
          {situacao === "salvo" && (vazia ? "Folha em branco" : <><Check className="size-3.5 text-sucesso" /> Salvo na pasta de dados</>)}
          {situacao === "pendente" && "Guardando..."}
          {situacao === "salvando" && <><LoaderCircle className="size-3.5 animate-spin" /> Salvando...</>}
          {situacao === "erro" && <><CloudOff className="size-3.5" /> Não consegui salvar. O texto está guardado neste navegador e tento de novo quando você digitar.</>}
        </span>
        {nota && (
          <>
            <Dica texto="Excluir a folha (vai para a lixeira da pasta de dados)">
              <Button variant="ghost" size="icon" aria-label="Excluir folha" onClick={() => aoExcluir(montarNota())}><Trash2 /></Button>
            </Dica>
            <Dica texto="Guardar sem organizar. A folha sai da lista do dia e fica em Arquivadas.">
              <Button variant="outline" disabled={vazia} onClick={async () => { if (await gravar()) aoArquivar(id); }}><Archive /> Arquivar</Button>
            </Dica>
          </>
        )}
        <Button data-slot="organizar" disabled={!texto.trim() || somenteLeitura} onClick={async () => { if (await gravar()) aoOrganizar(montarNota()); }}>
          <Sparkles /> Organizar com o Copilot
        </Button>
      </footer>
    </div>
  );
}
