"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useNexo } from "./Provider";
import { Campo, CatTag, Modal } from "./comum";
import { EmblemaCategoria } from "./categorias/EmblemaCategoria";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { mola } from "@/lib/animacoes";
import { cn } from "@/lib/utils";
import { CORES, Categoria, agoraISO, normalizarCategoria, novoId, semAcento } from "@/lib/tipos";

const NOMES_DAS_CORES: Record<string, string> = {
  "#e5484d": "Vermelho",
  "#f76b15": "Laranja",
  "#ffb224": "Amarelo",
  "#46a758": "Verde",
  "#12a594": "Turquesa",
  "#0090ff": "Azul",
  "#3e63dd": "Índigo",
  "#8e4ec6": "Roxo",
  "#d6409f": "Rosa",
  "#8d8d86": "Cinza",
};
const nomeDaCor = (c: string) => NOMES_DAS_CORES[c.toLowerCase()] ?? `Cor atual (${c})`;

/**
 * Bolinhas de cor no lugar de um <input type="color">. É um grupo de opções:
 * Tab entra na cor escolhida, setas (ou Home/End) trocam de cor, e o anel desliza até a selecionada.
 */
function SeletorCor({ valor, aoMudar, cores }: { valor: string; aoMudar: (c: string) => void; cores: string[] }) {
  const id = useId();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = cores.indexOf(valor);
  const irPara = (i: number) => {
    const n = (i + cores.length) % cores.length;
    aoMudar(cores[n]);
    botoes.current[n]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Cor da categoria"
      data-slot="seletor-cor"
      data-valor={valor}
      className="flex flex-wrap gap-1 sem-selecao"
      onKeyDown={(e) => {
        const base = atual < 0 ? 0 : atual;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); irPara(base + 1); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); irPara(base - 1); }
        else if (e.key === "Home") { e.preventDefault(); irPara(0); }
        else if (e.key === "End") { e.preventDefault(); irPara(cores.length - 1); }
      }}
    >
      {cores.map((c, i) => {
        const ativa = c === valor;
        return (
          <Dica key={c} texto={nomeDaCor(c)}>
            <button
              ref={(el) => { botoes.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={ativa}
              aria-label={nomeDaCor(c)}
              data-slot="cor"
              data-cor={c}
              tabIndex={ativa || (atual < 0 && i === 0) ? 0 : -1}
              onClick={() => aoMudar(c)}
              className="group/cor relative inline-flex size-8 items-center justify-center rounded-full outline-none focus-visible:bg-accent"
            >
              {ativa && (
                <motion.span
                  layoutId={`anel-cor-${id}`}
                  transition={mola}
                  style={{ borderColor: c }}
                  className="absolute inset-0 rounded-full border-2 transition-colors duration-200"
                />
              )}
              <span
                style={{ background: c }}
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-white shadow-xs ring-1 ring-black/10 transition-transform duration-150 ring-inset group-hover/cor:scale-110 group-active/cor:scale-95 dark:ring-white/15",
                  !ativa && "group-focus-visible/cor:scale-110",
                )}
              >
                {ativa && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={mola} className="inline-flex">
                    <Check className="size-3" strokeWidth={3.5} />
                  </motion.span>
                )}
              </span>
            </button>
          </Dica>
        );
      })}
    </div>
  );
}

export function CategoriaForm({ aberto, fechar, cat }: { aberto: boolean; fechar: () => void; cat?: Categoria }) {
  const { dados, salvarCategorias, toast } = useNexo();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[5]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setNome(cat?.nome ?? "");
    setDescricao(cat?.descricao ?? "");
    setCor(cat?.cor ?? CORES[(dados?.categorias.items.length ?? 0) % CORES.length]);
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, cat?.id]);

  // Se a categoria veio com uma cor fora da paleta (editada à mão no JSON), ela continua disponível.
  const cores = useMemo(() => (cat?.cor && !CORES.includes(cat.cor) ? [...CORES, cat.cor] : CORES), [cat?.cor]);

  const nomeLimpo = nome.trim();
  const repetida = useMemo(
    () => !!nomeLimpo && (dados?.categorias.items ?? []).some((c) => c.id !== cat?.id && semAcento(c.nome.trim()) === semAcento(nomeLimpo)),
    [dados, cat?.id, nomeLimpo],
  );

  async function salvar() {
    if (!nomeLimpo || salvando) return;
    setSalvando(true);
    const nova = normalizarCategoria({ ...(cat || {}), id: cat?.id ?? novoId("c"), nome: nomeLimpo, descricao, cor, atualizadaEm: agoraISO() });
    const ok = await salvarCategorias((items) => (cat ? items.map((i) => (i.id === cat.id ? nova : i)) : [...items, nova]));
    setSalvando(false);
    if (ok) {
      toast(cat ? "Categoria salva." : "Categoria criada.");
      fechar();
    }
  }

  const previa = { nome: nomeLimpo || "Nome da categoria", cor };

  return (
    <Modal
      titulo={cat ? "Editar categoria" : "Nova categoria"}
      descricao="Um assunto ou aplicação de onde nascem várias tarefas."
      aberto={aberto}
      fechar={fechar}
      rodape={
        <>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button disabled={!nomeLimpo || salvando} onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <div data-slot="form-categoria" className="flex flex-col gap-4">
        <Campo rotulo="Nome" dica={repetida ? <span className="text-alerta">Já existe uma categoria com esse nome.</span> : undefined}>
          <Input
            autoFocus
            data-foco-inicial
            value={nome}
            maxLength={80}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Security Champion"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); salvar(); }
            }}
          />
        </Campo>
        <Campo rotulo="Descrição">
          <Textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Do que se trata esse assunto, quem são os envolvidos..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(); }
            }}
          />
        </Campo>
        <Campo rotulo="Cor" lado={<span className="text-[11px] text-muted-foreground">{nomeDaCor(cor)}</span>}>
          <SeletorCor valor={cor} aoMudar={setCor} cores={cores} />
        </Campo>

        <div data-slot="previa-categoria" className="rounded-xl border border-dashed bg-muted/40 p-3">
          <div className="mb-2 text-[11px] font-medium text-muted-foreground sem-selecao">Prévia</div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex min-w-0 flex-1 basis-56 items-center gap-3 rounded-lg border bg-card p-2.5 shadow-xs">
              <EmblemaCategoria nome={nomeLimpo || "?"} cor={cor} />
              <div className="min-w-0">
                <div className={cn("truncate text-[13px] font-semibold", !nomeLimpo && "text-muted-foreground/70")}>{previa.nome}</div>
                <div className="truncate text-xs text-muted-foreground">{descricao.trim().split("\n")[0] || "Sem descrição"}</div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] text-muted-foreground sem-selecao">Nas tarefas aparece assim</span>
              <CatTag cat={previa as Categoria} className="text-foreground" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
