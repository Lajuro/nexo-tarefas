"use client";

// Painel "Avisos do Windows" (Configurações): liga as notificações do sistema para quando o Nexo está em
// segundo plano. Pede a permissão do navegador só no clique do usuário e explica o que fazer se ela foi negada.

import { useEffect, useState } from "react";
import { BellRing, MonitorUp } from "lucide-react";
import { Painel } from "@/components/comum";
import { useNexo } from "@/components/Provider";
import { Button } from "@/components/ui/button";
import { CampoSwitch } from "@/components/ui/controles";
import {
  NOTIFICACOES_PADRAO, type PrefNotificacoes, normalizarNotificacoes, notificacaoSuportada, notificar, pedirPermissao, permissaoDeNotificacao,
} from "@/lib/notificar";
import { usePref } from "@/lib/preferencias";

export function PainelNotificacoes() {
  const { toast } = useNexo();
  const [bruto, setBruto] = usePref<PrefNotificacoes>("notificacoes", NOTIFICACOES_PADRAO);
  const pref = normalizarNotificacoes(bruto);
  const [permissao, setPermissao] = useState<string>("default");
  useEffect(() => setPermissao(permissaoDeNotificacao()), []);
  const mudar = (parte: Partial<PrefNotificacoes>) => setBruto({ ...pref, ...parte });

  const ligar = async (v: boolean) => {
    if (!v) return mudar({ ligado: false });
    const ok = await pedirPermissao();
    setPermissao(permissaoDeNotificacao());
    if (ok) {
      mudar({ ligado: true });
      toast("Avisos do Windows ligados. Eles só aparecem quando o Nexo está em segundo plano.");
    } else toast("O navegador não liberou as notificações. Veja abaixo como liberar.", "erro");
  };

  return (
    <Painel titulo="Avisos do Windows" icone={<MonitorUp />}>
      {!notificacaoSuportada() ? (
        <p className="text-[13px] text-muted-foreground">Este navegador não tem notificações do sistema. No Edge e no Chrome elas funcionam.</p>
      ) : (
        <div data-slot="painel-notificacoes" className="flex flex-col gap-2.5">
          <CampoSwitch marcado={pref.ligado && permissao === "granted"} aoMudar={(v) => void ligar(v)}>
            <span className="text-foreground">Avisar pelo Windows quando o Nexo estiver em segundo plano</span>
          </CampoSwitch>
          <div className="flex flex-col gap-2 pl-1">
            <CampoSwitch marcado={pref.rotina} aoMudar={(v) => mudar({ rotina: v })}>Rotina: bloco começando, fim da pausa, hora de sair</CampoSwitch>
            <CampoSwitch marcado={pref.lembretes} aoMudar={(v) => mudar({ lembretes: v })}>Lembretes críticos novos: prazo de hoje, prazo vencido, passo atrasado</CampoSwitch>
          </div>
          {permissao === "denied" && (
            <p className="rounded-md bg-alerta/10 px-2.5 py-2 text-xs leading-relaxed text-alerta">
              O navegador está bloqueando as notificações deste endereço. Clique no cadeado ao lado do endereço (127.0.0.1:3210), em Permissões, e libere Notificações. Depois ligue de novo aqui.
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Funciona com o Nexo aberto (mesmo minimizado ou atrás de outra janela). Com o app fechado não há aviso: nada roda fora dele. Nenhum dado sai do computador.
          </p>
          {pref.ligado && permissao === "granted" && (
            <Button variant="outline" size="sm" className="self-start" data-slot="testar-notificacao"
              onClick={() => notificar("lembretes", "Teste do Nexo", "Assim chegam os avisos quando o Nexo está em segundo plano.", { sempre: true, tag: "teste" })}>
              <BellRing /> Mandar um aviso de teste
            </Button>
          )}
        </div>
      )}
    </Painel>
  );
}
