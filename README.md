# 🎧 AUDIUS-SOM

PWA musical baseado no Audius, com catálogo preparado para o **Modo Cinema**.

## Commit 1 — Motor de catálogo

- 10 blocos
- até 100 músicas por bloco
- renovação independente
- TTL de 7 dias por bloco
- verificação diária do GitHub Actions
- somente blocos expirados fazem chamadas ao Audius
- catálogo anterior permanece se uma renovação falhar
- nenhuma credencial Bearer vai para o PWA

## Commit 2 — IndexedDB

Stores separadas para catálogo, Favoritos, Playlists, Histórico e Configurações. A atualização do catálogo não apaga a Minha Biblioteca.

## Commit 3 — Sincronizador

`data/catalogo.json` → IndexedDB, com fallback para o último catálogo local.

## Commit 4 — Inicialização local-first

O PWA abre primeiro o IndexedDB e inicia a sincronização remota em segundo plano.

## Commit 5 — Catálogo real na interface

A interface agora consome os eventos do sincronizador:

1. 🟢 `audius:catalog-ready` renderiza imediatamente o catálogo local;
2. 🔄 `audius:catalog-updated` substitui silenciosamente a tela pelos blocos sincronizados;
3. 🟡 `audius:catalog-update-error` mantém o conteúdo local;
4. cada bloco aparece como uma seção horizontal;
5. cada faixa mostra capa, título, artista, gênero, duração e acesso para ouvir no Audius.

O catálogo continua sendo somente metadados nesta fase. O player nativo do AUDIUS-SOM será construído posteriormente.

## Próximas camadas

- Rate Guard
- Storage Guard
- Modo Cinema
- Minha Biblioteca
- player premium próprio
- favoritos e playlists na interface

Documentação oficial: https://docs.audius.co/sdk/
