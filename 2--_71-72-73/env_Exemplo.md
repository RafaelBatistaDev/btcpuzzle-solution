# ============================================
# RUNTIME SETTINGS
# ============================================

# Tamanho do lote de busca
BATCH_SIZE=1

# Delay entre requisições (ms)
DELAY_MS=50

# Máximo de requisições em 24h
MAX_REQ_24H=30000

# Timeout para requisições (ms)
TIMEOUT_MS=3000

# Modo de busca: SEMPRE 'sequential' (sem opção de random)
SEARCH_MODE=sequential


# ============================================
# BITCOIN — API COMPARTILHADA (P2PKH + P2WPKH)
# Suporta: Mempool.space, Blockchain.info
# ============================================

BLOCKCHAIN_INFO_BASE_URL=https://blockchain.info
#BLOCKCHAIN_INFO_BASE_URL=https://mempool.space/api

# Delay global do rate limiter no modo alternado (P2PKH ↔ P2WPKH)
BTC_DELAY_MS=2000

# ============================================
# BITCOIN P2PKH
# ============================================
BTC_P2PKH_BATCH_SIZE=20
BTC_P2PKH_DELAY_MS=2000
BTC_P2PKH_INITIAL_DELAY_MS=0
BTC_P2PKH_MAX_REQ_24H=30000
BTC_P2PKH_TIMEOUT_MS=3000

BTC_P2PKH_TARGET_71=1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU
BTC_P2PKH_TARGET_72=1JTK7s9YVYywfm5XUH7RNhHJH1LshCaRFR
BTC_P2PKH_TARGET_73=12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4

# ============================================
# BITCOIN P2WPKH (SegWit)
# ============================================
BTC_P2WPKH_BATCH_SIZE=20
BTC_P2WPKH_DELAY_MS=2000
BTC_P2WPKH_INITIAL_DELAY_MS=0
BTC_P2WPKH_MAX_REQ_24H=30000
BTC_P2WPKH_TIMEOUT_MS=3000

BTC_P2WPKH_TARGET_71=bc1q0j55cut9nd2c88tnnsfultdx696c8lt6n4n0su
BTC_P2WPKH_TARGET_72=bc1ql49ydapnjafl5t2cp9zqpjwe6pdgmxy98859v2
BTC_P2WPKH_TARGET_73=bc1qazcm763858nkj2dj986etajv6wquslv8uxwczt

# -------- BITCOIN P2SH-P2WPKH (SegWit wrapped / BIP49) --------
BTC_P2SH_BATCH_SIZE=20
BTC_P2SH_DELAY_MS=2000
BTC_P2SH_INITIAL_DELAY_MS=0
BTC_P2SH_MAX_REQ_24H=30000
BTC_P2SH_TIMEOUT_MS=3000

BTC_P2SH_TARGET_71=36rRUPzhHyrkyNq9PD2B8WpTikki459JRn
BTC_P2SH_TARGET_72=323Wf631NrQ7MAfdJ1cB6k5kaTfKAK1c7C
BTC_P2SH_TARGET_73=3Ji9Q4ZX8uKVawfsarpck3RSzaA8rj8R4r

# ============================================
# ETHEREUM CONFIGURATION (Etherscan REST API V2)
# ============================================

# API Endpoint para Ethereum
ETH_RPC_ENDPOINT=https://api.etherscan.io/v2/api

# Etherscan API Key
ETHERSCAN_KEY=Sua Chave

# Targets para Ethereum Puzzles
ETH_TARGET_71=0x00000000219ab540356cBB839Cbe05303d7705Fa
ETH_TARGET_72=0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8
ETH_TARGET_73=0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489

# Delays e Timeouts
ETH_DELAY_MS=200
ETH_MAX_REQ_24H=100000
ETH_INITIAL_DELAY_MS=0
ETH_TIMEOUT_MS=10000

# ============================================
# SOLANA CONFIGURATION (Helius Free - 10 req/sec)
# ============================================

# RPC Endpoint para Solana
SOL_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=Sua Chave

# Configurações Solana
SOL_DELAY_MS=110
SOL_TIMEOUT_MS=3000

# Targets para Solana Puzzles
SOL_TARGET_71=4ZJhPQAgUseCsWhKvJLTmmRRUV74fdoTpQLNfKoekbPY
SOL_TARGET_72=9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
SOL_TARGET_73=7mhcgF1DVsj5iv4CxZDgp51H6MBBwqamsH1KnqXhSRc5

# ============================================
# POLYGON CONFIGURATION (dRPC - 100 RPS)
# ============================================

# RPC e API Key dRPC
POLYGON_RPC_ENDPOINT=https://lb.drpc.org/ogrpc?network=polygon&dkey=Sua Chave
POLYGON_API_KEY=https://lb.drpc.org/ogrpc?network=polygon&dkey=Sua Chave

# Targets para Polygon Puzzles
POLYGON_TARGET_71=0x00000000219ab540356cBB839Cbe05303d7705Fa
POLYGON_TARGET_72=0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8
POLYGON_TARGET_73=0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489

# Configurações Polygon
POLYGON_DELAY_MS=300
POLYGON_INITIAL_DELAY_MS=100
POLYGON_TIMEOUT_MS=5000

# ============================================
# BNB CONFIGURATION (BscScan REST API)
# ============================================

# RPC Endpoint para BNB Chain
BNB_RPC_ENDPOINT=https://bsc-dataseed.binance.org

# BscScan API Key
BSCSCAN_KEY=8GS74KI7YYVW3M5V5WZ4SGJHHU85HA6JTX

# Targets para BNB Puzzles
BNB_TARGET_71=0x00000000219ab540356cBB839Cbe05303d7705Fa
BNB_TARGET_72=0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8
BNB_TARGET_73=0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489

# Configurações BNB
BNB_DELAY_MS=200
BNB_MAX_REQ_24H=100000
BNB_INITIAL_DELAY_MS=100
BNB_TIMEOUT_MS=10000