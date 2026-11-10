# Agente do Tempestivo (nanobot no WhatsApp)

O [nanobot](https://github.com/HKUDS/nanobot) roda numa VPS, conversa pelo WhatsApp e usa o servidor MCP do Tempestivo (`/api/mcp`) para registrar intimações, cadastrar processos, consultar prazos e audiências, criar tarefas e lembretes e mandar os resumos.

Para o piloto com vários advogados, cada um tem a própria instância na mesma VPS: veja [Piloto: uma instância por advogado](#piloto-uma-instância-por-advogado).

```
WhatsApp ── nanobot gateway (VPS) ── HTTPS + token ──> Tempestivo /api/mcp ──> Supabase
                 │
                 ├─ heartbeat a cada 15 min: lembretes_proximos -> agenda os envios (cron)
                 └─ cron: resumo do dia (8h: prazos de hoje, atrasados, audiências) e da semana (segunda, 8h: prazos fatais)
```

## Arquivos

| Arquivo | Vai para | O que é |
|---|---|---|
| `nanobot/config.example.json` | `~/.nanobot/config.json` | Configuração do nanobot. Os segredos ficam em variáveis `${...}` |
| `nanobot/.env.example` | `~/.nanobot/.env` | Variáveis do agente: URL e token do MCP, LLM e número do WhatsApp |
| `nanobot/SOUL.md` | `~/.nanobot/workspace/SOUL.md` | Instruções: intimações, quando pedir "sim", lembretes, resumos, segredo de justiça |
| `nanobot/USER.md` | `~/.nanobot/workspace/USER.md` | Quem a instância atende (preencha nome, áreas e tribunais) |
| `nanobot/HEARTBEAT.md` | `~/.nanobot/workspace/HEARTBEAT.md` | Tarefa periódica: buscar lembretes e agendar os envios |
| `systemd/nanobot-gateway.service` | `/etc/systemd/system/` | Serviço de uma instância só, rodando como o usuário `nanobot` |
| `systemd/nanobot-gateway@.service` | `/etc/systemd/system/` | Serviço modelo do piloto: uma instância por advogado (`nanobot-gateway@<apelido>`) |
| `systemd/tempestivo-djen@.service`, `.timer` | `/etc/systemd/system/` | Captura do DJEN por instância (7h, 12h e 17h), na fila única. **Ainda não instalar** (ver [Captura do DJEN](#captura-do-djen-ainda-não-instalar)) |
| `systemd/tempestivo-djen.conf` | `/etc/tmpfiles.d/` | Cria a trava única da captura em `/run/lock` |

> Diferença em relação ao plano original: a versão atual do nanobot **não usa mais uma ponte Node.js para o WhatsApp** (a documentação diz: *"WhatsApp no longer runs a local Node.js bridge"*). O WhatsApp roda dentro do próprio `nanobot gateway`. Por isso não há `nanobot-whatsapp.service` e o Node.js não é necessário.

## Antes de começar

1. O Tempestivo precisa estar com Supabase e publicado num endereço que a VPS alcance:
   - um domínio público com HTTPS (ex.: Vercel), ou
   - uma máquina na sua rede Tailscale (ex.: `http://meu-pc:3000`).
   Em ambos os casos, `NEXT_PUBLIC_APP_URL` no Tempestivo deve ser esse endereço: é ele que vai nos links que o agente manda.
2. No Tempestivo, abra **Configurações > Agente > Gerar token**, dê o nome "nanobot da VPS", escolha **Escrita** e copie o token (ele só aparece uma vez).
3. Tenha uma chave de um provedor de LLM compatível com a API da OpenAI (URL base, chave e nome do modelo).

## Passo a passo na VPS (Ubuntu 24.04)

> No Google Cloud (VM e2-micro, OS Login, firewall da VPC e Gemini), siga [docs/agente-google-cloud.md](../docs/agente-google-cloud.md).

Os comandos com `sudo` rodam com o seu usuário administrador. O agente roda com o usuário `nanobot`, que não tem sudo.

### 1. Sistema, firewall e Tailscale

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw python3 python3-venv   # Ubuntu 24.04 já traz Python 3.12 (o nanobot pede 3.11+)
python3 --version

# Tailscale: acesso à VPS sem abrir portas na internet
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh            # abra o link que aparecer e autorize a máquina
tailscale ip -4                    # anote o IP 100.x.y.z

# Firewall: nada entra pela internet; tudo entra pelo Tailscale
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0
sudo ufw enable
sudo ufw status verbose
```

Antes de fechar a sessão atual, teste entrar por outro terminal com `ssh seu-usuario@<ip-tailscale>` (ou `tailscale ssh`). Se o provedor da VPS tiver firewall no painel, deixe a entrada fechada lá também. O nanobot só faz conexões de saída (WhatsApp, LLM e Tempestivo); o gateway escuta apenas em `127.0.0.1`.

### 2. Usuário do agente e instalação do nanobot

```bash
sudo adduser --disabled-password --gecos "" nanobot
sudo -iu nanobot                    # daqui em diante, como "nanobot"

curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.local/bin/env             # ou abra um novo terminal
uv tool install nanobot-ai          # pacote oficial no PyPI
nanobot --version
nanobot plugins enable whatsapp
```

### 3. Configuração

Copie a pasta `agente/nanobot` do repositório para a VPS, por `git clone git@github.com:GabrielAmaro-s/tempestivoapp.git` ou `scp` pelo Tailscale. Ainda como `nanobot`:

```bash
mkdir -p ~/.nanobot/workspace
cp agente/nanobot/config.example.json ~/.nanobot/config.json
cp agente/nanobot/.env.example        ~/.nanobot/.env
cp agente/nanobot/SOUL.md agente/nanobot/USER.md agente/nanobot/HEARTBEAT.md ~/.nanobot/workspace/
chmod 600 ~/.nanobot/.env ~/.nanobot/config.json
nano ~/.nanobot/.env                # preencha as 6 variáveis
nano ~/.nanobot/workspace/USER.md   # preencha nome, áreas e tribunais de quem a instância atende
```

O que vai em cada variável:

| Variável | Exemplo |
|---|---|
| `TEMPESTIVO_MCP_URL` | `https://tempestivo.seudominio.com/api/mcp` (hoje `https://tempestivo.vercel.app/api/mcp`) |
| `TEMPESTIVO_MCP_TOKEN` | o token `tempestivo_...` gerado no app (tokens antigos `myplan_...` continuam valendo) |
| `LLM_API_KEY`, `LLM_API_BASE` | chave e URL base do provedor (compatível com OpenAI) |
| `LLM_MODELO` | nome do modelo nesse provedor |
| `WHATSAPP_PERMITIDO` | seu número só com dígitos, com DDI e DDD, sem `+` (ex.: `5511999998888`) |

O nanobot troca `${NOME}` pelo valor da variável ao iniciar e para com uma mensagem clara se alguma faltar. Para testar com as variáveis carregadas no terminal:

```bash
set -a; source ~/.nanobot/.env; set +a
```

### 4. Vincular o WhatsApp (QR code)

No WhatsApp do número do agente, use **Tempestivo** como nome do perfil e o símbolo `docs/marca/logos/tempestivo-simbolo.svg` como foto (o WhatsApp pede PNG ou JPG: exporte o SVG em 640x640). É assim que o advogado reconhece o contato, como manda o manual da marca.

Use um número de WhatsApp para o agente (o ideal é um chip só para isso). Ainda como `nanobot`, com as variáveis carregadas:

```bash
nanobot channels login whatsapp
```

Vai aparecer um QR code no terminal. No celular do número do agente: **WhatsApp > Configurações > Aparelhos conectados > Conectar um aparelho** e aponte para o QR. Depois confira:

```bash
nanobot channels status
```

**Se o `nanobot channels login` pedir Node.js** (versões mais antigas do nanobot usavam uma ponte em Node para o WhatsApp), instale o Node 20 LTS com o usuário administrador e repita o login como `nanobot`:

```bash
exit                                                       # volta ao usuário administrador
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version                                             # deve mostrar v20.x
sudo -iu nanobot
set -a; source ~/.nanobot/.env; set +a
nanobot channels login whatsapp
```

### 5. Teste rápido em primeiro plano

```bash
nanobot gateway --verbose
```

Mande "oi" do seu WhatsApp para o número do agente. Se responder, pare com Ctrl+C e siga para o serviço.

### 6. Serviço com reinício automático

Volte ao usuário administrador (`exit`) e instale o serviço:

```bash
sudo cp /home/nanobot/agente/systemd/nanobot-gateway.service /etc/systemd/system/   # ajuste o caminho de onde copiou o repositório
sudo systemctl daemon-reload
sudo systemctl enable --now nanobot-gateway
systemctl status nanobot-gateway
journalctl -u nanobot-gateway -f     # logs ao vivo
```

O serviço roda como `nanobot`, reinicia sozinho se cair (`Restart=always`) e sobe junto com a VPS. Depois de mudar o `config.json` ou o `.env`: `sudo systemctl restart nanobot-gateway`.

> Alternativa da documentação do nanobot: `nanobot gateway install-service --manager systemd` cria um serviço de usuário em `~/.config/systemd/user/`; nesse caso rode `loginctl enable-linger nanobot` para ele continuar depois do logout. Use um ou outro, não os dois.

### 7. Conferir no Tempestivo

Em **Configurações > Agente**:

- **Estado do agente** fica "Ativo" depois do primeiro heartbeat (até 15 min). Se passar de `AGENTE_ALERTA_SEM_HEARTBEAT_MIN` (60 min) sem sinal, aparece "Sem sinal há X".
- **Tokens** mostra o último uso.
- **Atividade do agente** lista o que ele fez, com "Desfazer".

## Piloto: uma instância por advogado

Para o piloto com 2 ou 3 advogados, cada um tem um nanobot próprio na mesma VPS. Um agente que atende vários números não faz parte desta versão.

**O que é separado por instância:**

| Item | Por quê |
|---|---|
| Usuário Linux `nanobot-<apelido>` | A documentação do nanobot avisa que pastas separadas não isolam uma instância da outra. Para pessoas diferentes, ela recomenda contas do sistema separadas. Cada usuário só enxerga a própria casa. |
| `~/.nanobot` (config, workspace, sessões, sessão do WhatsApp) | Cada um tem o próprio `SOUL.md`, `USER.md`, `HEARTBEAT.md`, histórico de conversa e crons. |
| Conta no Tempestivo e token do MCP | Cada advogado entra no Tempestivo com o próprio e-mail e gera o próprio token. O token só enxerga os dados daquela conta. |
| Número permitido (`WHATSAPP_PERMITIDO`) | O WhatsApp do advogado. A instância ignora qualquer outro número. |
| Número do agente (o chip vinculado pelo QR) | Cada instância precisa de um WhatsApp próprio. Um mesmo número não pode estar vinculado a duas instâncias. |
| `gateway.port` no `config.json` | O gateway abre uma porta local de saúde (padrão `18790`, em `127.0.0.1`). Duas instâncias na mesma porta não sobem. Use `18790`, `18791`, `18792`... |
| Chave do LLM | **No piloto, a mesma chave em todas as instâncias** (veja "Provedor de LLM e sigilo" abaixo). |

### Provedor de LLM e sigilo

O nanobot manda para o provedor de LLM tudo o que passa pela conversa: as mensagens do advogado, **o texto das intimações coladas ou encaminhadas**, os resumos e as respostas das ferramentas do Tempestivo (nomes de processos, números, prazos e, fora dos processos em segredo de justiça, partes e clientes). Por isso:

- **Use um provedor com termos de não retenção de dados** (às vezes chamado de "zero data retention"): os dados não ficam guardados depois da resposta e não são usados para treinar modelos. Confira isso no contrato ou nos termos do plano contratado, não só na página de marketing. Em vários provedores, a não retenção depende de pedir ou de ativar na conta.
- **Conte isso aos advogados do piloto antes de começar:** o texto das intimações passa pelo provedor de LLM escolhido, além do WhatsApp. Quem preferir pode usar só o app, sem o agente.
- **No piloto, uma chave só para todas as instâncias.** O custo aparece somado, sem separar por advogado, e revogar a chave desliga todas as instâncias de uma vez. Guarde a chave só no `.env` de cada instância (permissão 600) e troque se alguém sair do piloto.

O canal WebSocket/WebUI do nanobot fica desligado no nosso `config.json`. Se alguém ligar, ele também precisa de uma porta própria (padrão `8765`).

### Passo a passo para cada advogado

Use um apelido curto, só com letras minúsculas (ex.: `ana`). Os comandos abaixo usam `ana`. Troque pelo apelido de cada um.

1. **No Tempestivo:**
   - o advogado entra pelo link mágico com o próprio e-mail;
   - em **Configurações > Agente > Gerar token**, ele gera um token de **Escrita** chamado "nanobot do piloto" e passa o token por um canal seguro.
2. **Usuário e nanobot** (com o usuário administrador):

   ```bash
   sudo adduser --disabled-password --gecos "" nanobot-ana
   sudo chmod 700 /home/nanobot-ana          # um advogado não lê a pasta do outro
   sudo -iu nanobot-ana
   curl -LsSf https://astral.sh/uv/install.sh | sh
   source ~/.local/bin/env
   uv tool install nanobot-ai
   nanobot plugins enable whatsapp
   ```

3. **Configuração** (ainda como `nanobot-ana`):

   ```bash
   mkdir -p ~/.nanobot/workspace
   cp /caminho/do/repo/agente/nanobot/config.example.json ~/.nanobot/config.json
   cp /caminho/do/repo/agente/nanobot/.env.example        ~/.nanobot/.env
   cp /caminho/do/repo/agente/nanobot/{SOUL.md,USER.md,HEARTBEAT.md} ~/.nanobot/workspace/
   chmod 600 ~/.nanobot/.env ~/.nanobot/config.json
   nano ~/.nanobot/.env                 # token deste advogado, número dele; a chave do LLM é a mesma do piloto
   nano ~/.nanobot/config.json          # gateway.port: 18790 na primeira instância, 18791 na segunda...
   nano ~/.nanobot/workspace/USER.md    # nome, áreas e tribunais deste advogado
   ```

   Copie o repositório para um lugar que todos os usuários leem (ex.: `/opt/tempestivo-agente`), ou use `scp` para cada casa.
4. **WhatsApp:** com o celular do número do agente desta instância, rode `set -a; source ~/.nanobot/.env; set +a`, depois `nanobot channels login whatsapp` e leia o QR. Confira com `nanobot channels status`.
5. **Serviço** (volte ao administrador com `exit`). O modelo é instalado uma vez só, e cada instância é ativada pelo apelido:

   ```bash
   sudo cp /caminho/do/repo/agente/systemd/nanobot-gateway@.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now nanobot-gateway@ana
   systemctl status nanobot-gateway@ana
   journalctl -u nanobot-gateway@ana -f
   ```

6. **Repita os passos 1 a 5** para o próximo advogado, com outro apelido, outro `gateway.port`, outro número de agente e outro token.

### Conferências do piloto

Faça estas conferências para cada instância, além das [verificações de segurança](#verificações-de-segurança-logo-após-instalar):

- **Instâncias de pé:** `systemctl list-units 'nanobot-gateway@*'` lista todas, ativas. Cada uma responde na sua porta: `curl -s http://127.0.0.1:18790/health`, `curl -s http://127.0.0.1:18791/health`...
- **Uma não enxerga a outra:** como administrador, `sudo ls /proc/$(systemctl show -p MainPID --value nanobot-gateway@ana)/root/home` deve mostrar só `nanobot-ana`. E `sudo -u nanobot-ana ls /home/nanobot-bia` deve dar "Permissão negada".
- **Dados separados:** o advogado A pergunta "quais prazos tenho?" e só recebe os dele. No Tempestivo de B, em Configurações > Agente > Atividade, não aparece nada da conversa de A.
- **Número certo:** mande uma mensagem do WhatsApp de B para o agente de A. Ela deve ser ignorada.

Para parar só uma instância: `sudo systemctl stop nanobot-gateway@ana`. Para tirá-la do piloto: `sudo systemctl disable --now nanobot-gateway@ana` e revogue o token dela no Tempestivo.

> Conferido na documentação do nanobot em 10/11/2026 (`docs/multiple-instances.md`, `docs/cli-reference.md`, `docs/deployment.md` e `nanobot/config/schema.py`): `gateway.host` e `gateway.port` (padrão `127.0.0.1:18790`), a necessidade de portas diferentes entre instâncias, a recomendação de contas do sistema separadas e o fim da ponte Node do WhatsApp. **Não confirmado:** o caminho padrão da sessão do WhatsApp quando `channels.whatsapp.databasePath` não está definido. Com um usuário Linux por instância, cada sessão fica na casa do próprio usuário de qualquer forma.

## Captura do DJEN (ainda não instalar)

A etapa 5 traz a captura das comunicações do DJEN pela OAB do advogado (desenho em `docs/relatorios/etapa-5.md`, código da fatia 1 em `docs/relatorios/etapa-5-fatia-1.md`). **Não instale ainda:** a migração 0006 ainda não foi aplicada, e a captura só pode ser ligada a partir da fatia 2, com a conferência do nome ("É você?").

**Por que na VPS.** O limite do DJEN é por IP, e o CNJ trata o uso de vários IPs para contornar o limite como abuso. Por isso a consulta nunca roda numa função da Vercel. Ela sai sempre do IP fixo da VPS, uma de cada vez.

**Como funciona:**

- `tempestivo-djen@<apelido>.timer` dispara às 7h, 12h e 17h (horário de Brasília).
- O serviço entra na fila única (`flock /run/lock/tempestivo-djen.lock`) e roda `node scripts/captura-djen.ts` como o usuário da instância, com o token e a URL do `.env` dela.
- O script pergunta ao Tempestivo se deve consultar:
  - às 7h, sim;
  - às 12h e às 17h, só se a tentativa anterior do dia falhou.
- Ele busca no DJEN, com pelo menos 5 s entre requisições e as esperas de limite e de erro, e repassa ao app só os campos necessários.
- O log tem só contagens e códigos HTTP.

**Requisito: Node.js 22.18 ou mais novo.** O script roda o TypeScript direto, sem `npm install` e sem build, porque essas versões do Node já leem TypeScript. O Ubuntu 24.04 traz o Node 18 no `apt`, que não serve. Instale o Node 24 LTS pela NodeSource, com o usuário administrador:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version                       # precisa ser v22.18 ou mais novo
```

**Instalação (quando a fatia 2 liberar),** com o usuário administrador:

```bash
sudo git clone git@github.com:GabrielAmaro-s/tempestivoapp.git /opt/tempestivo-agente   # ou scp; para atualizar, git pull
sudo cp /opt/tempestivo-agente/agente/systemd/tempestivo-djen.conf /etc/tmpfiles.d/
sudo systemd-tmpfiles --create /etc/tmpfiles.d/tempestivo-djen.conf
sudo cp /opt/tempestivo-agente/agente/systemd/tempestivo-djen@.service /opt/tempestivo-agente/agente/systemd/tempestivo-djen@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tempestivo-djen@ana.timer            # um por instância
systemctl list-timers 'tempestivo-djen@*'
sudo systemctl start tempestivo-djen@ana.service                 # rodada manual; o app decide se consulta
journalctl -u tempestivo-djen@ana -n 20
```

Sem a captura ligada no Tempestivo para aquela conta, o log mostra `sem consulta: desligada` e nenhuma requisição vai ao DJEN.

**Não testado na VPS:** a trava com `ProtectSystem=strict` e `fs.protected_regular`, o `OnCalendar` com fuso e o `--disable-warning` no Node da NodeSource. Confira os três na primeira instalação.

## Verificações de segurança (logo após instalar)

Faça estas três conferências antes de usar o agente no dia a dia:

1. **Sem terminal.** Mande pelo WhatsApp: *"rode ls /"*. O agente precisa responder que não tem ferramenta de terminal (ou equivalente), sem listar pastas. **Se ele executar o comando**, pare o serviço na hora (`sudo systemctl stop nanobot-gateway`). Corrija `tools.exec` no `~/.nanobot/config.json` (deve estar `"exec": { "enable": false }`; confira na documentação do nanobot se o nome da chave mudou) e só religue quando o teste passar.
2. **Só o seu número.** Mande uma mensagem de **outro número** para o agente. Ele deve ignorar: nenhuma resposta e nenhuma linha nova em Configurações > Agente > Atividade. Se responder, confira `WHATSAPP_PERMITIDO` e `channels.whatsapp.allowFrom`.
3. **Token e registro.** No Tempestivo, em **Configurações > Agente**, confira que o token usado pelo nanobot aparece como **Escrita**, com "Último uso" recente, e que a **Atividade do agente** registra as chamadas feitas nos testes (ex.: "Conferiu os lembretes").

## Pedidos de teste

1. **Cole o texto de uma intimação** (ex.: *"Intimação no processo 0001234-47.2026.8.21.0001, disponibilizada no DJe em 06/11/2026: manifeste-se em 15 dias sobre a contestação."*).
   O agente chama `registrar_intimacao` com `confirmado=false` e responde com o vencimento, o prazo interno e o aviso de que a contagem está em validação. Se o processo for cível sem "Juizado" no órgão, ele pergunta *"Vara comum ou juizado?"*. Só depois do seu "sim" ele cria o prazo, com os lembretes D-3, D-1 e no dia. Se o processo não existir na conta, ele diz isso e não cria nada.
2. **"Quais prazos tenho esta semana?"**
   Chama `prazos_proximos` e responde com os atrasados primeiro.
3. **"Cria 3 tarefas na Cobrança de aluguéis para sexta: revisar textos, juntar comprovantes e protocolar."**
   O agente chama `criar_tarefas` e responde algo como *"Criei 3 tarefas em Cobrança de aluguéis, prazo sexta."* com o link. No app, as tarefas aparecem em A fazer.
4. **"Me lembra amanhã às 15h de ligar para o cliente."**
   Chama `criar_lembrete`, cria um cron para amanhã às 15:00 e marca como agendado. Amanhã às 15h chega *"⏰ Ligar para o cliente"*. No app, o lembrete aparece em Hoje > Próximos lembretes.
5. **"Conclui as tarefas atrasadas da Cobrança de aluguéis."**
   Busca as tarefas, chama `concluir_em_lote` sem confirmar e pergunta *"Vou concluir 2 tarefas. Responda sim para confirmar."*. Só depois do seu "sim" ele conclui. Dá para desfazer em Configurações > Agente.

## Problemas comuns

- **401 do Tempestivo**: token errado, revogado ou expirado (90 dias por padrão). Gere outro e atualize `TEMPESTIVO_MCP_TOKEN`.
- **O agente não enxerga as ferramentas**: confira `TEMPESTIVO_MCP_URL` com `curl -i -X POST $TEMPESTIVO_MCP_URL`. Sem token, deve responder 401; isso prova que a rota está no ar.
- **Tempestivo pelo Tailscale**: se o nanobot bloquear o endereço `100.x` por proteção contra SSRF, acrescente `"ssrfWhitelist": ["100.64.0.0/10"]` dentro de `tools` no `config.json`.
- **Ele responde a outras pessoas**: confira `WHATSAPP_PERMITIDO`. Só esse número é atendido.

## Chaves conferidas na documentação do nanobot

Conferidas no código (`nanobot/config/schema.py`) e na documentação, em novembro de 2026: `providers.custom.apiKey/apiBase`, `modelPresets` + `agents.defaults.modelPreset`, `agents.defaults.timezone`/`timezoneMode`, `tools.restrictToWorkspace`, `tools.mcpServers.<nome>.url/headers/type/toolTimeout/enabledTools`, `gateway.heartbeat.enabled/intervalS` e a interpolação `${VAR}`.

Só na documentação, sem conferência no código: `tools.exec.enable` e as chaves do canal WhatsApp (`enabled`, `allowFrom`, `groupPolicy`). Se o nanobot recusar alguma delas ao iniciar, confira a seção correspondente em https://github.com/HKUDS/nanobot/tree/main/docs.
