# 📡 Redes RPC e APIs de Consulta

Este documento detalha as configurações reais de rede, endpoints RPC, chaves de API e limites de taxa (Rate Limit) utilizados pelo projeto para a consulta de saldos dos puzzles **71**, **72** e **73** nas redes **Bitcoin**, **Ethereum**, **Solana**, **Polygon** e **BNB Chain**.

As configurações apresentadas abaixo são sincronizadas dinamicamente a partir do arquivo [.env](file:///var/home/recifecrypto/2--71-72-73/.env) e validadas pelo módulo [config.js](file:///var/home/recifecrypto/2--71-72-73/config.js).

---

## 📊 Visão Geral das Conexões

A tabela a seguir resume os parâmetros e endpoints de rede configurados e ativos no projeto:

| Rede | Provedor / API | Endpoint RPC / API | Variável de Ambiente | Atraso Médio | Limite Diário |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Bitcoin** | Blockchain.info API | `https://blockchain.info` | `BLOCKCHAIN_INFO_BASE_URL` | `2000 ms` | `30.000` |
| **Ethereum** | Etherscan REST API V2 | `https://api.etherscan.io/v2/api` | `ETH_RPC_ENDPOINT` | `200 ms` | `100.000` |
| **Solana** | Helius RPC Premium | `https://mainnet.helius-rpc.com/` | `SOL_RPC_ENDPOINT` | `110 ms` | `30.000` |
| **Polygon** | dRPC Nodes | `https://lb.drpc.org/ogrpc` | `POLYGON_RPC_ENDPOINT` | `300 ms` | `10.000` |
| **BNB Chain** | Binance Dataseed / BscScan | `https://bsc-dataseed.binance.org` | `BNB_RPC_ENDPOINT` | `200 ms` | `100.000` |

---

## ⚙️ Especificação por Rede

### 1. Bitcoin (BTC)
*   **Finalidade**: Verificação de saldos para chaves secp256k1 derivadas em formatos múltiplos (BIP44 Legacy, BIP49 Nested SegWit, BIP84 Native SegWit, BIP86 Taproot).
*   **Provedor**: [Blockchain.info API](https://blockchain.info)
*   **Configuração**:
    *   `BLOCKCHAIN_INFO_BASE_URL`: `https://blockchain.info`
    *   `BTC_PUBLIC_API_DELAY_MS`: `2000`
*   **Endereços Alvo (Targets)**:
    *   **Puzzle 71**: `1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU`
    *   **Puzzle 72**: `1JTK7s9YVYywfm5XUH7RNhHJH1LshCaRFR`
    *   **Puzzle 73**: `12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4`
*   **Controle de Taxa**:
    *   Atraso estrito de `2000ms` entre lotes para evitar banimento temporário por IP da API pública da Blockchain.info.
    *   Fallback de cooldown de `10s` para erros HTTP `429`.

### 2. Ethereum (ETH)
*   **Finalidade**: Verificação de saldos em formato EVM secp256k1 com suporte a endereços com EIP-55 checksum.
*   **Provedor**: [Etherscan API REST V2](https://etherscan.io/)
*   **Configuração**:
    *   `ETH_RPC_ENDPOINT`: `https://api.etherscan.io/v2/api`
    *   `ETHERSCAN_KEY`: `Sua Chave`
    *   `ETH_DELAY_MS`: `200`
    *   `ETH_TIMEOUT_MS`: `10000`
*   **Endereços Alvo (Targets)**:
    *   **Puzzle 71**: `0x00000000219ab540356cBB839Cbe05303d7705Fa`
    *   **Puzzle 72**: `0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8`
    *   **Puzzle 73**: `0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489`
*   **Controle de Taxa**:
    *   Atraso de `200ms` entre requisições.
    *   Limite diário de `100.000` requisições (`ETH_MAX_REQ_24H`).

### 3. Solana (SOL)
*   **Finalidade**: Verificação de endereços Solana derivados em base58 (criptografia ed25519).
*   **Provedor**: [Helius RPC](https://helius.dev/)
*   **Configuração**:
    *   `SOL_RPC_ENDPOINT`: `https://mainnet.helius-rpc.com/?api-key=Sua Chave`
    *   `SOL_DELAY_MS`: `110`
    *   `SOL_TIMEOUT_MS`: `3000`
*   **Endereços Alvo (Targets)**:
    *   **Puzzle 71**: `4ZJhPQAgUseCsWhKvJLTmmRRUV74fdoTpQLNfKoekbPY`
    *   **Puzzle 72**: `9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM`
    *   **Puzzle 73**: `7mhcgF1DVsj5iv4CxZDgp51H6MBBwqamsH1KnqXhSRc5`
*   **Controle de Taxa**:
    *   Atraso de `110ms` para garantir estabilidade abaixo do limite de 10 req/s da API gratuita da Helius.

### 4. Polygon (POLYGON)
*   **Finalidade**: Verificação secundária de rede EVM utilizando dRPC Nodes balanceados.
*   **Provedor**: [dRPC Nodes](https://drpc.org/)
*   **Configuração**:
    *   `POLYGON_RPC_ENDPOINT`: `https://lb.drpc.org/ogrpc?network=polygon&dkey=Sua Chave`
    *   `POLYGON_API_KEY`: `https://lb.drpc.org/ogrpc?network=polygon&dkey=Sua Chave`
    *   `POLYGON_DELAY_MS`: `300`
    *   `POLYGON_TIMEOUT_MS`: `5000`
*   **Endereços Alvo (Targets)**:
    *   **Puzzle 71**: `0x00000000219ab540356cBB839Cbe05303d7705Fa`
    *   **Puzzle 72**: `0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8`
    *   **Puzzle 73**: `0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489`

### 5. BNB Chain (BNB / BSC)
*   **Finalidade**: Verificação rápida de saldos utilizando RPC principal do BNB e BscScan.
*   **Provedor**: [Binance Dataseed RPC](https://bsc-dataseed.binance.org) e [BscScan API](https://bscscan.com/)
*   **Configuração**:
    *   `BNB_RPC_ENDPOINT`: `https://bsc-dataseed.binance.org`
    *   `BSCSCAN_KEY`: `Sua Chave`
    *   `BNB_DELAY_MS`: `200`
    *   `BNB_TIMEOUT_MS`: `10000`
*   **Endereços Alvo (Targets)**:
    *   **Puzzle 71**: `0x00000000219ab540356cBB839Cbe05303d7705Fa`
    *   **Puzzle 72**: `0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8`
    *   **Puzzle 73**: `0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489`

---

## 🔍 Scripts de Validação e Diagnóstico

O projeto disponibiliza scripts focados em verificar a saúde das RPCs e a validade das credenciais antes de iniciar a varredura pesada:

1.  **Diagnóstico das RPCs** ([test-rpc-endpoints.js](file:///var/home/recifecrypto/2--71-72-73/test-rpc-endpoints.js)): Executa chamadas leves em cada RPC para testar o tempo de resposta e integridade da conexão.
    ```bash
    node test-rpc-endpoints.js
    ```
2.  **Validador de Configuração** ([test-config.js](file:///var/home/recifecrypto/2--71-72-73/test-config.js)):
    ```bash
    node test-config.js
    ```
3.  **Auditorias Avançadas (Python)**:
    Scripts robustos para auditar exaustivamente latência, chamadas padrão e tratamento de rate limits específicos por rede:
    ```bash
    python3 audit_bitcoin_network.py
    python3 audit_ethereum_network.py
    python3 audit_solana_network.py
    python3 audit_polygon_network.py
    uv run audit_bnb_network.py
    ```
