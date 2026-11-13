"use client";
import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Seletor } from "@/components/ui/select";
import { Checkbox, CampoSwitch, Segmentado, Slider } from "@/components/ui/controles";
import { Calendario, SeletorData, SeletorHora } from "@/components/ui/data";
import { Combobox } from "@/components/ui/command";
import { AreaArquivo, CampoSugestoes } from "@/components/ui/chips";
import { Badge, Kbd, Progress, Table, TBody, Td, Th, THead, Tr } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { useConfirmar } from "@/components/Raiz";
import { useNexo } from "@/components/Provider";
import { BotaoMenuTarefa, MenuContextoTarefa } from "@/components/MenuTarefa";
import {
  AvatarPessoa, Campo, CatTag, ChipPessoa, ChipsInput, Estatistica, Etiqueta, ItemPasso, LinhaCampos, Modal, Pagina, Painel, PrazoTag,
  PrioBadge, Secao, SeletorPrioridade, SeletorStatus, StatusBadge, TipoBadge, IconeTipo, Vazio, opcoesStatus,
} from "@/components/comum";
import { STATUS, Status, TIPOS_REGISTRO } from "@/lib/tipos";

export default function Kit() {
  const { dados, toast } = useNexo();
  const confirmar = useConfirmar();
  const [st, setSt] = useState<Status>("em_andamento");
  const [p, setP] = useState(7);
  const [d, setD] = useState("");
  const [h, setH] = useState("");
  const [seg, setSeg] = useState("grade");
  const [chips, setChips] = useState(["Marina", "Felipe"]);
  const [combo, setCombo] = useState("");
  const [sug, setSug] = useState("");
  const [ck, setCk] = useState(false);
  const [sw, setSw] = useState(true);
  const [modal, setModal] = useState(false);
  const [arq, setArq] = useState<File | null>(null);
  const t = dados?.tarefas[0];
  return (
    <Pagina titulo="Kit de componentes" descricao="Página temporária para conferir a fundação"
      acoes={<><Button variant="outline"><Search /> Buscar</Button><Button><Plus /> Nova tarefa <Kbd className="border-white/20 bg-white/15 text-white">N</Kbd></Button></>}
      barra={<><Input placeholder="Filtrar..." className="w-64" /><Segmentado valor={seg} aoMudar={setSeg} opcoes={[{ valor: "grade", rotulo: "Grade" }, { valor: "lista", rotulo: "Lista" }, { valor: "quadro", rotulo: "Quadro" }]} /></>}>
      <div className="grid grid-cols-5 gap-3">
        <Estatistica rotulo="Tarefas abertas" valor={12} />
        <Estatistica rotulo="Atrasadas" valor={3} tom="perigo" />
        <Estatistica rotulo="Bloqueadas" valor={1} tom="alerta" />
        <Estatistica rotulo="Pendências" valor={24} tom="primario" />
        <Estatistica rotulo="Concluídas no mês" valor={0} tom="sucesso" />
      </div>
      <Secao titulo="Botões" contagem={6}>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primário</Button><Button variant="secondary">Secundário</Button><Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button><Button variant="destructive">Perigo</Button><Button variant="destructive-ghost"><Trash2 /> Excluir</Button>
          <Button size="sm">Pequeno</Button><Button size="lg">Grande</Button>
          <Dica texto="Dica própria" atalho="N"><Button size="icon" variant="outline"><Plus /></Button></Dica>
          <Button onClick={() => toast("Registro salvo.")}>Toast ok</Button>
          <Button variant="outline" onClick={() => toast("Deu erro ao gravar.", "erro")}>Toast erro</Button>
          <Button variant="outline" onClick={async () => toast((await confirmar({ titulo: "Mover para a lixeira?", descricao: "Dá pra restaurar depois.", perigo: true, confirmar: "Mover" })) ? "sim" : "não", "info")}>Confirmar</Button>
          <Button variant="outline" onClick={() => setModal(true)}>Modal</Button>
        </div>
      </Secao>
      <Secao titulo="Domínio">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS.map((s) => <StatusBadge key={s.id} status={s.id} />)}
          <SeletorStatus status={st} aoMudar={setSt} />
          {[2, 5, 9].map((n) => <PrioBadge key={n} p={n} />)}
          <CatTag cat={dados?.categorias.items[0]} /><CatTag />
          <PrazoTag prazo="2026-11-10" /><PrazoTag prazo="2026-11-14" /><PrazoTag prazo="2027-01-10" />
          {TIPOS_REGISTRO.map((x) => <TipoBadge key={x.id} tipo={x.id} />)}
          {TIPOS_REGISTRO.map((x) => <IconeTipo key={x.id} tipo={x.id} comFundo />)}
          <AvatarPessoa nome="Marina Souza" /><AvatarPessoa nome="Felipe" tamanho="lg" /><ChipPessoa nome="Bruno Lima" extra={3} /><Etiqueta>pipeline</Etiqueta>
          <Badge>padrão</Badge><Badge variant="sucesso">ok</Badge><Badge variant="alerta">atenção</Badge><Badge variant="perigo">crítico</Badge><Badge variant="info">info</Badge><Badge variant="outline">contorno</Badge>
          {t && <MenuContextoTarefa tarefa={t}><span className="rounded-md border px-2 py-1 text-xs">botão direito aqui</span></MenuContextoTarefa>}
          {t && <BotaoMenuTarefa tarefa={t} />}
        </div>
      </Secao>
      <div className="mt-8 grid grid-cols-2 gap-4">
        <Painel titulo="Formulário" contagem={3}>
          <div className="flex flex-col gap-3.5">
            <Campo rotulo="Título" dica="Uma dica curta"><Input placeholder="Ex.: Onboarding do squad" /></Campo>
            <LinhaCampos>
              <Campo rotulo="Status"><Seletor valor={st} aoMudar={(v) => setSt(v as Status)} opcoes={opcoesStatus} /></Campo>
              <Campo rotulo="Prazo"><SeletorData valor={d} aoMudar={setD} /></Campo>
              <Campo rotulo="Hora"><SeletorHora valor={h} aoMudar={setH} /></Campo>
            </LinhaCampos>
            <Campo rotulo={`Prioridade: ${p}`}><SeletorPrioridade valor={p} aoMudar={setP} /></Campo>
            <Campo rotulo="Participantes"><ChipsInput valor={chips} mudar={setChips} sugestoes={["Bruno", "Camila", "Diego", "Letícia"]} placeholder="Nomes" /></Campo>
            <LinhaCampos>
              <Campo rotulo="Tarefa"><Combobox valor={combo} aoMudar={setCombo} opcoes={(dados?.tarefas ?? []).map((x) => ({ valor: x.id, rotulo: x.titulo }))} /></Campo>
              <Campo rotulo="Quem"><CampoSugestoes valor={sug} aoMudar={setSug} sugestoes={["Eu", "Marina", "Felipe"]} placeholder="Quem" /></Campo>
            </LinhaCampos>
            <Campo rotulo="Descrição"><Textarea rows={3} placeholder="Texto livre..." /></Campo>
            <Slider defaultValue={[40]} />
            <Progress valor={62} />
            <div className="flex items-center gap-4"><Checkbox checked={ck} onCheckedChange={(v) => setCk(v === true)} /><CampoSwitch marcado={sw} aoMudar={setSw}>Só os meus</CampoSwitch></div>
            <AreaArquivo arquivo={arq} aoMudar={setArq} />
          </div>
        </Painel>
        <div className="flex flex-col gap-4">
          <Painel titulo="Pendências" contagem={2}>
            <ItemPasso texto="Agendar sessão de triagem dos 3 críticos" feito={ck} aoAlternar={setCk} meta={<><span>Eu</span><span>desde 09/11</span></>} />
            <ItemPasso texto="Montar guia rápido de falso positivo" feito={!ck} aoAlternar={(v) => setCk(!v)} />
          </Painel>
          <Painel titulo="Calendário"><Calendario valor={d || null} aoMudar={setD} /></Painel>
          <Vazio titulo="Nenhuma tarefa ainda" icone={<Plus />}><p>Comece cadastrando a primeira.</p><Button><Plus /> Nova tarefa</Button></Vazio>
          <Table><THead><Tr><Th>Nome</Th><Th>Registros</Th></Tr></THead><TBody><Tr><Td>Marina</Td><Td>3</Td></Tr><Tr><Td>Felipe</Td><Td>2</Td></Tr></TBody></Table>
        </div>
      </div>
      <Modal titulo="Nova tarefa" descricao="Exemplo de janela" aberto={modal} fechar={() => setModal(false)}
        rodape={<><Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button><Button>Salvar</Button></>}>
        <div className="flex flex-col gap-3.5">
          <Campo rotulo="Título"><Input autoFocus placeholder="Título" /></Campo>
          <Campo rotulo="Prazo"><SeletorData valor={d} aoMudar={setD} /></Campo>
          <Campo rotulo="Status"><Seletor valor={st} aoMudar={(v) => setSt(v as Status)} opcoes={opcoesStatus} /></Campo>
        </div>
      </Modal>
    </Pagina>
  );
}
