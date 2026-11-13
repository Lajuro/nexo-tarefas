"use client";

// Pessoas e Times.
//   /pessoas             lista de pessoas (cadastradas + nomes soltos dos registros)
//   /pessoas?aba=times   lista de times
//   /pessoas?p=<nome>    detalhe da pessoa (por nome, apelido ou e-mail; links do app inteiro usam isso)
//   /pessoas?time=<id>   detalhe do time

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { UserRoundX, Users, UsersRound } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Pagina, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { DetalhePessoa } from "@/components/pessoas/DetalhePessoa";
import { DetalheTime } from "@/components/pessoas/DetalheTime";
import { ListaPessoas } from "@/components/pessoas/ListaPessoas";
import { ListaTimes } from "@/components/pessoas/ListaTimes";
import { acharEntrada, montarDiretorio } from "@/lib/pessoas";

export default function Pessoas() {
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados } = useNexo();
  const params = useSearchParams();
  const sel = params.get("p");
  const timeId = params.get("time");
  const aba = params.get("aba") === "times" ? "times" : "pessoas";
  const diretorio = useMemo(() => montarDiretorio(dados!), [dados]);
  const pessoasAtivas = diretorio.filter((e) => e.cadastrada && !e.pessoa!.arquivada).length;
  const timesAtivos = dados!.times.items.filter((t) => !t.arquivado).length;

  if (timeId !== null) {
    const time = dados!.times.items.find((t) => t.id === timeId);
    if (time) return <DetalheTime key={time.id} time={time} diretorio={diretorio} />;
    return (
      <Pagina titulo="Time não encontrado" voltar={{ href: "/pessoas?aba=times", rotulo: "Times" }}>
        <Vazio titulo="Esse time não existe mais" icone={<UsersRound />}>
          <p>Ele pode ter sido removido (nesse caso está na lixeira, em Configurações).</p>
          <Button asChild variant="outline"><Link href="/pessoas?aba=times"><UsersRound /> Ver todos os times</Link></Button>
        </Vazio>
      </Pagina>
    );
  }

  if (sel !== null) {
    const entrada = acharEntrada(diretorio, sel);
    if (entrada) return <DetalhePessoa key={entrada.pessoa?.id ?? entrada.chave} entrada={entrada} />;
    return (
      <Pagina titulo="Pessoa não encontrada" voltar={{ href: "/pessoas", rotulo: "Pessoas" }}>
        <Vazio titulo={sel.trim() ? `Não achei ninguém chamado “${sel.trim()}”` : "Faltou dizer quem você procura"} icone={<UserRoundX />}>
          <p>O nome pode ter sido corrigido em algum registro ou o cadastro foi removido. A lista completa mostra todo mundo.</p>
          <Button asChild variant="outline"><Link href="/pessoas"><Users /> Ver todas as pessoas</Link></Button>
        </Vazio>
      </Pagina>
    );
  }

  return aba === "times"
    ? <ListaTimes diretorio={diretorio} totalPessoas={pessoasAtivas} />
    : <ListaPessoas diretorio={diretorio} totalTimes={timesAtivos} />;
}
