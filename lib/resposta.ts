import { NextResponse } from "next/server";
import { ErroConflito, ErroSomenteLeitura } from "./armazenamento";

export async function tratar(fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    if (r instanceof Response) return r;
    return NextResponse.json(r ?? { ok: true });
  } catch (e) {
    const status = e instanceof ErroConflito ? 409 : e instanceof ErroSomenteLeitura ? 423 : 500;
    return NextResponse.json({ erro: (e as Error).message }, { status });
  }
}
