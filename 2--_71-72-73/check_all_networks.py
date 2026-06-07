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

def check_network(network_name: str, script_dir: Path) -> Tuple[int, List[Dict]]:
    """
    Verifica endereços com saldo para uma rede específica
    Retorna: (total_encontrado, lista_de_resultados)
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
    
    # Determina qual arquivo procurar (Bitcoin usa addresses_checked.jsonl, outros usam batch_history.jsonl)
    if network_name.lower() == "bitcoin":
        data_file_name = "addresses_checked.jsonl"
    else:
        data_file_name = "batch_history.jsonl"
    
    print(f"\n{'='*60}")
    print(f"🔍 {network_name.upper()}")
    print(f"{'='*60}")
    
    # Processa cada pasta de puzzle
    for puzzle_folder in puzzle_folders:
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
                        data = json.loads(line)
                        
                        # Verifica balance
                        balance_str = data.get('balance', '0')
                        
                        try:
                            balance = float(balance_str)
                        except (ValueError, TypeError):
                            balance = 0
                        
                        # Se tem saldo > 0
                        if balance > 0:
                            result = {
                                'network': network_name,
                                'puzzle': puzzle_name,
                                'arquivo': str(jsonl_file),
                                'linha': line_num,
                                'endereco': data.get('addr', 'N/A'),
                                'saldo': balance_str,
                                'privHex': data.get('privHex', 'N/A'),
                                'privkey_length': data.get('privkey_length', 0),
                                'timestamp': data.get('timestamp', 'N/A'),
                            }
                            results.append(result)
                            total_found += 1
                            
                            # Exibe resumo (sem detalhe completo)
                            print(f"\n  ✓ {puzzle_name} - Linha {line_num}")
                            print(f"    Endereço: {data.get('addr', 'N/A')}")
                            print(f"    Saldo: {balance_str}")
                    
                    except json.JSONDecodeError as e:
                        print(f"  ✗ Erro JSON na linha {line_num}: {e}")
                        continue
        
        except Exception as e:
            print(f"  ✗ Erro ao processar {jsonl_file}: {e}")
            continue
    
    # Salva resultados
    if results:
        with open(output_file, 'w', encoding='utf-8') as f:
            for result in results:
                f.write(json.dumps(result, ensure_ascii=False) + '\n')
        
        print(f"\n  ✅ Total: {total_found} endereços encontrados")
        print(f"  📄 Salvo em: {output_file.name}")
    elif files_found == 0:
        print(f"\n  ℹ️  Sem dados (execute ./run_all_puzzles.sh primeiro)")
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
