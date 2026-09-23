# 🗄️ Arquitetura do IndexedDB

O IndexedDB será a camada local do AUDIUS-SOM.

## Regra principal

O catálogo Audius é **rotativo**. A Biblioteca do usuário é **permanente**.

Uma renovação do catálogo nunca deve apagar:
- ❤️ Favoritos
- 📀 Playlists
- 🕘 Histórico
- ⚙️ Configurações

## Stores planejados

```text
IndexedDB: audius-som
│
├── catalog_blocks
│   └── blocos rotativos do catálogo Audius
│
├── favorites
│   └── músicas marcadas com ❤️
│
├── playlists
│   └── playlists criadas pelo usuário
│
├── history
│   └── histórico de reprodução
│
└── settings
    └── preferências do aplicativo
```

## Catálogo

Cada bloco de `catalog_blocks` terá, conceitualmente:

- `blockId`
- `label`
- `updatedAt`
- `tracks[]`

O catálogo remoto atual possui 10 blocos, com até 100 faixas por bloco.

O TTL do catálogo é de **7 dias**. A renovação continua sendo independente por bloco.

## Separação de responsabilidades

**GitHub Actions + Audius**
→ gera e atualiza o catálogo público.

**PWA + IndexedDB**
→ lê o catálogo localmente e mantém os dados pessoais do usuário.

**Modo Cinema**
→ consumirá primeiro o catálogo local disponível, evitando chamadas desnecessárias ao Audius.

## Próxima implementação

A próxima camada de código deverá:

1. criar o banco IndexedDB;
2. criar as stores;
3. carregar `data/catalogo.json`;
4. salvar/atualizar somente os blocos do catálogo;
5. preservar Favoritos, Playlists, Histórico e Configurações;
6. permitir fallback local quando o catálogo remoto estiver indisponível.

Nenhum áudio será baixado nesta etapa. Estamos armazenando **metadados do catálogo**, não os arquivos de música.
