"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, ExternalLink, Library, ListTodo, MessagesSquare, Search, SearchX, Sparkles, Users } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { hrefLink } from "@/components/LinkForm";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { IconeLink, enderecoCurto } from "@/components/links/IconeLink";
import { montarPessoas } from "@/components/pessoas/dados";
import {
  AvatarPessoa, CatTag, ChipPessoa, Destaque, Etiqueta, IconeStatus, IconeTipo, Pagina, PontoCor, PrazoTag, PrioBadge, Secao, StatusBadge, TipoBadge, Vazio,
} from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { Kbd } from "@/components/ui/diversos";
import { itemLista, lista as cascata } from "@/lib/animacoes";
import { LinkDoc, Pessoa, Registro, STATUS_ABERTOS, Tarefa, Time, formatarData, semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export default function Busca() {
  return <Suspense><Conteudo /></Suspense>;
}

/** Palavras da busca. Um resultado precisa ter TODAS, em qualquer ordem e em qualquer campo. */
const palavrasDe = (termo: string) => semAcento(termo).split(/\s+/).filter(Boolean);

/** Recorte do texto em volta da busca: a frase inteira se aparecer junta, senão a primeira palavra encontrada. */
function trecho(texto: string, termo: string) {
  const base = semAcento(texto);
  let alvo = semAcento(termo);
  let i = base.indexOf(alvo);
  if (i < 0)
    for (const w of palavrasDe(termo)) {
      const j = base.indexOf(w);
      if (j >= 0 && (i < 0 || j < i)) { i = j; alvo = w; }
    }
  if (i < 0) return texto.slice(0, 180);
  const ini = Math.max(0, i - 80);
  return (ini > 0 ? "…" : "") + texto.slice(ini, i + alvo.length + 120) + (i + alvo.length + 120 < texto.length ? "…" : "");
}

type Aba = "tudo" | "tarefas" | "registros" | "links" | "pessoas";
// Mesma ordem dos campos pesquisados em cada registro.
const CAMPOS_REGISTRO = ["Título", "Resumo", "Anotações", "Decisões", "Impedimentos", "Participantes", "Próximos passos"];

interface AchadoRegistro { t: Tarefa; reg: Registro; achado: string; campo: number }
interface AchadoPessoa { pessoa: Pessoa; rotulo: string; texto: string; termo: string }
interface AchadoTime { time: Time; rotulo: string; texto: string; termo: string }

// Palavras de pergunta que não ajudam a achar ninguém ("quem me ajuda com deploy?").
const PALAVRAS_VAZIAS = new Set(["quem", "ajuda", "ajudar", "pode", "podem", "para", "sobre", "como", "algu", "alguem", "pessoa", "pessoas", "time", "times", "tem", "falar", "procurar"]);

/** Termos para casar texto livre do cadastro: a busca inteira, ou (se não achar) as palavras que importam. */
function termosDoCadastro(termo: string): string[] {
  const palavras = semAcento(termo).split(/[^\p{L}\p{N}@._-]+/u).filter((w) => w.length >= 4 && !PALAVRAS_VAZIAS.has(w));
  return palavras.length > 1 || (palavras.length === 1 && palavras[0] !== semAcento(termo)) ? palavras : [];
}

/** Primeiro campo que contém a busca (ou todas as palavras relevantes dela). */
function acharCampo(campos: [string, string][], termo: string): { rotulo: string; texto: string; termo: string } | null {
  const inteira = campos.find(([, c]) => c && semAcento(c).includes(semAcento(termo)));
  if (inteira) return { rotulo: inteira[0], texto: inteira[1], termo };
  const palavras = termosDoCadastro(termo);
  if (!palavras.length) return null;
  const tudo = semAcento(campos.map(([, c]) => c).join(" "));
  if (!palavras.every((w) => tudo.includes(w))) return null;
  const onde = campos.find(([, c]) => c && palavras.some((w) => semAcento(c).includes(w)));
  if (!onde) return null;
  return { rotulo: onde[0], texto: onde[1], termo: palavras.find((w) => semAcento(onde[1]).includes(w))! };
}

function Conteudo() {
  const { dados } = useNexo();
  const router = useRouter();
  const q = (useSearchParams().get("q") || "").trim();
  const [texto, setTexto] = useState(q);
  const [aba, setAba] = useState<Aba>("tudo");
  const campo = useRef<HTMLInputElement>(null);
  const resultados = useRef<HTMLDivElement>(null);

  // A URL é a fonte quando muda por fora (busca global da moldura, voltar/avançar);
  // quando quem mudou foi este campo, a navegação pode chegar atrasada e não deve desfazer o que foi digitado depois.
  const ultimo = useRef(q);
  const pendentes = useRef(new Set<string>());
  useEffect(() => {
    if (q === ultimo.current) { pendentes.current.clear(); return; }
    if (pendentes.current.has(q)) return;
    ultimo.current = q;
    pendentes.current.clear();
    setTexto(q);
  }, [q]);

  const irPara = useCallback((valor: string) => {
    const termo = valor.trim();
    if (termo === ultimo.current) return;
    ultimo.current = termo;
    pendentes.current.add(termo);
    router.replace(termo ? `/busca?q=${encodeURIComponent(termo)}` : "/busca", { scroll: false });
  }, [router]);

  // Enquanto digita, a URL acompanha com um pequeno atraso (Enter atualiza na hora).
  useEffect(() => {
    const id = setTimeout(() => irPara(texto), 350);
    return () => clearTimeout(id);
  }, [texto, irPara]);

  // Chegou na tela: o cursor já fica no campo, no fim do texto.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const termo = useDeferredValue(texto.trim());
  const n = semAcento(termo);

  const r = useMemo(() => {
    if (!n) return { tarefas: [] as Tarefa[], registros: [] as AchadoRegistro[], links: [] as LinkDoc[], cadastro: [] as AchadoPessoa[], times: [] as AchadoTime[] };
    const palavras = palavrasDe(n);
    const tem = (s: string) => { const x = semAcento(s); return palavras.every((w) => x.includes(w)); };
    const quantas = (s: string) => { const x = semAcento(s); return palavras.filter((w) => x.includes(w)).length; };
    const tarefas = dados!.tarefas.filter((t) => tem(`${t.titulo} ${t.descricao} ${t.tags.join(" ")} ${t.panoramaIA?.texto ?? ""}`));
    const registros = dados!.tarefas.flatMap((t) =>
      t.registros
        .map((reg) => {
          const campos = [reg.titulo, reg.resumoIA, reg.anotacoes, reg.decisoes, reg.impedimentos,
            reg.participantes.join(", "), reg.proximosPassos.map((p) => `${p.texto} ${p.responsavel}`).join("\n")];
          if (!tem(campos.join("\n"))) return null;
          // Mostra o campo que tem a busca inteira; se as palavras estão espalhadas, o que tem mais delas.
          let i = campos.findIndex((c) => c && semAcento(c).includes(n));
          if (i < 0) i = campos.reduce((melhor, c, j) => (quantas(c) > quantas(campos[melhor]) ? j : melhor), 0);
          return { t, reg, achado: campos[i], campo: i };
        })
        .filter(Boolean) as AchadoRegistro[],
    ).sort((a, b) => b.reg.data.localeCompare(a.reg.data));
    const links = dados!.links.items.filter((l) => tem(`${l.titulo} ${l.descricao} ${l.url} ${l.nomeArquivo} ${l.tags.join(" ")}`));
    const cadastro = (dados!.pessoas?.items ?? []).flatMap((pessoa) => {
      const a = acharCampo([
        ["Nome", pessoa.nome], ["Apelido", pessoa.apelidos.join(", ")], ["E-mail", pessoa.email], ["Cargo", pessoa.cargo],
        ["Área", pessoa.area], ["Ajuda com", pessoa.ajudaCom], ["Anotações", pessoa.anotacoes], ["Tags", pessoa.tags.join(", ")],
      ], termo);
      return a ? [{ pessoa, ...a }] : [];
    });
    const times = (dados!.times?.items ?? []).flatMap((time) => {
      const a = acharCampo([["Nome", time.nome], ["Descrição", time.descricao]], termo);
      return a ? [{ time, ...a }] : [];
    });
    return { tarefas, registros, links, cadastro, times };
  }, [dados, n, termo]);

  const pessoas = useMemo(() => (n ? montarPessoas(dados!.tarefas).filter((p) => p.chave.includes(n)).slice(0, 6) : []), [dados, n]);
  const sugestoes = useMemo(() => {
    if (n) return [];
    const gente = montarPessoas(dados!.tarefas).sort((a, b) => b.regs.length - a.regs.length).slice(0, 3).map((p) => p.nome);
    const contagem = new Map<string, number>();
    for (const t of [...dados!.tarefas.flatMap((x) => x.tags), ...dados!.links.items.flatMap((x) => x.tags)]) contagem.set(t, (contagem.get(t) || 0) + 1);
    const tags = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
    return [...new Set([...gente, ...tags])];
  }, [dados, n]);

  const qtdPessoas = r.cadastro.length + r.times.length;
  const total = r.tarefas.length + r.registros.length + r.links.length + qtdPessoas;
  const cat = (id: string | null) => dados!.categorias.items.find((c) => c.id === id);
  const mostra = (a: Exclude<Aba, "tudo">) => aba === "tudo" || aba === a;
  const nesta = aba === "tudo" ? total : aba === "pessoas" ? qtdPessoas : r[aba].length;

  // Setas percorrem os resultados como numa lista de app de desktop.
  const mover = (delta: number) => {
    const itens = [...(resultados.current?.querySelectorAll<HTMLElement>("[data-slot=resultado] > a") ?? [])];
    if (!itens.length) return false;
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const prox = i + delta;
    if (prox < 0) { campo.current?.focus(); return true; }
    itens[Math.min(prox, itens.length - 1)]?.focus();
    return true;
  };

  const rotuloAba = (nome: string, qtd: number): ReactNode => (
    <>
      {nome}
      <span className={cn("text-[11px] tabular-nums", qtd ? "text-muted-foreground" : "text-muted-foreground/50")}>{qtd}</span>
    </>
  );

  return (
    <Pagina
      estreita
      titulo="Busca"
      descricao="Procura em tarefas, registros da linha do tempo e links, ignorando acentos e maiúsculas."
      barra={
        <>
          <CampoBusca
            grande
            ref={campo}
            className="w-full"
            valor={texto}
            aoMudar={setTexto}
            placeholder="Buscar em tarefas, registros e links..."
            aria-label="Buscar em tudo"
            data-slot="busca-campo"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); irPara(texto); }
              else if (e.key === "ArrowDown" && mover(1)) e.preventDefault();
            }}
          />
          {n && total > 0 && (
            <>
              <Segmentado
                aria-label="Mostrar"
                valor={aba}
                aoMudar={setAba}
                opcoes={[
                  { valor: "tudo", rotulo: rotuloAba("Tudo", total) },
                  { valor: "tarefas", rotulo: rotuloAba("Tarefas", r.tarefas.length) },
                  { valor: "registros", rotulo: rotuloAba("Registros", r.registros.length) },
                  { valor: "links", rotulo: rotuloAba("Links", r.links.length) },
                  { valor: "pessoas", rotulo: rotuloAba("Pessoas", qtdPessoas) },
                ]}
              />
              <span data-slot="contagem" className="ml-auto text-xs text-muted-foreground tabular-nums sem-selecao">
                {total} {total === 1 ? "resultado" : "resultados"} para “{termo}”
              </span>
            </>
          )}
        </>
      }
    >
      {!n ? (
        <Convite sugestoes={sugestoes} aoEscolher={(s) => { setTexto(s); campo.current?.focus(); }} />
      ) : total === 0 ? (
        <Vazio titulo={`Nada encontrado para “${termo}”`} icone={<SearchX />}>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-left">
            <li>Tente uma palavra só, ou um pedaço dela: a busca procura o trecho do jeito que foi digitado.</li>
            <li>Nome de pessoa, tag e trecho de anotação também valem.</li>
            <li>Tarefas que estão na lixeira não entram na busca.</li>
          </ul>
          <Button variant="outline" onClick={() => { setTexto(""); campo.current?.focus(); }}>Limpar a busca</Button>
        </Vazio>
      ) : (
        <div
          ref={resultados}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && mover(1)) e.preventDefault();
            else if (e.key === "ArrowUp" && mover(-1)) e.preventDefault();
          }}
        >
          {pessoas.length > 0 && (
            <div data-slot="atalho-pessoas" className="mb-5 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-xs text-muted-foreground">Ir para a pessoa</span>
              {pessoas.map((p) => (
                <ChipPessoa key={p.chave} nome={p.nome} href={`/pessoas?p=${encodeURIComponent(p.nome)}`} extra={p.regs.length || undefined} />
              ))}
            </div>
          )}

          {nesta === 0 && (
            <Vazio compacto titulo={aba === "tarefas" ? "Nenhuma tarefa com esse termo" : aba === "registros" ? "Nenhum registro com esse termo" : aba === "pessoas" ? "Nenhuma pessoa ou time com esse termo" : "Nenhum link com esse termo"} icone={<SearchX />}>
              <p>{total === 1 ? "Há 1 resultado em outra seção." : `Há ${total} resultados nas outras seções.`}</p>
              <Button variant="outline" size="sm" onClick={() => setAba("tudo")}>Ver tudo</Button>
            </Vazio>
          )}

          {mostra("tarefas") && r.tarefas.length > 0 && (
            <Secao titulo="Tarefas" icone={<ListTodo />} contagem={r.tarefas.length}>
              <ListaResultados>
                {r.tarefas.map((t) => {
                  const noTexto = [t.descricao, t.panoramaIA?.texto ?? ""].find((c) => c && palavrasDe(n).some((w) => semAcento(c).includes(w)));
                  const fonte = noTexto ?? t.descricao;
                  const doPanorama = Boolean(noTexto) && noTexto !== t.descricao;
                  return (
                    <Resultado key={t.id} tipo="tarefa">
                      <MenuContextoTarefa tarefa={t}>
                        <Link href={`/tarefas/${t.id}`} className={CLASSE_RESULTADO}>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <StatusBadge status={t.status} />
                              <CatTag cat={cat(t.categoriaId)} />
                              <PrazoTag prazo={t.prazo} concluida={!STATUS_ABERTOS.includes(t.status)} />
                            </div>
                            <h3 className="mt-1.5 text-sm leading-snug font-medium"><Destaque texto={t.titulo} termo={termo} /></h3>
                            {fonte && (
                              <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground [&_mark]:text-foreground">
                                {doPanorama && <RotuloCampo>Panorama</RotuloCampo>}
                                <Destaque texto={trecho(fonte, termo)} termo={termo} />
                              </p>
                            )}
                            {t.tags.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {t.tags.map((x) => <Etiqueta key={x}><Destaque texto={x} termo={termo} /></Etiqueta>)}
                              </div>
                            )}
                          </div>
                          <PrioBadge p={t.prioridade} semDica />
                          <Seta />
                        </Link>
                      </MenuContextoTarefa>
                    </Resultado>
                  );
                })}
              </ListaResultados>
            </Secao>
          )}

          {mostra("registros") && r.registros.length > 0 && (
            <Secao titulo="Registros na linha do tempo" icone={<MessagesSquare />} contagem={r.registros.length}>
              <ListaResultados>
                {r.registros.map(({ t, reg, achado, campo: onde }) => {
                  const apoio = reg.resumoIA || reg.anotacoes;
                  // Nos próximos passos, mostra só o passo que bateu (o campo pesquisado junta todos).
                  const passo = onde === 6 ? reg.proximosPassos.find((p) => palavrasDe(n).some((w) => semAcento(`${p.texto} ${p.responsavel}`).includes(w))) : undefined;
                  const mostrado = passo ? `${passo.texto}${passo.responsavel ? ` (${passo.responsavel})` : ""}` : achado;
                  return (
                    <Resultado key={t.id + reg.id} tipo="registro">
                      <Link href={`/tarefas/${t.id}?r=${encodeURIComponent(reg.id)}`} className={CLASSE_RESULTADO}>
                        <IconeTipo tipo={reg.tipo} comFundo className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground tabular-nums">{formatarData(reg.data)}</span>
                            <TipoBadge tipo={reg.tipo} />
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <IconeStatus status={t.status} className="size-3" />
                              <span className="truncate">{t.titulo}</span>
                            </span>
                          </div>
                          {reg.titulo && <h3 className="mt-1 text-sm leading-snug font-medium"><Destaque texto={reg.titulo} termo={termo} /></h3>}
                          {onde === 0 ? (
                            apoio && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground [&_mark]:text-foreground">{trecho(apoio, termo)}</p>
                          ) : (
                            <p className="mt-0.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground [&_mark]:text-foreground">
                              <RotuloCampo>{CAMPOS_REGISTRO[onde]}</RotuloCampo>
                              <Destaque texto={trecho(mostrado, termo)} termo={termo} />
                            </p>
                          )}
                        </div>
                        <Seta />
                      </Link>
                    </Resultado>
                  );
                })}
              </ListaResultados>
            </Secao>
          )}

          {mostra("pessoas") && r.cadastro.length > 0 && (
            <Secao titulo="Pessoas" icone={<Users />} contagem={r.cadastro.length}>
              <ListaResultados>
                {r.cadastro.map(({ pessoa, rotulo, texto, termo: achou }) => {
                  const funcao = [pessoa.cargo, pessoa.area].filter(Boolean).join(" · ");
                  return (
                    <Resultado key={pessoa.id} tipo="pessoa">
                      <Link href={`/pessoas?p=${encodeURIComponent(pessoa.nome)}`} className={CLASSE_RESULTADO}>
                        <AvatarPessoa nome={pessoa.nome} tamanho="lg" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm leading-snug font-medium"><Destaque texto={pessoa.nome} termo={achou} /></h3>
                          {funcao && <p className="text-xs text-muted-foreground [&_mark]:text-foreground"><Destaque texto={funcao} termo={achou} /></p>}
                          {rotulo !== "Nome" && (
                            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground [&_mark]:text-foreground">
                              <RotuloCampo>{rotulo}</RotuloCampo>
                              <Destaque texto={trecho(texto, achou)} termo={achou} />
                            </p>
                          )}
                        </div>
                        <Seta />
                      </Link>
                    </Resultado>
                  );
                })}
              </ListaResultados>
            </Secao>
          )}

          {mostra("pessoas") && r.times.length > 0 && (
            <Secao titulo="Times" icone={<Users />} contagem={r.times.length}>
              <ListaResultados>
                {r.times.map(({ time, rotulo, texto, termo: achou }) => (
                  <Resultado key={time.id} tipo="time">
                    <Link href={`/pessoas?time=${encodeURIComponent(time.id)}`} className={CLASSE_RESULTADO}>
                      <span className="mt-1 inline-flex size-6 shrink-0 items-center justify-center"><PontoCor cor={time.cor} className="size-3" /></span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm leading-snug font-medium"><Destaque texto={time.nome} termo={achou} /></h3>
                        {rotulo !== "Nome" && (
                          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground [&_mark]:text-foreground">
                            <RotuloCampo>{rotulo}</RotuloCampo>
                            <Destaque texto={trecho(texto, achou)} termo={achou} />
                          </p>
                        )}
                      </div>
                      <Seta />
                    </Link>
                  </Resultado>
                ))}
              </ListaResultados>
            </Secao>
          )}

          {mostra("links") && r.links.length > 0 && (
            <Secao titulo="Links e documentos" icone={<Library />} contagem={r.links.length}>
              <ListaResultados>
                {r.links.map((l) => (
                  <Resultado key={l.id} tipo="link">
                    <a href={hrefLink(l)} target="_blank" rel="noreferrer" className={CLASSE_RESULTADO}>
                      <IconeLink link={l} />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm leading-snug font-medium"><Destaque texto={l.titulo} termo={termo} /></h3>
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground [&_mark]:text-foreground">
                          {l.descricao && <Destaque texto={l.descricao} termo={termo} />}
                          {l.descricao && enderecoCurto(l) && <span className="text-muted-foreground/60"> · </span>}
                          <span className={l.descricao ? "text-muted-foreground/70" : undefined}><Destaque texto={enderecoCurto(l)} termo={termo} /></span>
                        </p>
                        {l.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {l.tags.map((x) => <Etiqueta key={x}><Destaque texto={x} termo={termo} /></Etiqueta>)}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover/resultado:text-foreground" />
                    </a>
                  </Resultado>
                ))}
              </ListaResultados>
            </Secao>
          )}
        </div>
      )}
    </Pagina>
  );
}

const CLASSE_RESULTADO =
  "group/resultado flex items-start gap-3 px-3.5 py-3 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:ring-inset data-[state=open]:bg-muted/40";

function ListaResultados({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={cascata} initial="escondido" animate="visivel" className="overflow-hidden rounded-xl border bg-card shadow-xs">
      {children}
    </motion.div>
  );
}

function Resultado({ tipo, children }: { tipo: "tarefa" | "registro" | "link" | "pessoa" | "time"; children: ReactNode }) {
  return (
    <motion.div data-slot="resultado" data-tipo={tipo} variants={itemLista} className="border-b last:border-0">
      {children}
    </motion.div>
  );
}

function RotuloCampo({ children }: { children: ReactNode }) {
  return <span className="mr-1.5 rounded bg-muted px-1 py-px text-[11px] font-medium text-muted-foreground">{children}</span>;
}

function Seta() {
  return <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-[color,transform] duration-150 group-hover/resultado:translate-x-0.5 group-hover/resultado:text-foreground" />;
}

const COBERTURA = [
  { icone: <ListTodo />, titulo: "Tarefas", texto: "Título, descrição, tags e o último panorama." },
  { icone: <MessagesSquare />, titulo: "Registros", texto: "Título, resumo, anotações, decisões, impedimentos, participantes e próximos passos." },
  { icone: <Library />, titulo: "Links e documentos", texto: "Título, descrição, endereço, nome do arquivo e tags." },
];

function Convite({ sugestoes, aoEscolher }: { sugestoes: string[]; aoEscolher: (s: string) => void }) {
  return (
    <motion.div data-slot="busca-convite" variants={cascata} initial="escondido" animate="visivel" className="mx-auto flex max-w-2xl flex-col items-center pt-8 text-center">
      <motion.span variants={itemLista} className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
        <Search className="size-5" />
      </motion.span>
      <motion.h2 variants={itemLista} className="mt-4 text-base font-semibold tracking-tight">O que você quer achar?</motion.h2>
      <motion.p variants={itemLista} className="mt-1 max-w-md text-[13px] text-muted-foreground">
        Digite um nome, um sistema, uma decisão ou qualquer pedaço de anotação. Não precisa de acento nem de maiúscula.
      </motion.p>

      {sugestoes.length > 0 && (
        <motion.div variants={itemLista} className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> Experimente</span>
          {sugestoes.map((s) => (
            <button key={s} type="button" data-slot="busca-sugestao" onClick={() => aoEscolher(s)}
              className="inline-flex h-6 items-center rounded-full border bg-card px-2.5 text-xs font-medium transition-colors outline-none hover:border-ring/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35">
              {s}
            </button>
          ))}
        </motion.div>
      )}

      <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-3">
        {COBERTURA.map((c) => (
          <motion.div key={c.titulo} variants={itemLista} className="rounded-xl border bg-card p-3.5 shadow-xs">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-3.5">{c.icone}</span>
            <h3 className="mt-2.5 text-[13px] font-semibold">{c.titulo}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.texto}</p>
          </motion.div>
        ))}
      </div>

      <motion.p variants={itemLista} className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground sem-selecao">
        <Kbd>/</Kbd> busca de qualquer tela
        <span className="mx-1 text-muted-foreground/40">·</span>
        <Kbd>↓</Kbd><Kbd>↑</Kbd> percorrem os resultados
        <span className="mx-1 text-muted-foreground/40">·</span>
        <Kbd>Enter</Kbd> abre
      </motion.p>
    </motion.div>
  );
}
