# ============================================================================
# ⚠️  ARQUIVO DESCONTINUADO - USE JAVASCRIPT SOLVERS EQUIVALENTES
# ============================================================================
#
# MOTIVO: A API pública da Blockchain.info (blockchain.info/balance?active=) 
# não suporta endereços BIP86 Taproot (bc1p...), causando erro 400 (Bad Request).
#
# SUBSTITUIÇÃO: 
#   - Bitcoin: bitcoin/solver.js (via bitcoin/balance_verifier.js)
#   - Ethereum: ethereum/solver.js (via ethereum/balance_verifier.js)
#
# Estes módulos JavaScript usam Ankr Blockbook com suporte nativo a:
#   - BIP44 Legacy (1...)
#   - BIP49 Nested SegWit (3...)
#   - BIP84 Native SegWit (bc1q...)
#   - BIP86 Taproot (bc1p...)
#
# Para executar:
#   PUZZLE_ID=71 node bitcoin/solver.js
#   PUZZLE_ID=72 node bitcoin/solver.js
#   PUZZLE_ID=73 node bitcoin/solver.js
#
# ============================================================================

# Este arquivo foi descontinuado em favor da solução JavaScript/Node.js
# que suporta 100% dos formatos Bitcoin através da API privada Ankr.
# Use sua chave Ankr pessoal ou configure via variável de ambiente
ETH_API = os.environ.get(
    'RPC_ENDPOINT',
    'https://rpc.ankr.com/eth/af6ba3816c496e95bd422a2775ce65ece906e9d4a220ab084d538d01ea0176e6'
)

# Garantir a criação da pasta de relatórios
os.makedirs(REPORT_DIR, exist_ok=True)


def log_message(msg):
    """Gera logs no terminal e salva em arquivo."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    print(formatted)
    sys.stdout.flush()
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(formatted + '\n')
    except Exception as e:
        print(f"Erro ao gravar log: {e}")


def load_checkpoint():
    """Carrega o progresso anterior se existir."""
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            log_message(f"⚠️ Erro ao carregar checkpoint: {e}. Reiniciando do zero.")
    
    return {
        "files_processed": {},
        "current_file": None,
        "current_line": 0,
        "total_checked": 0,
        "found_count": 0
    }


def save_checkpoint(checkpoint):
    """Salva o estado atual do progresso."""
    try:
        with open(CHECKPOINT_FILE, 'w', encoding='utf-8') as f:
            json.dump(checkpoint, f, indent=2)
    except Exception as e:
        log_message(f"⚠️ Erro ao salvar checkpoint: {e}")


def query_btc_balances(addresses, retries=0):
    """Consulta saldo de lote de endereços Bitcoin com divisão em caso de erro."""
    if not addresses:
        return {}
    
    url = BTC_API + ",".join(addresses)
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    
    try:
        time.sleep(BTC_DELAY)
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
            results = {}
            for addr in addresses:
                if addr in data:
                    results[addr] = {
                        "balance": data[addr].get("final_balance", 0),
                        "tx_count": data[addr].get("n_tx", 0)
                    }
            return results
            
    except urllib.error.HTTPError as e:
        if e.code == 429:
            wait_time = (BACKOFF_FACTOR ** (retries + 1)) * 5
            log_message(f"⚠️ Rate limit (429) no Bitcoin. Aguardando {wait_time}s...")
            time.sleep(wait_time)
            if retries < MAX_RETRIES:
                return query_btc_balances(addresses, retries + 1)
            else:
                log_message("❌ Limite de retentativas excedido para Bitcoin (429).")
                raise e
        elif e.code == 400 or (400 <= e.code < 500):
            # Provável endereço inválido no lote. Faz subdivisão binária para isolar.
            log_message(f"⚠️ Erro HTTP {e.code} no lote de {len(addresses)} endereços BTC. Subdividindo lote...")
            if len(addresses) > 1:
                mid = len(addresses) // 2
                left = query_btc_balances(addresses[:mid], 0)
                right = query_btc_balances(addresses[mid:], 0)
                left.update(right)
                return left
            else:
                log_message(f"❌ Endereço BTC inválido ignorado: {addresses[0]}")
                return {addresses[0]: {"balance": 0, "tx_count": 0, "invalid": True}}
        else:
            log_message(f"⚠️ Erro HTTP {e.code} no Bitcoin. Retentando em 5s...")
            time.sleep(5)
            if retries < MAX_RETRIES:
                return query_btc_balances(addresses, retries + 1)
            raise e
            
    except Exception as e:
        log_message(f"⚠️ Erro de conexão no Bitcoin: {e}. Retentando em 5s...")
        time.sleep(5)
        if retries < MAX_RETRIES:
            return query_btc_balances(addresses, retries + 1)
        raise e


def query_eth_balances(addresses, retries=0):
    """Consulta saldo de lote de endereços Ethereum usando JSON-RPC Batch."""
    if not addresses:
        return {}
    
    payload = []
    for idx, addr in enumerate(addresses):
        payload.append({
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [addr.lower(), "latest"],  # Endereço DEVE ser lowercase para JSON-RPC
            "id": idx + 1
        })
        
    req = urllib.request.Request(
        ETH_API,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        }
    )
    
    try:
        time.sleep(ETH_DELAY)
        with urllib.request.urlopen(req, timeout=15) as response:
            resp_data = json.loads(response.read().decode('utf-8'))
            results = {}
            
            if not isinstance(resp_data, list):
                resp_data = [resp_data]
                
            for resp_item in resp_data:
                req_id = resp_item.get("id")
                if req_id is not None and 0 < req_id <= len(addresses):
                    addr = addresses[req_id - 1]
                    if "result" in resp_item:
                        hex_val = resp_item["result"]
                        wei_val = int(hex_val, 16) if hex_val.startswith("0x") else int(hex_val)
                        results[addr] = {
                            "balance": wei_val,
                            "tx_count": 0
                        }
                    elif "error" in resp_item:
                        log_message(f"⚠️ Erro no endereço ETH {addr}: {resp_item['error'].get('message')}")
                        results[addr] = {"balance": 0, "tx_count": 0, "invalid": True}
            return results
            
    except urllib.error.HTTPError as e:
        if e.code == 429:
            wait_time = (BACKOFF_FACTOR ** (retries + 1)) * 5
            log_message(f"⚠️ Rate limit (429) no Ethereum. Aguardando {wait_time}s...")
            time.sleep(wait_time)
            if retries < MAX_RETRIES:
                return query_eth_balances(addresses, retries + 1)
            raise e
        else:
            log_message(f"⚠️ Erro HTTP {e.code} no Ethereum. Retentando em 5s...")
            time.sleep(5)
            if retries < MAX_RETRIES:
                return query_eth_balances(addresses, retries + 1)
            raise e
            
    except Exception as e:
        log_message(f"⚠️ Erro de conexão no Ethereum: {e}. Retentando em 5s...")
        time.sleep(5)
        if retries < MAX_RETRIES:
            return query_eth_balances(addresses, retries + 1)
        raise e


def get_batch_files():
    """Mapeia os caminhos dos arquivos batch_history.jsonl."""
    files = []
    puzzles = ["PUZZLE_71", "PUZZLE_72", "PUZZLE_73"]
    
    # Bitcoin
    for p in puzzles:
        path = os.path.join(WORKSPACE_DIR, "bitcoin", p, "batch_history.jsonl")
        if os.path.exists(path):
            files.append(("bitcoin", p, path))
            
    # Ethereum
    for p in puzzles:
        path = os.path.join(WORKSPACE_DIR, "ethereum", p, "batch_history.jsonl")
        if os.path.exists(path):
            files.append(("ethereum", p, path))
            
    return files


def process_batch_data(coin, puzzle, addresses, meta, checkpoint, next_line_num):
    """Processa um único lote de endereços e salva se encontrar saldos positivos."""
    if coin == "bitcoin":
        results = query_btc_balances(addresses)
    else:
        results = query_eth_balances(addresses)
        
    found_any = 0
    for idx, addr in enumerate(addresses):
        item_meta = meta[idx]
        res = results.get(addr, {"balance": 0})
        balance = res.get("balance", 0)
        
        if balance > 0:
            found_any += 1
            checkpoint["found_count"] += 1
            
            # Formata o saldo para exibição
            if coin == "bitcoin":
                formatted_balance = f"{balance / 1e8:.8f} BTC ({balance} sat)"
            else:
                formatted_balance = f"{balance / 1e18:.18f} ETH ({balance} Wei)"
            
            # ALERTA VISUAL IMPORTANTE!
            bell = "\a" * 5  # Beep 5 vezes
            alert_msg = f"\n{'='*80}\n🚨🚨🚨 SALDO POSITIVO ENCONTRADO! 🚨🚨🚨\n{'='*80}\n[{coin.upper()} {puzzle}] {addr}\nSaldo: {formatted_balance}\n{'='*80}\n"
            log_message(bell + alert_msg)
            
            # Dados completos da descoberta
            record = {
                "coin": coin,
                "puzzle": puzzle,
                "address": addr,
                "balance": balance,
                "formatted_balance": formatted_balance,
                "privHex": item_meta.get("privHex"),
                "wif": item_meta.get("wif"),
                "privInt": item_meta.get("privInt"),
                "timestamp_verified": datetime.now().isoformat()
            }
            
            # Salva na lista final imediatamente
            with open(FOUND_FILE, 'a', encoding='utf-8') as ff:
                ff.write(json.dumps(record) + '\n')
                
    checkpoint["total_checked"] += len(addresses)
    checkpoint["current_line"] = next_line_num
    save_checkpoint(checkpoint)
    
    # Exibe progresso a cada lote processado ou quando achar saldo
    if checkpoint["total_checked"] % 1000 == 0 or found_any > 0:
        log_message(f"📊 Progresso: {checkpoint['total_checked']} endereços verificados. Saldo positivo: {checkpoint['found_count']}")


def generate_summary_report(checkpoint):
    """Gera o arquivo de texto com o resumo consolidado final."""
    report_lines = [
        "=" * 80,
        "RELATÓRIO CONSOLIDADO FINAL - VERIFICAÇÃO DE SALDO",
        f"Data/Hora de Geração: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 80,
        "",
        f"Total de endereços verificados: {checkpoint['total_checked']}",
        f"Total de endereços com saldo > 0: {checkpoint['found_count']}",
        "",
        "ARQUIVOS BATCH HISTÓRICO VERIFICADOS:"
    ]
    
    for file_path in checkpoint.get("files_processed", {}):
        report_lines.append(f" ✓ {os.path.basename(os.path.dirname(file_path))}/{os.path.basename(file_path)}")
    report_lines.append("")
    
    report_lines.append("=" * 80)
    report_lines.append("LISTA DE CHAVES E ENDEREÇOS COM SALDO POSITIVO:")
    report_lines.append("=" * 80)
    
    if checkpoint['found_count'] == 0:
        report_lines.append("Nenhum endereço com saldo positivo foi localizado nesta execução.")
    else:
        if os.path.exists(FOUND_FILE):
            with open(FOUND_FILE, 'r', encoding='utf-8') as f:
                for idx, line in enumerate(f, 1):
                    try:
                        rec = json.loads(line.strip())
                        report_lines.append(f"\n[{idx}] {rec['coin'].upper()} {rec['puzzle']} - ENCONTRADO!")
                        report_lines.append(f"  • Endereço:      {rec['address']}")
                        report_lines.append(f"  • Saldo:         {rec['formatted_balance']}")
                        if rec.get("wif"):
                            report_lines.append(f"  • WIF (Bitcoin):  {rec['wif']}")
                        if rec.get("privHex"):
                            report_lines.append(f"  • PrivKey (Hex):  {rec['privHex']}")
                        if rec.get("privInt"):
                            report_lines.append(f"  • PrivKey (Int):  {rec['privInt']}")
                        report_lines.append("-" * 50)
                    except Exception as e:
                        report_lines.append(f"Erro ao ler registro {idx}: {e}")
                        
    report_lines.append("")
    report_lines.append("=" * 80)
    report_lines.append("Fim do Relatório.")
    
    with open(SUMMARY_FILE, 'w', encoding='utf-8') as f:
        f.write("\n".join(report_lines))
        
    log_message(f"🎉 Relatório consolidado final salvo com sucesso em: {SUMMARY_FILE}")


def main():
    checkpoint = load_checkpoint()
    batch_files = get_batch_files()
    
    if not batch_files:
        log_message("❌ Nenhum arquivo batch_history.jsonl foi localizado no workspace.")
        sys.exit(1)
        
    log_message("⚙️ Iniciando sistema de verificação de saldos...")
    log_message(f"Total de arquivos históricos mapeados: {len(batch_files)}")
    
    for coin, puzzle, file_path in batch_files:
        if file_path in checkpoint["files_processed"]:
            log_message(f"⏭️  {coin.upper()} {puzzle} já foi totalmente verificado. Pulando.")
            continue
            
        log_message(f"⏳ Processando arquivo: {coin.upper()} {puzzle} em {file_path}")
        checkpoint["current_file"] = file_path
        
        start_line = 0
        if file_path == checkpoint.get("current_file"):
            start_line = checkpoint.get("current_line", 0)
            if start_line > 0:
                log_message(f"🔄 Retomando processamento do arquivo a partir da linha {start_line}...")
                
        current_batch = []
        batch_meta = []
        batch_size = BTC_BATCH_SIZE if coin == "bitcoin" else ETH_BATCH_SIZE
        
        last_line_idx = start_line
        with open(file_path, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f):
                if idx < start_line:
                    continue
                    
                last_line_idx = idx
                try:
                    data = json.loads(line.strip())
                    addr = data.get("addr")
                    if addr:
                        current_batch.append(addr)
                        batch_meta.append(data)
                except Exception as parse_err:
                    log_message(f"⚠️ Linha {idx+1} mal formatada no arquivo {file_path}: {parse_err}")
                    
                if len(current_batch) >= batch_size:
                    process_batch_data(coin, puzzle, current_batch, batch_meta, checkpoint, idx + 1)
                    current_batch = []
                    batch_meta = []
                    
            # Processa lote remanescente
            if current_batch:
                process_batch_data(coin, puzzle, current_batch, batch_meta, checkpoint, last_line_idx + 1)
                
        # Marca arquivo como totalmente verificado
        checkpoint["files_processed"][file_path] = True
        checkpoint["current_file"] = None
        checkpoint["current_line"] = 0
        save_checkpoint(checkpoint)
        log_message(f"✓ Concluído: {coin.upper()} {puzzle}")
        
    generate_summary_report(checkpoint)
    log_message("🏁 Processo de verificação de saldo finalizado com sucesso!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log_message("\n🛑 Processo interrompido pelo usuário. O progresso foi salvo e pode ser retomado executando o script novamente.")
        sys.exit(0)
    except Exception as e:
        log_message(f"❌ Erro fatal durante a execução: {e}")
        sys.exit(1)
