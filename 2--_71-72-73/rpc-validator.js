/**
 * ========================================
 * RPC VALIDATOR - Validação de Endpoints por Rede
 * ========================================
 * 
 * Garante que cada solver está usando a RPC correta
 * Valida URLs, testa conexão e loga qual rede está sendo usada
 * 
 * Uso:
 *   import { validateRpcEndpoint } from './rpc-validator.js'
 *   validateRpcEndpoint('ETHEREUM', config.RPC_ENDPOINT, 'ETH_PUZZLE_72')
 */

import axios from 'axios';

/**
 * Valida e testa o endpoint RPC de uma rede específica
 */
export async function validateRpcEndpoint(network, rpcUrl, puzzleId) {
  console.log(`\n🔍 Validando RPC para ${network}...`);
  
  // 1. Verificar URL não vazia
  if (!rpcUrl || typeof rpcUrl !== 'string') {
    throw new Error(`❌ [${network}] RPC_ENDPOINT está vazio ou undefined`);
  }
  
  // 2. Verificar placeholder
  if (rpcUrl.includes('YOUR_') || rpcUrl.includes('YOUR-') || rpcUrl === '') {
    throw new Error(`❌ [${network}] RPC_ENDPOINT contém placeholder: "${rpcUrl}"`);
  }
  
  // 3. Verificar formato URL
  try {
    new URL(rpcUrl);
  } catch (e) {
    throw new Error(`❌ [${network}] URL inválida: "${rpcUrl}"`);
  }
  
  // 4. Log informacional
  console.log(`✅ [${network}] RPC URL validada: ${rpcUrl.substring(0, 60)}...`);
  console.log(`✅ [${network}] Puzzle: ${puzzleId}`);
  
  // 5. Teste de conexão rápido (sem esperar muito)
  try {
    const testUrl = buildTestRequest(network, rpcUrl);
    console.log(`🔗 Testando conexão com ${network}...`);
    
    // Timeout curto para teste (3 segundos)
    const timeout = setTimeout(() => {
      throw new Error(`Timeout na conexão com ${network}`);
    }, 3000);
    
    const response = await axios.post(rpcUrl, testUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Puzzle-Solver-Client/1.0',
        'Connection': 'keep-alive'
      },
      timeout: 3000,
    });
    
    clearTimeout(timeout);
    
    if (response.status === 200) {
      console.log(`✅ [${network}] Conexão estabelecida com sucesso!\n`);
    }
  } catch (error) {
    // Se o teste falhar, apenas avisar (não falhar completamente)
    console.warn(`⚠️  [${network}] Teste de conexão falhou (rede pode estar lenta):`);
    console.warn(`   ${error.message}\n`);
    console.warn(`   ℹ️  O solver continuará mesmo assim (pode falhar em runtime)\n`);
  }
}

/**
 * Constrói requisição de teste para cada rede
 */
function buildTestRequest(network, rpcUrl) {
  switch (network) {
    case 'ETHEREUM':
    case 'POLYGON':
    case 'BNB':
      // Teste: eth_chainId (leve e rápido)
      return {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      };
    
    case 'SOLANA':
      // Teste: getHealth (Solana)
      return {
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
        params: [],
      };
    
    case 'BITCOIN':
      // Teste: getinfo (Bitcoin Blockbook)
      return {
        jsonrpc: '2.0',
        id: 1,
        method: 'getinfo',
        params: [],
      };
    
    default:
      return { jsonrpc: '2.0', id: 1, method: 'web3_clientVersion', params: [] };
  }
}

/**
 * Validação simples (síncrona) para uso nos solvers
 */
export function validateRpcSync(network, rpcUrl, puzzleId) {
  if (!rpcUrl || typeof rpcUrl !== 'string') {
    throw new Error(`❌ [${network}] RPC_ENDPOINT está vazio ou undefined`);
  }
  
  if (rpcUrl.includes('YOUR_') || rpcUrl.includes('YOUR-') || rpcUrl === '') {
    throw new Error(`❌ [${network}] RPC_ENDPOINT contém placeholder: "${rpcUrl}"`);
  }
  
  try {
    new URL(rpcUrl);
  } catch (e) {
    throw new Error(`❌ [${network}] URL inválida: "${rpcUrl}"`);
  }
  
  console.log(`\n✅ [${network}] RPC validada`);
  console.log(`   URL: ${rpcUrl.substring(0, 50)}...`);
  console.log(`   Puzzle: ${puzzleId}\n`);
}

/**
 * Log detalhado do RPC sendo usado
 */
export function logRpcInfo(network, rpcUrl, puzzleId, batchSize, delay) {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  📡 RPC INFORMATION - ${network.padEnd(45)} ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
  
  console.log(`Network:     ${network}`);
  console.log(`RPC URL:     ${rpcUrl.substring(0, 60)}...`);
  console.log(`Puzzle:      ${puzzleId}`);
  console.log(`Batch Size:  ${batchSize}`);
  console.log(`Delay:       ${delay}ms\n`);
}
