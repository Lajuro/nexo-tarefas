"use client";

// Painéis de Configurações que falam dos dados: pasta, proteção (backups) e lixeira.

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore, ChevronRight, CircleAlert, CircleCheckBig, Copy, DatabaseBackup, Download, FileJson, FileText, FileUp, FolderOpen, History, Info, LoaderCircle,
  Lock, RefreshCw, RotateCcw, ShieldCheck, Stethoscope, Trash2, TriangleAlert,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { Campo, Contador, Modal, NumeroAnimado, Painel, copiarTexto, formatarTamanho } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, Table, TBody, Td, Th, THead, Tr } from "@/components/ui/diversos";
import { AreaArquivo } from "@/components/ui/chips";
import { Segmentado } from "@/components/ui/controles";
import type { PreviaDeImportar, PreviaDoBackup } from "@/lib/armazenamento";
import { type GrupoImportavel, MAX_BYTES_DA_IMPORTACAO, type ModoDeImportacao, trocasNoResumo } from "@/lib/importar-dados";
import type { Achado, Verificacao } from "@/lib/integridade";
import { dataRelativa } from "@/lib/lembretes";
import { dataCurta, formatarDataHora } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export type ItemLixeira = { arquivo: string; titulo: string; tipo: string };

// ---------- Pasta de dados ----------

export function PainelPasta() {
  const { estado, dados, configurarPasta, toast, entrarNoExemplo, sairDoExemplo } = useNexo();
  const [trocandoExemplo, setTrocandoExemplo] = useState(false);
  const noExemplo = Boolean(estado?.exemplo);
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
            disabled={fixada || noExemplo}
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

        {/* Dados de exemplo (3.22): numa pasta separada, para ver o app cheio sem misturar com os dados de verdade. */}
        <div data-slot="painel-do-exemplo" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed px-3 py-2.5">
          <p className="min-w-0 flex-1 basis-64 text-xs leading-snug text-muted-foreground">
            {noExemplo ? (
              <>Você está vendo os <strong className="font-medium text-foreground">dados de exemplo</strong>. Os seus continuam em <code>{estado?.pastaReal}</code>, sem nenhuma mudança.</>
            ) : fixada ? (
              "Os dados de exemplo não estão disponíveis com a pasta fixada por variável de ambiente."
            ) : (
              "Quer ver o app cheio antes de pôr as suas tarefas? Os dados de exemplo ficam numa pasta separada: nada se mistura com os seus, e você volta com um clique."
            )}
          </p>
          {noExemplo ? (
            <Button data-slot="config-sair-do-exemplo" disabled={trocandoExemplo} onClick={async () => { setTrocandoExemplo(true); await sairDoExemplo(); setTrocandoExemplo(false); }}>Usar meus dados</Button>
          ) : (
            <Button variant="outline" data-slot="config-abrir-exemplo" disabled={fixada || trocandoExemplo}
              onClick={async () => { setTrocandoExemplo(true); await entrarNoExemplo(); setTrocandoExemplo(false); }}>
              {trocandoExemplo ? <LoaderCircle className="animate-spin" /> : null} Conhecer com um exemplo
            </Button>
          )}
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
      <span className="block truncate text-xs text-muted-foreground">{rotulo}</span>
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
    icone: <RotateCcw />,
    titulo: "Restaurar tem volta",
    texto: <>Qualquer backup da lista abaixo pode ser restaurado pelo app, com prévia do que muda. Antes, o estado de agora é guardado em <code>_backups/pre-restauracao-*</code>.</>,
  },
  {
    icone: <FileUp />,
    titulo: "Importar soma, não apaga",
    texto: <>Um arquivo exportado pode voltar para o app: o que falta entra, o que já está aqui fica, e você escolhe o que fazer com o que está diferente. Antes, o estado de agora vai para <code>_backups/pre-importacao-*</code>.</>,
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
  if (nome.startsWith("pre-restauracao-")) return { rotulo: "antes de restaurar", variante: "alerta" };
  if (nome.startsWith("pre-importacao-")) return { rotulo: "antes de importar", variante: "alerta" };
  return { rotulo: "diário", variante: "secondary" };
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.erro) throw new Error(j.erro || `Erro ${r.status}`);
  return j as T;
}

const NOME_COLECAO: Record<string, string> = { categorias: "Categorias", links: "Links e docs", pessoas: "Pessoas", times: "Times", notas: "Folhas do bloco de notas", modelos: "Modelos de tarefa", paginas: "Páginas", jornada: "Rotina e ponto (dias)", assuntos: "Assuntos para falar" };

/** Janela que mostra o que muda antes de restaurar um backup. Só restaura com a confirmação. */
function RestaurarBackup({ nome, fechar, aoRestaurar }: { nome: string | null; fechar: () => void; aoRestaurar: () => void }) {
  const { recarregar, toast, estado } = useNexo();
  const [previa, setPrevia] = useState<PreviaDoBackup | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  useEffect(() => {
    setPrevia(null);
    setErro(null);
    if (!nome) return;
    let vivo = true;
    pedir<{ previa: PreviaDoBackup }>(`/api/backup?nome=${encodeURIComponent(nome)}`)
      .then((r) => vivo && setPrevia(r.previa))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [nome]);

  const restaurar = async () => {
    if (!nome || restaurando) return;
    setRestaurando(true);
    try {
      const r = await pedir<{ foto: string; tarefas: number; paraLixeira: number }>("/api/backup/restaurar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome }),
      });
      await recarregar();
      toast(`Backup restaurado. O estado anterior ficou guardado em _backups/${r.foto}.`);
      aoRestaurar();
      fechar();
    } catch (e) {
      toast((e as Error).message, "erro");
    }
    setRestaurando(false);
  };

  const igual = previa && !previa.saem.length && !previa.voltam.length && !previa.mudam.length && previa.colecoes.every((c) => c.noBackup === null || c.noBackup === c.agora);
  const lista = (titulo: string, itens: { id: string; titulo: string }[], classe: string) =>
    itens.length > 0 && (
      <div>
        <p className={cn("text-[13px] font-medium", classe)}>{titulo}</p>
        <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-muted-foreground">
          {itens.slice(0, 8).map((t) => <li key={t.id} className="truncate">{t.titulo}</li>)}
          {itens.length > 8 && <li>e mais {itens.length - 8}</li>}
        </ul>
      </div>
    );

  return (
    <Modal
      titulo="Restaurar este backup?"
      descricao={nome ? <>Os dados voltam a ser o que eram em <code className="font-mono text-xs">{nome}</code>.</> : undefined}
      aberto={!!nome}
      fechar={fechar}
      rodape={
        <>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button variant="destructive" data-slot="confirmar-restauracao" disabled={!previa?.restauravel || restaurando || !!estado?.somenteLeitura} onClick={restaurar}>
            {restaurando ? <LoaderCircle className="animate-spin" /> : <RotateCcw />} Restaurar
          </Button>
        </>
      }
    >
      {erro ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] leading-snug text-destructive">{erro}</p>
      ) : !previa ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Conferindo o backup...</p>
      ) : (
        <div data-slot="previa-backup" className="flex flex-col gap-3">
          {!previa.restauravel && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] leading-snug text-destructive">{previa.motivo}</p>}
          <p className="text-[13px] leading-relaxed">
            O backup tem <strong>{previa.tarefasNoBackup}</strong> {previa.tarefasNoBackup === 1 ? "tarefa" : "tarefas"}.
            {igual ? " Ele é igual ao que está na pasta agora: restaurar não muda nada." : " Veja o que muda:"}
          </p>
          {lista(`${previa.mudam.length} ${previa.mudam.length === 1 ? "tarefa volta" : "tarefas voltam"} ao que ${previa.mudam.length === 1 ? "era" : "eram"}`, previa.mudam, "text-alerta")}
          {lista(`${previa.voltam.length} ${previa.voltam.length === 1 ? "tarefa que não existe mais volta" : "tarefas que não existem mais voltam"}`, previa.voltam, "text-sucesso")}
          {lista(`${previa.saem.length} ${previa.saem.length === 1 ? "tarefa criada depois vai" : "tarefas criadas depois vão"} para a lixeira`, previa.saem, "text-destructive")}
          <Table>
            <THead><Tr><Th>Coleção</Th><Th className="text-right">No backup</Th><Th className="text-right">Agora</Th></Tr></THead>
            <TBody>
              {previa.colecoes.map((c) => (
                <Tr key={c.nome}>
                  <Td>{NOME_COLECAO[c.nome] ?? c.nome}</Td>
                  <Td className="text-right tabular-nums">{c.noBackup === null ? <span className="text-muted-foreground">não está no backup, fica como está</span> : c.noBackup}</Td>
                  <Td className="text-right tabular-nums">{c.agora === null ? <span className="text-destructive">ilegível</span> : c.agora}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Restaurar tem volta: antes de mexer em qualquer coisa, o app tira uma foto do estado de agora em <code>_backups/pre-restauracao-*</code>, que aparece nesta lista.
            Os anexos (pasta <code>arquivos</code>) não são tocados.
          </p>
        </div>
      )}
    </Modal>
  );
}

const NOME_DO_GRUPO: Record<GrupoImportavel, string> = {
  tarefas: "Tarefas", categorias: "Categorias", links: "Links e docs", pessoas: "Pessoas", times: "Times", notas: "Folhas do bloco de notas",
  modelos: "Modelos de tarefa", paginas: "Páginas", jornada: "Rotina e ponto (dias)", assuntos: "Assuntos para falar",
};

const MODOS: { valor: ModoDeImportacao; rotulo: string; explica: (trocam: number, ficam: number) => string }[] = [
  { valor: "manter", rotulo: "Manter o daqui", explica: (_t, ficam) => `${plural(ficam, "item diferente fica", "itens diferentes ficam")} como está aqui. O arquivo só acrescenta o que falta.` },
  { valor: "recente", rotulo: "O mais recente", explica: (trocam, ficam) => `Em cada item diferente fica o lado mexido por último: ${plural(trocam, "é trocado", "são trocados")} pelo do arquivo e ${plural(ficam, "fica", "ficam")} como está aqui.` },
  { valor: "arquivo", rotulo: "O do arquivo", explica: (trocam) => `${plural(trocam, "item daqui é trocado", "itens daqui são trocados")} pelo que está no arquivo.` },
];

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * Janela de importar um nexo-export-*.json (3.17). Mostra o que entra e o que conflita antes de qualquer gravação.
 * Importar soma: nada do que está na pasta é apagado. Só importa com a confirmação.
 */
function ImportarExportacao({ aberto, fechar, aoImportar }: { aberto: boolean; fechar: () => void; aoImportar: () => void }) {
  const { recarregar, toast, estado } = useNexo();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [previa, setPrevia] = useState<PreviaDeImportar | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoDeImportacao>("manter");
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setArquivo(null);
    setTexto(null);
    setPrevia(null);
    setErro(null);
    setModo("manter");
    setImportando(false);
  }, [aberto]);

  const escolher = async (f: File | null) => {
    setArquivo(f);
    setTexto(null);
    setPrevia(null);
    setErro(null);
    setModo("manter");
    if (!f) return;
    try {
      if (f.size > MAX_BYTES_DA_IMPORTACAO) throw new Error("O arquivo é grande demais para ser um export do Nexo.");
      const lido = await f.text();
      const r = await pedir<{ previa: PreviaDeImportar }>("/api/importar", { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: lido });
      setTexto(lido);
      setPrevia(r.previa);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const grupos = previa?.grupos.filter((g) => g.noArquivo > 0) ?? [];
  const comMudanca = grupos.filter((g) => g.entram > 0 || g.conflitos > 0 || g.ilegivelAqui);
  const semMudanca = grupos.filter((g) => !comMudanca.includes(g));
  const entram = grupos.reduce((n, g) => n + g.entram, 0);
  const conflitos = grupos.reduce((n, g) => n + g.conflitos, 0);
  const trocam = grupos.reduce((n, g) => n + trocasNoResumo(g, modo), 0);
  const nadaAFazer = !!previa && entram + trocam === 0;
  const escolhido = MODOS.find((m) => m.valor === modo)!;

  const importar = async () => {
    if (!texto || !previa?.importavel || importando || nadaAFazer) return;
    setImportando(true);
    try {
      const r = await pedir<{ foto: string | null; entraram: number; trocados: number }>(`/api/importar?aplicar=1&modo=${modo}`, {
        method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: texto,
      });
      await recarregar();
      toast(
        `Importado: ${plural(r.entraram, "item novo", "itens novos")}${r.trocados ? ` e ${plural(r.trocados, "trocado", "trocados")}` : ""}.` +
          (r.foto ? ` O estado anterior ficou guardado em _backups/${r.foto}.` : ""),
      );
      aoImportar();
      fechar();
    } catch (e) {
      toast((e as Error).message, "erro");
    }
    setImportando(false);
  };

  const exemplos = (titulo: string, itens: string[], total: number) =>
    itens.length > 0 && (
      <div>
        <p className="text-[13px] font-medium">{titulo}</p>
        <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-muted-foreground">
          {itens.map((t, i) => <li key={i} className="truncate">{t}</li>)}
          {total > itens.length && <li>e mais {total - itens.length}</li>}
        </ul>
      </div>
    );
  const tarefas = grupos.find((g) => g.grupo === "tarefas");

  return (
    <Modal
      titulo="Importar um arquivo exportado"
      descricao={<>Traz de volta o que está num <code className="font-mono text-xs">nexo-export-*.json</code>. O que já está aqui não é apagado.</>}
      aberto={aberto}
      fechar={() => !importando && fechar()}
      rodape={
        <>
          <Button variant="outline" disabled={importando} onClick={fechar}>Cancelar</Button>
          <Button data-slot="confirmar-importacao" disabled={!previa?.importavel || nadaAFazer || importando || !!estado?.somenteLeitura} onClick={importar}>
            {importando ? <LoaderCircle className="animate-spin" /> : <FileUp />} Importar
          </Button>
        </>
      }
    >
      <div data-slot="importar-exportacao" className="flex flex-col gap-3">
        <AreaArquivo arquivo={arquivo} aoMudar={(f) => void escolher(f)} className={previa ? "py-3" : undefined} />
        {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] leading-snug text-destructive">{erro}</p>}
        {arquivo && !previa && !erro && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Conferindo o arquivo...</p>
        )}
        {previa && (
          <div data-slot="previa-importacao" data-entram={entram} data-conflitos={conflitos} className="flex flex-col gap-3">
            {!previa.importavel && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] leading-snug text-destructive">{previa.motivo}</p>}
            <p className="text-[13px] leading-relaxed">
              {previa.exportadoEm ? <>Exportado em <strong className="tabular-nums">{formatarDataHora(previa.exportadoEm)}</strong>. </> : null}
              {nadaAFazer && !conflitos
                ? "Tudo o que está no arquivo já está aqui, igual: não há o que importar."
                : <>{plural(entram, "item novo entra", "itens novos entram")}{conflitos > 0 && <> e {plural(conflitos, "já existe aqui com conteúdo diferente", "já existem aqui com conteúdo diferente")}</>}.</>}
            </p>
            {/* a tabela mostra só o que muda; o que veio igual vira uma linha de texto, para a janela caber na tela */}
            {comMudanca.length > 0 && (
              <Table>
                <THead><Tr><Th>O quê</Th><Th className="text-right">No arquivo</Th><Th className="text-right">Entram</Th><Th className="text-right">Diferentes</Th><Th className="text-right">Iguais</Th></Tr></THead>
                <TBody>
                  {comMudanca.map((g) => (
                    <Tr key={g.grupo} data-slot="grupo-da-importacao" data-grupo={g.grupo}>
                      <Td>{NOME_DO_GRUPO[g.grupo]}{g.ilegivelAqui && <span className="ml-1.5 text-xs text-destructive">ilegível aqui</span>}</Td>
                      <Td className="text-right tabular-nums">{g.noArquivo}</Td>
                      <Td className={cn("text-right tabular-nums", g.entram ? "font-medium text-sucesso" : "text-muted-foreground")}>{g.entram}</Td>
                      <Td className={cn("text-right tabular-nums", g.conflitos ? "font-medium text-alerta" : "text-muted-foreground")}>{g.conflitos}</Td>
                      <Td className="text-right text-muted-foreground tabular-nums">{g.iguais}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
            {semMudanca.length > 0 && comMudanca.length > 0 && (
              <p data-slot="grupos-iguais" className="text-xs leading-relaxed text-muted-foreground">
                Já estão aqui, iguais: {semMudanca.map((g) => `${NOME_DO_GRUPO[g.grupo].toLowerCase()} (${g.noArquivo})`).join(", ")}.
              </p>
            )}
            {tarefas && exemplos(plural(tarefas.entram, "tarefa nova", "tarefas novas"), tarefas.exemplosDeEntrada, tarefas.entram)}
            {tarefas && exemplos(plural(tarefas.conflitos, "tarefa diferente nos dois lados", "tarefas diferentes nos dois lados"), tarefas.exemplosDeConflito, tarefas.conflitos)}
            {conflitos > 0 && (
              <div data-slot="modo-da-importacao" className="flex flex-col gap-1.5 rounded-lg bg-muted/60 px-3 py-2.5">
                <p className="text-[13px] font-medium">No que está diferente nos dois lados, o que fica?</p>
                <Segmentado<ModoDeImportacao> aria-label="O que fica quando o item está diferente nos dois lados" tamanho="sm" valor={modo} aoMudar={setModo}
                  opcoes={MODOS.map((m) => ({ valor: m.valor, rotulo: m.rotulo }))} />
                <p role="status" className="text-xs leading-relaxed text-muted-foreground">{escolhido.explica(trocam, conflitos - trocam)}</p>
              </div>
            )}
            {previa.ignorados > 0 && (
              <p className="text-xs leading-relaxed text-alerta">{plural(previa.ignorados, "item do arquivo ficou de fora", "itens do arquivo ficaram de fora")} por não ter um identificador válido.</p>
            )}
            <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Importar tem volta: antes de gravar, o app tira uma foto do estado de agora em <code>_backups/pre-importacao-*</code>, que aparece na lista de backups.
              {" "}Os anexos (pasta <code>arquivos</code>) não fazem parte do arquivo exportado
              {previa.anexosQueFaltam > 0
                ? <>: {plural(previa.anexosQueFaltam, "link do arquivo cita um anexo que não está", "links do arquivo citam anexos que não estão")} nesta pasta. Copie a pasta <code>arquivos</code> de onde o export veio.</>
                : "."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function PainelProtecao({
  backups: lista, aoFazerBackup, fazendo, aoRestaurar,
}: {
  backups: string[] | null; aoFazerBackup: () => void; fazendo: boolean; aoRestaurar: () => void;
}) {
  const backups = useMemo(
    () => (lista ? [...lista].sort((a, b) => dataDoBackup(b).localeCompare(dataDoBackup(a)) || b.localeCompare(a)) : null),
    [lista],
  );
  const ultimo = backups?.[0];
  const { recarregar, toast } = useNexo();
  const [aberto, setAberto] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [paraRestaurar, setParaRestaurar] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

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
        <Button variant="outline" data-slot="importar-export" onClick={() => setImportando(true)}>
          <FileUp /> Importar um export...
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
                    <Button variant="ghost" size="sm" className="-mr-1.5 h-6" data-slot="restaurar-backup" onClick={() => setParaRestaurar(b)}>
                      <RotateCcw /> Restaurar...
                    </Button>
                  </li>
                );
              })}
            </ul>
            {backups.length > 60 && <p className="mt-1.5 px-1.5 text-xs text-muted-foreground">Mostrando os 60 mais recentes.</p>}
          </CollapsibleContent>
        </Collapsible>
      )}
      <RestaurarBackup nome={paraRestaurar} fechar={() => setParaRestaurar(null)} aoRestaurar={aoRestaurar} />
      {/* depois de importar, a lista de backups ganha a foto "pre-importacao": aoRestaurar relê a lista */}
      <ImportarExportacao aberto={importando} fechar={() => setImportando(false)} aoImportar={aoRestaurar} />
    </Painel>
  );
}

// ---------- Saúde dos dados ----------

const VISUAL_ACHADO: Record<Achado["gravidade"], { icone: ReactNode; classe: string; rotulo: string }> = {
  erro: { icone: <CircleAlert />, classe: "text-destructive", rotulo: "Precisa de você" },
  aviso: { icone: <TriangleAlert />, classe: "text-alerta", rotulo: "Vale conferir" },
  info: { icone: <Info />, classe: "text-muted-foreground", rotulo: "Só para saber" },
};

/** Verificação de integridade: confere os dados e a pasta sob demanda. Só lê; nada é consertado sozinho. */
export function PainelSaude() {
  const { toast } = useNexo();
  const [v, setV] = useState<Verificacao | null>(null);
  const [verificando, setVerificando] = useState(false);

  const verificar = async () => {
    setVerificando(true);
    try {
      setV(await pedir<Verificacao>("/api/verificar"));
    } catch (e) {
      toast((e as Error).message, "erro");
    }
    setVerificando(false);
  };

  const serios = v?.achados.filter((a) => a.gravidade !== "info") ?? [];
  return (
    <Painel
      titulo="Saúde dos dados"
      icone={<Stethoscope />}
      acoes={
        <Button variant="outline" size="sm" data-slot="verificar-dados" disabled={verificando} onClick={verificar}>
          {verificando ? <LoaderCircle className="animate-spin" /> : <Stethoscope />} {v ? "Verificar de novo" : "Verificar agora"}
        </Button>
      }
    >
      {!v ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Confere se todos os arquivos estão legíveis, se há cópias de conflito do OneDrive, anexos faltando ou vínculos que apontam para algo que não existe mais.
          Só lê: nada é alterado.
        </p>
      ) : (
        <div data-slot="saude-dos-dados" data-serios={serios.length} className="flex flex-col gap-3">
          <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-snug", serios.length ? "border-alerta/30 bg-alerta/10" : "border-sucesso/30 bg-sucesso/10")}>
            {serios.length ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" /> : <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-sucesso" />}
            <div>
              <p className="font-medium">{serios.length ? `${serios.length} ${serios.length === 1 ? "ponto pede" : "pontos pedem"} atenção` : "Tudo certo com os seus dados"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {v.numeros.tarefas} tarefas, {v.numeros.registros} registros, {v.numeros.passos} passos, {v.numeros.paginas} páginas e {v.numeros.notas} folhas em {formatarTamanho(v.numeros.bytesDados)}.{" "}
                {v.numeros.anexos} {v.numeros.anexos === 1 ? "anexo" : "anexos"} ({formatarTamanho(v.numeros.bytesAnexos)}). {v.numeros.backups} {v.numeros.backups === 1 ? "backup" : "backups"}
                {v.numeros.ultimoBackup ? `, o diário mais recente de ${dataCurta(v.numeros.ultimoBackup)}` : ""}.
              </p>
            </div>
          </div>
          {v.achados.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {v.achados.map((a) => {
                const vis = VISUAL_ACHADO[a.gravidade];
                return (
                  <li key={a.id} data-slot="achado" data-gravidade={a.gravidade} data-achado={a.id} className="flex gap-2.5">
                    <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", vis.classe)}>{vis.icone}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{a.titulo} <span className={cn("ml-1 text-xs font-normal", vis.classe)}>{vis.rotulo}</span></p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{a.detalhe}</p>
                      {a.itens && a.itens.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-muted-foreground">
                          {a.itens.map((i, n) => <li key={n} className="break-words">{i}</li>)}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
                      <span className="text-xs text-muted-foreground">guardado para consulta</span>
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
