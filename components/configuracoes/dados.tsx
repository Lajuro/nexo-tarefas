"use client";

// Painéis de Configurações que falam dos dados: pasta, proteção (backups) e lixeira.

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore, ChevronRight, Copy, DatabaseBackup, Download, FileJson, FileText, FolderOpen, History, LoaderCircle,
  Lock, RefreshCw, RotateCcw, ShieldCheck, Trash2,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { Campo, Contador, NumeroAnimado, Painel, copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, Table, TBody, Td, Th, THead, Tr } from "@/components/ui/diversos";
import { dataRelativa } from "@/lib/lembretes";
import { cn } from "@/lib/utils";

export type ItemLixeira = { arquivo: string; titulo: string; tipo: string };

// ---------- Pasta de dados ----------

export function PainelPasta() {
  const { estado, dados, configurarPasta, toast } = useNexo();
  const confirmar = useConfirmar();
  const atual = estado?.dataDir ?? "";
  const [dir, setDir] = useState(atual);
  const [trocando, setTrocando] = useState(false);
  useEffect(() => setDir(atual), [atual]);

  const fixada = estado?.origem === "env";
  const mudou = Boolean(dir.trim()) && dir.trim() !== atual;
  const totalRegs = (dados?.tarefas ?? []).reduce((n, t) => n + t.registros.length, 0);
  const somenteLeitura = Boolean(estado?.somenteLeitura);

  const trocar = async () => {
    const ok = await confirmar({
      titulo: "Trocar a pasta de dados?",
      descricao: (
        <>
          O app vai passar a ler e gravar em <code>{dir.trim()}</code>. Os dados atuais não são movidos sozinhos: copie a pasta antes, se quiser levar tudo.
        </>
      ),
      confirmar: "Usar esta pasta",
    });
    if (!ok) return;
    setTrocando(true);
    await configurarPasta(dir.trim());
    setTrocando(false);
  };

  return (
    <Painel
      titulo="Pasta de dados"
      icone={<FolderOpen />}
      acoes={fixada ? <Badge variant="outline"><Lock /> Fixada por variável de ambiente</Badge> : undefined}
    >
      <div className="flex flex-col gap-3.5">
        <Campo
          rotulo="Caminho atual"
          dica={
            fixada
              ? <>Fixado pela variável de ambiente <code>NEXO_DATA_DIR</code>. Para trocar, mude a variável e abra o app de novo.</>
              : "Para trocar, cole outro caminho e confirme. Os dados não são movidos sozinhos: copie a pasta antes, se quiser levar tudo."
          }
        >
          <Input
            data-slot="caminho-dados"
            aria-label="Caminho da pasta de dados"
            className="font-mono text-xs"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mudou && !fixada && trocar()}
            disabled={fixada}
            placeholder="C:\Users\voce\OneDrive\Nexo"
          />
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Button variant={mudou && !fixada ? "default" : "outline"} disabled={!mudou || fixada || trocando} onClick={trocar}>
            {trocando ? <LoaderCircle className="animate-spin" /> : <FolderOpen />}
            Usar esta pasta
          </Button>
          <Button
            variant="ghost"
            onClick={async () => (await copiarTexto(atual)) && toast("Caminho copiado. Cole no Explorer para abrir.")}
          >
            <Copy /> Copiar caminho
          </Button>
        </div>

        <div className="grid grid-cols-4 divide-x overflow-hidden rounded-lg border bg-muted/30">
          <Contagem rotulo="Tarefas" n={dados?.tarefas.length ?? 0} />
          <Contagem rotulo="Registros" n={totalRegs} />
          <Contagem rotulo="Categorias" n={dados?.categorias.items.length ?? 0} />
          <Contagem rotulo="Links e docs" n={dados?.links.items.length ?? 0} />
        </div>

        <div data-slot="versao-formato" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            Formato dos dados: <strong className="font-semibold text-foreground tabular-nums">v{estado?.schemaDados ?? "?"}</strong>
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">este app lê até a v{estado?.schemaApp}</span>
          {somenteLeitura
            ? <Badge variant="alerta" className="ml-auto">Somente leitura: atualize o app</Badge>
            : <Badge variant="sucesso" className="ml-auto">Compatível</Badge>}
        </div>
      </div>
    </Painel>
  );
}

function Contagem({ rotulo, n }: { rotulo: string; n: number }) {
  return (
    <div data-slot="contagem" className="min-w-0 px-3 py-2">
      <NumeroAnimado valor={n} className="block text-base leading-tight font-semibold tracking-tight" />
      <span className="block truncate text-[11px] text-muted-foreground">{rotulo}</span>
    </div>
  );
}

// ---------- Proteção dos dados ----------

const GARANTIAS: { icone: ReactNode; titulo: string; texto: ReactNode }[] = [
  {
    icone: <FileJson />,
    titulo: "Um arquivo por tarefa",
    texto: "Cada tarefa é um arquivo JSON separado. Um problema num arquivo não afeta os outros.",
  },
  {
    icone: <ShieldCheck />,
    titulo: "Gravação atômica",
    texto: "Escreve num arquivo temporário e só então troca. Se o PC desligar no meio, o arquivo antigo fica intacto.",
  },
  {
    icone: <History />,
    titulo: "Backup diário automático",
    texto: <>Todo dia, antes da primeira alteração, uma foto dos dados vai para <code>_backups/AAAA-MM-DD</code> (guarda as últimas 45).</>,
  },
  {
    icone: <DatabaseBackup />,
    titulo: "Cópia antes de mudar o formato",
    texto: <>Antes de qualquer atualização de formato, uma cópia completa vai para <code>_backups/pre-migracao-*</code>.</>,
  },
  {
    icone: <Trash2 />,
    titulo: "Nada é apagado de verdade",
    texto: <>Tarefas e itens removidos vão para <code>_lixeira</code>. Registros removidos ficam guardados dentro da própria tarefa.</>,
  },
  {
    icone: <FileText />,
    titulo: "Espelho legível em Markdown",
    texto: <>A pasta <code>markdown/</code> tem uma versão legível de cada tarefa, caso um dia você precise ler sem o app.</>,
  },
];

/** Data embutida no nome da pasta de backup ("2026-11-13" ou "2026-11-13T16-40-09"), para ordenar do mais novo ao mais antigo. */
const dataDoBackup = (nome: string) => nome.match(/\d{4}-\d{2}-\d{2}(T[\d-]+)?/)?.[0] ?? "";

function tipoBackup(nome: string): { rotulo: string; variante: "secondary" | "info" | "alerta" } {
  if (nome.startsWith("manual-")) return { rotulo: "manual", variante: "info" };
  if (nome.startsWith("pre-migracao-")) return { rotulo: "antes de migração", variante: "alerta" };
  return { rotulo: "diário", variante: "secondary" };
}

export function PainelProtecao({
  backups: lista, aoFazerBackup, fazendo,
}: {
  backups: string[] | null; aoFazerBackup: () => void; fazendo: boolean;
}) {
  const backups = useMemo(
    () => (lista ? [...lista].sort((a, b) => dataDoBackup(b).localeCompare(dataDoBackup(a)) || b.localeCompare(a)) : null),
    [lista],
  );
  const ultimo = backups?.[0];
  const { recarregar, toast } = useNexo();
  const [aberto, setAberto] = useState(false);
  const [recarregando, setRecarregando] = useState(false);

  return (
    <Painel
      titulo="Proteção dos dados"
      icone={<ShieldCheck />}
      acoes={
        <Button
          variant="ghost"
          size="sm"
          disabled={recarregando}
          onClick={async () => {
            setRecarregando(true);
            await recarregar();
            setRecarregando(false);
            toast("Dados lidos de novo da pasta.", "info");
          }}
        >
          <RefreshCw className={cn(recarregando && "animate-spin")} /> Recarregar dados da pasta
        </Button>
      }
    >
      <ul className="flex flex-col gap-3">
        {GARANTIAS.map((g) => (
          <li key={g.titulo} data-slot="garantia" className="flex gap-3">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-sucesso/12 text-sucesso [&_svg]:size-3.5">
              {g.icone}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{g.titulo}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{g.texto}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3.5">
        <Button variant="outline" disabled={fazendo} onClick={aoFazerBackup}>
          {fazendo ? <LoaderCircle className="animate-spin" /> : <DatabaseBackup />}
          Fazer backup agora
        </Button>
        <Button asChild variant="outline">
          <a href="/api/exportar" download><Download /> Exportar tudo (JSON)</a>
        </Button>
      </div>

      {backups && backups.length > 0 && (
        <Collapsible open={aberto} onOpenChange={setAberto} className="mt-2.5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              data-slot="lista-backups"
              className="flex h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-xs font-medium text-muted-foreground outline-none sem-selecao hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
            >
              <ChevronRight className={cn("size-3.5 transition-transform duration-200", aberto && "rotate-90")} />
              <span className="truncate">{backups.length === 1 ? "1 backup guardado" : `${backups.length} backups guardados`}</span>
              {ultimo && (
                <span className="ml-auto shrink-0 font-normal whitespace-nowrap tabular-nums">
                  mais recente: {dataRelativa(dataDoBackup(ultimo).slice(0, 10)) || ultimo} ({tipoBackup(ultimo).rotulo})
                </span>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-1.5 max-h-52 divide-y overflow-y-auto rounded-lg border bg-muted/30">
              {backups.slice(0, 60).map((b) => {
                const tipo = tipoBackup(b);
                return (
                  <li key={b} data-slot="backup" className="flex h-8 items-center gap-2 px-2.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{b}</span>
                    <Badge variant={tipo.variante}>{tipo.rotulo}</Badge>
                  </li>
                );
              })}
            </ul>
            {backups.length > 60 && <p className="mt-1.5 px-1.5 text-[11px] text-muted-foreground">Mostrando os 60 mais recentes.</p>}
          </CollapsibleContent>
        </Collapsible>
      )}
    </Painel>
  );
}

// ---------- Lixeira ----------

const NOME_REMOVIDOS: Record<string, string> = { categorias: "Categorias removidas", links: "Links e docs removidos" };

export function PainelLixeira({
  itens, aoRestaurar, restaurando, className,
}: {
  itens: ItemLixeira[] | null; aoRestaurar: (i: ItemLixeira) => void; restaurando: string | null; className?: string;
}) {
  const vazia = !itens || itens.length === 0;
  return (
    <Painel
      titulo="Lixeira"
      icone={<Trash2 />}
      acoes={itens && itens.length > 0 ? <Contador n={itens.length} /> : undefined}
      className={className}
      // A Table já vem com moldura própria: dentro do painel ela fica sem borda nem sombra.
      corpoClassName={vazia ? undefined : "p-0 [&>div]:rounded-t-none [&>div]:border-0 [&>div]:shadow-none"}
    >
      {vazia ? (
        <p data-slot="lixeira-vazia" className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <ArchiveRestore className="size-3.5 opacity-70" />
          {itens ? "Nada na lixeira. Tarefas e itens excluídos aparecem aqui e podem voltar." : "Lendo a lixeira..."}
        </p>
      ) : (
        <Table>
          <THead>
            <Tr className="hover:bg-transparent">
              <Th>Item</Th>
              <Th>Arquivo em _lixeira</Th>
              <Th className="w-px" />
            </Tr>
          </THead>
          <TBody>
            {itens.map((i) => {
              const tarefa = i.tipo === "tarefa";
              return (
                <Tr key={i.arquivo} data-slot="item-lixeira">
                  <Td className="max-w-0 w-[45%]">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant={tarefa ? "default" : "secondary"}>{tarefa ? "Tarefa" : "Lista"}</Badge>
                      <span className="truncate font-medium">{tarefa ? i.titulo : (NOME_REMOVIDOS[i.tipo] ?? `${i.tipo} removidos`)}</span>
                    </div>
                  </Td>
                  <Td className="max-w-0">
                    <span className="block truncate font-mono text-xs text-muted-foreground">{i.arquivo}</span>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {tarefa ? (
                      <Button variant="outline" size="sm" disabled={restaurando !== null} onClick={() => aoRestaurar(i)}>
                        {restaurando === i.arquivo ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
                        Restaurar
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">guardado para consulta</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </Painel>
  );
}
