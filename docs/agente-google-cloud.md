# Agente do Tempestivo numa VM do Google Cloud

Passo a passo para subir o agente nanobot numa VM **e2-micro com Ubuntu 24.04** no Google Cloud, falando com o Tempestivo em produção e usando o Gemini como LLM. É a versão para o Google Cloud do "Passo a passo na VPS" do [agente/README.md](../agente/README.md), com o que muda nessa nuvem: o OS Login, o firewall da VPC, a memória de 1 GB e o provedor Gemini.

| Item | Valor |
|---|---|
| App | `https://tempestivo.vercel.app` |
| MCP | `https://tempestivo.vercel.app/api/mcp` |
| LLM | Gemini, pelo provedor próprio `gemini` do nanobot |
| VM | e2-micro (2 vCPU compartilhadas, 1 GB de memória), Ubuntu 24.04 |

## Regras durante a instalação

- **Segredos só na VM.** O token do MCP e a chave do Gemini são digitados direto no `~/.nanobot/.env` da VM, com o `nano`. Não vão para chat, e-mail, repositório nem para outro arquivo.
- **Nada de segredo na tela nem nos logs.** Não rode `cat ~/.nanobot/.env`, `env`, `set -x` nem `echo $LLM_API_KEY`. As checagens abaixo só mostram códigos de resposta e nomes de variáveis.
- **Uma checagem no fim de cada passo.** Só siga para o próximo passo quando a checagem der o resultado esperado.

## Passo 0. Criar a VM e dar permissão de administrador

1. Em **Compute Engine > Instâncias de VM > Criar instância**:
   - **Tipo de máquina:** e2-micro.
   - **Região:** `us-central1`, `us-west1` ou `us-east1`, se quiser ficar na camada gratuita (vale só nessas regiões).
   - **Disco de inicialização:** Ubuntu 24.04 LTS, disco padrão de até 30 GB.
   - **Firewall:** deixe desmarcados "Permitir tráfego HTTP" e "Permitir tráfego HTTPS". O agente não recebe conexões, só faz conexões de saída.
2. **Permissão de sudo.** A VM usa o OS Login, então quem entra pelo botão SSH só tem `sudo` se a conta Google tiver o papel **Compute OS Admin Login**. Sem ele, o `sudo` responde "I'm sorry ... I'm afraid I can't do that".
   - Pelo console: **IAM e administrador > IAM**, lápis na sua conta, **Adicionar outro papel > Compute OS Admin Login**, salvar.
   - Ou pelo Cloud Shell:

     ```bash
     gcloud projects add-iam-policy-binding SEU-PROJETO \
       --member="user:SEU-EMAIL-GOOGLE" --role="roles/compute.osAdminLogin"
     ```

   Se você não puder editar o IAM, peça o papel a quem é dono do projeto. Depois, **feche a janela de SSH e abra de novo**. A permissão pode levar um ou dois minutos para valer.

**Checagem:**

```bash
sudo -v && echo "sudo ok"
```

Esperado: `sudo ok`. Se a recusa continuar, veja os grupos da conta com `id`.

## Passo 1. Sistema, pacotes e swap de 2 GB

Com 1 GB de memória, a instalação do nanobot e o próprio agente podem ficar sem memória. O swap de 2 GB entra **antes** de instalar qualquer coisa do agente.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw python3 python3-venv

swapon --show                       # se já mostrar algum swap, pare e confira antes de criar outro
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Usar o swap só quando a memória apertar
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system
```

**Checagem:**

```bash
python3 --version
free -h
swapon --show
grep swapfile /etc/fstab
cat /proc/sys/vm/swappiness
```

Esperado:
- Python 3.12 (o nanobot pede 3.11 ou mais);
- `Swap: 2.0Gi` no `free -h`;
- `/swapfile` com `2G` no `swapon --show`;
- uma única linha do `/swapfile` no fstab;
- swappiness `10`.

## Passo 2. Tailscale, ufw e firewall do Google Cloud

Depois deste passo, nada entra na VM pela internet. Você passa a entrar pelo Tailscale.

### 2.1 Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh             # abra o link que aparecer e autorize a máquina
tailscale ip -4                     # anote o IP 100.x.y.z
```

No seu computador, com o Tailscale instalado e na mesma conta, **abra outro terminal** e teste antes de fechar qualquer coisa:

```bash
tailscale ssh SEU-USUARIO@tempestivo-agente
```

Siga para o ufw só quando esse acesso funcionar.

### 2.2 ufw (firewall da VM)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0
# Reserva: o botão SSH do console pelo IAP do Google continua funcionando
sudo ufw allow from 35.235.240.0/20 to any port 22 proto tcp
sudo ufw enable
```

### 2.3 Firewall da VPC (no Cloud Shell ou no seu computador com gcloud)

A rede `default` do Google Cloud vem com regras que abrem SSH (porta 22) e RDP (porta 3389) para a internet inteira (`0.0.0.0/0`). Feche as duas e deixe o SSH só para o IAP do Google:

```bash
gcloud compute firewall-rules list --format="table(name,direction,sourceRanges.list(),allowed[].map().firewall_rule().list())"
gcloud compute firewall-rules update default-allow-ssh --source-ranges=35.235.240.0/20
gcloud compute firewall-rules delete default-allow-rdp
```

Se o botão SSH do console parar de funcionar, entre pelo Tailscale. A recuperação de último caso é o console serial da VM.

**Checagem:**

```bash
sudo ufw status verbose
tailscale status
gcloud compute firewall-rules list --format="table(name,sourceRanges.list(),allowed[].map().firewall_rule().list())"   # no Cloud Shell
```

Esperado:
- ufw `Status: active`, com `deny (incoming)`, `ALLOW IN` em `tailscale0` e a porta 22 só para `35.235.240.0/20`;
- `tailscale status` mostrando a VM e o seu computador;
- nenhuma regra da VPC com `0.0.0.0/0` em portas TCP. Ficam só `default-allow-internal`, `default-allow-icmp` e `default-allow-ssh` com `35.235.240.0/20`.

## Passo 3. Usuário do agente e instalação do nanobot

O agente roda com o usuário `nanobot`, que não tem sudo.

```bash
sudo adduser --disabled-password --gecos "" nanobot
sudo chmod 700 /home/nanobot
sudo -iu nanobot                    # daqui em diante, como "nanobot"

curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.local/bin/env
uv tool install nanobot-ai          # pacote oficial no PyPI
nanobot plugins enable whatsapp
```

**Checagem** (ainda como `nanobot`):

```bash
whoami
nanobot --version
which nanobot
free -h
```

Esperado:
- `nanobot`;
- uma versão do nanobot;
- o caminho `/home/nanobot/.local/bin/nanobot`, que é o que o serviço do passo 7 usa;
- o swap usado, se aparecer, abaixo de 2 GB.

## Passo 4. Configuração

### 4.1 Subir os arquivos do repositório

Na janela de SSH do console, use **UPLOAD FILE** e envie estes quatro arquivos do repositório. Eles chegam na pasta do seu usuário administrador:

- `agente/nanobot/SOUL.md`
- `agente/nanobot/USER.md`
- `agente/nanobot/HEARTBEAT.md`
- `agente/systemd/nanobot-gateway.service`

Pelo seu computador, o mesmo com o gcloud:

```bash
gcloud compute scp agente/nanobot/{SOUL.md,USER.md,HEARTBEAT.md} agente/systemd/nanobot-gateway.service \
  tempestivo-agente:~ --zone SUA-ZONA
```

Com o **usuário administrador** (saia do `nanobot` com `exit`), mova os arquivos do workspace para a casa do `nanobot`:

```bash
sudo install -d -o nanobot -g nanobot -m 700 /home/nanobot/.nanobot /home/nanobot/.nanobot/workspace
sudo install -o nanobot -g nanobot -m 600 ~/SOUL.md ~/USER.md ~/HEARTBEAT.md /home/nanobot/.nanobot/workspace/
rm ~/SOUL.md ~/USER.md ~/HEARTBEAT.md
sudo -iu nanobot
```

### 4.2 config.json

Ainda como `nanobot`, cole o bloco inteiro. As aspas em `'EOF'` impedem o terminal de trocar os `${...}`: quem os troca é o nanobot, ao iniciar.

```bash
cat > ~/.nanobot/config.json <<'EOF'
{
  "providers": {
    "gemini": {
      "apiKey": "${LLM_API_KEY}"
    }
  },
  "modelPresets": {
    "padrao": {
      "model": "${LLM_MODELO}",
      "provider": "gemini"
    }
  },
  "agents": {
    "defaults": {
      "modelPreset": "padrao",
      "timezone": "America/Sao_Paulo",
      "timezoneMode": "manual"
    }
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["${WHATSAPP_PERMITIDO}"],
      "groupPolicy": "mention"
    }
  },
  "tools": {
    "restrictToWorkspace": true,
    "exec": {
      "enable": false
    },
    "mcpServers": {
      "tempestivo": {
        "type": "streamableHttp",
        "url": "${TEMPESTIVO_MCP_URL}",
        "headers": {
          "Authorization": "Bearer ${TEMPESTIVO_MCP_TOKEN}"
        },
        "toolTimeout": 60,
        "enabledTools": ["*"]
      }
    }
  },
  "gateway": {
    "host": "127.0.0.1",
    "port": 18790,
    "heartbeat": {
      "enabled": true,
      "intervalS": 900
    }
  }
}
EOF
chmod 600 ~/.nanobot/config.json
```

É o `agente/nanobot/config.example.json` com uma diferença: o bloco `providers` usa o provedor `gemini` do nanobot em vez do `custom`. Por que esse provedor:

- O registro de provedores do nanobot tem uma entrada `gemini` que já aponta para `https://generativelanguage.googleapis.com/v1beta/openai/`.
- A documentação recomenda o provedor próprio quando existe um. O `custom` com essa URL também funcionaria, mas não foi testado com o Gemini.

Conferido em 10/11/2026 em `nanobot/providers/registry.py`, `nanobot/config/schema.py` e `docs/configuration.md` do HKUDS/nanobot.

### 4.3 .env com os segredos

Primeiro, crie o arquivo com os campos que não são segredo:

```bash
cat > ~/.nanobot/.env <<'EOF'
TEMPESTIVO_MCP_URL=https://tempestivo.vercel.app/api/mcp
TEMPESTIVO_MCP_TOKEN=
LLM_API_KEY=
LLM_MODELO=gemini-2.5-flash
WHATSAPP_PERMITIDO=
EOF
chmod 600 ~/.nanobot/.env
nano ~/.nanobot/.env
```

No `nano`, digite os três campos vazios depois do `=`, sem aspas e sem espaços:

| Variável | O que digitar |
|---|---|
| `TEMPESTIVO_MCP_TOKEN` | O token `tempestivo_...` gerado em **Configurações > Agente > Gerar token** (tipo **Escrita**). Só o token, sem `Bearer`. |
| `LLM_API_KEY` | A chave da API do Gemini, do Google AI Studio. |
| `WHATSAPP_PERMITIDO` | O seu número, só dígitos, com 55 e DDD, sem `+` (ex.: `5551999998888`). |

Salve com Ctrl+O e Enter, e saia com Ctrl+X.

**Sigilo no Gemini.** Isto não vem da documentação do nanobot; confira nos termos do Google AI Studio. No plano gratuito da API do Gemini, o Google pode usar o conteúdo enviado para melhorar os produtos. No plano pago, não usa. As intimações levam dados de clientes, então ative o faturamento no projeto da chave antes de usar com casos reais. Veja também "Provedor de LLM e sigilo" no [agente/README.md](../agente/README.md).

### 4.4 USER.md

```bash
nano ~/.nanobot/workspace/USER.md
```

Troque os campos entre `< >`:
- **Nome:** como o agente deve chamar você.
- **Áreas principais:** ex.: cível, trabalhista, previdenciário.
- **Tribunais em que mais atua:** ex.: TJRS, TRT4.

Ajuste também o horário do resumo do dia, se não for 8h.

**Checagem** (como `nanobot`; nenhum comando mostra valores):

```bash
python3 -m json.tool ~/.nanobot/config.json > /dev/null && echo "config ok"
awk -F= 'NF && $2=="" {print "VAZIO:", $1}' ~/.nanobot/.env; echo "fim da conferência do .env"
stat -c '%a %U %n' ~/.nanobot/.env ~/.nanobot/config.json
grep -c '<' ~/.nanobot/workspace/USER.md

set -a; source ~/.nanobot/.env; set +a
# Chave do Gemini: só o código HTTP
curl -s -o /dev/null -w "gemini: %{http_code}\n" \
  -H "Authorization: Bearer $LLM_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/openai/models
# Token do MCP: só o código HTTP
curl -s -o /dev/null -w "mcp: %{http_code}\n" -X POST "$TEMPESTIVO_MCP_URL" \
  -H "Authorization: Bearer $TEMPESTIVO_MCP_TOKEN" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# Modelo: o agente responde pelo terminal, sem WhatsApp
nanobot agent -m "Responda só: ok"
```

Esperado:
- `config ok`;
- nenhuma linha `VAZIO:`;
- `600 nanobot` nos dois arquivos;
- `0` no `grep` (o comentário final do USER.md tem `<!--`, então `1` também é normal);
- `gemini: 200` (`400` ou `401` indica chave errada);
- `mcp: 200` (`401` indica token errado ou revogado);
- uma resposta curta do agente.

Se o agente reclamar do nome do modelo, confira o nome na lista de modelos do Google AI Studio. A documentação do nanobot não mostra o formato, mas pelo código ele envia o nome sem mudança, então use `gemini-2.5-flash` sem prefixo.

## Passo 5. Conferir rede antes de parear o WhatsApp

Antes de ligar o WhatsApp, confirme que o gateway só escuta na própria VM e que nada está aberto para a internet.

```bash
set -a; source ~/.nanobot/.env; set +a
nanobot gateway --foreground &      # sobe sem WhatsApp vinculado; avisos sobre o WhatsApp são esperados
sleep 15
ss -tlnp | grep 18790
curl -s http://127.0.0.1:18790/health; echo
kill %1
```

Com o usuário administrador:

```bash
sudo ss -tlnp
sudo ufw status verbose
```

No seu computador, fora do Tailscale (com o Tailscale desligado ou de outra rede), use o IP externo da VM, que aparece na lista de instâncias:

```bash
nc -vz -w 5 IP-EXTERNO 18790
nc -vz -w 5 IP-EXTERNO 22
```

**Checagem.** Esperado:
- o gateway em `127.0.0.1:18790`, nunca `0.0.0.0:18790` nem `*:18790`;
- o `/health` respondendo;
- no `sudo ss -tlnp`, nada além de `127.0.0.1` ou `127.0.0.53` fora o `sshd` e o `tailscaled`;
- ufw ativo como no passo 2;
- os dois `nc` com tempo esgotado ou recusa. Se a porta 22 abrir de fora, a regra da VPC do passo 2.3 não foi aplicada.

Se o gateway aparecer em `0.0.0.0`, pare aqui e confira `gateway.host` no `config.json`.

## Passo 6. Parear o WhatsApp e testar em primeiro plano

No WhatsApp do número do agente (o ideal é um chip só para isso):
- **Nome do perfil:** Tempestivo.
- **Foto:** o símbolo `docs/marca/logos/tempestivo-simbolo.svg`, exportado em PNG 640x640.

Como `nanobot`:

```bash
set -a; source ~/.nanobot/.env; set +a
nanobot channels login whatsapp
```

No celular do número do agente: **WhatsApp > Configurações > Aparelhos conectados > Conectar um aparelho** e aponte para o QR do terminal.

```bash
nanobot channels status
nanobot gateway --verbose
```

Mande "oi" do seu WhatsApp para o número do agente. Se ele responder, pare com Ctrl+C.

**Checagem:**

```bash
nanobot channels status
grep -rl "tempestivo_" ~/.nanobot --include='*.log' 2>/dev/null | wc -l
```

Esperado:
- o WhatsApp como conectado;
- a resposta ao "oi";
- `0` arquivos de log com o token.

## Passo 7. Serviço com reinício automático

Com o usuário administrador:

```bash
sudo install -o root -g root -m 644 ~/nanobot-gateway.service /etc/systemd/system/
rm ~/nanobot-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now nanobot-gateway
```

Depois de mudar o `config.json` ou o `.env`: `sudo systemctl restart nanobot-gateway`.

**Checagem:**

```bash
systemctl is-active nanobot-gateway
systemctl is-enabled nanobot-gateway
sudo ss -tlnp | grep 18790
journalctl -u nanobot-gateway --since "10 min ago" | tail -n 30
journalctl -u nanobot-gateway | grep -c "tempestivo_"
free -h
```

Esperado:
- `active` e `enabled`;
- a porta de novo em `127.0.0.1:18790`;
- logs sem erro repetido;
- `0` linhas com o token;
- memória e swap com folga.

Para conferir que o serviço volta sozinho: `sudo reboot`, entre de novo pelo Tailscale e repita `systemctl is-active nanobot-gateway`.

## Passo 8. Verificações de segurança e teste com intimação

### 8.1 Segurança

Faça as três verificações de [agente/README.md, "Verificações de segurança"](../agente/README.md#verificações-de-segurança-logo-após-instalar):
1. **Sem terminal:** "rode ls /" não lista pastas.
2. **Só o seu número:** a mensagem de outro número é ignorada.
3. **Token e registro:** o token aparece como Escrita, com uso recente.

### 8.2 Intimação de exemplo

Mande pelo WhatsApp este texto de exemplo (fictício):

> Intimação. Processo 5001234-56.2026.8.21.0001, 3ª Vara Cível do Foro Central de Porto Alegre. Fica a parte autora intimada, na pessoa de sua procuradora, para apresentar réplica à contestação no prazo de 15 (quinze) dias. Disponibilizada no DJEN em 09/11/2026.

**Checagem.** Esperado, em ordem:

1. **Pede o "sim" antes de gravar.**
   - O agente mostra o processo, o ato, o prazo fatal calculado e a memória de cálculo, e termina com "Responda *sim* para registrar."
   - Se perguntar "vara comum ou juizado?", responda "vara comum".
2. **Nada gravado antes do "sim".** No Tempestivo, a tarefa **não** existe e **Configurações > Agente > Atividade** não mostra registro.
3. **Grava com o "sim".**
   - Responda *sim*. O agente confirma o registro.
   - A tarefa aparece no quadro com o selo do prazo, e a Atividade mostra a chamada com "Desfazer".
4. **Lembrete agendado.**
   - Peça "me lembra disso dois dias antes do prazo interno". O lembrete aparece na tarefa no Tempestivo.
   - Na VM, como `nanobot`, `nanobot cron list` mostra o agendamento. Se o comando tiver outro nome na sua versão, veja `nanobot --help`.
   - O HEARTBEAT confere os lembretes a cada 15 minutos.
5. **Limpeza.** Use "Desfazer" na Atividade ou apague a tarefa de teste, para o exemplo não ficar no quadro.

Com tudo isso passando, o agente está pronto para o uso diário.
