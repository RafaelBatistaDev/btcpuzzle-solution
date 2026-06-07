# /// script
# requires-python = ">=3.11"
# ///

import hashlib
import os

# =========================================================================
# 1. CORE: UTILITÁRIOS CRIPTOGRÁFICOS NATIVOS REUTILIZÁVEIS
# =========================================================================

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def b58_encode(b: bytes) -> str:
    """Codifica uma sequência de bytes para uma string Base58Check."""
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


# Parâmetros estruturais da curva secp256k1 do Bitcoin
P = 2**256 - 2**32 - 977
Gx = 55066263022246183897908585404863132223214828135062534571946059489240402808027
Gy = 32670510020758816978082121356073111456784846614131557062402120005701625904943
G = (Gx, Gy)

def inv(n, p=P):
    """Inverso modular usando o Pequeno Teorema de Fermat."""
    return pow(n, p - 2, p)

def ec_add(p1, p2):
    """Adição de pontos na curva elíptica."""
    if p1 is None: return p2
    if p2 is None: return p1
    (x1, y1), (x2, y2) = p1, p2
    if x1 == x2 and y1 != y2: return None
    if x1 == x2:
        m = (3 * x1 * x1) * inv(2 * y1)
    else:
        m = (y2 - y1) * inv(x2 - x1)
    x3 = (m * m - x1 - x2) % P
    y3 = (m * (x1 - x3) - y1) % P
    return (x3, y3)

def ec_mul(k, p=G):
    """Multiplicação escalar de pontos usando o método Double-and-Add."""
    r = None
    for bit in bin(k)[2:]:
        r = ec_add(r, r)
        if bit == '1': r = ec_add(r, p)
    return r

def private_key_to_addresses(privkey_hex: str) -> tuple[str, str]:
    """
    Deriva matematicamente os endereços comprimido e não comprimido
    com base na curva elíptica aplicada à chave privada HEX de 256 bits.
    """
    k = int(privkey_hex.replace("0x", ""), 16)
    if k == 0:
        return "Invalido (K=0)", "Invalido (K=0)"
    pub_point = ec_mul(k)
    if pub_point is None:
        return "Invalido", "Invalido"
    
    x, y = pub_point
    pub_uncomp = b'\x04' + x.to_bytes(32, 'big') + y.to_bytes(32, 'big')
    prefix = b'\x02' if y % 2 == 0 else b'\x03'
    pub_comp = prefix + x.to_bytes(32, 'big')
    
    def to_address(pub_bytes: bytes) -> str:
        sha = hashlib.sha256(pub_bytes).digest()
        h = hashlib.new('ripemd160', sha).digest()
        payload = b'\x00' + h
        checksum = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
        return b58_encode(payload + checksum)
        
    return to_address(pub_comp), to_address(pub_uncomp)


# =========================================================================
# 2. EXTENSÃO: VALIDADOR E FORMATADOR DE STRINGS LITERAIS
# =========================================================================

def normalizar_hex_padrao(hex_input: str) -> str:
    """
    Garante que a string possua o prefixo 0x e exatamente 64 caracteres de dados,
    preservando o alinhamento de zeros à esquerda que você colou.
    """
    clean = str(hex_input).strip().replace("0x", "").lower()
    # Garante preenchimento de 64 caracteres caso falte algum zero por erro de cópia
    return f"0x{clean.zfill(64)}"


def processar_e_imprimir_formato_exato(name: str, target: str, r_min_raw: str, r_max_raw: str, filename: str = "resultado_puzzle.txt"):
    """
    Processa as entradas, converte para o formato matemático estrito de 256 bits 
    e imprime/salva com os nomes exatos de chaves solicitados.
    """
    # Normaliza as entradas de range mantendo a integridade matemática
    r_min_valido = normalizar_hex_padrao(r_min_raw)
    r_max_valido = normalizar_hex_padrao(r_max_raw)
    
    # Define a chave inicial como sendo o rangeMin absoluto calculado
    initial_privkey = r_min_valido
    
    # Calcula os endereços correspondentes de teste para validação
    addr_comp, addr_uncomp = private_key_to_addresses(initial_privkey)
    
    # Estruturação final exata solicitada no seu prompt
    bloco_saida = ("{\n"
                   f"    name: '{name}',\n"
                   f"    target: '{target}',\n"
                   f"    rangeMin: '{r_min_valido}',\n"
                   f"    rangeMax: '{r_max_valido}',\n"
                   f"    initialPrivkey: '{initial_privkey}',\n"
                   f"    expectedAddrComp: '{addr_comp}',\n"
                   f"    expectedAddrUncomp: '{addr_uncomp}',\n"
                   "}")
    
    # Print direto na tela para cópia imediata no terminal
    print(bloco_saida)
    
    # Persistência estável em arquivo de texto
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(bloco_saida + "\n")
    except Exception as e:
        print(f"\n❌ Erro ao salvar arquivo: {e}")


# =========================================================================
# 3. EDITE APENAS ESTAS 4 LINHAS SEMPRE QUE O SITE MUDAR
# =========================================================================
if __name__ == "__main__":
    
    NAME      = 'PUZZLE_73'
    TARGET    = '12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4'
    RANGE_MIN = '0000000000000000000000000000000000000000000001000000000000000000'
    RANGE_MAX = '0000000000000000000000000000000000000000000001ffffffffffffffffff'
    
    # Executa a geração do output e gravação em disco
    processar_e_imprimir_formato_exato(
        name=NAME,
        target=TARGET,
        r_min_raw=RANGE_MIN,
        r_max_raw=RANGE_MAX,
        filename="resultado_puzzle.txt"
    )