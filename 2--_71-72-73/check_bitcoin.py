#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# ///
"""
Bitcoin Address Checker com Relatório Final
Lê arquivos addresses_checked.jsonl e extrai endereços com saldo
"""

import json
import os
from pathlib import Path

def is_line_with_balance(line: str) -> bool:
    zero_pattern = '"balance":0,"btc":"0.00000000","txCount":0}}}'
    if zero_pattern in line:
        return False
    try:
        data = json.loads(line)
        # Check root level balance
        final_balance = data.get('finalBalance', 0) or data.get('totalBalance', 0)
        final_btc = data.get('finalBalanceBtc', '0.00000000') or data.get('totalBtc', '0.00000000')
        n_tx = data.get('nTx', 0)
        
        try:
            btc_val = float(final_btc) if isinstance(final_btc, str) else final_btc
        except:
            btc_val = 0
            
        if final_balance > 0 or btc_val > 0 or n_tx > 0:
            return True
            
        # Check formats
        formats = data.get('formats', {})
        if isinstance(formats, dict):
            for fmt_name, fmt_data in formats.items():
                if isinstance(fmt_data, dict):
                    balance = fmt_data.get('balance', 0)
                    btc = fmt_data.get('btc', '0.00000000')
                    tx_count = fmt_data.get('txCount', 0)
                    try:
                        b_val = float(btc) if isinstance(btc, str) else btc
                    except:
                        b_val = 0
                    if balance > 0 or b_val > 0 or tx_count > 0:
                        return True
    except:
        pass
    return False

def main():
    # Diretório base
    script_dir = Path(__file__).parent.absolute()
    
    # Pastas a verificar
    puzzle_folders = [
        script_dir / "bitcoin" / "PUZZLE_71",
        script_dir / "bitcoin" / "PUZZLE_72",
        script_dir / "bitcoin" / "PUZZLE_73",
    ]
    
    # Diretório de saída
    relatorio_dir = script_dir / "relatorio_final"
    relatorio_dir.mkdir(exist_ok=True)
    
    # Arquivo de saída
    output_file = relatorio_dir / "bitcoin_addresses_with_balance.jsonl"
    
    results = []
    
    # Processa cada pasta
    for puzzle_folder in puzzle_folders:
        puzzle_name = puzzle_folder.name
        print(f"\n📂 Processando {puzzle_name}...")
        
        data_files = ["addresses_checked.jsonl", "batch_history.jsonl"]
        files_found = 0
        for file_name in data_files:
            jsonl_file = puzzle_folder / file_name
            if not jsonl_file.exists():
                continue
            
            files_found += 1
            print(f"📄 Lendo {file_name}...")
            try:
                with open(jsonl_file, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        if not line.strip():
                            continue
                        
                        try:
                            if is_line_with_balance(line):
                                data = json.loads(line)
                                results.append(line.strip())
                                
                                # Cabeçalho melhorado com informações fiéis ao arquivo
                                print(f"\n  ✓ Linha {line_num}")
                                print(f"    Timestamp: {data.get('timestamp', 'N/A')}")
                                print(f"    Private Key (Hex): {data.get('privHex', 'N/A')}")
                                print(f"    WIF: {data.get('wif', 'N/A')}")
                                print(f"    Status: {data.get('status', 'desconhecido').upper()}")
                                total_balance = data.get('totalBalance', 0) or data.get('finalBalance', 0)
                                total_btc_str = data.get('totalBtc', '0.00000000') or data.get('finalBalanceBtc', '0.00000000')
                                print(f"    Saldo Total: {total_balance} satoshis = {total_btc_str} BTC")
                                
                                # Mostra TODOS os formatos com seus dados reais
                                print(f"    Formatos disponíveis:")
                                formats = data.get('formats', {})
                                for format_name in ['BIP44U', 'BIP44C', 'BIP49', 'BIP84', 'BIP86']:
                                    if format_name in formats:
                                        fmt = formats[format_name]
                                        marker = "✦" if fmt.get('btc', '0.00000000') != '0.00000000' or fmt.get('balance', 0) > 0 else " "
                                        print(f"      {marker} {format_name}")
                                        print(f"        Endereço: {fmt.get('address', 'N/A')}")
                                        print(f"        Balance: {fmt.get('balance', 0)} satoshis")
                                        print(f"        BTC: {fmt.get('btc', '0.00000000')}")
                                        print(f"        Transações: {fmt.get('txCount', 0)}")
                        
                        except json.JSONDecodeError as e:
                            print(f"  ✗ Erro ao decodificar linha {line_num}: {e}")
                            continue
            
            except Exception as e:
                print(f"  ✗ Erro ao processar {jsonl_file}: {e}")
                continue
        
        if files_found == 0:
            print(f"⚠️  Nenhum arquivo de dados encontrado em {puzzle_folder}")
    
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
