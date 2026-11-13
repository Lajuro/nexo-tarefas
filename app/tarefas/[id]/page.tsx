"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { TarefaForm, aplicarStatus } from "@/components/TarefaForm";
import { RegistroEditor } from "@/components/RegistroEditor";
import { PassosTarefa } from "@/components/PassosTarefa";
import { PromptModal } from "@/components/PromptModal";
import { LinkForm, hrefLink } from "@/components/LinkForm";
import { CatTag, CobrarTag, PrazoTag, PrioBadge, Vazio, formatarTamanho } from "@/components/ui";
import { promptPanorama, promptPrepararReuniao } from "@/lib/prompts";
import { Rascunho, apagarRascunho, listarRascunhos } from "@/lib/rascunhos";
import {
  Registro, STATUS, STATUS_ESPERA, Status, Tarefa, TipoRegistro, agoraISO, formatarData, formatarDataHora, marcarPasso, nomeStatus,
  ordenarRegistros, tipoInfo,
} from "@/lib/tipos";

export default function PaginaTarefa() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { dados, atualizarTarefa, excluirTarefa, salvarLinks } = useNexo();
  const tarefa = dados!.tarefas.find((t) => t.id === id);
  const [editando, setEditando] = useState(false);
  const [editor, setEditor] = useState<{ aberto: boolean; registro?: Registro | null; tipo?: TipoRegistro }>({ aberto: false });
  const [prompt, setPrompt] = useState<null | "panorama" | "reuniao">(null);
  const [linkForm, setLinkForm] = useState(false);
  const [recentes, setRecentes] = useState(false);
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);

  // Rascunhos de registro que ficaram sem salvar (editor fechado, F5, navegador travado).
  // Relê sempre que o editor fecha.
  useEffect(() => {
    if (!editor.aberto) setRascunhos(listarRascunhos(id));
  }, [editor.aberto, id]);

  useEffect(() => {
    try { setRecentes(localStorage.getItem("nexo:recentesPrimeiro") === "1"); } catch {}
  }, []);

  const cat = dados!.categorias.items.find((c) => c.id === tarefa?.categoriaId);
  const links = dados!.links.items.filter((l) => l.tarefaId === id);
  const pessoas = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of tarefa?.registros ?? []) for (const p of r.participantes) m.set(p, (m.get(p) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tarefa]);

  // nomes já usados em qualquer tarefa, para sugerir em "quem"
  const todasPessoas = useMemo(() => {
    const s = new Set<string>();
    for (const t of dados!.tarefas) {
      for (const r of t.registros) {
        r.participantes.forEach((p) => s.add(p));
        r.proximosPassos.forEach((p) => p.responsavel && s.add(p.responsavel));
      }
      (t.passos ?? []).forEach((p) => p.responsavel && s.add(p.responsavel));
      if (t.aguardandoQuem) s.add(t.aguardandoQuem);
    }
    s.delete("Eu");
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [dados]);

  if (!tarefa) {
    return (
      <Vazio titulo="Tarefa não encontrada">
        <Link className="btn" href="/">Voltar ao painel</Link>
      </Vazio>
    );
  }

  const regs = ordenarRegistros(tarefa.registros, recentes);

  const alternarPasso = (passoId: string, feito: boolean) => atualizarTarefa(tarefa.id, (t) => marcarPasso(t, passoId, feito));

  const mudarStatus = (s: Status) => atualizarTarefa(tarefa.id, (t) => aplicarStatus(t, s, t));

  return (
    <>
      <div className="migalha">
        <Link href="/">Tarefas</Link> /
        {cat ? <Link href={`/categorias/${cat.id}`}>{cat.nome}</Link> : <span>Sem categoria</span>}
      </div>

      <section className="tarefa-topo">
        <div className="card-topo">
          <h1>{tarefa.titulo}</h1>
          <div className="acoes">
            <button className="btn pequeno" onClick={() => setEditando(true)}>Editar</button>
            <button className="btn pequeno perigo" onClick={async () => {
              if (confirm("Mover esta tarefa para a lixeira? Dá pra restaurar depois em Configurações.")) {
                if (await excluirTarefa(tarefa.id)) router.push("/");
              }
            }}>Excluir</button>
          </div>
        </div>
        <div className="card-meta">
          <CatTag cat={cat} />
          <select value={tarefa.status} onChange={(e) => mudarStatus(e.target.value as Status)} aria-label="Status">
            {STATUS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <span className="acoes" style={{ gap: 6 }}>Prioridade <PrioBadge p={tarefa.prioridade} /></span>
          <PrazoTag prazo={tarefa.prazo} concluida={tarefa.status === "concluida"} />
          <span>Criada em {formatarData(tarefa.criadaEm)}</span>
          {tarefa.tags.map((t) => <span key={t} className="chip so-leitura">{t}</span>)}
        </div>
        {STATUS_ESPERA.includes(tarefa.status) && <EsperaLinha tarefa={tarefa} pessoas={todasPessoas} />}
        {tarefa.descricao && <p className="desc">{tarefa.descricao}</p>}
        <div className="barra-ia">
          <span className="rotulo">Copilot</span>
          <button className="btn pequeno" onClick={() => setPrompt("panorama")}>📊 Panorama da tarefa</button>
          <button className="btn pequeno" onClick={() => setPrompt("reuniao")}>🗓️ Preparar próxima reunião</button>
        </div>
      </section>

      <div className="tarefa-layout">
        <section>
          <div className="timeline-topo">
            <h2>Linha do tempo <span className="contador">{tarefa.registros.length}</span></h2>
            <div className="acoes">
              <button className="btn fantasma pequeno" onClick={() => {
                setRecentes(!recentes);
                try { localStorage.setItem("nexo:recentesPrimeiro", recentes ? "0" : "1"); } catch {}
              }}>
                {recentes ? "↑ Mais recentes primeiro" : "↓ Mais antigos primeiro"}
              </button>
              <button className="btn pequeno" onClick={() => setEditor({ aberto: true, tipo: "atividade" })}>🛠️ Atividade</button>
              <button className="btn pequeno" onClick={() => setEditor({ aberto: true, tipo: "impedimento" })}>⛔ Impedimento</button>
              <button className="btn primario pequeno" onClick={() => setEditor({ aberto: true, tipo: "reuniao" })}>+ Reunião</button>
            </div>
          </div>
          {rascunhos.map((x) => {
            const reg = x.registroId ? tarefa.registros.find((r) => r.id === x.registroId) : null;
            if (x.registroId && !reg) return null; // o registro saiu da timeline; o rascunho não tem onde entrar
            const oQue = reg
              ? `edição de "${reg.titulo || tipoInfo(reg.tipo).nome}"`
              : `registro novo: ${tipoInfo(x.r.tipo).nome.toLowerCase()}${x.r.titulo ? `, "${x.r.titulo}"` : ""}`;
            return (
              <div key={x.registroId ?? "novo"} className="aviso info rascunho-aviso">
                <span>Rascunho não salvo ({oQue}), de {formatarDataHora(x.salvoEm)}.</span>
                <span className="acoes">
                  <button className="btn pequeno primario" onClick={() => setEditor({ aberto: true, registro: reg })}>Continuar</button>
                  <button className="btn pequeno" onClick={() => {
                    if (!confirm("Descartar este rascunho? Não dá pra desfazer.")) return;
                    apagarRascunho(tarefa.id, x.registroId);
                    setRascunhos(listarRascunhos(tarefa.id));
                  }}>Descartar</button>
                </span>
              </div>
            );
          })}
          {regs.length === 0 ? (
            <Vazio titulo="Nada registrado ainda">Registre a primeira reunião ou atividade desta tarefa.</Vazio>
          ) : (
            <div className="timeline">
              {regs.map((r) => (
                <CardRegistro key={r.id} r={r}
                  editar={() => setEditor({ aberto: true, registro: r })}
                  excluir={() => {
                    if (confirm("Remover este registro da timeline?"))
                      atualizarTarefa(tarefa.id, (t) => ({
                        ...t,
                        registros: t.registros.filter((x) => x.id !== r.id),
                        registrosRemovidos: [...((t.registrosRemovidos as Registro[]) || []), { ...r, removidoEm: agoraISO() }],
                      }));
                  }}
                  alternar={alternarPasso} />
              ))}
            </div>
          )}
        </section>

        <aside className="lado">
          <PassosTarefa tarefa={tarefa} pessoas={todasPessoas} />

          <div className="caixa">
            <header>
              <h3>Links e documentos</h3>
              <button className="btn pequeno" onClick={() => setLinkForm(true)}>+ Adicionar</button>
            </header>
            {links.length === 0 ? <p className="sutil" style={{ margin: 0, fontSize: 13 }}>Nada vinculado.</p> : links.map((l) => (
              <div key={l.id} className="link-item">
                <span>{l.tipo === "arquivo" ? "📄" : "🔗"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={hrefLink(l)} target="_blank" rel="noreferrer">{l.titulo}</a>
                  <small>{l.descricao || (l.tipo === "arquivo" ? formatarTamanho(l.tamanho) : l.url)}</small>
                </div>
                <button className="btn-icone" title="Desvincular" onClick={() =>
                  salvarLinks((items) => items.map((i) => (i.id === l.id ? { ...i, tarefaId: null } : i)))}>✕</button>
              </div>
            ))}
          </div>

          {pessoas.length > 0 && (
            <div className="caixa">
              <header><h3>Pessoas envolvidas</h3></header>
              <div className="reg-pessoas" style={{ marginTop: 0 }}>
                {pessoas.map(([p, n]) => (
                  <Link key={p} href={`/pessoas?p=${encodeURIComponent(p)}`} className="chip so-leitura">{p} · {n}</Link>
                ))}
              </div>
            </div>
          )}

          {tarefa.panoramaIA?.texto && (
            <div className="caixa">
              <header>
                <h3>Último panorama (IA)</h3>
                <small className="sutil">{formatarData(tarefa.panoramaIA.geradoEm)}</small>
              </header>
              <div className="pre" style={{ fontSize: 13, maxHeight: 320, overflow: "auto" }}>{tarefa.panoramaIA.texto}</div>
            </div>
          )}
        </aside>
      </div>

      <TarefaForm aberto={editando} fechar={() => setEditando(false)} tarefa={tarefa} />
      <RegistroEditor aberto={editor.aberto} fechar={() => setEditor({ aberto: false })} tarefa={tarefa}
        registro={editor.registro} tipoInicial={editor.tipo} />
      <LinkForm aberto={linkForm} fechar={() => setLinkForm(false)} tarefaId={tarefa.id} categoriaId={tarefa.categoriaId} />
      <PromptModal
        aberto={prompt === "panorama"}
        fechar={() => setPrompt(null)}
        titulo="Panorama da tarefa"
        explicacao="Gera um status report com toda a linha do tempo. Cole a resposta para guardar o panorama na tarefa."
        prompt={promptPanorama(tarefa, cat)}
        aoSalvarResposta={(texto) =>
          atualizarTarefa(tarefa.id, (t) => ({ ...t, panoramaIA: { texto, geradoEm: agoraISO() } }))}
        rotuloSalvar="Guardar panorama"
      />
      <PromptModal
        aberto={prompt === "reuniao"}
        fechar={() => setPrompt(null)}
        titulo="Preparar próxima reunião"
        explicacao="Gera uma pauta com base no histórico e nas pendências. Use a resposta no Copilot mesmo, ou copie para as anotações do próximo registro."
        prompt={promptPrepararReuniao(tarefa, cat)}
      />
    </>
  );
}

// "Aguardando quem" e "cobrar em": aparecem no cabeçalho enquanto a tarefa está parada com alguém.
function EsperaLinha({ tarefa, pessoas }: { tarefa: Tarefa; pessoas: string[] }) {
  const { atualizarTarefa } = useNexo();
  const [quem, setQuem] = useState(tarefa.aguardandoQuem ?? "");
  useEffect(() => setQuem(tarefa.aguardandoQuem ?? ""), [tarefa.aguardandoQuem]);
  const gravarQuem = () => {
    const v = quem.trim();
    if (v !== (tarefa.aguardandoQuem ?? "")) atualizarTarefa(tarefa.id, (t) => ({ ...t, aguardandoQuem: v }));
  };
  return (
    <div className="espera-linha">
      <label>
        <span className="rotulo">{tarefa.status === "bloqueada" ? "Depende de" : "Aguardando"}</span>
        <input type="text" value={quem} list="pessoas-espera" placeholder="Quem? (pessoa ou time)"
          onChange={(e) => setQuem(e.target.value)} onBlur={gravarQuem}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
        <datalist id="pessoas-espera">{pessoas.map((p) => <option key={p} value={p} />)}</datalist>
      </label>
      <label>
        <span className="rotulo">Cobrar em</span>
        <input type="date" value={tarefa.cobrarEm ?? ""}
          onChange={(e) => {
            // lê o valor já: a gravação entra numa fila e o campo pode ter sido redesenhado até lá
            const v = e.target.value || null;
            atualizarTarefa(tarefa.id, (t) => ({ ...t, cobrarEm: v }));
          }} />
      </label>
      <CobrarTag data={tarefa.cobrarEm} />
    </div>
  );
}

function CardRegistro({
  r, editar, excluir, alternar,
}: {
  r: Registro; editar: () => void; excluir: () => void; alternar: (passoId: string, feito: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const info = tipoInfo(r.tipo);
  const fim = r.tipo === "marco" && (r.alteracoes?.status?.para === "concluida");
  const temDetalhe = (r.resumoIA && r.anotacoes) || r.respostaIABruta;
  const corpo = r.resumoIA || r.anotacoes;

  if (r.tipo === "marco") {
    return (
      <div className={`reg marco ${fim ? "fim" : ""}`} data-ico={fim ? "✓" : info.icone}>
        <div className="reg-topo">
          <div className="reg-data">
            {formatarData(r.data)}
            <span className="reg-tipo">{fim ? "Concluída" : r.titulo || "Marco"}</span>
            {r.alteracoes?.status?.de && (
              <span className="sutil">
                {nomeStatus(r.alteracoes.status.de as Status)} → {nomeStatus(r.alteracoes.status.para as Status)}
              </span>
            )}
          </div>
          <div className="reg-acoes"><button className="btn-icone" onClick={editar} title="Editar">✎</button></div>
        </div>
        {r.anotacoes && <div className="reg-corpo sutil">{r.anotacoes}</div>}
      </div>
    );
  }

  return (
    <div className={`reg ${r.tipo}`} data-ico={info.icone}>
      <div className="reg-topo">
        <div>
          <div className="reg-data">
            {formatarData(r.data)}{r.hora ? ` · ${r.hora}` : ""}
            <span className="reg-tipo">{info.nome}</span>
          </div>
          {r.titulo && <h3>{r.titulo}</h3>}
        </div>
        <div className="reg-acoes">
          <button className="btn-icone" onClick={editar} title="Editar">✎</button>
          <button className="btn-icone" onClick={excluir} title="Remover">🗑</button>
        </div>
      </div>
      {r.participantes.length > 0 && (
        <div className="reg-pessoas">{r.participantes.map((p) => <span key={p} className="chip so-leitura">{p}</span>)}</div>
      )}
      {corpo && <div className="reg-corpo">{corpo}</div>}
      {r.decisoes && (
        <div className="reg-bloco"><span className="rotulo">Decisões</span><div className="pre">{r.decisoes}</div></div>
      )}
      {r.proximosPassos.length > 0 && (
        <div className="reg-bloco">
          <span className="rotulo">Próximos passos</span>
          <ul className="lista-limpa">
            {r.proximosPassos.map((p) => (
              <li key={p.id} className={`passo ${p.feito ? "feito" : ""}`}>
                <input type="checkbox" checked={p.feito} onChange={(e) => alternar(p.id, e.target.checked)} />
                <span>
                  {p.texto}
                  {(p.responsavel || p.prazo) && (
                    <small>
                      {p.responsavel}{p.responsavel && p.prazo ? " · " : ""}
                      {p.prazo && <PrazoTag prazo={p.prazo} concluida={p.feito} />}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.impedimentos && (
        <div className="reg-bloco"><span className="rotulo" style={{ color: "var(--erro)" }}>Impedimentos</span><div className="pre">{r.impedimentos}</div></div>
      )}
      {r.alteracoes && Object.keys(r.alteracoes).length > 0 && (
        <div className="alteracao">
          {r.alteracoes.status && <>Status: {nomeStatus(r.alteracoes.status.de as Status)} → {nomeStatus(r.alteracoes.status.para as Status)}. </>}
          {r.alteracoes.prioridade && <>Prioridade: {r.alteracoes.prioridade.de} → {r.alteracoes.prioridade.para}. </>}
          {r.alteracoes.prazo && <>Prazo: {formatarData(r.alteracoes.prazo.de) || "sem"} → {formatarData(r.alteracoes.prazo.para) || "sem"}.</>}
        </div>
      )}
      {temDetalhe && (
        <>
          <button className="mais" onClick={() => setAberto(!aberto)}>{aberto ? "Esconder" : "Ver"} anotações originais</button>
          {aberto && (
            <>
              {r.resumoIA && r.anotacoes && <div className="reg-bloco"><span className="rotulo">Anotações brutas</span><div className="pre sutil">{r.anotacoes}</div></div>}
              {r.respostaIABruta && <div className="reg-bloco"><span className="rotulo">Resposta completa da IA</span><div className="pre sutil">{r.respostaIABruta}</div></div>}
            </>
          )}
        </>
      )}
    </div>
  );
}
