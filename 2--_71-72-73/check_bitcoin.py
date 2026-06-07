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
        jsonl_file = puzzle_folder / "addresses_checked.jsonl"
        
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
                        
                        # Verifica totalBalance e totalBtc
                        total_balance = data.get('totalBalance', 0)
                        total_btc_str = data.get('totalBtc', '0.00000000')
                        
                        # Converte totalBtc para float
                        try:
                            total_btc = float(total_btc_str) if isinstance(total_btc_str, str) else total_btc_str
                        except (ValueError, TypeError):
                            total_btc = 0
                        
                        has_balance = False
                        addresses_with_balance = []
                        
                        # Se totalBalance > 0 ou totalBtc > 0, tem saldo
                        if (isinstance(total_balance, (int, float)) and total_balance > 0) or total_btc > 0:
                            has_balance = True
                        
                        # Verifica cada formato individual para TODOS os campos
                        formats = data.get('formats', {})
                        for format_name, format_data in formats.items():
                            if isinstance(format_data, dict):
                                balance = format_data.get('balance', 0)
                                btc_str = format_data.get('btc', '0.00000000')
                                tx_count = format_data.get('txCount', 0)
                                
                                # Converte btc para float
                                try:
                                    btc_val = float(btc_str) if isinstance(btc_str, str) else btc_str
                                except (ValueError, TypeError):
                                    btc_val = 0
                                
                                # Se tem balance > 0 ou btc > 0 ou txCount > 0, registra
                                if (isinstance(balance, (int, float)) and balance > 0) or btc_val > 0 or tx_count > 0:
                                    has_balance = True
                                    addresses_with_balance.append({
                                        'formato': format_name,
                                        'endereco': format_data.get('address'),
                                        'saldo_satoshis': balance,
                                        'saldo_btc': btc_str,
                                        'tx_count': tx_count
                                    })
                        
                        # Se encontrou saldo em algum lugar, adiciona ao resultado
                        if has_balance:
                            result = {
                                'puzzle': puzzle_name,
                                'arquivo': str(jsonl_file),
                                'linha': line_num,
                                'saldo_total_satoshis': total_balance,
                                'saldo_total_btc': total_btc_str,
                                'enderecos_com_evidencia': addresses_with_balance,
                                'status': data.get('status', 'desconhecido'),
                                'privHex': data.get('privHex', 'N/A'),
                                'wif': data.get('wif', 'N/A'),
                                'dados_completos': data
                            }
                            results.append(result)
                            
                            # Cabeçalho melhorado com informações fiéis ao arquivo
                            print(f"\n  ✓ Linha {line_num}")
                            print(f"    Timestamp: {data.get('timestamp', 'N/A')}")
                            print(f"    Private Key (Hex): {data.get('privHex', 'N/A')}")
                            print(f"    WIF: {data.get('wif', 'N/A')}")
                            print(f"    Status: {data.get('status', 'desconhecido').upper()}")
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
