# Teste ponta a ponta da interface (Playwright + Chromium).
# Pré-requisito: pip install playwright && playwright install chromium
# Suba o app com dados descartáveis, ex.:
#   HOME=/tmp/nexo-home NEXO_DATA_DIR=/tmp/nexo-dados npm start
# e rode:  python3 testes/e2e.py   (screenshots vão para /tmp/nexo-e2e-*.png)
# Cobre: criar categorias, criar tarefa pelo atalho N, registrar reunião,
# copiar prompt, colar resposta do Copilot, preencher campos, concluir passo
# antigo por resposta da IA, pendências, busca e pessoas.
import asyncio, sys
from playwright.async_api import async_playwright
import os
B = os.environ.get("NEXO_URL", "http://127.0.0.1:3210")
RESP = """## RESUMO
Alinhamos o escopo do onboarding do Ferramenta X no squad de Pagamentos. O time vai integrar o scan na pipeline até o fim do mês e a arquitetura validou o desenho.

## DECISÕES
- Começar pelo repositório de checkout
- Gate de bloqueio só para severidade crítica no início

## PRÓXIMOS PASSOS
- Enviar documentação de integração para o squad (responsável: Eu)
- Liberar acesso ao repositório de checkout (responsável: Marina)
- Agendar follow-up em 15 dias

## IMPEDIMENTOS
- Aguardando liberação de acesso pelo time de plataforma

## PARTICIPANTES
- Marina
- Felipe

## PASSOS CONCLUÍDOS
- Nenhum
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, permissions=["clipboard-read","clipboard-write"])
        pg = await ctx.new_page()
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
        await pg.goto(B + "/categorias"); await pg.wait_for_selector("text=Categorias")
        for nome, desc in [("Ferramenta X", "Programa de adoção da ferramenta Ferramenta X pelos squads"), ("Security Champion", "Formação e acompanhamento dos champions"), ("HT", "Demandas de hardening")]:
            await pg.click("text=+ Nova categoria")
            await pg.fill("input[placeholder='Ex.: Security Champion']", nome)
            await pg.fill("textarea", desc)
            await pg.click(".modal-rodape >> text=Salvar")
            await pg.wait_for_selector(f".card-cat >> text={nome}")
        # nova tarefa via atalho
        await pg.goto(B + "/"); await pg.wait_for_selector("text=Tarefas")
        await pg.keyboard.press("n")
        await pg.fill(".modal input[placeholder^='Ex.: Onboarding']", "Onboarding do squad Pagamentos no Ferramenta X")
        await pg.select_option(".modal select >> nth=0", label="Ferramenta X")
        await pg.fill(".modal input[type=range]", "8")
        await pg.select_option(".modal select >> nth=1", label="Em andamento")
        await pg.fill(".modal input[type=date]", "2026-11-28")
        await pg.fill(".modal textarea", "Colocar o scan do Ferramenta X na pipeline do squad de Pagamentos e treinar o time.")
        await pg.click(".modal-rodape >> text=Salvar")
        await pg.wait_for_url("**/tarefas/*")
        url = pg.url
        # novo registro de reunião
        await pg.click("text=+ Reunião")
        await pg.fill(".modal input[placeholder^='Ex.: Alinhamento']", "Kickoff com o squad")
        chips = pg.locator(".modal .chips-input input")
        await chips.fill("Marina"); await chips.press("Enter")
        await pg.fill(".modal textarea[placeholder^='O que foi falado']", "marina topou, felipe da arquitetura validou desenho. falta acesso ao repo checkout. gate só critica no começo. eu mando doc.")
        await pg.click("text=📋 Copiar prompt para o Copilot")
        await pg.wait_for_timeout(300)
        prompt = await pg.evaluate("navigator.clipboard.readText()")
        assert "Onboarding do squad Pagamentos" in prompt and "felipe da arquitetura" in prompt, prompt[:300]
        await pg.fill(".modal textarea[placeholder='Cole a resposta aqui...']", RESP)
        await pg.click("text=✨ Preencher campos com a resposta")
        await pg.wait_for_timeout(200)
        await pg.screenshot(path="/tmp/nexo-e2e-04-editor.png")
        await pg.click(".modal-rodape >> text=Salvar registro")
        await pg.wait_for_selector(".reg >> text=Kickoff com o squad")
        # atividade concluindo passo antigo via resposta
        await pg.click("text=🛠️ Atividade")
        await pg.fill(".modal input[placeholder^='Resumo em uma linha']", "Enviei a documentação de integração")
        await pg.fill(".modal textarea[placeholder='Cole a resposta aqui...']", "## RESUMO\nDocumentação enviada por e-mail ao squad.\n## PRÓXIMOS PASSOS\nNenhum\n## PASSOS CONCLUÍDOS\n- Enviar documentação de integração para o squad (responsável: Eu)\n")
        await pg.click("text=✨ Preencher campos com a resposta")
        marcados = await pg.locator(".modal .lista-limpa input:checked").count()
        await pg.click(".modal-rodape >> text=Salvar registro")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path="/tmp/nexo-e2e-02-tarefa.png", full_page=True)
        pend = await pg.locator(".lado .caixa >> nth=0").inner_text()
        await pg.goto(B + "/"); await pg.wait_for_selector(".card-tarefa")
        await pg.screenshot(path="/tmp/nexo-e2e-01-painel.png")
        await pg.goto(B + "/pendencias"); await pg.wait_for_timeout(500)
        await pg.screenshot(path="/tmp/nexo-e2e-03-pendencias.png")
        await pg.goto(B + "/busca?q=checkout"); await pg.wait_for_timeout(500)
        nres = await pg.locator(".resultado").count()
        await pg.screenshot(path="/tmp/nexo-e2e-05-busca.png")
        await pg.goto(B + "/pessoas"); await pg.wait_for_timeout(400)
        pessoas = await pg.locator("tbody tr").count()
        for rota in ["/categorias", "/links", "/relatorios", "/configuracoes"]:
            await pg.goto(B + rota); await pg.wait_for_timeout(400)
        await pg.screenshot(path="/tmp/nexo-e2e-06-config.png", full_page=True)
        print("marcados p/ concluir:", marcados)
        print("pendencias lado:", pend.replace("\n"," | "))
        print("resultados busca:", nres, "pessoas:", pessoas)
        print("ERROS:", erros)
        await b.close()
asyncio.run(main())
