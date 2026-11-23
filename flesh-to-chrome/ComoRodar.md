# Como rodar Flesh to Chrome

Este documento explica como instalar e executar o jogo, iniciar o multiplayer e conectar dois jogadores no mesmo computador, na mesma rede local ou em redes diferentes.

## 1. Pré-requisitos

Instale:

- Node.js 20 LTS ou mais recente;
- npm, normalmente instalado junto com o Node.js;
- um navegador atual com suporte a WebRTC, como Chrome, Chromium, Firefox ou Edge.

Confirme a instalação:

```bash
node --version
npm --version
```

## 2. Instalar o projeto

No terminal, entre na pasta do jogo e instale as dependências:

```bash
cd flesh-to-chrome
npm install
```

Esse procedimento só precisa ser repetido quando as dependências do projeto forem alteradas.

## 3. Executar o jogo localmente

Dentro de `flesh-to-chrome`, execute:

```bash
npm run dev
```

Depois, abra no navegador:

```text
http://localhost:1234
```

Também é possível utilizar:

```bash
npm start
```

Esse comando inicia o Parcel e tenta abrir o navegador automaticamente.

Para encerrar o servidor, pressione `Ctrl+C` no terminal.

## 4. Gerar uma versão de produção

Execute:

```bash
npm run build
```

Os arquivos finais serão criados na pasta `dist/`. Eles precisam ser publicados por um servidor HTTP; não abra `dist/index.html` diretamente pelo explorador de arquivos.

## 5. Como funciona o multiplayer

O multiplayer é uma corrida para dois jogadores. O servidor WebSocket apresenta os jogadores da mesma sala e o WebRTC estabelece a comunicação da partida.

O comando de desenvolvimento utiliza:

| Serviço | Porta padrão | Função |
| --- | ---: | --- |
| Jogo/Parcel | `1234` | Entrega a página e os assets do jogo |
| Sinalização WebSocket | `8080` | Encontra e conecta os dois jogadores |

O servidor de sinalização não transmite continuamente o gameplay. Depois da negociação, os navegadores tentam se comunicar diretamente. Em algumas redes, o tráfego precisa passar por um servidor TURN.

## 6. Testar o multiplayer no mesmo computador

Para um teste rápido em duas abas do mesmo navegador, inicie somente o jogo:

```bash
npm run dev
```

Abra a mesma URL nas duas abas:

```text
http://localhost:1234/?signal=local&room=TESTE
```

O parâmetro `signal=local` utiliza `BroadcastChannel` e dispensa o servidor WebSocket. As duas abas devem usar exatamente o mesmo valor de `room`.

Esse modo serve apenas para testes no mesmo navegador e no mesmo dispositivo. Ele não conecta computadores diferentes.

## 7. Jogar em dispositivos na mesma rede

Os dois dispositivos devem estar conectados à mesma rede local, por cabo ou Wi-Fi.

### 7.1. No computador anfitrião

Dentro de `flesh-to-chrome`, execute:

```bash
npm run dev:multiplayer
```

Esse comando inicia o jogo na porta `1234` e a sinalização na porta `8080`. O terminal mostrará um ou mais endereços semelhantes a:

```text
Jogo na rede local: http://192.168.1.10:1234
```

Abra o endereço que utiliza o IP da rede local. Para gerar um convite válido, não abra o jogo como `localhost`, pois `localhost` no dispositivo convidado apontaria para o próprio dispositivo dele.

### 7.2. Criar e compartilhar a sala

1. No menu principal, selecione **Multiplayer**.
2. Aguarde a entrada no lobby.
3. Selecione **Copiar convite para o oponente**.
4. Envie o link copiado ao segundo jogador.
5. O convidado deve abrir o link completo no navegador.
6. Quando os dois jogadores estiverem conectados, a largada será sincronizada automaticamente.

O link contém um identificador semelhante a:

```text
http://192.168.1.10:1234/?room=1880D954
```

### 7.3. Firewall

Se o segundo dispositivo não conseguir abrir o jogo ou entrar na sala, permita conexões de entrada para o Node.js ou libere no firewall do anfitrião:

- TCP `1234`, para o jogo;
- TCP `8080`, para a sinalização WebSocket.

Em redes Wi-Fi com isolamento de clientes, como algumas redes públicas e de visitantes, dispositivos conectados ao mesmo roteador podem não conseguir se comunicar. Nesse caso, desative o isolamento, use outra rede ou utilize a configuração para redes diferentes.

## 8. Jogar em dispositivos de redes diferentes

Para redes diferentes, o jogo e a sinalização precisam estar acessíveis publicamente. Além disso, redes com NAT restritivo ou CGNAT normalmente exigem TURN.

Há duas formas principais de disponibilizar o jogo.

### 8.1. Teste por IP público e redirecionamento de portas

No roteador da rede do anfitrião:

1. Redirecione a porta TCP `1234` para a porta `1234` do computador anfitrião.
2. Redirecione a porta TCP `8080` para a porta `8080` do computador anfitrião.
3. Libere as mesmas portas no firewall do computador.
4. Execute `npm run dev:multiplayer`.
5. Abra e compartilhe `http://IP_PUBLICO:1234`.

Ao acessar o jogo pelo IP público, o cliente tenta usar automaticamente:

```text
ws://IP_PUBLICO:8080/ws
```

Essa opção é adequada somente para testes. Ela pode não funcionar quando o provedor utiliza CGNAT, quando o roteador bloqueia redirecionamento ou quando o navegador/rede exige HTTPS.

Não exponha permanentemente o servidor de desenvolvimento na internet. Ele não possui autenticação de usuários e foi criado para playtests.

### 8.2. Publicação com domínio, HTTPS e WSS

Para uma instalação pública mais estável:

1. Publique o conteúdo de `dist/` em um servidor HTTPS.
2. Execute `server/signaling-server.mjs` em um servidor acessível publicamente.
3. Coloque a sinalização atrás de um proxy reverso com TLS, como Caddy ou Nginx.
4. Encaminhe `/ws` e `/ice-config` do domínio público para a porta interna `8080`.
5. Informe a sinalização no endereço do jogo:

```text
https://jogo.exemplo.com/?signal=wss://sinal.exemplo.com/ws
```

Quando a página usa HTTPS, a sinalização também deve usar `wss://`. Navegadores normalmente bloqueiam `ws://` dentro de uma página HTTPS por ser conteúdo inseguro.

O endpoint `/ice-config` deve estar disponível no mesmo domínio da sinalização. O jogo converte automaticamente `wss://sinal.exemplo.com/ws` em `https://sinal.exemplo.com/ice-config` para obter a configuração STUN/TURN.

## 9. Configurar STUN e TURN

O projeto usa, por padrão, o STUN público:

```text
stun:stun.l.google.com:19302
```

STUN é suficiente em algumas redes, mas não garante conexão entre todos os tipos de NAT. Para partidas confiáveis entre redes diferentes, configure um servidor TURN próprio, como Coturn, ou um serviço TURN gerenciado.

As variáveis aceitas pelo servidor são:

| Variável | Valor padrão | Descrição |
| --- | --- | --- |
| `SIGNALING_HOST` | `0.0.0.0` | Interface em que a sinalização escuta |
| `SIGNALING_PORT` | `8080` | Porta HTTP/WebSocket da sinalização |
| `GAME_PORT` | `1234` | Porta mostrada nos endereços do jogo |
| `STUN_URL` | `stun:stun.l.google.com:19302` | Servidor STUN |
| `TURN_URL` | não definido | Endereço do servidor TURN |
| `TURN_USERNAME` | não definido | Usuário TURN |
| `TURN_CREDENTIAL` | não definido | Senha/credencial TURN |
| `MAX_PEERS_PER_ROOM` | `2` | Limite de jogadores por sala |

Se `SIGNALING_PORT` for diferente de `8080`, informe o endereço completo ao abrir o jogo, por exemplo `?signal=ws://IP_DO_HOST:9090/ws`. A variável `GAME_PORT` é usada pelo servidor de sinalização para mostrar o endereço no terminal; para mudar de fato a porta do Parcel, também é necessário iniciar o jogo com a opção `--port` correspondente.

Exemplo de execução com TURN:

```bash
TURN_URL="turn:turn.exemplo.com:3478?transport=udp" \
TURN_USERNAME="usuario" \
TURN_CREDENTIAL="senha" \
npm run dev:multiplayer
```

Em um servidor publicado, as mesmas variáveis podem ser usadas ao executar somente a sinalização:

```bash
SIGNALING_PORT=8080 \
TURN_URL="turns:turn.exemplo.com:5349?transport=tcp" \
TURN_USERNAME="usuario" \
TURN_CREDENTIAL="senha" \
npm run signaling
```

Não armazene credenciais TURN reais no repositório.

## 10. Verificações e solução de problemas

### O segundo jogador não abre o jogo

- Confirme que ele recebeu um endereço com o IP correto, e não `localhost`.
- Teste se `http://IP_DO_HOST:1234` abre no segundo dispositivo.
- Verifique firewall, isolamento do Wi-Fi e redirecionamento da porta `1234`.

### O jogo abre, mas fica aguardando oponente

- Confirme que os dois links possuem o mesmo parâmetro `room`.
- Verifique a sinalização em:

```text
http://IP_DO_HOST:8080/health
```

- Confirme que a porta `8080` está liberada.
- Abra o console do navegador e procure erros de WebSocket ou WebRTC.

### Funciona na mesma rede, mas não em redes diferentes

- Verifique se o provedor utiliza CGNAT.
- Confirme o redirecionamento das portas públicas.
- Configure TURN; STUN sozinho não atravessa todos os NATs e firewalls.
- Em páginas HTTPS, utilize obrigatoriamente sinalização `wss://`.

### Verificar a configuração ICE

Com a sinalização em execução, abra:

```text
http://IP_DO_HOST:8080/ice-config
```

A resposta deve listar o STUN e, quando configurado, o TURN.

## 11. Comandos úteis

| Comando | Função |
| --- | --- |
| `npm run dev` | Executa o jogo localmente |
| `npm start` | Executa o jogo e tenta abrir o navegador |
| `npm run dev:network` | Expõe somente o jogo na rede local |
| `npm run signaling` | Executa somente o servidor de sinalização |
| `npm run dev:multiplayer` | Executa jogo e sinalização juntos |
| `npm run build` | Gera os arquivos de produção em `dist/` |
| `npm run typecheck` | Verifica os tipos TypeScript |
| `npm run test:multiplayer` | Executa os testes do protocolo multiplayer |
| `npm run validate:assets` | Valida mapas e assets do jogo |

