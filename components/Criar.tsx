"use client";

// Criar de qualquer tela (3.16): categoria, página, folha, link, pessoa, time e modelo sem precisar ir antes à
// tela de cada um. Antes, só a tarefa tinha isso (botão da barra lateral, atalho N, paleta); para o resto era
// preciso largar o que se fazia, abrir a tela certa e achar o botão "Novo".
//
// pedirCriar("categoria") abre o formulário por cima de onde o usuário está, e ele continua ali depois de salvar.
// Página e folha não têm formulário: nascem e abrem (a página já gravada, a folha em branco no bloco de notas).
// CriarAqui é montado uma vez no Shell e ouve o evento, como MoverEJuntar e o visor de arquivos.
// Os mesmos itens aparecem no menu "+" da barra lateral (ItensDeCriar) e na paleta (COISAS_PARA_CRIAR).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FolderPlus, LayoutTemplate, Link2, type LucideIcon, StickyNote, UserRoundPlus, UsersRound } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CategoriaForm } from "@/components/CategoriaForm";
import { EVENTO_CRIAR, type OQueCriar, type PedidoDeCriar, pedirCriar } from "@/components/criar-evento";
import { LinkForm } from "@/components/LinkForm";
import { pedirModelo } from "@/components/Modelos";
import { useAcoesDePagina } from "@/components/paginas/pecas";
import { PessoaForm } from "@/components/pessoas/PessoaForm";
import { TimeForm } from "@/components/pessoas/TimeForm";
import { DropdownMenuItem } from "@/components/ui/menu";
import { ID_VALIDO } from "@/lib/tipos";

export { pedirCriar, type OQueCriar };

export const COISAS_PARA_CRIAR: { tipo: OQueCriar; nome: string; curto: string; palavras: string; icone: LucideIcon }[] = [
  { tipo: "categoria", nome: "Nova categoria", curto: "Categoria", palavras: "criar adicionar nova categoria assunto frente", icone: FolderPlus },
  { tipo: "pagina", nome: "Nova página", curto: "Página", palavras: "criar adicionar nova pagina documento documentacao conhecimento wiki", icone: FilePlus2 },
  { tipo: "folha", nome: "Nova folha no bloco de notas", curto: "Folha no bloco de notas", palavras: "criar adicionar nova folha nota bloco de notas rascunho", icone: StickyNote },
  { tipo: "link", nome: "Novo link ou arquivo", curto: "Link ou arquivo", palavras: "criar adicionar novo link arquivo documento anexo chamado url", icone: Link2 },
  { tipo: "pessoa", nome: "Nova pessoa", curto: "Pessoa", palavras: "criar adicionar cadastrar nova pessoa contato", icone: UserRoundPlus },
  { tipo: "time", nome: "Novo time", curto: "Time", palavras: "criar adicionar novo time squad equipe", icone: UsersRound },
  { tipo: "modelo", nome: "Novo modelo de tarefa", curto: "Modelo de tarefa", palavras: "criar adicionar novo modelo de tarefa repetir", icone: LayoutTemplate },
];

const TIPOS = new Set<string>(COISAS_PARA_CRIAR.map((c) => c.tipo));

/** Os itens "Categoria", "Página"... para um menu suspenso. */
export function ItensDeCriar({ desabilitado }: { desabilitado?: boolean }) {
  return (
    <>
      {COISAS_PARA_CRIAR.map((c) => (
        <DropdownMenuItem key={c.tipo} disabled={desabilitado} data-slot={`criar-${c.tipo}`} onSelect={() => setTimeout(() => pedirCriar(c.tipo), 80)}>
          <c.icone /> {c.curto}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function CriarAqui() {
  const router = useRouter();
  const { dados } = useNexo();
  const paginas = useAcoesDePagina();
  const criarPagina = useRef(paginas.criar);
  criarPagina.current = paginas.criar;
  // `aberto` à parte do pedido: ao fechar, o formulário continua sendo o mesmo enquanto a janela some
  const [pedido, setPedido] = useState<(PedidoDeCriar & { aberto: boolean }) | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => {
      const d = (e as CustomEvent<Partial<PedidoDeCriar>>).detail;
      // o evento é da própria janela, mas confere mesmo assim: tipo em lista fechada e id no formato dos ids do app
      if (!d || typeof d.tipo !== "string" || !TIPOS.has(d.tipo)) return;
      const id = typeof d.id === "string" && ID_VALIDO.test(d.id) ? d.id : undefined;
      const tipo = d.tipo as OQueCriar;
      if (tipo === "pagina") {
        void criarPagina.current({}).then((novo) => { if (novo) router.push(`/paginas?p=${novo}`); });
        return;
      }
      if (tipo === "folha") { router.push("/notas?n=nova"); return; }
      if (tipo === "modelo") { pedirModelo({}); return; }
      setPedido({ tipo, id, aberto: true });
    };
    window.addEventListener(EVENTO_CRIAR, abrir);
    return () => window.removeEventListener(EVENTO_CRIAR, abrir);
  }, [router]);

  const fechar = () => setPedido((p) => (p ? { ...p, aberto: false } : p));
  const aberto = (tipo: OQueCriar) => !!pedido?.aberto && pedido.tipo === tipo;
  const cat = pedido?.tipo === "categoria" && pedido.id ? dados?.categorias.items.find((c) => c.id === pedido.id) : undefined;
  // com id, o formulário de pessoa edita (3.17: "Completar cadastro" de quem foi cadastrado pelo campo de participantes)
  const pessoa = pedido?.tipo === "pessoa" && pedido.id ? dados?.pessoas?.items.find((p) => p.id === pedido.id) : undefined;

  return (
    <>
      <CategoriaForm aberto={aberto("categoria")} fechar={fechar} cat={cat} />
      <LinkForm aberto={aberto("link")} fechar={fechar} />
      <PessoaForm aberto={aberto("pessoa")} fechar={fechar} pessoa={pessoa} />
      <TimeForm aberto={aberto("time")} fechar={fechar} />
    </>
  );
}
