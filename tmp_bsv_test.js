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
tx.txIns[0].script = new bsv.Script().fromBuffer(scriptSigBuf);
const hex = tx.toString();
console.log('scriptSig hex', tx.txIns[0].script.toBuffer().toString('hex'));
console.log('scriptSig len', tx.txIns[0].script.toBuffer().length);
console.log('scriptSig pushonly?', tx.txIns[0].script.isPushOnly());
console.log('tx hex', hex);
