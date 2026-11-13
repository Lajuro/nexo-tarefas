"use client";

// Cadastrar/editar pessoa. Grava a pessoa (pessoas.json) e, só depois, os times de que ela
// faz parte (times.json, em time.membroIds), porque o vínculo com time mora no time.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TriangleAlert } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { AvatarPessoa, Campo, ChipsInput, LinhaCampos, Modal, PontoCor } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { CampoSugestoes } from "@/components/ui/chips";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/diversos";
import { type Pessoa, agoraISO, normalizarPessoa, novoId } from "@/lib/tipos";
import { chaveNome, chavesDaPessoa, montarDiretorio } from "@/lib/pessoas";
import { hrefPessoa, porNome } from "./pecas";
import { SeletorMultiplo } from "./SeletorMultiplo";

export function PessoaForm({
  aberto, fechar, pessoa, nomeInicial, aoSalvar,
}: {
  aberto: boolean;
  fechar: () => void;
  pessoa?: Pessoa;
  /** Nome solto dos registros que está sendo cadastrado. */
  nomeInicial?: string;
  /** Chamado com a pessoa gravada (para a tela seguir o nome novo, por exemplo). */
  aoSalvar?: (p: Pessoa) => void;
}) {
  const { dados, salvarPessoas, salvarTimes, toast } = useNexo();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [apelidos, setApelidos] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [area, setArea] = useState("");
  const [ajudaCom, setAjudaCom] = useState("");
  const [anotacoes, setAnotacoes] = useState("");
  const [timeIds, setTimeIds] = useState<string[]>([]);
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const times = useMemo(() => dados?.times.items ?? [], [dados]);
  const timesIniciais = useMemo(() => (pessoa ? times.filter((t) => t.membroIds.includes(pessoa.id)).map((t) => t.id) : []), [pessoa, times]);

  useEffect(() => {
    if (!aberto) return;
    setNome(pessoa?.nome ?? nomeInicial ?? "");
    setApelidos(pessoa?.apelidos ?? []);
    setEmail(pessoa?.email ?? "");
    setCargo(pessoa?.cargo ?? "");
    setArea(pessoa?.area ?? "");
    setAjudaCom(pessoa?.ajudaCom ?? "");
    setAnotacoes(pessoa?.anotacoes ?? "");
    setTimeIds(timesIniciais);
    setCategoriaIds(pessoa?.categoriaIds ?? []);
    setTags(pessoa?.tags ?? []);
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, pessoa?.id, nomeInicial]);

  const outras = useMemo(() => (dados?.pessoas.items ?? []).filter((p) => p.id !== pessoa?.id), [dados, pessoa?.id]);
  const diretorio = useMemo(() => (dados && aberto ? montarDiretorio(dados) : []), [dados, aberto]);
  const nomesSoltos = useMemo(
    () => diretorio.filter((e) => !e.cadastrada).sort((a, b) => b.registros.length - a.registros.length).map((e) => e.nome),
    [diretorio],
  );
  const areas = useMemo(
    () => [...new Set((dados?.pessoas.items ?? []).map((p) => p.area.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [dados],
  );
  const todasTags = useMemo(() => [...new Set((dados?.pessoas.items ?? []).flatMap((p) => p.tags))], [dados]);

  const nomeLimpo = nome.replace(/\s+/g, " ").trim();
  // Nome ou apelido que já identifica outra pessoa: avisa e oferece abrir a existente.
  const conflitos = useMemo(() => {
    const out: { nome: string; pessoa: Pessoa }[] = [];
    for (const n of [nomeLimpo, ...apelidos]) {
      const k = chaveNome(n);
      if (!k) continue;
      const p = outras.find((o) => chavesDaPessoa(o).includes(k));
      if (p && !out.some((c) => c.pessoa.id === p.id)) out.push({ nome: n, pessoa: p });
    }
    return out;
  }, [nomeLimpo, apelidos, outras]);

  // Ao cadastrar um nome solto com outro nome (ex.: "Diego" vira "Diego Alves"), o nome antigo vira apelido.
  const viraApelido = !pessoa && nomeInicial && chaveNome(nomeInicial) !== chaveNome(nomeLimpo) ? nomeInicial.trim() : "";

  async function salvar() {
    if (!nomeLimpo || salvando) return;
    setSalvando(true);
    const id = pessoa?.id ?? novoId("pe");
    const nova = normalizarPessoa({
      ...(pessoa || {}),
      id,
      nome: nomeLimpo,
      apelidos: viraApelido ? [...apelidos, viraApelido] : apelidos,
      email, cargo, area, ajudaCom, anotacoes, categoriaIds, tags,
      origem: pessoa?.origem ?? (nomeInicial ? "registros" : "manual"),
      atualizadaEm: agoraISO(),
    });
    const ok = await salvarPessoas((items) => (pessoa && items.some((i) => i.id === id) ? items.map((i) => (i.id === id ? nova : i)) : [...items, nova]));
    if (!ok) { setSalvando(false); return; }

    const entra = timeIds.filter((t) => !timesIniciais.includes(t));
    const sai = timesIniciais.filter((t) => !timeIds.includes(t));
    if (entra.length || sai.length) {
      const agora = agoraISO();
      const okTimes = await salvarTimes((items) =>
        items.map((t) => {
          if (entra.includes(t.id) && !t.membroIds.includes(id)) return { ...t, membroIds: [...t.membroIds, id], atualizadoEm: agora };
          if (sai.includes(t.id))
            return { ...t, membroIds: t.membroIds.filter((x) => x !== id), responsavelIds: t.responsavelIds.filter((x) => x !== id), atualizadoEm: agora };
          return t;
        }),
      );
      if (!okTimes) toast("A pessoa foi salva, mas os times não. Confira os times e tente de novo.", "erro");
    }
    setSalvando(false);
    toast(pessoa ? "Pessoa salva." : `${nova.nome} cadastrada.`);
    aoSalvar?.(nova);
    fechar();
  }

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(); }
  };

  return (
    <Modal
      titulo={pessoa ? "Editar pessoa" : nomeInicial ? "Cadastrar pessoa" : "Nova pessoa"}
      descricao={
        pessoa
          ? "Quem é, com o que pode ajudar e de quais times e assuntos faz parte."
          : nomeInicial
            ? <>“{nomeInicial}” aparece nos seus registros. Com o cadastro, dá para anotar com o que ajuda e ligar a times e assuntos.</>
            : "Quem é, com o que pode ajudar e de quais times e assuntos faz parte."
      }
      aberto={aberto}
      fechar={fechar}
      largo
      rodape={
        <>
          <span className="mr-auto hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex sem-selecao">
            <Kbd>Ctrl</Kbd><Kbd>Enter</Kbd> salva
          </span>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button disabled={!nomeLimpo || salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</Button>
        </>
      }
    >
      <div data-slot="pessoa-form" className="grid gap-x-6 gap-y-4 md:grid-cols-2" onKeyDown={aoTeclar}>
        <div className="flex min-w-0 flex-col gap-4">
          <Campo rotulo="Nome">
            <div className="flex items-center gap-2.5">
              <AvatarPessoa nome={nomeLimpo || "?"} tamanho="lg" />
              <Input
                autoFocus
                data-foco-inicial
                value={nome}
                maxLength={120}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                aria-label="Nome"
              />
            </div>
          </Campo>

          <AnimatePresence initial={false}>
            {conflitos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div data-slot="aviso-repetida" className="flex flex-col gap-1.5 rounded-lg border border-alerta/40 bg-alerta/8 px-3 py-2 text-[13px]">
                  {conflitos.map((c) => (
                    <div key={c.pessoa.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <TriangleAlert className="size-3.5 shrink-0 text-alerta" />
                      <span className="min-w-0 flex-1">
                        “{c.nome}” já identifica <strong className="font-semibold">{c.pessoa.nome}</strong>.
                      </span>
                      <Button size="sm" variant="outline" onClick={() => { fechar(); router.push(hrefPessoa(c.pessoa.nome)); }}>
                        Abrir {c.pessoa.nome.split(" ")[0]}
                      </Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Campo
            rotulo="Apelidos"
            dica={
              viraApelido
                ? <>Outros nomes pelos quais ela aparece nos seus registros. “{viraApelido}” entra como apelido ao salvar.</>
                : "Outros nomes pelos quais ela aparece nos seus registros."
            }
          >
            <ChipsInput valor={apelidos} mudar={setApelidos} sugestoes={nomesSoltos} placeholder="Ex.: Marina, Marina S." />
          </Campo>

          <LinhaCampos>
            <Campo rotulo="Cargo">
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Product Owner" aria-label="Cargo" />
            </Campo>
            <Campo rotulo="Área ou squad">
              <CampoSugestoes valor={area} aoMudar={setArea} sugestoes={areas} placeholder="Ex.: Squad de Pagamentos" aria-label="Área ou squad" />
            </Campo>
          </LinhaCampos>

          <Campo rotulo="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" aria-label="E-mail" />
          </Campo>

          <Campo rotulo="Tags">
            <ChipsInput valor={tags} mudar={setTags} sugestoes={todasTags} placeholder="Ex.: liderança, dev" />
          </Campo>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Campo rotulo="Pode ajudar com" dica="É o que aparece em destaque na lista e na busca.">
            <Textarea
              rows={4}
              value={ajudaCom}
              onChange={(e) => setAjudaCom(e.target.value)}
              placeholder="Ex.: Libera acessos, conhece a pipeline de deploy"
              aria-label="Pode ajudar com"
            />
          </Campo>

          <Campo rotulo="Times">
            <SeletorMultiplo
              aria-label="Times"
              valor={timeIds}
              aoMudar={setTimeIds}
              placeholder="Escolher times"
              buscaPlaceholder="Buscar time..."
              vazio={times.length ? "Nenhum time com esse nome." : "Nenhum time cadastrado ainda."}
              opcoes={[...times]
                .filter((t) => !t.arquivado || timeIds.includes(t.id))
                .sort(porNome)
                .map((t) => ({ valor: t.id, rotulo: t.nome, icone: <PontoCor cor={t.cor} />, detalhe: `${t.membroIds.length} ${t.membroIds.length === 1 ? "membro" : "membros"}` }))}
            />
          </Campo>

          <Campo rotulo="Categorias" dica="Assuntos em que ela costuma estar envolvida.">
            <SeletorMultiplo
              aria-label="Categorias"
              valor={categoriaIds}
              aoMudar={setCategoriaIds}
              placeholder="Ligar a categorias"
              buscaPlaceholder="Buscar categoria..."
              vazio="Nenhuma categoria com esse nome."
              opcoes={(dados?.categorias.items ?? [])
                .filter((c) => !c.arquivada || categoriaIds.includes(c.id))
                .map((c) => ({ valor: c.id, rotulo: c.nome, icone: <PontoCor cor={c.cor} /> }))}
            />
          </Campo>

          <Campo rotulo="Anotações">
            <Textarea
              rows={4}
              value={anotacoes}
              onChange={(e) => setAnotacoes(e.target.value)}
              placeholder="Como prefere ser contatada, contexto, histórico..."
              aria-label="Anotações"
            />
          </Campo>
        </div>
      </div>
    </Modal>
  );
}
