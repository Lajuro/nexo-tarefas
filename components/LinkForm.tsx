"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, FileText, FolderOpen, Globe, Link2 } from "lucide-react";
import { useNexo } from "./Provider";
import { useFecharComCuidado } from "./Raiz";
import { aoClicarEmArquivo } from "./VisorDeArquivo";
import { Campo, ChipsInput, LinhaCampos, Modal, formatarTamanho } from "./comum";
import { SeletorCategoria } from "./categorias/Escolher";
import { useNomesDasTags } from "./tags/useTags";
import { useCriarTarefa } from "./tarefas/criar";
import { IconeEstadoLink } from "./links/EstadoLink";
import { IconeLink } from "./links/IconeLink";
import { opcoesDeTarefa } from "./links/SeletorDeTarefas";
import { SeletorMultiplo } from "./pessoas/SeletorMultiplo";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Segmentado } from "@/components/ui/controles";
import { AreaArquivo } from "@/components/ui/chips";
import { Seletor } from "@/components/ui/select";
import { comEstado, comTarefasNoLink, tarefasDoLink } from "@/lib/links";
import { ESTADOS_LINK, type EstadoLink, LinkDoc, agoraISO, normalizarLink, novoId } from "@/lib/tipos";

export function LinkForm({
  aberto, fechar, link, tarefaId, categoriaId,
}: {
  aberto: boolean; fechar: () => void; link?: LinkDoc; tarefaId?: string | null; categoriaId?: string | null;
}) {
  const { dados, salvarLinks, enviarArquivo, toast } = useNexo();
  const [tipo, setTipo] = useState<"link" | "arquivo">("link");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tIds, setTIds] = useState<string[]>([]);
  const [cId, setCId] = useState("");
  const [estado, setEstado] = useState<EstadoLink | "">("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTipo(link?.tipo ?? "link");
    setTitulo(link?.titulo ?? "");
    setUrl(link?.url ?? "");
    setArquivo(null);
    setDescricao(link?.descricao ?? "");
    setTags(link?.tags ?? []);
    setTIds(link ? tarefasDoLink(link) : tarefaId ? [tarefaId] : []);
    setCId(link?.categoriaId ?? categoriaId ?? "");
    setEstado(link?.estado ?? "");
    setSalvando(false);
  }, [aberto, link, tarefaId, categoriaId]);

  const valido = Boolean(titulo.trim() || url.trim() || arquivo);
  const podeSalvar = Boolean(tipo === "link" ? url.trim() : link?.arquivo || arquivo);
  const liberado = valido && podeSalvar && !salvando;

  async function salvar() {
    if (!liberado) return;
    setSalvando(true);
    let extra: Partial<LinkDoc> = {};
    if (tipo === "arquivo" && arquivo) {
      const up = await enviarArquivo(arquivo);
      if (!up) return setSalvando(false);
      extra = up;
    }
    let u = url.trim();
    if (tipo === "link" && u && !/^[a-z]+:\/\//i.test(u) && !u.startsWith("\\\\")) u = "https://" + u;
    // tarefas e status passam pelas funções de lib/links.ts: o campo antigo (tarefaId), a trava e o carimbo do status ficam coerentes
    const novo = comEstado(
      comTarefasNoLink(
        normalizarLink({
          ...(link || {}),
          id: link?.id ?? novoId("l"),
          tipo,
          titulo: titulo.trim() || arquivo?.name || u,
          url: tipo === "link" ? u : "",
          descricao, tags,
          categoriaId: cId || null,
          ...extra,
        }),
        tIds,
      ),
      estado || null,
      agoraISO(),
    );
    const ok = await salvarLinks((items) =>
      link ? items.map((i) => (i.id === link.id ? novo : i)) : [...items, novo],
    );
    setSalvando(false);
    if (ok) {
      toast(link ? "Alterações salvas." : tipo === "arquivo" ? "Arquivo guardado." : "Link guardado.");
      fechar();
    }
  }

  const aoEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      salvar();
    }
  };

  const tagsExist = useNomesDasTags();
  const criarTarefa = useCriarTarefa();

  const opcoesTarefa = useMemo(() => opcoesDeTarefa(dados?.tarefas ?? []), [dados]);


  const ehRede = url.trim().startsWith("\\\\");
  const IconeEndereco = ehRede ? FolderOpen : Globe;

  const sujo = aberto && (
    titulo !== (link?.titulo ?? "") || url !== (link?.url ?? "") || descricao !== (link?.descricao ?? "") || arquivo !== null
  );
  const tentarFechar = useFecharComCuidado(sujo, fechar);

  return (
    <Modal
      titulo={link ? "Editar link ou documento" : "Adicionar link ou documento"}
      descricao="Guarde um endereço ou a cópia de um arquivo para achar depois."
      aberto={aberto}
      fechar={tentarFechar}
      rodape={
        <>
          <Button variant="outline" onClick={tentarFechar}>Cancelar</Button>
          <Button disabled={!liberado} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</Button>
        </>
      }
    >
      <div data-slot="link-form" className="flex flex-col gap-3.5">
        {!link && (
          <Segmentado
            aria-label="Tipo"
            className="self-start"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { valor: "link", rotulo: "Link", icone: <Link2 /> },
              { valor: "arquivo", rotulo: "Arquivo", icone: <FileText /> },
            ]}
          />
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tipo}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            {tipo === "link" ? (
              <Campo rotulo="Endereço" dica="Link da web, SharePoint, Confluence, Jira... ou caminho de rede (\\servidor\pasta).">
                <div className="relative">
                  <IconeEndereco aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    data-foco-inicial
                    className="pl-8"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={aoEnter}
                    placeholder="https://..."
                  />
                </div>
              </Campo>
            ) : link?.arquivo ? (
              <Campo rotulo="Arquivo" dica="Para trocar o arquivo, adicione um novo documento. Este continua guardado na pasta de dados.">
                <div data-slot="arquivo-atual" className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-2.5 py-2">
                  <IconeLink link={link} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{link.nomeArquivo || link.titulo}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{formatarTamanho(link.tamanho) || "Tamanho desconhecido"}</div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <a href={hrefLink(link)} target="_blank" rel="noreferrer" onClick={(e) => aoClicarEmArquivo(e, hrefLink(link), link.nomeArquivo || link.arquivo || "", link.titulo)}><ExternalLink /> Abrir</a>
                  </Button>
                </div>
              </Campo>
            ) : (
              <Campo rotulo="Arquivo" dica="Evite subir dados sensíveis se a pasta de dados sincroniza com a nuvem.">
                <AreaArquivo arquivo={arquivo} aoMudar={setArquivo} />
              </Campo>
            )}
          </motion.div>
        </AnimatePresence>

        <Campo rotulo="Título">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={aoEnter}
            placeholder={tipo === "arquivo" && arquivo ? arquivo.name : "Como você vai reconhecer isso depois"}
          />
        </Campo>
        <Campo rotulo="Descrição">
          <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Para que serve, quando usar" />
        </Campo>
        {/* Um por linha: a lista do seletor tem a largura do campo e os títulos de tarefa são longos. */}
        <Campo rotulo="Usar nas tarefas" dica="O mesmo link pode servir a várias tarefas: ele aparece em Links e documentos de cada uma.">
          <SeletorMultiplo
            aria-label="Usar nas tarefas"
            valor={tIds}
            aoMudar={setTIds}
            opcoes={opcoesTarefa}
            placeholder="Nenhuma tarefa"
            buscaPlaceholder="Buscar tarefa ou digitar o nome de uma nova..."
            vazio="Nenhuma tarefa com esse nome."
            criar={(titulo) => criarTarefa(titulo, { categoriaId: cId })}
          />
        </Campo>
        <LinhaCampos>
          <Campo rotulo="Vincular à categoria">
            <SeletorCategoria aria-label="Vincular à categoria" valor={cId} aoMudar={setCId} placeholder="Nenhuma" rotuloVazio="Nenhuma" />
          </Campo>
          <Campo rotulo="Status" dica="Para acompanhar: uma leitura pendente ou um chamado que você abriu.">
            <Seletor
              aria-label="Status"
              valor={estado}
              aoMudar={(v) => setEstado(v as EstadoLink | "")}
              opcoes={[
                { valor: "", rotulo: "Sem status" },
                ...ESTADOS_LINK.map((e) => ({ valor: e.id, rotulo: <><IconeEstadoLink estado={e.id} />{e.nome}</> })),
              ]}
            />
          </Campo>
        </LinhaCampos>
        <Campo rotulo="Tags">
          <ChipsInput valor={tags} mudar={setTags} sugestoes={tagsExist} placeholder="Ex.: runbook, padrão, acesso" />
        </Campo>
      </div>
    </Modal>
  );
}

export function hrefLink(l: LinkDoc) {
  if (l.tipo === "arquivo") return `/api/arquivos?p=${encodeURIComponent(l.arquivo || "")}`;
  if (l.url?.startsWith("\\\\")) return `file:${l.url.replace(/\\/g, "/")}`;
  return l.url || "#";
}
