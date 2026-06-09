#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# ///
"""
Polygon Address Checker com Relatório Final
Lê arquivos batch_history.jsonl e extrai endereços com saldo
"""

import json
import os
from pathlib import Path

def is_line_with_balance(line: str) -> bool:
    zero_pattern = '"balance":"0","finalBalance":0,"finalBalanceMatic":"0.000000000000000000","nTx":0}'
    if zero_pattern in line:
        return False
    try:
        data = json.loads(line)
        balance_str = data.get('balance', '0')
        final_balance = data.get('finalBalance', 0)
        final_matic = data.get('finalBalanceMatic', '0.000000000000000000')
        n_tx = data.get('nTx', 0)
        if balance_str != '0' or final_balance != 0 or final_matic != '0.000000000000000000' or n_tx != 0:
            return True
    except:
        pass
    return False

def main():
    # Diretório base
    script_dir = Path(__file__).parent.absolute()
    
    # Pastas a verificar
    puzzle_folders = [
        script_dir / "polygon" / "PUZZLE_71",
        script_dir / "polygon" / "PUZZLE_72",
        script_dir / "polygon" / "PUZZLE_73",
    ]
    
    # Diretório de saída
    relatorio_dir = script_dir / "relatorio_final"
    relatorio_dir.mkdir(exist_ok=True)
    
    # Arquivo de saída
    output_file = relatorio_dir / "polygon_addresses_with_balance.jsonl"
    
    results = []
    
    # Processa cada pasta
    for puzzle_folder in puzzle_folders:
        jsonl_file = puzzle_folder / "batch_history.jsonl"
        
        if not jsonl_file.exists():
            print(f"⚠️  Arquivo não encontrado: {jsonl_file}")
            continue
        
        puzzle_name = puzzle_folder.name
        print(f"\n📂 Processando {puzzle_name}...")
        
        try:
            with open(jsonl_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if not line.strip():
                        continue
                    
                    try:
                        if is_line_with_balance(line):
                            data = json.loads(line)
                            results.append(line.strip())
                            
                            # Exibe informações encontradas
                            print(f"\n  ✓ Linha {line_num}")
                            print(f"    Timestamp: {data.get('timestamp', 'N/A')}")
                            print(f"    Endereço: {data.get('addr', 'N/A') or data.get('address', 'N/A')}")
                            print(f"    Private Key (Hex): {data.get('privHex', 'N/A')}")
                            print(f"    Privkey Length: {data.get('privkey_length', 0)}")
                            print(f"    Saldo: {data.get('balance', '0')}")
                    
                    except json.JSONDecodeError as e:
                        print(f"  ✗ Erro ao decodificar linha {line_num}: {e}")
                        continue
        
        except Exception as e:
            print(f"  ✗ Erro ao processar {jsonl_file}: {e}")
            continue
    
    # Salva resultados
    if results:
        with open(output_file, 'w', encoding='utf-8') as f:
            for result in results:
                f.write(result + '\n')
        
        print(f"\n✅ Total de endereços com saldo encontrados: {len(results)}")
        print(f"📄 Relatório salvo em: {output_file}")
    else:
        print("\n⚠️  Nenhum endereço com saldo encontrado")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("")

if __name__ == "__main__":
    main()
