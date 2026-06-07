# 📋 Guia: Processamento com Rastreamento de Progresso

## ✨ Como Funciona

Seu script agora **rastreia automaticamente** o progresso e continua de onde parou:

### Sistema de Rastreamento
- **Frases processadas com sucesso** → salvas em `logs/linhas_sucesso_heliowallet.txt`
- **Frases que falharam** → salvas em `logs/linhas_falha_heliowallet.txt`
- **Checkpoint** → `logs/checkpoint.json` rastreia a última execução

O script **pula automaticamente** as frases já processadas e continua com as novas.

---

## 🚀 Como Usar

### 1️⃣ Processar Normalmente (continua de onde parou)
```bash
uv run automacao_bitcoin_saldo.py frases.txt
```
✅ Processa apenas as frases novas  
✅ Mostra resumo: total, sucesso, falha, faltando

### 2️⃣ Ver Progresso (sem processar)
```bash
uv run automacao_bitcoin_saldo.py frases.txt 2>&1 | head -20
```
Mostra o status sem fazer nada.

### 3️⃣ Com Browser Visível
```bash
uv run automacao_bitcoin_saldo.py frases.txt --show
```
Vê a automação acontecendo na tela.

### 4️⃣ Resetar e Começar do Zero
```bash
uv run automacao_bitcoin_saldo.py frases.txt --reset
```
⚠️ **Limpa todo o histórico e começa novamente**

---

## 📊 Exemplo de Resumo Exibido

```
════════════════════════════════════════════════════
📊 PROGRESSO DO PROCESSAMENTO
════════════════════════════════════════════════════
  Total de frases:        125000
  Já processadas:         45230
    ✅ Com sucesso:       44100
    ❌ Com falha:         1130
  Faltam processar:       79770
════════════════════════════════════════════════════
```

---

## 🔍 Arquivos de Saída

| Arquivo | Descrição |
|---------|-----------|
| `logs/linhas_sucesso_heliowallet.txt` | Frases processadas com sucesso |
| `logs/linhas_falha_heliowallet.txt` | Frases que não funcionaram |
| `logs/dados_completos_heliowallet.jsonl` | JSON com saldos capturados |
| `logs/checkpoint.json` | Última linha processada + estatísticas |

---

## 💡 Dicas Importantes

✅ **Para processar 100k+ linhas:**
1. Execute uma vez: `uv run automacao_bitcoin_saldo.py frases.txt`
2. Se cair/interromper, execute novamente
3. Script continua automaticamente de onde parou
4. Sem repetições, sem perda de dados!

✅ **Para monitorar execução longa:**
```bash
# Em outro terminal, monitore os arquivos
watch -n 5 "wc -l logs/*.txt"
```

✅ **Para processar só falhas novamente:**
```bash
# Copie linhas_falha_heliowallet.txt para um arquivo temporário
cp logs/linhas_falha_heliowallet.txt frases_retry.txt
# Limpe o histórico e reprocesse
uv run automacao_bitcoin_saldo.py frases_retry.txt --reset
```

---

## 🐛 Troubleshooting

**P: Como sei onde parou?**  
R: Abra `logs/checkpoint.json` para ver a última frase processada.

**P: Como recomeçar tudo?**  
R: Use `--reset` para limpar histórico.

**P: Script parou. Como continuo?**  
R: Só execute novamente! Ele continua de onde parou.

**P: Quero processar um arquivo diferente?**  
R: Use `--reset` primeiro para limpar o histórico:
```bash
uv run automacao_bitcoin_saldo.py novo_arquivo.txt --reset
```
