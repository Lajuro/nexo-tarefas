"use client";

// Categorias e Tags: os dois jeitos de organizar.
//   /categorias                    os cartões das categorias
//   /categorias?aba=tags           todas as tags do app (renomear, juntar, tirar)
//   /categorias?aba=tags&tag=<nome> uma tag aberta, com tudo o que tem ela

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArchiveRestore, ArrowRight, FolderPlus, Folders, Plus, Tag, Tags } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CategoriaForm } from "@/components/CategoriaForm";
import { CartaoCategoria } from "@/components/categorias/CartaoCategoria";
import { Contador, Pagina, Vazio } from "@/components/comum";
import { GerenciarTags } from "@/components/tags/GerenciarTags";
import { useInventarioDeTags } from "@/components/tags/useTags";
import { Button } from "@/components/ui/button";
import { CampoSwitch, Segmentado } from "@/components/ui/controles";
import { lista } from "@/lib/animacoes";
import { usePref } from "@/lib/preferencias";
import { Categoria, Tarefa } from "@/lib/tipos";

export default function Categorias() {
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados } = useNexo();
  const router = useRouter();
  const params = useSearchParams();
  const aba = params.get("aba") === "tags" ? "tags" : "categorias";
  const tags = useInventarioDeTags();
  const [form, setForm] = useState<{ aberto: boolean; cat?: Categoria }>({ aberto: false });
  const [verArquivadas, setVerArquivadas, carregado] = usePref("mostrarArquivadas", false);

  const todas = dados?.categorias.items ?? [];
  const tarefas = dados?.tarefas ?? [];
  const arquivadas = todas.filter((c) => c.arquivada).length;
  const cats = todas.filter((c) => verArquivadas || !c.arquivada);
  const semCat = tarefas.filter((t) => !t.categoriaId).length;

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>();
    for (const t of tarefas) {
      if (!t.categoriaId) continue;
      const l = mapa.get(t.categoriaId);
      if (l) l.push(t);
      else mapa.set(t.categoriaId, [t]);
    }
    return mapa;
  }, [tarefas]);

  const nova = () => setForm({ aberto: true });
  const ativas = todas.length - arquivadas;

  const abas = (
    <Segmentado
      aria-label="Categorias ou tags"
      valor={aba}
      aoMudar={(v) => router.replace(v === "tags" ? "/categorias?aba=tags" : "/categorias", { scroll: false })}
      opcoes={[
        { valor: "categorias", icone: <Folders />, rotulo: <>Categorias <Contador n={ativas} className="bg-background/70" /></> },
        { valor: "tags", icone: <Tags />, rotulo: <>Tags <Contador n={tags.length} className="bg-background/70" /></> },
      ]}
    />
  );

  if (aba === "tags")
    return (
      <Pagina
        titulo="Tags"
        descricao="As etiquetas livres de tarefas, links, páginas, pessoas e modelos. Renomeie, junte as repetidas ou tire as que não usa mais."
        acoes={abas}
      >
        {dados && <GerenciarTags aberta={params.get("tag")} />}
      </Pagina>
    );

  return (
    <Pagina
      titulo="Categorias"
      descricao="De onde nascem as tarefas. Abra uma para ver tudo o que saiu dela."
      acoes={
        <>
          {abas}
          <CampoSwitch marcado={verArquivadas} aoMudar={setVerArquivadas} className="mr-1">
            Mostrar arquivadas
            {arquivadas > 0 && <span className="ml-1 tabular-nums opacity-70">({arquivadas})</span>}
          </CampoSwitch>
          <Button data-slot="nova-categoria" onClick={nova}><Plus /> Nova categoria</Button>
        </>
      }
    >
      {!dados || !carregado ? null : todas.length === 0 ? (
        <Vazio titulo="Nenhuma categoria ainda" icone={<FolderPlus />}>
          <p>
            Uma categoria é um assunto ou aplicação de onde saem várias tarefas, como Security Champion,
            gestão de vulnerabilidades ou um sistema específico.
          </p>
          <Button onClick={nova}><Plus /> Criar a primeira categoria</Button>
        </Vazio>
      ) : cats.length === 0 ? (
        <Vazio titulo="Todas as categorias estão arquivadas" icone={<ArchiveRestore />}>
          <p>Ligue “Mostrar arquivadas” para ver e desarquivar o que precisar.</p>
          <Button variant="outline" onClick={() => setVerArquivadas(true)}>Ver as arquivadas</Button>
        </Vazio>
      ) : (
        <motion.div
          variants={lista}
          initial="escondido"
          animate="visivel"
          data-slot="grade-categorias"
          className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-4"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {cats.map((c) => (
              <CartaoCategoria key={c.id} cat={c} tarefas={porCategoria.get(c.id) ?? VAZIA} aoEditar={(cat) => setForm({ aberto: true, cat })} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {dados && (todas.length > 0 || semCat > 0) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {todas.length > 0 && (
            <span className="tabular-nums">
              {ativas} {ativas === 1 ? "categoria ativa" : "categorias ativas"}
              {arquivadas > 0 && `, ${arquivadas} ${arquivadas === 1 ? "arquivada" : "arquivadas"}`}
            </span>
          )}
          {semCat > 0 && (
            <Link
              href="/tarefas?cat=__sem"
              data-slot="sem-categoria"
              className="group/sem inline-flex items-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
            >
              <Tag className="size-3 opacity-70" />
              <span className="tabular-nums">{semCat} {semCat === 1 ? "tarefa sem categoria" : "tarefas sem categoria"}</span>
              <ArrowRight className="size-3 opacity-0 transition-[opacity,transform] duration-150 group-hover/sem:translate-x-0.5 group-hover/sem:opacity-100 group-focus-visible/sem:opacity-100" />
            </Link>
          )}
        </div>
      )}

      <CategoriaForm aberto={form.aberto} fechar={() => setForm((f) => ({ ...f, aberto: false }))} cat={form.cat} />
    </Pagina>
  );
}

const VAZIA: Tarefa[] = [];
