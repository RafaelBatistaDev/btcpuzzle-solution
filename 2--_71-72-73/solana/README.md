# Solana Puzzle Solver - Estrutura

Pasta criada a partir da estrutura do `ethereum/`, adaptada para rede Solana (SOL).

## Adaptações Realizadas

### 1. **Criptografia (ed25519 vs secp256k1)**
   - Ethereum: `secp256k1` + `keccak256` → addresses hex com checksum EIP-55
   - Solana: `ed25519` + `blake2b/SHA-256` → addresses base58

### 2. **Módulos Alterados**

#### `config/config.js`
- `ETH_TARGET_xx` → `SOL_TARGET_xx`
- RPC endpoint: Ethereum Ankr → Solana RPC (`mainnet-beta`, `devnet`, `testnet`)
- Ranges de puzzle mantidas (adaptáveis conforme necessário)

#### `config/utils.js` 
- Classe `CryptoEngine` usa `nacl` (ed25519) em vez de `elliptic` (secp256k1)
- `privkeyToAddress()`: Converte para base58 Solana
- `isValidAddress()`: Valida addresses Solana (32 bytes em base58)

#### `config/solver.js`
- Classe `SolanaSolver` em vez de `EthereumSolver`
- RPC method: `getBalance` (Solana) em vez de `eth_getBalance` (Ethereum)
- Unidades: Lamports (1 SOL = 1e9 Lamports) em vez de Wei
- Arquivo de saída: `solana_addresses_with_balance.jsonl`

#### `config/balance_checker.js`
- Classe `SolanaBalanceChecker` 
- Lê from `solana_addresses_with_balance.jsonl`

#### `config/balance_verifier.js`
- Classe `SolanaBalanceVerifier`
- Method: `getBalance` para Solana

#### `config/check_batch_history.js`
- Gera relatórios com prefixo `solana_report_`

### 3. **Estrutura de Pastas Preservada**

```
solana/
├── config/           # Módulos Solana
├── cache/            # Estado persistente (puzzle_71-73.json)
├── logs/             # Logs de execução
└── PUZZLE_71/        # Resultados individuais
    ├── batch_history.jsonl
    └── addresses_checked.jsonl
```

## Dependências Adicionadas para Solana

```json
{
  "bs58": "^5.0.0",          // Encoding base58 para addresses Solana
  "tweetnacl": "^1.0.3",     // ed25519 signing
  "js-sha256": "^0.9.0"      // SHA-256 hashing
}
```

## Uso

```bash
# Executar solver para Puzzle 71
PUZZLE_ID=71 node solana/config/solver.js

# Verificar balances
PUZZLE_ID=72 node solana/config/balance_checker.js

# Gerar relatório
node solana/config/check_batch_history.js
```

## Notas Importantes

- ⚠️ **NÃO foram modificadas** as pastas `ethereum/`, `bitcoin/` e scripts principais da raiz
- Ranges e targets podem ser atualizados em `solana/config/config.js`
- RPC endpoint padrão: mainnet-beta (altere em `.env` ou `config.js`)
- Arquivo consolidado de achados: `relatorio_final/solana_addresses_with_balance.jsonl`
