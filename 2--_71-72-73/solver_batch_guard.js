/**
 * Padrão compartilhado entre todos os solvers:
 * - falha de RPC/API não grava sem_saldo
 * - recua checkpoint e aguarda retry
 * - log resumido por lote
 */

export function getEvmResult(results, item, toChecksum = (addr) => addr) {
  return results[item.addr] || results[toChecksum(item.addr)];
}

export function findBatchRpcFailures(batch, results, options = {}) {
  const hasResult = options.hasResult
    || ((item) => Boolean(results[options.keyFn ? options.keyFn(item) : item.addr]));

  return batch.filter((item) => !hasResult(item));
}

export function rewindBatchCheckpoint(solver, batch) {
  const raw = batch[0].privHex;
  const firstPriv = BigInt(raw.startsWith('0x') ? raw : `0x${raw}`);
  const rewind = firstPriv > solver.rangeMin ? firstPriv - 1n : solver.rangeMin;
  solver.state.lastPrivkey = '0x' + rewind.toString(16);
  solver.state.totalChecked = Math.max(0, solver.state.totalChecked - batch.length);
  solver._saveState();
}

export async function handleBatchRpcFailure(solver, batch, results, options = {}) {
  const failed = findBatchRpcFailures(batch, results, options);
  if (failed.length === 0) return false;

  rewindBatchCheckpoint(solver, batch);
  const retryMs = options.retryMs ?? 15000;
  solver.log(
    `⚠️ ${failed.length}/${batch.length} endereços sem resposta RPC — `
    + `checkpoint recuado para ${solver.state.lastPrivkey}, retry em ${retryMs}ms`
  );
  await new Promise((resolve) => setTimeout(resolve, retryMs));
  return true;
}

export function logBatchItemErrors(logFn, label, itemErrors, total, firstError) {
  if (itemErrors > 0) {
    logFn(`⚠️ [${label}] ${itemErrors}/${total} itens falharam: ${firstError || 'erro RPC'}`);
  }
}

export function summarizeMissingResults(logFn, label, results, addresses) {
  const missing = addresses.filter((addr) => !results[addr]);
  if (missing.length > 0) {
    logFn(`⚠️ [${label}] ${missing.length}/${addresses.length} endereços sem resposta após consulta`);
  }
  return missing.length;
}

export function rpcHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'rpc';
  }
}

export function buildRpcEndpoints(primary, fallback, fallback2) {
  return [...new Set([primary, fallback, fallback2].filter(
    (url) => url && typeof url === 'string' && !url.includes('YOUR_')
  ))];
}

export function isTransientRpcMessage(message = '') {
  const msg = message.toLowerCase();
  return msg.includes('timeout')
    || msg.includes('does not exist')
    || msg.includes('not available')
    || msg.includes('rate limit')
    || msg.includes('too many')
    || msg.includes('429');
}
