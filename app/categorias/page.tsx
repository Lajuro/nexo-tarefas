"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArchiveRestore, ArrowRight, FolderPlus, Plus, Tag } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CategoriaForm } from "@/components/CategoriaForm";
import { CartaoCategoria } from "@/components/categorias/CartaoCategoria";
import { Pagina, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { CampoSwitch } from "@/components/ui/controles";
import { lista } from "@/lib/animacoes";
import { usePref } from "@/lib/preferencias";
import { Categoria, Tarefa } from "@/lib/tipos";

export default function Categorias() {
  const { dados } = useNexo();
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

  return (
    <Pagina
      titulo="Categorias"
      descricao="Os assuntos de onde nascem as tarefas. Abra um para ver tudo o que saiu dele."
      acoes={
        <>
          <CampoSwitch marcado={verArquivadas} aoMudar={setVerArquivadas} className="mr-1">
            Mostrar arquivadas
            {arquivadas > 0 && <span className="ml-1 tabular-nums opacity-70">({arquivadas})</span>}
          </CampoSwitch>
          <Button onClick={nova}><Plus /> Nova categoria</Button>
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
