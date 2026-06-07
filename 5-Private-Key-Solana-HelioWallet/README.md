# 🔐 HelioWallet Automation Suite

![Python](https://img.shields.io/badge/python-3.14+-blue.svg)
![PyQt6](https://img.shields.io/badge/PyQt6-6.7-green.svg)
![Playwright](https://img.shields.io/badge/Playwright-1.44+-orange.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

Ferramenta profissional de automação e auditoria para carteiras [HelioWallet](https://heliowallet.com/). Este software realiza validação em lote de frases de recuperação (mnemonics) BIP39 e extração automatizada de saldos Solana (SOL) através de duas interfaces: uma interface gráfica moderna com WebView integrada ou automação via linha de comando.

---

python automacao_solana_saldo.py frases.txt --show

## 📋 Sumário

- [Funcionalidades](#-funcionalidades)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [Estrutura de Arquivos](#-estrutura-de-arquivos)
- [Saída de Dados](#-saída-de-dados)
- [Configurações Avançadas](#%EF%B8%8F-configurações-avançadas)
- [Troubleshooting](#-troubleshooting)
- [Aviso Legal](#-aviso-legal)

---

## 🚀 Funcionalidades

### Interface Gráfica (GUI)
- **Interface WebView moderna** construída com PyQt6 e renderizada via HTML5/CSS3/JavaScript
- **Console em tempo real** integrado que exibe progresso com cores e formatação
- **Processamento não-bloqueante** via `multiprocessing` — a UI permanece responsiva durante automação
- **Gerenciamento de processo** — possibilidade de encerrar a automação a qualquer momento sem danificar a aplicação principal
- **Seleção visual de arquivos** com diálogo nativo de sistema operacional

### Automação Solana
- **Validação automatizada de mnemonics** — verifica frases de recuperação BIP39 (12, 15, 18, 21, 24 palavras)
- **Extração de saldos** em SOL (formato decimal com precisão)
- **Conversão automática** para valores USD (quando disponível na interface)
- **Reutilização de resultados** — processamento incremental (não reprocessa frases já auditadas)
- **Isolamento de contexto** — cada frase é processada em contexto de navegador separado para evitar vazamento de dados

### Motor de Automação
- **Engine Playwright** com Firefox headless/visual (intercambiável)
- **DOM parsing inteligente** com seletores CSS precisos
- **Detecção de erro em tempo real** — identifica frases inválidas imediatamente
- **Timeouts configuráveis** — adaptáveis a conexões lentas (30s página, 10s captura)
- **Retry automático** em falhas de rede

### Saída de Dados Estruturada
Três formatos de saída simultâneos:

| Arquivo | Formato | Conteúdo |
|---------|---------|----------|
| `linhas_sucesso_heliowallet.txt` | TXT (uma frase por linha) | Frases processadas com sucesso |
| `linhas_falha_heliowallet.txt` | TXT (uma frase por linha) | Frases inválidas ou com erro |
| `dados_completos_heliowallet.jsonl` | JSONL (JSON Line) | Registro completo (frase, saldo SOL, saldo USD, timestamp) |

---

## 📦 Requisitos

### Sistema Operacional
- **Linux** (recomendado: Ubuntu 20.04+, Fedora 35+, Debian 11+)
- **macOS** (10.14+)
- **Windows** (10/11 com WSL2 recomendado)

### Software
- **Python** 3.14 ou superior
- **pip** ou **uv** (gerenciador de dependências)
- **Firefox** (instalado automaticamente pelo Playwright)

### Hardware Mínimo
- 2 GB RAM
- 500 MB espaço em disco
- Conexão de internet estável

---

## 📥 Instalação

### 1. Clonar ou Baixar o Repositório

```bash
# Opção A: Com git
git clone <url-do-repositorio>
cd Frases-Solana-HelioWallet

# Opção B: Manualmente
# Baixe e extraia o arquivo ZIP
unzip Frases-Solana-HelioWallet.zip
cd Frases-Solana-HelioWallet
```

### 2. Criar Ambiente Virtual (Recomendado)

#### Com `uv` (mais rápido)
```bash
uv venv
uv add pywebview
uv add PyQt6 PyQt6-WebEngine playwright
source .venv/bin/activate
uv sync --all-groups
uv run automacao_solana_saldo.py frases.txt --show
```

# Processar normalmente (continua de onde parou)
uv run automacao_solana_saldo.py frases.txt

# Com browser visível
uv run automacao_solana_saldo.py frases.txt --show

# Resetar e começar do zero
uv run automacao_solana_saldo.py frases.txt --reset
---

## 🎯 Uso

### Sistema de Processamento Incremental

**⚠️ Informação Importante:**
O script utiliza um **sistema inteligente de não-reprocessamento**. Isto significa:

- ✅ **Frases já processadas NÃO serão auditadas novamente**
- ✅ **Novo lote será processado automaticamente (append)**
- ✅ **Histórico completo é mantido em logs/**

Quando você executa o script e recebe a mensagem:
```
✓ Todas as frases já foram processadas!
```

Isto **NÃO é um erro** — significa que todas as frases do arquivo já estão registradas em:
- `logs/linhas_sucesso_heliowallet.txt` ou
- `logs/linhas_falha_heliowallet.txt`

Para reprocessar, veja a seção [Troubleshooting → "Todas as frases já foram processadas"](#problema-todas-as-frases-já-foram-processadas-nenhuma-frase-foi-processada)

---

### Opção A: Interface Gráfica (Recomendado)

#### Comando
```bash
python main_webview.py
```

#### Procedimento
1. A aplicação abrirá uma janela com interface gráfica
2. **Clique em "Selecionar Arquivo e Iniciar"**
3. **Navegue e selecione** um arquivo `.txt` contendo as frases de recuperação
4. **Formato esperado**: Uma frase completa por linha
5. **Monitor em tempo real**: O console integrado exibe:
   - Progresso numérico `[1/100]`
   - Status de cada frase (✓ sucesso ou ✗ falha)
   - Saldos capturados (SOL e USD)
   - Erros detalhados com timestamps
6. **Saída automática**: Resultados salvos em `logs/` ao término

#### Exemplo de Arquivo de Entrada (frases.txt)
```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong
letter advice cage absurd amount doctor acoustic avoid letter advice cage above
```

### Opção B: Linha de Comando (CLI)

#### Modo Silencioso (Headless)
```bash
python automacao_solana_saldo.py frases.txt
```

Executa a automação sem exibir o navegador. Ideal para:
- Processamento em background
- Servidores sem interface gráfica
- Automação agendada (cron jobs)

#### Modo Visual (Debugging)
```bash
python automacao_solana_saldo.py frases.txt --show
```

Exibe o navegador Firefox trabalhando em tempo real. Útil para:
- Troubleshooting e debug
- Verificar comportamento da HelioWallet
- Validar padrões de DOM

#### Exemplos Completos
```bash
# Processar múltiplos lotes
python automacao_solana_saldo.py lote1.txt
python automacao_solana_saldo.py lote2.txt
# Resultados se acumulam em logs/

# Verificar progresso
tail -f logs/linhas_sucesso_heliowallet.txt

# Gerar relatório
wc -l logs/linhas_sucesso_heliowallet.txt logs/linhas_falha_heliowallet.txt

# Reprocessar tudo (limpar histórico primeiro)
rm -f logs/linhas_{sucesso,falha}_heliowallet.txt logs/dados_completos_heliowallet.jsonl
python automacao_solana_saldo.py frases.txt --show
```

---

## 📂 Estrutura de Arquivos

### Árvore de Diretório

```
Frases-Solana-HelioWallet/
├── automacao_solana_saldo.py          # Motor de automação CLI
├── main_webview.py                    # Interface gráfica (PyQt6)
├── index.html                         # Frontend da GUI (HTML5/CSS3)
├── pyproject.toml                     # Configuração do projeto
├── README.md                          # Este arquivo
├── frases.txt                         # Arquivo exemplo de entrada
├── logs/                              # Saída de dados (gerado)
│   ├── contador_YYYYMMDD_HHMMSS.log  # Log detalhado com timestamps
│   ├── linhas_sucesso_heliowallet.txt # Frases validadas (append)
│   ├── linhas_falha_heliowallet.txt   # Frases inválidas (append)
│   └── dados_completos_heliowallet.jsonl # Registros estruturados
└── Feito/                             # Diretório para resultados consolidados
```

### Descrição de Arquivos Principais

| Arquivo | Propósito | Tipo |
|---------|-----------|------|
| `automacao_solana_saldo.py` | Core de automação Playwright | Python (executável) |
| `main_webview.py` | Ponto de entrada GUI | Python (executável) |
| `index.html` | Interface WebView | HTML5 + CSS3 + JS |
| `pyproject.toml` | Dependências do projeto | TOML (config) |
| `frases.txt` | Arquivo de entrada (exemplo) | TXT (dados) |

---

## 📊 Saída de Dados

### 1. Arquivo de Log (contador_YYYYMMDD_HHMMSS.log)

```
[INFO] 2026-05-23 14:30:45,123 — 100 linha(s) carregada(s) [Solana]
[INFO] 2026-05-23 14:30:46,456 — Iniciando automação — 50 frase(s) nova(s) para processar.
[OK]   2026-05-23 14:31:12,789 — [1/50] Frase e saldo capturado: 125.50 SOL
[AVISO] 2026-05-23 14:31:35,012 — [2/50] Frase inválida detectada após o clique de acesso.
[ERRO]  2026-05-23 14:32:01,345 — [3/50] Erro: Timeout waiting for selector
[OK]   2026-05-23 14:32:28,678 — ═══ Concluído ═══
```

### 2. Arquivo de Sucessos (linhas_sucesso_heliowallet.txt)

```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
legal winner thank year wave sausage worth useful legal winner thank yellow
```

### 3. Arquivo de Falhas (linhas_falha_heliowallet.txt)

```
invalid mnemonic with wrong words here
too many words in this recovery phrase yes absolutely surely maybe
```

### 4. Arquivo JSON Lines (dados_completos_heliowallet.jsonl)

```json
{"frase":"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about","timestamp":"2026-05-23T14:31:12.789123","saldo_sol":"125.50","saldo_usd":"$25,125.00"}
{"frase":"legal winner thank year wave sausage worth useful legal winner thank yellow","timestamp":"2026-05-23T14:31:45.123456","saldo_sol":"0.001","saldo_usd":"$0.20"}
```

---

## ⚙️ Configurações Avançadas

### Ajustar Timeouts

Edite `automacao_solana_saldo.py` linha ~20:

```python
# Timeouts em milissegundos (ms)
TIMEOUT_PAGINA = 30_000  # Espera máxima para carregar página
ESPERA_PADRAO = 2_000    # Intervalo entre passos
ESPERA_CAPTURA = 10_000  # Espera para captura de saldo
```

### Modificar Seletores CSS

Se a HelioWallet atualizar sua interface, atualize os seletores:

```python
SELETOR_BOTAO_SOL = "button:has-text('SOL')"
SELETOR_RECOVERY_PHRASE = "text='Recovery Phrase'"
SELETOR_TEXTAREA_FRASE = "textarea"
SELETOR_BOTAO_ACCESS = "#access-wallet-btn"
SELETOR_ACCOUNT_BALANCE = "div:has-text('Account Balance')"
```

Inspecione com DevTools do Firefox para encontrar novos seletores.

### Executar com Python Específico

```bash
# Com Python 3.14 explícito
python3.14 automacao_solana_saldo.py frases.txt

# Com ambiente virtual ativo
source .venv/bin/activate
python automacao_solana_saldo.py frases.txt
```

### Processar Recursivamente

```bash
# Processar todos os .txt em um diretório
for file in dados/*.txt; do
    python automacao_solana_saldo.py "$file"
done
```

---

## 🔒 Segurança

### Boas Práticas

1. **Armazenamento de Frases**
   - ✓ Use arquivos criptografados no disco
   - ✓ Armazene em partição criptografada (LUKS/BitLocker)
   - ✗ Não mantenha frases em texto plano no GitHub/cloud

2. **Ambiente de Execução**
   - ✓ Execute em máquina isolada ou VM
   - ✓ Desabilite conexão de rede se não for necessária
   - ✓ Use firewall para restringir saída

3. **Limpeza de Logs**
   ```bash
   # Remover logs antigos após processamento
   rm -f logs/contador_*.log
   
   # Proteger dados completos
   chmod 600 logs/dados_completos_heliowallet.jsonl
   ```

4. **Contextos Isolados**
   - A automação cria novo contexto de navegador para cada frase
   - Cookies e dados de sessão não persistem entre iterações

---

## 🐛 Troubleshooting

### Problema: "✓ Todas as frases já foram processadas!" (Nenhuma frase foi processada)

**Causa:**
O script possui um sistema inteligente que **evita reprocessar frases já auditadas**. Se todas as frases do `frases.txt` já existem nos arquivos `linhas_sucesso_heliowallet.txt` ou `linhas_falha_heliowallet.txt`, o script não executa novamente.

**Soluções:**

**Opção A: Limpar histórico completo**
```bash
# Remove todos os logs de processamento anterior
rm -f logs/linhas_sucesso_heliowallet.txt logs/linhas_falha_heliowallet.txt logs/dados_completos_heliowallet.jsonl

# Agora executa normalmente
python automacao_solana_saldo.py frases.txt --show
```

**Opção B: Usar arquivo com frases novas**
```bash
# Criar arquivo de teste com frases diferentes
cat > teste_novo.txt << 'EOF'
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
letter advice cage absurd amount doctor acoustic avoid letter advice cage above
zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong
EOF

python automacao_solana_saldo.py teste_novo.txt --show
```

**Opção C: Editar frases.txt com novas frases**
```bash
# Substitua as frases antigas por novas no arquivo
nano frases.txt

# Depois execute
python automacao_solana_saldo.py frases.txt --show
```

**Opção D: Adicionar frases incrementalmente (append)**
```bash
# Adiciona novas frases sem remover as antigas
echo "sua_nova_frase_de_24_palavras_aqui" >> frases.txt

python automacao_solana_saldo.py frases.txt --show
```

**Por que este comportamento?**
- Evita duplicação desnecessária de processamento
- Economiza tempo em lotes grandes
- Mantém histórico consistente de processamentos
- Permite retomar de onde parou em caso de falha

---

### Problema: "ModuleNotFoundError: No module named 'PyQt6'"

**Solução:**
```bash
pip install --upgrade PyQt6 PyQt6-WebEngine
```

### Problema: "Firefox executable not found"

**Solução:**
```bash
playwright install firefox
```

### Problema: Seletor CSS não encontrado / Interface mudou

**Solução:**
```bash
# Abra o navegador no modo visual para debug
python automacao_solana_saldo.py frases.txt --show

# Inspecione manualmente no Firefox DevTools (F12)
# Atualize os seletores em automacao_solana_saldo.py

# Teste o novo seletor com Playwright REPL
python -c "from playwright.sync_api import sync_playwright; ..."
```

### Problema: Timeout ao carregar dashboard

**Solução:**
```python
# Aumentar timeout em automacao_solana_saldo.py
TIMEOUT_PAGINA = 60_000  # 60 segundos
ESPERA_CAPTURA = 20_000  # 20 segundos
```

### Problema: Processo de automação trava

**Solução:**
1. Na GUI: Clique em "Parar" ou feche a janela
2. Via CLI: Pressione `Ctrl+C`
3. Force parar no terminal: `pkill -f "automacao_solana_saldo"`

### Problema: Permissão negada ao criar logs/

**Solução:**
```bash
chmod 755 .
ls -la logs/  # Verificar permissões
```

### Problema: Quebra de linha nos arquivos de saída (corrupção de frase)

**Sintoma:**
Frase dividida em múltiplas linhas nos arquivos `.txt`:
```
evoke below divorce piano catch about gas season alone hybrid elite around
disease adapt scrub dignity dolphin across ugly security above coral column adult
t  # <- parte da próxima frase aparece aqui
```

**Causa:**
Frase original no `frases.txt` estava quebrada ou mal formatada.

**Solução:**
```bash
# Verificar integridade do arquivo
cat frases.txt | od -c | head -50

# Remover linhas vazias e corrigir formatação
sed '/^[[:space:]]*$/d' frases.txt > frases_limpo.txt
mv frases_limpo.txt frases.txt

# Limpar logs e reprocessar
rm -f logs/linhas_sucesso_heliowallet.txt logs/linhas_falha_heliowallet.txt
python automacao_solana_saldo.py frases.txt --show
```

---

## 📈 Monitoramento e Relatórios

### Contar Processamentos

```bash
# Total de sucessos
wc -l logs/linhas_sucesso_heliowallet.txt

# Total de falhas
wc -l logs/linhas_falha_heliowallet.txt

# Resultado em JSON
python -c "
import json, pathlib
success = len(pathlib.Path('logs/linhas_sucesso_heliowallet.txt').read_text().strip().split('\\n'))
fail = len(pathlib.Path('logs/linhas_falha_heliowallet.txt').read_text().strip().split('\\n'))
print(json.dumps({'sucessos': success, 'falhas': fail, 'total': success+fail}))
"
```

### Gerar Relatório CSV

```bash
python -c "
import json, csv
with open('logs/dados_completos_heliowallet.jsonl') as f, \
     open('relatorio.csv', 'w', newline='') as out:
    reader = (json.loads(line) for line in f)
    writer = csv.DictWriter(out, fieldnames=['frase', 'saldo_sol', 'saldo_usd', 'timestamp'])
    writer.writeheader()
    writer.writerows(reader)
print('✓ relatorio.csv gerado')
"
```

---

## 🛠️ Desenvolvimento

### Estrutura do Código

```
automacao_solana_saldo.py
├── Constantes e configuração
│   ├── Diretórios e URLs
│   ├── Seletores CSS
│   └── Timeouts
├── Sistema de logs (cores + formatação)
├── Função de processamento principal
│   └── processar_linha(page, frase)
│       ├── Navegação e cliques
│       ├── Preenchimento de formulário
│       ├── Extração de dados DOM
│       └── Tratamento de erros
└── Função de execução
    └── executar_automacao(arquivo, headless)
        ├── Leitura de arquivo
        ├── Filtro de processados
        ├── Loop de navegadores
        └── Salva em 3 formatos
```

### Modificar Comportamento

Edite a função `processar_linha()` para:
- Adicionar validações extras
- Extrair dados adicionais
- Mudar sequência de cliques

---

## 📝 Licença

MIT License — veja arquivo `LICENSE` para detalhes.

---

## ⚠️ Aviso Legal (Disclaimer)

**LEIA COM ATENÇÃO**

Este software foi desenvolvido exclusivamente para **auditoria de carteiras próprias** e **recuperação de dados pessoais**.

### Proibições Explícitas
- ❌ Usar para acessar carteiras de terceiros SEM CONSENTIMENTO EXPLÍCITO
- ❌ Usar para roubo, fraude ou atividades ilegais
- ❌ Contornar medidas de segurança da HelioWallet ou similar
- ❌ Usar em ambientes não-autorizados

### Responsabilidades
- O **autor não se responsabiliza** por:
  - Perdas financeiras ou monetárias
  - Acesso não-autorizado a contas
  - Violação de termos de serviço
  - Mau uso intencional ou negligente
  - Dados pessoais expostos por negligência do usuário

- O **usuário é responsável** por:
  - Armazenar frases de recuperação de forma segura
  - Usar esta ferramenta apenas legalmente
  - Cumprir regulamentações locais (KYC, AML, etc.)
  - Fazer backup de seus dados

### Cumprimento Legal
Ao usar este software, você confirma que:
1. Leu e compreendeu este aviso
2. Usará apenas com suas próprias carteiras/dados
3. Aceita todos os riscos associados
4. Isentará o autor de qualquer responsabilidade

---

## ✒️ Autor

**Rafael Batista** (recifecrypto)  
Desenvolvido para a comunidade cripto com ❤️

---

## 📞 Suporte

- **Issues**: Reporte bugs no repositório GitHub
- **Discussões**: Abra uma discussion para dúvidas
- **Fork**: Contribuições via pull requests são bem-vindas

---

**Última atualização**: 23 de maio de 2026  
**Versão**: 3.8.2
