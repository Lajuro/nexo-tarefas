"use client";

// Checklist próprio da tarefa (3.17): painel da coluna lateral, logo abaixo de Pendências.
//
// Pendências são os passos que nasceram de registros (o que ficou combinado numa conversa, com responsável e
// prazo). O checklist é da tarefa em si: a lista do que ela precisa para ficar pronta. Uma linha por item,
// Enter adiciona, colar uma lista de várias linhas cria um item por linha. O texto se edita no lugar.
// Toda mudança é uma gravação comum da tarefa (lib/checklist.ts dentro de atualizarTarefa); tirar um item
// avisa com "Desfazer".

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Ellipsis, PencilLine, Plus, SquareCheckBig, Trash2 } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Painel } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controles";
import { Progress } from "@/components/ui/diversos";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { itemRemovivel } from "@/lib/animacoes";
import {
  checklistDe, comItemAlternado, comItemEditado, comItemMovido, comItensNoChecklist, itensDoTexto, progressoDoChecklist, semItemDoChecklist, textoDoItem, vagasNoChecklist,
} from "@/lib/checklist";
import { type ItemDoChecklist, MAX_ITENS_NO_CHECKLIST, MAX_TEXTO_DO_ITEM, type Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function PainelChecklist({ tarefa }: { tarefa: Tarefa }) {
  const { atualizarTarefa, atualizarComVolta, estado, toast } = useNexo();
  const itens = checklistDe(tarefa);
  const { feitos, total } = progressoDoChecklist(tarefa);
  const [novo, setNovo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [editando, definirEditando] = useState<{ id: string; texto: string } | null>(null);
  // espelho do item em edição: Enter fecha o campo e o blur vem logo atrás; sem isto, a mesma edição seria gravada duas vezes
  const emEdicao = useRef<{ id: string; texto: string } | null>(null);
  const setEditando = (v: { id: string; texto: string } | null) => { emEdicao.current = v; definirEditando(v); };
  const campo = useRef<HTMLInputElement>(null);
  const travado = !!estado?.somenteLeitura;

  const adicionar = async (texto: string) => {
    const pedidos = itensDoTexto(texto).length;
    if (!pedidos) return;
    const vagas = vagasNoChecklist(tarefa);
    if (!vagas) {
      toast(`O checklist já tem ${MAX_ITENS_NO_CHECKLIST} itens, que é o limite.`, "erro");
      return;
    }
    setNovo("");
    // se não gravou, o texto volta para o campo: nada digitado se perde
    if (!(await atualizarTarefa(tarefa.id, (t) => comItensNoChecklist(t, texto)))) setNovo(texto);
    else if (pedidos > vagas) toast(`Entraram ${vagas} de ${pedidos} itens: o checklist chegou ao limite de ${MAX_ITENS_NO_CHECKLIST}.`, "info");
  };

  const guardarEdicao = () => {
    const e = emEdicao.current;
    setEditando(null);
    // só grava se o texto mudou de verdade (e não ficou vazio: para tirar o item existe o menu)
    const antes = itens.find((i) => i.id === e?.id)?.texto;
    if (e && antes !== undefined && textoDoItem(e.texto) && textoDoItem(e.texto) !== antes) void atualizarTarefa(tarefa.id, (t) => comItemEditado(t, e.id, e.texto));
  };

  const linha = (i: ItemDoChecklist, n: number) => (
    <motion.li key={i.id} {...itemRemovivel} layout={false} data-slot="item-do-checklist" data-feito={i.feito || undefined} className="-mx-1 overflow-hidden px-1">
      <div className="flex min-h-7 items-start gap-2 py-0.5">
        <Checkbox
          checked={i.feito}
          disabled={travado}
          onCheckedChange={(v) => void atualizarTarefa(tarefa.id, (t) => comItemAlternado(t, i.id, v === true))}
          className="mt-[5px]"
          aria-label={i.feito ? `Reabrir: ${i.texto}` : `Marcar como feito: ${i.texto}`}
        />
        {editando?.id === i.id ? (
          <Input
            autoFocus
            value={editando.texto}
            maxLength={MAX_TEXTO_DO_ITEM}
            aria-label="Texto do item"
            className="h-7 min-w-0 flex-1 px-1.5"
            onChange={(e) => setEditando({ id: i.id, texto: e.target.value })}
            onBlur={guardarEdicao}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); guardarEdicao(); }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditando(null); }
            }}
          />
        ) : (
          <button
            type="button"
            disabled={travado}
            data-slot="texto-do-item"
            onClick={() => setEditando({ id: i.id, texto: i.texto })}
            className={cn(
              "min-w-0 flex-1 rounded-sm py-[3px] text-left text-[13px] leading-snug outline-none transition-colors duration-300 [overflow-wrap:anywhere] enabled:cursor-text focus-visible:ring-2 focus-visible:ring-ring/50",
              i.feito && "text-muted-foreground line-through decoration-muted-foreground/50",
            )}
          >
            {i.texto}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={travado} aria-label={`Ações do item: ${i.texto}`} data-slot="menu-do-item"
              className="size-6 shrink-0 text-muted-foreground opacity-60 hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setTimeout(() => setEditando({ id: i.id, texto: i.texto }), 80)}><PencilLine /> Editar o texto</DropdownMenuItem>
            <DropdownMenuItem disabled={n === 0} onSelect={() => void atualizarTarefa(tarefa.id, (t) => comItemMovido(t, i.id, -1))}><ArrowUp /> Mover para cima</DropdownMenuItem>
            <DropdownMenuItem disabled={n === itens.length - 1} onSelect={() => void atualizarTarefa(tarefa.id, (t) => comItemMovido(t, i.id, 1))}><ArrowDown /> Mover para baixo</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem perigo data-slot="tirar-item" onSelect={() => void atualizarComVolta(tarefa.id, (t) => semItemDoChecklist(t, i.id), "Item tirado do checklist.")}>
              <Trash2 /> Tirar do checklist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.li>
  );

  // Painel vazio ocupa uma linha (3.12): sem itens, só o cabeçalho com o botão de começar.
  if (total === 0 && !adicionando) {
    return (
      <Painel
        titulo="Checklist"
        icone={<SquareCheckBig />}
        acoes={
          <Button variant="ghost" size="sm" data-slot="comecar-checklist" disabled={travado}
            onClick={() => { setAdicionando(true); setTimeout(() => campo.current?.focus(), 40); }}>
            <Plus /> Adicionar
          </Button>
        }
      />
    );
  }

  return (
    <Painel
      titulo="Checklist"
      icone={<SquareCheckBig />}
      corpoClassName="py-2.5"
      acoes={total > 0 && (
        <span data-slot="progresso-do-checklist" className={cn("px-1 text-xs tabular-nums", feitos === total ? "font-medium text-sucesso" : "text-muted-foreground")}>
          {feitos} de {total}
        </span>
      )}
    >
      {total > 0 && <Progress valor={(feitos / total) * 100} className="mb-2 h-1" />}
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>{itens.map(linha)}</AnimatePresence>
      </ul>
      <div className="mt-1 flex items-center gap-2">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          ref={campo}
          value={novo}
          disabled={travado}
          maxLength={MAX_TEXTO_DO_ITEM * 4}
          data-slot="novo-item-do-checklist"
          aria-label="Novo item do checklist"
          placeholder={total ? "Mais um item e Enter" : "O que precisa ser feito? Enter adiciona"}
          className="h-7 min-w-0 flex-1 px-1.5"
          onChange={(e) => setNovo(e.target.value)}
          onBlur={() => { if (!novo.trim() && total === 0) setAdicionando(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); void adicionar(novo); }
            if (e.key === "Escape" && novo) { e.preventDefault(); e.stopPropagation(); setNovo(""); }
          }}
          onPaste={(e) => {
            // lista de várias linhas colada: um item por linha, em vez de tudo emendado num só
            const colado = e.clipboardData.getData("text");
            if (!/\r?\n/.test(colado.trim())) return;
            e.preventDefault();
            void adicionar(`${novo}\n${colado}`);
          }}
        />
      </div>
    </Painel>
  );
}
