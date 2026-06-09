#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# ///
"""
MASTER - Address Checker para todos os 5 Networks
Bitcoin, Ethereum, Solana, Polygon, BNB
Consolida resultados em relatorio_final/
"""

import json
from pathlib import Path
from typing import List, Dict, Tuple

def extract_address(data: dict) -> str:
    """
    Extrai o endereço de forma flexível de diferentes formatos de JSON.
    """
    if 'addr' in data:
        return str(data['addr'])
    if 'address' in data:
        return str(data['address'])
    
    # Verifica dentro de 'formats' (formato Bitcoin)
    formats = data.get('formats')
    if isinstance(formats, dict):
        addresses = []
        for fmt_name, fmt_data in formats.items():
            if isinstance(fmt_data, dict):
                addr = fmt_data.get('address') or fmt_data.get('addr')
                if addr:
                    addresses.append(f"{fmt_name}:{addr}")
        if addresses:
            return ", ".join(addresses)
            
    return 'N/A'

def is_line_with_balance_for_network(line: str, network_name: str) -> bool:
    if network_name == "bnb":
        zero_pattern = '"balance":"0","finalBalance":0,"finalBalanceBnb":"0.000000000000000000","nTx":0}'
        if zero_pattern in line:
            return False
        try:
            data = json.loads(line)
            if data.get('balance', '0') != '0' or data.get('finalBalance', 0) != 0 or data.get('finalBalanceBnb', '0.000000000000000000') != '0.000000000000000000' or data.get('nTx', 0) != 0:
                return True
        except:
            pass
    elif network_name == "bitcoin":
        zero_pattern = '"balance":0,"btc":"0.00000000","txCount":0}}}'
        if zero_pattern in line:
            return False
        try:
            data = json.loads(line)
            if data.get('finalBalance', 0) != 0 or data.get('finalBalanceBtc', '0.00000000') != '0.00000000' or data.get('nTx', 0) != 0:
                return True
            formats = data.get('formats', {})
            if isinstance(formats, dict):
                for fmt_name, fmt_data in formats.items():
                    if isinstance(fmt_data, dict):
                        if fmt_data.get('balance', 0) != 0 or fmt_data.get('btc', '0.00000000') != '0.00000000' or fmt_data.get('txCount', 0) != 0:
                            return True
        except:
            pass
    elif network_name == "ethereum":
        zero_pattern = '"balance":"0","finalBalance":0,"finalBalanceEth":"0.000000000000000000","nTx":0}'
        if zero_pattern in line:
            return False
        try:
            data = json.loads(line)
            if data.get('balance', '0') != '0' or data.get('finalBalance', 0) != 0 or data.get('finalBalanceEth', '0.000000000000000000') != '0.000000000000000000' or data.get('nTx', 0) != 0:
                return True
        except:
            pass
    elif network_name == "polygon":
        zero_pattern = '"balance":"0","finalBalance":0,"finalBalanceMatic":"0.000000000000000000","nTx":0}'
        if zero_pattern in line:
            return False
        try:
            data = json.loads(line)
            if data.get('balance', '0') != '0' or data.get('finalBalance', 0) != 0 or data.get('finalBalanceMatic', '0.000000000000000000') != '0.000000000000000000' or data.get('nTx', 0) != 0:
                return True
        except:
            pass
    elif network_name == "solana":
        zero_pattern = '"balance":"0","finalBalance":0,"finalBalanceSol":"0.000000000","uiAmount":0,"decimals":0,"note":"Account not initialized (zero balance)","nTx":0}'
        if zero_pattern in line:
            return False
        try:
            data = json.loads(line)
            if data.get('balance', '0') != '0' or data.get('finalBalance', 0) != 0 or data.get('finalBalanceSol', '0.000000000') != '0.000000000' or data.get('uiAmount', 0) != 0 or data.get('nTx', 0) != 0 or data.get('note', 'Account not initialized (zero balance)') != 'Account not initialized (zero balance)':
                return True
        except:
            pass
    return False

def check_network(network_name: str, script_dir: Path) -> Tuple[int, List[str]]:
    """
    Verifica endereços com saldo para uma rede específica buscando em todos os arquivos
    addresses_checked.jsonl e batch_history.jsonl.
    Retorna: (total_encontrado, lista_de_resultados_linhas_cruas)
    """
    
    # Configuração por rede
    puzzle_folders = [
        script_dir / network_name / "PUZZLE_71",
        script_dir / network_name / "PUZZLE_72",
        script_dir / network_name / "PUZZLE_73",
    ]
    
    relatorio_dir = script_dir / "relatorio_final"
    relatorio_dir.mkdir(exist_ok=True)
    
    output_file = relatorio_dir / f"{network_name}_addresses_with_balance.jsonl"
    
    results = []
    total_found = 0
    files_found = 0
    
    # Procuramos por ambos os arquivos em todas as redes
    data_file_names = ["addresses_checked.jsonl", "batch_history.jsonl"]
    
    print(f"\n{'='*60}")
    print(f"🔍 {network_name.upper()}")
    print(f"{'='*60}")
    
    # Processa cada pasta de puzzle e cada arquivo jsonl
    for puzzle_folder in puzzle_folders:
        for data_file_name in data_file_names:
            jsonl_file = puzzle_folder / data_file_name
            
            if not jsonl_file.exists():
                continue
            
            files_found += 1
            puzzle_name = puzzle_folder.name
            
            try:
                with open(jsonl_file, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        if not line.strip():
                            continue
                        
                        try:
                            if is_line_with_balance_for_network(line, network_name):
                                data = json.loads(line)
                                results.append(line.strip())
                                total_found += 1
                                
                                address = extract_address(data)
                                balance_str = data.get('balance') or data.get('totalBalance') or data.get('finalBalance') or '0'
                                
                                # Exibe resumo no terminal
                                print(f"\n  ✓ {puzzle_name} ({data_file_name}) - Linha {line_num}")
                                print(f"    Endereço: {address}")
                                print(f"    Saldo: {balance_str}")
                        
                        except json.JSONDecodeError as e:
                            print(f"  ✗ Erro JSON na linha {line_num} em {jsonl_file.name}: {e}")
                            continue
            
            except Exception as e:
                print(f"  ✗ Erro ao processar {jsonl_file}: {e}")
                continue
    
    # Salva resultados
    if results:
        with open(output_file, 'w', encoding='utf-8') as f:
            for result in results:
                f.write(result + '\n')
        
        print(f"\n  ✅ Total: {total_found} endereços encontrados")
        print(f"  📄 Salvo em: {output_file.name}")
    elif files_found == 0:
        print(f"\n  ℹ️  Sem dados para processar nessa rede")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("")
    else:
        print(f"\n  ℹ️  Nenhum endereço com saldo encontrado")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("")
    
    return total_found, results


def main():
    print("\n" + "╔" + "="*58 + "╗")
    print("║" + " "*10 + "🚀 MASTER - CHECK ALL NETWORKS" + " "*19 + "║")
    print("║" + " "*8 + "Bitcoin + Ethereum + Solana + Polygon + BNB" + " "*5 + "║")
    print("╚" + "="*58 + "╝")
    
    script_dir = Path(__file__).parent.absolute()
    networks = ["bitcoin", "ethereum", "solana", "polygon", "bnb"]
    
    # Armazena resultados consolidados
    all_results = {}
    grand_total = 0
    
    # Processa cada rede
    for network in networks:
        total, results = check_network(network, script_dir)
        all_results[network] = (total, results)
        grand_total += total
    
    # Resumo final consolidado
    print(f"\n{'='*60}")
    print(f"📊 RESUMO CONSOLIDADO")
    print(f"{'='*60}")
    
    for network, (total, _) in all_results.items():
        status = "✅" if total > 0 else "⏭️ "
        print(f"  {status} {network.upper():12} {total:3} endereços encontrados")
    
    print(f"\n  📈 TOTAL GERAL: {grand_total} endereços com saldo")
    
    # Arquivo consolidado (todos os networks)
    relatorio_dir = script_dir / "relatorio_final"
    consolidated_file = relatorio_dir / "all_networks_consolidated.jsonl"
    
    with open(consolidated_file, 'w', encoding='utf-8') as f:
        for network, (_, results) in all_results.items():
            for result in results:
                f.write(json.dumps(result, ensure_ascii=False) + '\n')
    
    print(f"\n  📦 Consolidado: {consolidated_file.name}")
    print(f"\n╔" + "="*58 + "╗")
    print("║" + " "*15 + "✅ VERIFICAÇÃO CONCLUÍDA" + " "*20 + "║")
    print("╚" + "="*58 + "╝\n")


if __name__ == "__main__":
    main()
