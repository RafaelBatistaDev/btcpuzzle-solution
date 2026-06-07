# /// script
# requires-python = ">=3.11"
# ///

import hashlib

# --- utilitários base58 para suporte a wif ---
BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def b58_decode(v: str) -> bytes:
    """Decodifica uma string Base58 para bytes."""
    n = 0
    for char in v:
        n = n * 58 + BASE58_ALPHABET.index(char)
    res = bytearray()
    while n > 0:
        res.append(n & 0xff)
        n >>= 8
    pad = 0
    for char in v:
        if char == '1': pad += 1
        else: break
    return bytes([0] * pad) + bytes(reversed(res))

def b58_encode(b: bytes) -> str:
    """Codifica bytes para uma string Base58."""
    n = int.from_bytes(b, byteorder='big')
    res = []
    while n > 0:
        n, r = divmod(n, 58)
        res.append(BASE58_ALPHABET[r])
    pad = 0
    for byte in b:
        if byte == 0: pad += 1
        else: break
    return '1' * pad + ''.join(reversed(res))


# --- funções core do sistema ---

def get_puzzle_range(bit_number: int) -> tuple[str, str]:
    """
    Retorna o rangeMin e rangeMax em formato hexadecimal de 256 bits
    com base no número do puzzle (quantidade de bits).
    """
    # Min: 2^(bit-1)
    min_val = 2 ** (bit_number - 1)
    # Max: (2^bit) - 1
    max_val = (2 ** bit_number) - 1
    
    # Formata para string hex preenchendo com zeros à esquerda (64 caracteres = 256 bits)
    range_min = f"0x{min_val:064x}"
    range_max = f"0x{max_val:064x}"
    
    return range_min, range_max


def wif_to_hex(wif_key: str) -> tuple[str, bool]:
    """
    Converte uma chave privada WIF para HEX.
    Retorna uma tupla: (chave_hex, is_compressed)
    """
    decoded = b58_decode(wif_key)
    payload = decoded[:-4]
    checksum = decoded[-4:]
    expected_checksum = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    
    if checksum != expected_checksum:
        raise ValueError("Checksum do WIF inválido.")
    if payload[0] != 0x80:
        raise ValueError("Prefixo de rede inválido (deve ser 0x80).")
    
    if len(payload) == 34 and payload[-1] == 0x01:
        is_compressed = True
        private_key_bytes = payload[1:-1]
    elif len(payload) == 33:
        is_compressed = False
        private_key_bytes = payload[1:]
    else:
        raise ValueError("Tamanho de payload WIF inválido.")
        
    return private_key_bytes.hex(), is_compressed


def hex_to_wif(hex_key: str, compressed: bool = True) -> str:
    """
    Converte uma chave privada HEX para o formato WIF (Compressed ou Uncompressed).
    """
    hex_clean = hex_key.replace("0x", "").zfill(64)
    private_key_bytes = bytes.fromhex(hex_clean)
    
    payload = b'\x80' + private_key_bytes
    if compressed:
        payload += b'\x01'
        
    checksum = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    return b58_encode(payload + checksum)


# --- PONTO DE EXECUÇÃO INTEGRADO ---
if __name__ == "__main__":
    # 1. PARTE: Mapeamento de Range do Endereço Alvo
    TARGET_ADDRESS = "18uhzy546Qz7CxRNkHohg4W9VSkfTkbSvY"
    BIT_NUMBER = 130 
    
    range_min, range_max = get_puzzle_range(BIT_NUMBER)
    
    print("=" * 70)
    print(f"🎯 ENDEREÇO ALVO : {TARGET_ADDRESS}")
    print(f"📊 BIT DO PUZZLE  : {BIT_NUMBER} bits")
    print("-" * 70)
    print(f"🔹 RANGE MINIMO   : {range_min}")
    print(f"🔸 RANGE MAXIMO   : {range_max}")
    print("=" * 70)
    print("\n" + "=" * 70)
    
    # 2. PARTE: Ferramenta de Conversão Integrada (Exemplo base: Puzzle 64)
    print("🛠️ TOOLKIT DE CONVERSÃO WIF / HEX INTEGRADO")
    print("=" * 70)
    
    # Exemplo de entrada WIF (Altere aqui para o valor que deseja converter)
    SAMPLE_WIF = "KwDiBf89QgG21AukvXU37wAngS89v5u1C6Zp5E7sV9B5xEXXmE6B"
    print(f"📥 WIF Entrada   : {SAMPLE_WIF}")
    
    try:
        # Conversão WIF -> HEX
        hex_out, is_comp = wif_to_hex(SAMPLE_WIF)
        print(f"🔓 HEX Saída     : 0x{hex_out}")
        print(f"📦 Tipo Chave    : {'Comprimida' if is_comp else 'Não Comprimida'}")
        
        # Teste do caminho inverso HEX -> WIF para validação de integridade
        wif_back = hex_to_wif(hex_out, compressed=is_comp)
        print(f"🔄 Validação WIF : {wif_back}")
        
    except Exception as e:
        print(f"❌ Erro na conversão: {e}")
    print("=" * 70)