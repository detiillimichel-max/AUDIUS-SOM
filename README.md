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

## Próximas camadas

- IndexedDB
- separação entre catálogo rotativo e dados permanentes da Minha Biblioteca
- Commit 2: camada IndexedDB local criada para catálogo, Favoritos, Playlists, Histórico e Configurações
- Commit 3: sincronizador remoto → IndexedDB com fallback local
- Rate Guard no PWA
- Storage Guard
- Modo Cinema
- Minha Biblioteca
- Player premium
- interface visual própria do AUDIUS-SOM

Documentação oficial: https://docs.audius.co/sdk/
