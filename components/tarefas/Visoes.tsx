"use client";

// Visões salvas da lista de tarefas: uma combinação de filtros (texto, categoria, status, filtro pronto,
// ordem e jeito de ver) guardada com nome. Ficam no navegador ("nexo:visoesTarefas"), como as outras
// preferências da lista: perder não custa nada além de salvar de novo. Abrem pelo menu e pela paleta (/tarefas?v=<id>).

import { useState } from "react";
import { Bookmark, BookmarkPlus, Check, ChevronDown, Trash2 } from "lucide-react";
import { Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as M from "@/components/ui/menu";
import { usePref } from "@/lib/preferencias";
import { novoId } from "@/lib/tipos";
import { MAX_VISOES, type VisaoSalva, normalizarVisoes } from "./filtros";

export function useVisoesSalvas() {
  const [bruto, setBruto] = usePref<unknown>("visoesTarefas", []);
  const visoes = normalizarVisoes(bruto);
  return {
    visoes,
    salvar: (v: Omit<VisaoSalva, "id">) => {
      const nova = { ...v, id: novoId("v") };
      setBruto((atual: unknown) => [...normalizarVisoes(atual).filter((x) => x.nome.toLowerCase() !== v.nome.toLowerCase()), nova].slice(-MAX_VISOES));
      return nova;
    },
    remover: (id: string) => setBruto((atual: unknown) => normalizarVisoes(atual).filter((x) => x.id !== id)),
  };
}

/** Os filtros de agora são exatamente os de uma visão salva? (para mostrar o nome dela no botão) */
export const mesmaVisao = (a: Omit<VisaoSalva, "id" | "nome">, b: VisaoSalva) =>
  a.texto.trim() === b.texto.trim() && a.categoria === b.categoria && a.status === b.status && a.especial === b.especial && a.ordem === b.ordem && a.visao === b.visao;

export function MenuVisoes({
  atual, aoAplicar,
}: {
  atual: Omit<VisaoSalva, "id" | "nome">;
  aoAplicar: (v: VisaoSalva) => void;
}) {
  const { visoes, salvar, remover } = useVisoesSalvas();
  const [nomeando, setNomeando] = useState(false);
  const [nome, setNome] = useState("");
  const ativa = visoes.find((v) => mesmaVisao(atual, v));

  const confirmar = () => {
    const n = nome.trim();
    if (!n) return;
    salvar({ ...atual, nome: n });
    setNomeando(false);
    setNome("");
  };

  return (
    <>
      <M.DropdownMenu>
        <M.DropdownMenuTrigger asChild>
          <Button variant="outline" data-slot="visoes-salvas" className="max-w-52 gap-2 px-2.5 font-normal">
            <Bookmark className="size-3.5 text-muted-foreground" />
            <span className="truncate">{ativa ? ativa.nome : "Visões"}</span>
            <ChevronDown className="size-3.5 opacity-50" />
          </Button>
        </M.DropdownMenuTrigger>
        <M.DropdownMenuContent align="start" className="w-64">
          <M.DropdownMenuLabel>Visões salvas</M.DropdownMenuLabel>
          {visoes.length === 0 && <p className="px-2 pb-1.5 text-xs text-muted-foreground">Monte os filtros e salve aqui para voltar a eles com um clique.</p>}
          {visoes.map((v) => (
            <M.DropdownMenuItem key={v.id} data-slot="visao-salva" onSelect={() => aoAplicar(v)}>
              {ativa?.id === v.id ? <Check className="text-primary" /> : <Bookmark />}
              <span className="truncate">{v.nome}</span>
            </M.DropdownMenuItem>
          ))}
          <M.DropdownMenuSeparator />
          <M.DropdownMenuItem data-slot="salvar-visao" disabled={!!ativa} onSelect={() => { setNome(""); setNomeando(true); }}>
            <BookmarkPlus /> Salvar os filtros de agora...
          </M.DropdownMenuItem>
          {visoes.length > 0 && (
            <M.DropdownMenuSub>
              <M.DropdownMenuSubTrigger><Trash2 /> Remover uma visão</M.DropdownMenuSubTrigger>
              <M.DropdownMenuSubContent>
                {visoes.map((v) => <M.DropdownMenuItem key={v.id} perigo onSelect={() => remover(v.id)}>{v.nome}</M.DropdownMenuItem>)}
              </M.DropdownMenuSubContent>
            </M.DropdownMenuSub>
          )}
        </M.DropdownMenuContent>
      </M.DropdownMenu>

      <Modal titulo="Salvar visão" descricao="Guarda os filtros, a ordem e o jeito de ver de agora. Ela aparece aqui e na paleta (Ctrl K)."
        aberto={nomeando} fechar={() => setNomeando(false)}
        rodape={<><Button variant="outline" onClick={() => setNomeando(false)}>Cancelar</Button><Button disabled={!nome.trim()} onClick={confirmar}>Salvar</Button></>}>
        <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} aria-label="Nome da visão"
          placeholder="Ex.: Champion atrasadas" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar(); } }} />
      </Modal>
    </>
  );
}
