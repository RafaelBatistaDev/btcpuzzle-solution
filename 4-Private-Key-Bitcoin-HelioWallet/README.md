# 🔐 HelioWallet Automation Suite

![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![PyQt6](https://img.shields.io/badge/PyQt6-GUI-green.svg)
![Playwright](https://img.shields.io/badge/Playwright-Automation-orange.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

Uma ferramenta profissional de automação e auditoria para carteiras HelioWallet. Valida frases de recuperação (mnemonics) em lote, extrai saldos Bitcoin, endereços de carteira e informações financeiras através de automação web inteligente com interface moderna.

## 🚀 Funcionalidades

- **Interface Híbrida (WebView):** GUI construída com PyQt6 renderizada via HTML5/CSS3 para experiência fluida
- **Processamento em Paralelo:** Automação não trava a interface principal; permite parar a execução a qualquer momento
- **Automação Robusta:** Engine baseada em Playwright (Firefox) com interação precisa ao DOM da HelioWallet
- **Logs em Tempo Real:** Console integrado exibindo progresso via QWebChannel
- **Extração de Dados Estruturados:**
  - `JSONL`: Dados completos (frase, saldo BTC, saldo USD, endereço)
  - `TXT`: Listas separadas para sucessos e falhas
- **Modo Headless/Visual:** Execute silenciosamente ou veja o navegador trabalhando
- **Recuperação Automática:** Reutiliza resultados anteriores (append em arquivos de saída)

## 🛠️ Tecnologias Utilizadas

| Componente | Tecnologia |
|-----------|-----------|
| **Linguagem** | Python 3.10+ |
| **GUI** | PyQt6 (QtWebEngineView) |
| **Automação** | Playwright (Firefox) |
| **Frontend** | HTML5, CSS3, JavaScript |
| **Gerenciador** | uv (Python package manager) |

## 📋 Pré-requisitos

- Python 3.10 ou superior
- Linux/macOS (ou Windows com ajustes)
- Gerenciador de pacotes `uv` instalado
- Conexão com internet para acessar HelioWallet

## 📂 Estrutura do Projeto

```text
.
├── main_webview.py                    # GUI principal (PyQt6 + WebView)
├── automacao_bitcoin_saldo.py         # Script core de automação
├── index.html                         # Interface visual (Frontend)
├── style.css                          # Estilos da aplicação
├── script.js                          # Lógica JavaScript frontend
├── pyproject.toml                     # Configuração de dependências (uv)
├── frases.txt                         # Arquivo com frases para processar
├── CONTADOR.MD                        # Documentação adicional
├── logs/                              # Diretório de outputs
│   ├── dados_completos_heliowallet.jsonl     # Dados completos (JSONL)
│   ├── linhas_sucesso_heliowallet.txt        # Frases processadas com sucesso
│   ├── linhas_falha_heliowallet.txt          # Frases que falharam
│   └── contador_YYYYMMDD_HHMMSS.log         # Log detalhado por execução
├── Feito/                             # Diretório de resultados consolidados
├── .venv/                             # Ambiente virtual Python
└── README.md                          # Este arquivo
```
## 📦 Instalação

### 1. Clone o Repositório
```bash
git clone https://github.com/recifecrypto/Frases-HelioWallet.git
cd Frases-HelioWallet
```

## 🎯 Como Usar

### Modo 1: Interface Gráfica (Recomendado)

A interface permite selecionar arquivo e acompanhar processamento em tempo real:

```bash
# Modo visual (browser visível)
uv venv
uv add pywebview
uv add PyQt6 PyQt6-WebEngine playwright
source .venv/bin/activate
uv sync --all-groups
uv run automacao_bitcoin_saldo.py frases.txt --show
```

**Passos:**
1. A janela GUI se abrirá com a interface da aplicação
2. Clique em **"Selecionar Arquivo e Iniciar"**
3. Escolha um arquivo `.txt` com frases de recuperação (uma por linha)
4. Acompanhe o progresso no console integrado
5. Os resultados serão salvos automaticamente em `logs/`

### Modo 2: Linha de Comando (Automação)

Para automação headless sem interface gráfica:

```bash
# Modo automação (headless - padrão)
# Processa frases silenciosamente
uv run python automacao_bitcoin_saldo.py frases.txt
```

**Exemplo com arquivo:**
```bash
# Com arquivo personalizado
uv run python automacao_bitcoin_saldo.py /caminho/para/suas_frases.txt
```

### Modo 3: Modo Debug Visual

Para ver o navegador trabalhando (útil para troubleshooting):

```bash
# Modo visual (browser visível)
uv run python automacao_bitcoin_saldo.py frases.txt --show
```

## 📝 Formato do Arquivo de Entrada

O arquivo `frases.txt` deve conter uma frase de recuperação por linha:

```text
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
legal winner thank year wave sausage worth useful legal winner thank yellow
letter advice cage absurd amount doctor acoustic avoid letter advice cage above
```

**Requisitos:**
- Frases com **12, 15, 18, 21 ou 24 palavras** (padrão BIP39)
- Uma frase por linha
- Encoding UTF-8
- Sem linhas vazias ou espaços extras

## 📊 Arquivos de Saída

Os resultados são salvos em `logs/`:

### `dados_completos_heliowallet.jsonl`
Formato JSONL com dados completos:
```json
{"frase": "abandon abandon...", "saldo_btc": "0.00015234", "saldo_usd": "12.34", "endereco": "1A1z7agoat..."}
{"frase": "legal winner...", "saldo_btc": "0.00000000", "saldo_usd": "0.00", "endereco": "1Aq4gFfiLm..."}
```

### `linhas_sucesso_heliowallet.txt`
Lista de frases processadas com sucesso:
```text
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
legal winner thank year wave sausage worth useful legal winner thank yellow
```

### `linhas_falha_heliowallet.txt`
Frases que falharam no processamento:
```text
invalid mnemonic phrase (must be 12, 15, 18, 21, or 24 words)
another invalid phrase here
```

### `contador_YYYYMMDD_HHMMSS.log`
Log detalhado de execução com timestamps e status

## 🔄 Recuperação e Continuação

Se o processo for interrompido, simplesmente execute novamente:

```bash
uv run python automacao_bitcoin_saldo.py frases.txt
```

O sistema **automatically append** aos arquivos existentes, não sobrescreve resultados anteriores.

## 🛠️ Configuração Avançada

### Variáveis de Ambiente

Você pode customizar comportamentos editando constantes em `automacao_bitcoin_saldo.py`:

```python
TIMEOUT_PAGINA  = 30_000    # Timeout em ms para carregar página
ESPERA_PADRAO   = 2_000     # Delay padrão entre ações
ESPERA_CAPTURA  = 10_000    # Espera antes de capturar dados
```

### Seletores DOM

Se a HelioWallet mudar sua estrutura HTML, atualize os seletores:

```python
SELETOR_BOTAO_BTC       = "button:has-text('BTC')"
SELETOR_RECOVERY_PHRASE = "text='Recovery Phrase'"
SELETOR_TEXTAREA_FRASE  = "textarea"
SELETOR_BOTAO_ACCESS    = "#access-wallet-btn"
```

## ⚙️ Requisitos do Sistema

| Requisito | Especificação |
|-----------|--------------|
| Python | 3.10 ou superior |
| Memória | Mínimo 512MB (recomendado 2GB+) |
| Disco | 500MB para dependências e logs |
| SO | Linux, macOS, Windows |
| Navegador | Firefox (instalado automaticamente via Playwright) |

## 🐛 Troubleshooting

### Erro: "ModuleNotFoundError"
```bash
# Reinstale as dependências
uv sync
```

### Erro: "Firefox not found"
```bash
# Instale o Firefox via Playwright
uv run python -m playwright install firefox
```

### A interface GUI não abre
```bash
# Verifique o ambiente X11 (Linux)
echo $DISPLAY

# Se estiver vazio, você pode estar em Wayland
# Use XWayland ou instale a versão Wayland do PyQt6
```

### Timeout ao acessar HelioWallet
- Verifique conexão com internet
- Aumente `TIMEOUT_PAGINA` em `automacao_bitcoin_saldo.py`
- Verifique se o site HelioWallet está operacional

### Processo travado
- Use `Ctrl+C` para interromper
- A automação roda em processo separado, então a interface continua responsiva

## 📈 Performance

| Operação | Tempo Estimado |
|----------|---|
| Processar 1 frase | 15-30 segundos |
| Processar 100 frases | 25-50 minutos |
| Salvar JSONL | < 1 segundo |

## ⚠️ Aviso Legal (Disclaimer)

Este software foi desenvolvido para fins de **auditoria e recuperação de dados próprios apenas**. 

**Aviso Importante:**
- ❌ Não use para acessar carteiras sem autorização
- ❌ Não use para fins fraudulentos ou ilícitos
- ⚠️ O autor não se responsabiliza por perdas financeiras
- ✅ Mantenha frases de recuperação em local seguro e privado
- ✅ Use em ambiente seguro e offline se possível

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👨‍💻 Autor

**Rafael Batista** - *Desenvolvedor Principal* - [@recifecrypto](https://github.com/recifecrypto)

---

## 📚 Recursos Adicionais

- [Documentação BIP39](https://github.com/trezor/python-mnemonic)
- [HelioWallet](https://heliowallet.com)
- [Playwright Documentation](https://playwright.dev/python)
- [PyQt6 Documentation](https://www.riverbankcomputing.com/static/Docs/PyQt6)

---

*Desenvolvido com ❤️ para a comunidade cripto.*
