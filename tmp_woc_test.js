const fetch = global.fetch || require('node-fetch');
const bsv = require('bsv');
const priv = bsv.PrivKey.fromRandom();
const kp = bsv.KeyPair.fromPrivKey(priv);
const walletAddress = bsv.Address.fromPrivKey(priv).toString();
const amount = 1000;
const tx = new bsv.Tx();
const inputScript = bsv.Address.fromString(walletAddress).toTxOutScript();
tx.addTxIn(Buffer.from('00'.repeat(32), 'hex'), 0, inputScript);
tx.addTxOut(new bsv.Bn(amount), bsv.Address.fromString(walletAddress).toTxOutScript());
const sig = tx.sign(kp, undefined, 0, inputScript, new bsv.Bn(amount));
const der = sig.toBuffer();
const sighashByte = Buffer.from([sig.nHashType ?? 1]);
const sigWithHash = Buffer.concat([der, sighashByte]);
const pubRaw = kp.toPublic().pubKey.toBuffer();
const scriptSigBuf = Buffer.concat([
  Buffer.from([sigWithHash.length]),
  sigWithHash,
  Buffer.from([pubRaw.length]),
  pubRaw,
]);
tx.txIns[0].setScript(new bsv.Script().fromBuffer(scriptSigBuf));
const hex = tx.toString();
console.log('tx hex', hex);
(async () => {
  const res = await fetch('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txhex: hex }),
  });
  const text = await res.text();
  console.log('status', res.status);
  console.log('body', text);
})();
