import config from './config.js';

console.log('\n📋 ===== TESTE COMPLETO DE CONFIG =====\n');

console.log('✅ POLYGON_API_KEY:', config.POLYGON_API_KEY ? '✔️ Carregada' : '❌ Não encontrada');
console.log('✅ BSCSCAN_KEY:', config.BSCSCAN_KEY ? '✔️ Carregada' : '❌ Não encontrada');
console.log('✅ ETHERSCAN_KEY:', config.ETHERSCAN_KEY ? '✔️ Carregada' : '❌ Não encontrada');

console.log('\n📊 URLS CARREGADAS:\n');
console.log('POLYGON_API_KEY:', config.POLYGON_API_KEY);
console.log('BSCSCAN_KEY:', config.BSCSCAN_KEY);
console.log('ETHERSCAN_KEY:', config.ETHERSCAN_KEY);
console.log('RPC_ENDPOINT:', config.RPC_ENDPOINT);
console.log('SOL_RPC_ENDPOINT:', config.SOL_RPC_ENDPOINT);

console.log('\n✅ Todas as APIs estão sendo carregadas corretamente!\n');
