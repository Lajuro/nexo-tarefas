"use client";

// Assistente de importação de contatos do Outlook, 100% local: cola o texto ou abre um arquivo
// (CSV/vCard) e a interpretação acontece aqui no navegador. A lógica está em lib/importar-pessoas.ts.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardPaste, Contact, FileSpreadsheet,
  Search, ShieldCheck, Tag, UserPlus, Users,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { AvatarPessoa, Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/input";
import { Checkbox, Segmentado } from "@/components/ui/controles";
import { AreaArquivo } from "@/components/ui/chips";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, Table, TBody, THead, Td, Th, Tr } from "@/components/ui/diversos";
import { Combobox, type OpcaoCombo } from "@/components/ui/command";
import { suave } from "@/lib/animacoes";
import { cn } from "@/lib/utils";
import { agoraISO, CORES, normalizarPessoa, normalizarTime, novoId, type Pessoa } from "@/lib/tipos";
import { chaveNome } from "@/lib/pessoas";
import {
  compararComCadastro, decodificarArquivo, interpretarImportacao, type PessoaImportada,
} from "@/lib/importar-pessoas";

type Caminho = "colar" | "csv" | "vcf";
type Passo = 1 | 2 | 3;
type Leitura = { arquivo: File | null; pessoas: PessoaImportada[]; erro: string };
type Linha = { id: string; imp: PessoaImportada };
type Resumo = {
  criadas: number; completadas: number; existentes: number; puladas: number;
  time: string; categoria: string; aviso: string;
};

const LEITURA_VAZIA: Leitura = { arquivo: null, pessoas: [], erro: "" };
const NOVO_TIME = "__novo";
const LIMITE_ARQUIVO = 20 * 1024 * 1024;
const ROTULO_CAMPO = { email: "e-mail", cargo: "cargo", area: "área" } as const;

const EXEMPLO =
  "Marina Souza <marina.souza@exemplo.local>; Felipe Rocha <felipe.rocha@exemplo.local>\n" +
  "Rocha, Bruno <bruno.rocha@exemplo.local>\n" +
  "carla.dias@exemplo.local";

const PASSOS: { n: Passo; rotulo: string }[] = [
  { n: 1, rotulo: "Origem" },
  { n: 2, rotulo: "Conferir" },
  { n: 3, rotulo: "Pronto" },
];

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function Lista({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-muted-foreground marker:text-foreground/60">
      {itens.map((t, i) => <li key={i}>{t}</li>)}
    </ol>
  );
}

function Indicador({ passo }: { passo: Passo }) {
  return (
    <ol data-slot="importar-passos" aria-label="Passos da importação" className="flex items-center gap-2 sem-selecao">
      {PASSOS.map((p, i) => {
        const feito = passo > p.n;
        const ativo = passo === p.n;
        return (
          <li key={p.n} className="flex items-center gap-2" aria-current={ativo ? "step" : undefined}>
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                feito || ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {feito ? <Check className="size-3" /> : p.n}
            </span>
            <span className={cn("text-xs font-medium transition-colors", ativo ? "text-foreground" : "text-muted-foreground")}>{p.rotulo}</span>
            {i < PASSOS.length - 1 && <span className={cn("mx-1 h-px w-8 transition-colors", feito ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

function AvisoLocal() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ShieldCheck className="size-3.5 shrink-0 text-sucesso" />
      Tudo é lido aqui, no seu navegador. Nada sai da sua máquina.
    </p>
  );
}

function Reconhecidos({ n }: { n: number }) {
  return (
    <Badge variant={n > 0 ? "sucesso" : "secondary"} data-slot="importar-reconhecidos">
      {n > 0 && <Check />}
      {plural(n, "contato reconhecido", "contatos reconhecidos")}
    </Badge>
  );
}

function Instrucao({ titulo, itens }: { titulo: string; itens: React.ReactNode[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex h-8 w-full items-center justify-between gap-2 rounded-lg px-3 text-[13px] font-medium outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/30">
        {titulo}
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-3 py-2.5"><Lista itens={itens} /></div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ImportarPessoas({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const { dados, salvarPessoas, salvarTimes, toast } = useNexo();
  const pessoas = dados?.pessoas.items ?? [];
  const times = dados?.times.items ?? [];
  const categorias = dados?.categorias.items ?? [];

  const [passo, setPasso] = useState<Passo>(1);
  const [caminho, setCaminho] = useState<Caminho>("colar");
  const [texto, setTexto] = useState("");
  const [leituras, setLeituras] = useState<Record<"csv" | "vcf", Leitura>>({ csv: LEITURA_VAZIA, vcf: LEITURA_VAZIA });
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [marcas, setMarcas] = useState<Record<string, boolean>>({});
  const [filtro, setFiltro] = useState("");
  const [timeSel, setTimeSel] = useState("");
  const [timeNovo, setTimeNovo] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("");
  const [gravando, setGravando] = useState(false);
  const [erroGravar, setErroGravar] = useState("");
  const [resumo, setResumo] = useState<Resumo | null>(null);

  function reiniciar() {
    setPasso(1); setCaminho("colar"); setTexto("");
    setLeituras({ csv: LEITURA_VAZIA, vcf: LEITURA_VAZIA });
    setLinhas([]); setMarcas({}); setFiltro("");
    setTimeSel(""); setTimeNovo(""); setCategoriaSel("");
    setGravando(false); setErroGravar(""); setResumo(null);
  }

  // Ao abrir, sempre começa limpo.
  useEffect(() => { if (aberto) reiniciar(); }, [aberto]);

  const coladas = useMemo(() => (texto.trim() ? interpretarImportacao("", texto).pessoas : []), [texto]);
  const reconhecidas = caminho === "colar" ? coladas : leituras[caminho].pessoas;

  async function lerArquivo(tipo: "csv" | "vcf", arquivo: File | null) {
    if (!arquivo) { setLeituras((l) => ({ ...l, [tipo]: LEITURA_VAZIA })); return; }
    const esperado = tipo === "csv"
      ? "Esperava um CSV exportado do Outlook, com colunas como Nome e E-mail (ou First Name, Last Name e E-mail Address)."
      : "Esperava um arquivo vCard (.vcf) com BEGIN:VCARD, nome e e-mail.";
    let resultado: Leitura;
    if (arquivo.size > LIMITE_ARQUIVO) {
      resultado = { arquivo, pessoas: [], erro: "O arquivo é grande demais (mais de 20 MB). " + esperado };
    } else {
      try {
        const conteudo = decodificarArquivo(await arquivo.arrayBuffer());
        const lidas = interpretarImportacao(arquivo.name, conteudo).pessoas;
        resultado = { arquivo, pessoas: lidas, erro: lidas.length ? "" : "Não reconheci nenhum contato neste arquivo. " + esperado };
      } catch {
        resultado = { arquivo, pessoas: [], erro: "Não consegui ler este arquivo. " + esperado };
      }
    }
    setLeituras((l) => ({ ...l, [tipo]: resultado }));
  }

  function continuar() {
    setLinhas(reconhecidas.map((imp, i) => ({ id: `l${i}`, imp })));
    setMarcas({}); setFiltro(""); setErroGravar("");
    setPasso(2);
  }

  function mudarNome(id: string, nome: string) {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, imp: { ...l.imp, nome } } : l)));
  }

  const comparacoes = useMemo(() => compararComCadastro(linhas.map((l) => l.imp), pessoas), [linhas, pessoas]);

  const estado = linhas.map((l, i) => {
    const c = comparacoes[i];
    const valida = l.imp.nome.trim().length > 0;
    const marcada = valida && (marcas[l.id] ?? c.situacao !== "jaExiste");
    return { linha: l, c, valida, marcada };
  });
  const selecionadas = estado.filter((e) => e.marcada);
  const busca = chaveNome(filtro);
  const visiveis = busca
    ? estado.filter((e) => chaveNome(`${e.linha.imp.nome} ${e.linha.imp.email}`).includes(busca))
    : estado;

  function marcarTodas(valor: boolean) {
    setMarcas(Object.fromEntries(estado.map((e) => [e.linha.id, valor])));
  }

  const opcoesTime: OpcaoCombo[] = [
    { valor: NOVO_TIME, rotulo: "Criar um time novo" },
    ...times.filter((t) => !t.arquivado).map((t) => ({ valor: t.id, rotulo: t.nome, detalhe: plural(t.membroIds.length, "pessoa", "pessoas") })),
  ];
  const opcoesCategoria: OpcaoCombo[] = categorias
    .filter((c) => !c.arquivada)
    .map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      render: (
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: c.cor }} />
          <span className="truncate">{c.nome}</span>
        </span>
      ),
    }));

  async function importar() {
    if (gravando || !selecionadas.length) return;
    setGravando(true);
    setErroGravar("");
    const escolhidas = selecionadas.map((e) => e.linha.imp);
    const agora = agoraISO();
    let criadas = 0;
    let completadas = 0;
    let existentes = 0;
    const ids: string[] = [];

    const ok = await salvarPessoas((items) => {
      criadas = 0; completadas = 0; existentes = 0; ids.length = 0;
      const atual: Pessoa[] = [...items];
      for (const imp of escolhidas) {
        const c = compararComCadastro([imp], atual)[0];
        if (c.situacao === "nova" || !c.pessoa) {
          const p = normalizarPessoa({
            id: novoId("pe"), nome: imp.nome.trim(), email: imp.email, cargo: imp.cargo, area: imp.area,
            origem: "outlook", categoriaIds: categoriaSel ? [categoriaSel] : [],
          });
          atual.push(p);
          ids.push(p.id);
          criadas++;
          continue;
        }
        const pos = atual.findIndex((x) => x.id === c.pessoa!.id);
        let p = atual[pos];
        let mudou = false;
        // só preenche o que está vazio, nunca sobrescreve
        for (const campo of c.camposNovos) {
          if (!String(p[campo] ?? "").trim()) { p = { ...p, [campo]: imp[campo] }; mudou = true; }
        }
        if (c.camposNovos.length) completadas++; else existentes++;
        if (categoriaSel && !p.categoriaIds.includes(categoriaSel)) {
          p = { ...p, categoriaIds: [...p.categoriaIds, categoriaSel] };
          mudou = true;
        }
        if (mudou) atual[pos] = { ...p, atualizadaEm: agora };
        if (!ids.includes(p.id)) ids.push(p.id);
      }
      return atual;
    });

    if (!ok) {
      setGravando(false);
      setErroGravar("Não consegui gravar as pessoas. Nada foi alterado. Confira se a pasta de dados está acessível e tente de novo.");
      return;
    }

    let nomeTime = "";
    let aviso = "";
    if (timeSel) {
      const nomeAlvo = timeSel === NOVO_TIME ? timeNovo.trim() : "";
      const okTime = await salvarTimes((items) => {
        const existente = timeSel === NOVO_TIME
          ? items.find((t) => chaveNome(t.nome) === chaveNome(nomeAlvo))
          : items.find((t) => t.id === timeSel);
        if (existente) {
          nomeTime = existente.nome;
          return items.map((t) =>
            t.id === existente.id
              ? { ...t, membroIds: [...new Set([...t.membroIds, ...ids])], atualizadoEm: agora }
              : t,
          );
        }
        nomeTime = nomeAlvo;
        return [
          ...items,
          normalizarTime({ id: novoId("ti"), nome: nomeAlvo, cor: CORES[items.length % CORES.length], membroIds: ids }),
        ];
      });
      if (!okTime) {
        nomeTime = "";
        aviso = "As pessoas foram salvas, mas não consegui colocá-las no time. Abra o time e adicione os membros por lá.";
        toast("As pessoas entraram, mas o time não foi atualizado", "erro");
      }
    }

    const cat = categorias.find((c) => c.id === categoriaSel);
    setResumo({
      criadas, completadas, existentes, puladas: linhas.length - escolhidas.length,
      time: nomeTime, categoria: cat?.nome ?? "", aviso,
    });
    setGravando(false);
    setPasso(3);
  }

  const rodape = (
    <div className="flex w-full items-center justify-between gap-2">
      {passo === 1 && (
        <>
          <Button variant="ghost" onClick={fechar}>Cancelar</Button>
          <Button onClick={continuar} disabled={!reconhecidas.length} data-slot="importar-continuar">
            Continuar <ArrowRight />
          </Button>
        </>
      )}
      {passo === 2 && (
        <>
          <Button variant="ghost" onClick={() => setPasso(1)} disabled={gravando}><ArrowLeft /> Voltar</Button>
          <Button onClick={importar} disabled={!selecionadas.length || gravando || (timeSel === NOVO_TIME && !timeNovo.trim())} data-slot="importar-confirmar">
            {gravando ? "Gravando..." : `Importar ${plural(selecionadas.length, "pessoa", "pessoas")}`}
          </Button>
        </>
      )}
      {passo === 3 && (
        <>
          <Button variant="outline" onClick={reiniciar}>Importar mais</Button>
          <Button onClick={fechar}>Concluir</Button>
        </>
      )}
    </div>
  );

  const nTotal = linhas.length;
  const nNovas = estado.filter((e) => e.c.situacao === "nova").length;
  const nCompleta = estado.filter((e) => e.c.situacao === "completa").length;
  const nExiste = estado.filter((e) => e.c.situacao === "jaExiste").length;
  const todasMarcadas = estado.length > 0 && estado.every((e) => e.marcada || !e.valida);

  return (
    <Modal
      titulo="Importar do Outlook"
      descricao="Cadastre várias pessoas de uma vez, sem digitar."
      aberto={aberto}
      fechar={fechar}
      largo
      rodape={rodape}
    >
      <div data-slot="importar-pessoas" className="flex min-h-[340px] flex-col gap-4">
        <Indicador passo={passo} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={passo}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={suave}
            className="flex flex-col gap-4"
          >
            {passo === 1 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Segmentado<Caminho>
                    aria-label="De onde vêm os contatos"
                    valor={caminho}
                    aoMudar={setCaminho}
                    opcoes={[
                      { valor: "colar", rotulo: "Colar", icone: <ClipboardPaste /> },
                      { valor: "csv", rotulo: "Arquivo CSV", icone: <FileSpreadsheet /> },
                      { valor: "vcf", rotulo: "vCard (.vcf)", icone: <Contact /> },
                    ]}
                  />
                  <AvisoLocal />
                </div>

                {caminho === "colar" && (
                  <div className="flex flex-col gap-3">
                    <Lista
                      itens={[
                        "Abra um e-mail ou convite de reunião no Outlook.",
                        <>Clique no campo <strong className="text-foreground">Para</strong> (ou em <strong className="text-foreground">Participantes</strong>) e selecione os nomes com Ctrl+A.</>,
                        "Copie com Ctrl+C e cole aqui com Ctrl+V.",
                      ]}
                    />
                    <Textarea
                      data-slot="importar-colagem"
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder={EXEMPLO}
                      rows={8}
                      autoFocus
                      className="min-h-40 font-mono text-xs"
                      aria-label="Contatos copiados do Outlook"
                    />
                    <div className="flex items-center gap-2">
                      <Reconhecidos n={coladas.length} />
                      {texto.trim() && !coladas.length && (
                        <span className="text-xs text-muted-foreground">
                          Não achei nomes nem e-mails. Cole o conteúdo do campo Para ou uma lista com um contato por linha.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {caminho === "csv" && (
                  <div className="flex flex-col gap-3">
                    <Instrucao
                      titulo="Como exportar no Outlook clássico"
                      itens={[
                        <>Abra <strong className="text-foreground">Arquivo &gt; Abrir e Exportar &gt; Importar/Exportar</strong>.</>,
                        <>Escolha <strong className="text-foreground">Exportar para um arquivo</strong> e depois <strong className="text-foreground">Valores Separados por Vírgula</strong>.</>,
                        <>Selecione a pasta <strong className="text-foreground">Contatos</strong>, escolha onde salvar e conclua.</>,
                        "Traga o arquivo .csv para a área abaixo.",
                      ]}
                    />
                    <Instrucao
                      titulo="Como exportar no Outlook novo ou na web"
                      itens={[
                        <>Abra <strong className="text-foreground">Pessoas</strong> (ícone no menu lateral).</>,
                        <>Clique em <strong className="text-foreground">Gerenciar contatos &gt; Exportar contatos</strong>.</>,
                        "Escolha todos os contatos (ou uma pasta) e exporte.",
                        "Traga o arquivo .csv para a área abaixo.",
                      ]}
                    />
                    <AreaArquivo arquivo={leituras.csv.arquivo} aoMudar={(f) => void lerArquivo("csv", f)} />
                    {leituras.csv.arquivo && <ResultadoLeitura leitura={leituras.csv} />}
                  </div>
                )}

                {caminho === "vcf" && (
                  <div className="flex flex-col gap-3">
                    <Lista
                      itens={[
                        <>Abra o contato no Outlook e use <strong className="text-foreground">Salvar como &gt; vCard</strong>, ou arraste o contato para uma pasta.</>,
                        "Um arquivo .vcf pode ter vários contatos. Traga-o para a área abaixo.",
                      ]}
                    />
                    <AreaArquivo arquivo={leituras.vcf.arquivo} aoMudar={(f) => void lerArquivo("vcf", f)} />
                    {leituras.vcf.arquivo && <ResultadoLeitura leitura={leituras.vcf} />}
                  </div>
                )}
              </>
            )}

            {passo === 2 && (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="sucesso">{plural(nNovas, "nova", "novas")}</Badge>
                    {nCompleta > 0 && <Badge variant="info">{nCompleta} completa{nCompleta === 1 ? "" : "m"}</Badge>}
                    {nExiste > 0 && <Badge variant="secondary">{plural(nExiste, "já existe", "já existem")}</Badge>}
                  </div>
                  <span className="text-[13px] text-muted-foreground tabular-nums" data-slot="importar-contagem">
                    {selecionadas.length} de {nTotal} vão entrar
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {nTotal > 15 && (
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={filtro}
                          onChange={(e) => setFiltro(e.target.value)}
                          placeholder="Filtrar por nome ou e-mail"
                          aria-label="Filtrar contatos"
                          className="h-7 w-56 pl-8"
                        />
                      </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => marcarTodas(true)} disabled={todasMarcadas}>Marcar todas</Button>
                    <Button variant="ghost" size="sm" onClick={() => marcarTodas(false)} disabled={!selecionadas.length}>Nenhuma</Button>
                  </div>
                </div>

                <div className="max-h-[40vh] overflow-y-auto rounded-xl" data-slot="importar-tabela">
                  <Table>
                    <THead>
                      <Tr className="hover:bg-transparent">
                        <Th className="w-9" />
                        <Th>Nome</Th>
                        <Th>E-mail</Th>
                        <Th>Cargo</Th>
                        <Th>Área</Th>
                        <Th>Situação</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {visiveis.map(({ linha, c, valida, marcada }) => (
                        <Tr key={linha.id} data-slot="importado" data-situacao={c.situacao} className={cn(!marcada && "opacity-60")}>
                          <Td>
                            <Checkbox
                              checked={marcada}
                              disabled={!valida}
                              onCheckedChange={(v) => setMarcas((m) => ({ ...m, [linha.id]: v === true }))}
                              aria-label={`Importar ${linha.imp.nome || "contato"}`}
                            />
                          </Td>
                          <Td className="min-w-44">
                            <div className="flex items-center gap-2">
                              <AvatarPessoa nome={linha.imp.nome || "?"} tamanho="sm" />
                              <Input
                                value={linha.imp.nome}
                                onChange={(e) => mudarNome(linha.id, e.target.value)}
                                aria-label="Nome"
                                placeholder="Nome obrigatório"
                                className={cn("h-7 min-w-36 px-2", !valida && "border-destructive")}
                              />
                            </div>
                          </Td>
                          <Td className="max-w-52 truncate text-muted-foreground">{linha.imp.email || "·"}</Td>
                          <Td className="max-w-40 truncate text-muted-foreground">{linha.imp.cargo || "·"}</Td>
                          <Td className="max-w-40 truncate text-muted-foreground">{linha.imp.area || "·"}</Td>
                          <Td className="min-w-40">
                            {c.situacao === "nova" && <Badge variant="sucesso">Nova</Badge>}
                            {c.situacao === "jaExiste" && (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="secondary" className="w-fit">Já existe</Badge>
                                {c.pessoa && <span className="text-[11px] text-muted-foreground">com {c.pessoa.nome}</span>}
                              </div>
                            )}
                            {c.situacao === "completa" && (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="info" className="w-fit">Completa o cadastro</Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  Preenche {c.camposNovos.map((k) => ROTULO_CAMPO[k]).join(", ")} de {c.pessoa?.nome}
                                </span>
                              </div>
                            )}
                          </Td>
                        </Tr>
                      ))}
                      {!visiveis.length && (
                        <Tr className="hover:bg-transparent">
                          <Td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum contato com esse filtro.</Td>
                        </Tr>
                      )}
                    </TBody>
                  </Table>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium"><Users className="size-3.5 text-muted-foreground" /> Colocar todas num time</span>
                    <Combobox
                      aria-label="Time"
                      valor={timeSel}
                      aoMudar={setTimeSel}
                      opcoes={opcoesTime}
                      placeholder="Nenhum time"
                      buscaPlaceholder="Buscar time"
                      rotuloLimpar="Nenhum time"
                    />
                    {timeSel === NOVO_TIME && (
                      <Input
                        data-slot="importar-time-novo"
                        value={timeNovo}
                        onChange={(e) => setTimeNovo(e.target.value)}
                        placeholder="Nome do time novo"
                        aria-label="Nome do time novo"
                        autoFocus
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium"><Tag className="size-3.5 text-muted-foreground" /> Ligar a uma categoria</span>
                    <Combobox
                      aria-label="Categoria"
                      valor={categoriaSel}
                      aoMudar={setCategoriaSel}
                      opcoes={opcoesCategoria}
                      placeholder="Nenhuma categoria"
                      buscaPlaceholder="Buscar categoria"
                      rotuloLimpar="Nenhuma categoria"
                    />
                  </div>
                </div>

                {erroGravar && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-[13px] text-destructive">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {erroGravar}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Quem já está no cadastro nunca é duplicado, e campos que já têm valor nunca são sobrescritos.
                </p>
              </>
            )}

            {passo === 3 && resumo && (
              <div data-slot="importar-resumo" className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-sucesso/14 text-sucesso"><Check className="size-5" /></span>
                  <div>
                    <p className="text-sm font-semibold">Importação concluída</p>
                    <p className="text-[13px] text-muted-foreground">Os dados já estão gravados na sua pasta.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Numero valor={resumo.criadas} rotulo={resumo.criadas === 1 ? "criada" : "criadas"} destaque />
                  <Numero valor={resumo.completadas} rotulo={resumo.completadas === 1 ? "completada" : "completadas"} />
                  <Numero valor={resumo.puladas} rotulo={resumo.puladas === 1 ? "pulada" : "puladas"} />
                </div>
                {(resumo.time || resumo.categoria || resumo.existentes > 0) && (
                  <ul className="flex flex-col gap-1.5 text-[13px]">
                    {resumo.time && <li className="flex items-center gap-2"><Users className="size-3.5 text-muted-foreground" /> Time: <strong>{resumo.time}</strong></li>}
                    {resumo.categoria && <li className="flex items-center gap-2"><Tag className="size-3.5 text-muted-foreground" /> Categoria: <strong>{resumo.categoria}</strong></li>}
                    {resumo.existentes > 0 && (
                      <li className="flex items-center gap-2 text-muted-foreground">
                        <UserPlus className="size-3.5" /> {plural(resumo.existentes, "pessoa já cadastrada foi só ligada", "pessoas já cadastradas foram só ligadas")} ao time ou à categoria.
                      </li>
                    )}
                  </ul>
                )}
                {resumo.aviso && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg border border-alerta/30 bg-alerta/10 px-3 py-2 text-[13px] text-alerta">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {resumo.aviso}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}

function ResultadoLeitura({ leitura }: { leitura: Leitura }) {
  if (leitura.erro) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-[13px] text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        {leitura.erro}
      </p>
    );
  }
  return <div><Reconhecidos n={leitura.pessoas.length} /></div>;
}

function Numero({ valor, rotulo, destaque }: { valor: number; rotulo: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-xs">
      <div className={cn("text-2xl font-semibold tabular-nums", destaque && "text-primary")}>{valor}</div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
    </div>
  );
}
