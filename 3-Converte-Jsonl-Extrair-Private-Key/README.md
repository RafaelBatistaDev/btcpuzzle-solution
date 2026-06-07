# Modo padrão — lê batch_history.jsonl, gera privhex_output.txt no mesmo diretório
uv run extract_privhex.py

# Caminhos explícitos
uv run extract_privhex.py -i /caminho/batch_history.jsonl -o /caminho/saida.txt