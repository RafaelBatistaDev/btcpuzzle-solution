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
                        data = json.loads(line)
                        
                        # Verifica balance
                        balance_str = data.get('balance', '0')
                        
                        # Converte balance para float
                        try:
                            balance = float(balance_str)
                        except (ValueError, TypeError):
                            balance = 0
                        
                        # Se tem saldo > 0, adiciona ao resultado
                        if balance > 0:
                            result = {
                                'puzzle': puzzle_name,
                                'arquivo': str(jsonl_file),
                                'linha': line_num,
                                'endereco': data.get('addr', 'N/A'),
                                'saldo': balance_str,
                                'privHex': data.get('privHex', 'N/A'),
                                'privkey_length': data.get('privkey_length', 0),
                                'timestamp': data.get('timestamp', 'N/A'),
                                'dados_completos': data
                            }
                            results.append(result)
                            
                            # Exibe informações encontradas
                            print(f"\n  ✓ Linha {line_num}")
                            print(f"    Timestamp: {data.get('timestamp', 'N/A')}")
                            print(f"    Endereço: {data.get('addr', 'N/A')}")
                            print(f"    Private Key (Hex): {data.get('privHex', 'N/A')}")
                            print(f"    Privkey Length: {data.get('privkey_length', 0)}")
                            print(f"    Saldo: {balance_str}")
                    
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
                f.write(json.dumps(result, ensure_ascii=False) + '\n')
        
        print(f"\n✅ Total de endereços com saldo encontrados: {len(results)}")
        print(f"📄 Relatório salvo em: {output_file}")
    else:
        print("\n⚠️  Nenhum endereço com saldo encontrado")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("")

if __name__ == "__main__":
    main()
