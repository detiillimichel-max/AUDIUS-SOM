# 🎧 AUDIUS-SOM

PWA musical baseado no Audius, com catálogo preparado para o **Modo Cinema**.

## Commit 1 — Motor de catálogo

O coração do projeto começa separado da interface:

- 10 blocos de catálogo
- até 100 músicas por bloco
- renovação independente por bloco
- TTL de 7 dias por bloco
- verificação diária do GitHub Actions
- somente blocos expirados fazem chamadas ao Audius
- catálogo anterior permanece se uma renovação falhar
- máximo de 100 músicas por chamada
- chamadas sequenciais com pausa para manter margem abaixo do limite de requisições
- nenhuma credencial Bearer vai para o PWA

### Blocos iniciais

1. 🔥 Trending
2. 💎 Underground
3. 🆕 Latest
4. 🎛️ Electronic
5. 🎤 Hip-Hop/Rap
6. ✨ Pop
7. 🎸 Rock
8. 🌙 Ambient
9. 🏠 House
10. 🧭 Descobertas

Resultado: **até 1.000 faixas de catálogo**, organizadas em blocos independentes.

## Segurança

O GitHub Actions usa somente `AUDIUS_API_KEY` para as consultas públicas do catálogo. O `AUDIUS_BEARER_TOKEN` não é enviado ao navegador.

## Commit 2 — IndexedDB

A camada local possui stores separadas para:

- catálogo rotativo
- Favoritos
- Playlists
- Histórico
- Configurações

A atualização do catálogo não apaga os dados permanentes da Minha Biblioteca.

## Commit 3 — Sincronizador

O sincronizador faz:

`data/catalogo.json` → IndexedDB

Se o remoto falhar, o último catálogo local permanece disponível.

## Commit 4 — Inicialização local-first

A abertura do PWA agora segue esta ordem:

1. 🟢 abre primeiro o catálogo existente no IndexedDB;
2. 📱 a interface pode começar a renderizar sem esperar a rede;
3. 🔄 a sincronização de `data/catalogo.json` começa em segundo plano;
4. 💾 somente blocos alterados são gravados;
5. 🟡 se o remoto falhar, o catálogo local continua disponível;
6. ✓ quando o remoto volta, a atualização acontece silenciosamente.

Eventos disponíveis para a interface:

- `audius:catalog-ready`
- `audius:catalog-updated`
- `audius:catalog-update-error`

O Commit 4 ainda não implementa o player ou o visual final. Ele estabelece a abertura correta do PWA.

## Próximas camadas

- Rate Guard no PWA
- Storage Guard
- Modo Cinema
- Minha Biblioteca
- Player premium
- interface visual própria do AUDIUS-SOM

Documentação oficial: https://docs.audius.co/sdk/
