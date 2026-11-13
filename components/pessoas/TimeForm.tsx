"use client";

// Cadastrar/editar time: nome, descrição, cor, membros, responsáveis (sempre membros também) e categorias.

import { useEffect, useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { AvatarPessoa, Campo, Modal, PontoCor } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { CORES, type Time, agoraISO, normalizarTime, novoId, semAcento } from "@/lib/tipos";
import { EmblemaTime, porNome, useAcoesPessoa } from "./pecas";
import { SeletorCor, nomeDaCor } from "./SeletorCor";
import { SeletorMultiplo } from "./SeletorMultiplo";

export function TimeForm({ aberto, fechar, time, aoSalvar }: { aberto: boolean; fechar: () => void; time?: Time; aoSalvar?: (t: Time) => void }) {
  const { dados, salvarTimes, toast } = useNexo();
  const { criarRapido } = useAcoesPessoa();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[6]);
  const [membroIds, setMembroIds] = useState<string[]>([]);
  const [responsavelIds, setResponsavelIds] = useState<string[]>([]);
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(time?.nome ?? "");
    setDescricao(time?.descricao ?? "");
    setCor(time?.cor ?? CORES[((dados?.times.items.length ?? 0) + 5) % CORES.length]);
    setMembroIds(time?.membroIds ?? []);
    setResponsavelIds(time?.responsavelIds ?? []);
    setCategoriaIds(time?.categoriaIds ?? []);
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, time?.id]);

  const cores = useMemo(() => (time?.cor && !CORES.includes(time.cor) ? [...CORES, time.cor] : CORES), [time?.cor]);
  const nomeLimpo = nome.trim();
  const repetido = useMemo(
    () => !!nomeLimpo && (dados?.times.items ?? []).some((t) => t.id !== time?.id && semAcento(t.nome.trim()) === semAcento(nomeLimpo)),
    [dados, time?.id, nomeLimpo],
  );

  const pessoas = useMemo(
    () => [...(dados?.pessoas.items ?? [])].filter((p) => !p.arquivada || membroIds.includes(p.id)).sort(porNome),
    [dados, membroIds],
  );
  const opcaoPessoa = (p: (typeof pessoas)[number]) => ({
    valor: p.id, rotulo: p.nome, icone: <AvatarPessoa nome={p.nome} tamanho="sm" />, detalhe: p.cargo || p.area || undefined,
  });

  // quem sai dos membros deixa de ser responsável; quem vira responsável entra como membro
  const mudarMembros = (v: string[]) => {
    setMembroIds(v);
    setResponsavelIds((r) => r.filter((x) => v.includes(x)));
  };
  const mudarResponsaveis = (v: string[]) => {
    setResponsavelIds(v);
    setMembroIds((m) => [...m, ...v.filter((x) => !m.includes(x))]);
  };
  const criarPessoa = async (texto: string) => (await criarRapido(texto))?.id ?? null;

  async function salvar() {
    if (!nomeLimpo || salvando) return;
    setSalvando(true);
    const novo = normalizarTime({
      ...(time || {}),
      id: time?.id ?? novoId("ti"),
      nome: nomeLimpo, descricao, cor, membroIds, responsavelIds, categoriaIds,
      atualizadoEm: agoraISO(),
    });
    const ok = await salvarTimes((items) => (time && items.some((i) => i.id === time.id) ? items.map((i) => (i.id === time.id ? novo : i)) : [...items, novo]));
    setSalvando(false);
    if (ok) {
      toast(time ? "Time salvo." : `Time ${novo.nome} criado.`);
      aoSalvar?.(novo);
      fechar();
    }
  }

  return (
    <Modal
      titulo={time ? "Editar time" : "Novo time"}
      descricao="Um grupo de pessoas que costuma trabalhar junto, com quem responde por ele."
      aberto={aberto}
      fechar={fechar}
      rodape={
        <>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button disabled={!nomeLimpo || salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</Button>
        </>
      }
    >
      <div
        data-slot="time-form"
        className="flex flex-col gap-4"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(); } }}
      >
        <Campo rotulo="Nome" dica={repetido ? <span className="text-alerta">Já existe um time com esse nome.</span> : undefined}>
          <div className="flex items-center gap-2.5">
            <EmblemaTime time={{ nome: nomeLimpo || "?", cor }} className="size-8 rounded-md text-[13px]" />
            <Input
              autoFocus
              data-foco-inicial
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Squad de Pagamentos"
              aria-label="Nome do time"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.nativeEvent.isComposing) { e.preventDefault(); salvar(); } }}
            />
          </div>
        </Campo>
        <Campo rotulo="Descrição">
          <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Do que o time cuida" aria-label="Descrição" />
        </Campo>
        <Campo rotulo="Cor" lado={<span className="text-[11px] text-muted-foreground">{nomeDaCor(cor)}</span>}>
          <SeletorCor valor={cor} aoMudar={setCor} cores={cores} aria-label="Cor do time" />
        </Campo>
        <Campo rotulo="Membros" dica="Digite um nome que ainda não existe para cadastrar a pessoa na hora.">
          <SeletorMultiplo
            aria-label="Membros"
            valor={membroIds}
            aoMudar={mudarMembros}
            placeholder="Escolher pessoas"
            buscaPlaceholder="Buscar pessoa..."
            vazio="Ninguém com esse nome."
            opcoes={pessoas.map(opcaoPessoa)}
            criar={criarPessoa}
            rotuloCriar="Cadastrar"
          />
        </Campo>
        <Campo rotulo="Responsáveis" dica="Quem responde pelo time. Ao escolher alguém aqui, a pessoa entra como membro.">
          <SeletorMultiplo
            aria-label="Responsáveis"
            valor={responsavelIds}
            aoMudar={mudarResponsaveis}
            placeholder="Escolher responsáveis"
            buscaPlaceholder="Buscar pessoa..."
            vazio="Ninguém com esse nome."
            // membros primeiro, depois o resto
            opcoes={[...pessoas.filter((p) => membroIds.includes(p.id)), ...pessoas.filter((p) => !membroIds.includes(p.id))].map(opcaoPessoa)}
          />
        </Campo>
        <Campo rotulo="Categorias" dica="Assuntos de que o time cuida.">
          <SeletorMultiplo
            aria-label="Categorias do time"
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
      </div>
    </Modal>
  );
}
