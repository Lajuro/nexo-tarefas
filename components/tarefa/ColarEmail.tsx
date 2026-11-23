"use client";

// Colar um e-mail no registro (3.17): janela que abre por cima do editor de registro.
//
// O usuário cola o texto do e-mail (com o cabeçalho De, Enviada em, Para, Assunto, que é o que o Outlook mostra
// em cada mensagem ao responder ou encaminhar). A janela mostra o que foi reconhecido antes de trazer: nada
// entra no registro sem o clique em "Trazer para o registro". A leitura é de lib/email.ts.

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ClipboardPaste, Mail, TriangleAlert, Users } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useFecharComCuidado } from "@/components/Raiz";
import { Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { type EmailLido, lerEmail, participantesDoEmail } from "@/lib/email";
import { formatarData } from "@/lib/tipos";

export function ColarEmail({ aberto, fechar, aoTrazer }: { aberto: boolean; fechar: () => void; aoTrazer: (email: EmailLido) => void }) {
  const { dados, toast } = useNexo();
  const [texto, setTexto] = useState("");
  useEffect(() => { if (aberto) setTexto(""); }, [aberto]);

  const email = useMemo(() => lerEmail(texto), [texto]);
  const cadastro = dados?.pessoas?.items;
  const pessoas = useMemo(() => participantesDoEmail(email, cadastro ?? []), [email, cadastro]);
  const temTexto = !!texto.trim();
  const tentarFechar = useFecharComCuidado(temTexto, fechar);

  const colarDaAreaDeTransferencia = async () => {
    try {
      const lido = await navigator.clipboard.readText();
      if (lido.trim()) setTexto(lido);
      else toast("A área de transferência está vazia. Copie o e-mail no Outlook e tente de novo.", "info");
    } catch {
      toast("O navegador não deixou ler a área de transferência. Clique no campo e cole com Ctrl V.", "info");
    }
  };

  return (
    <Modal
      titulo="Colar um e-mail"
      descricao="Copie o e-mail no Outlook, com o cabeçalho (De, Enviada em, Para, Assunto), e cole aqui."
      aberto={aberto}
      fechar={tentarFechar}
      rodape={
        <>
          <Button variant="outline" onClick={tentarFechar}>Cancelar</Button>
          <Button data-slot="trazer-email" disabled={!temTexto} onClick={() => { aoTrazer(email); fechar(); }}>
            <Mail /> Trazer para o registro
          </Button>
        </>
      }
    >
      <div data-slot="colar-email" className="flex flex-col gap-3">
        <Textarea
          data-foco-inicial
          rows={7}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Texto do e-mail"
          placeholder={"De: Fulano\nEnviada em: quinta-feira, 19 de novembro de 2026 14:32\nPara: Beltrano; Ciclano\nAssunto: ...\n\nTexto do e-mail"}
          className="max-h-[min(18rem,40vh)] font-mono text-xs"
        />
        {!temTexto ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Button variant="outline" size="sm" data-slot="colar-da-area" onClick={colarDaAreaDeTransferencia}><ClipboardPaste /> Colar o que copiei</Button>
            <span className="text-xs text-muted-foreground">Ou clique no campo e use Ctrl V.</span>
          </div>
        ) : email.reconheceu ? (
          <dl data-slot="email-reconhecido" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg bg-muted/60 px-3 py-2.5 text-[13px]">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="size-3.5" /> Título</dt>
            <dd className="truncate font-medium">{email.assunto || <span className="font-normal text-muted-foreground">sem assunto</span>}</dd>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" /> Quando</dt>
            <dd className="tabular-nums">{email.data ? `${formatarData(email.data)}${email.hora ? ` ${email.hora}` : ""}` : <span className="text-muted-foreground">não consegui ler a data</span>}</dd>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" /> Pessoas</dt>
            <dd className="[overflow-wrap:anywhere]">{pessoas.length ? pessoas.join(", ") : <span className="text-muted-foreground">ninguém além de você</span>}</dd>
          </dl>
        ) : (
          <p data-slot="email-sem-cabecalho" role="status" className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-alerta" />
            Não achei o cabeçalho do e-mail (De, Para, Assunto). O texto entra inteiro nas anotações, e você preenche o título e os participantes.
          </p>
        )}
        {temTexto && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            O texto vai para o fim das anotações. O que você já escreveu no registro não é trocado.
            {email.cortado && " O texto colado é maior do que o Nexo lê de uma vez: o final fica de fora."}
          </p>
        )}
      </div>
    </Modal>
  );
}
