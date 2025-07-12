const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const certsPath = path.join(__dirname, 'certs');
const certPath = path.join(certsPath, 'cert.pem');
const keyPath = path.join(certsPath, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  console.log('Certificates already exist. Skipping generation.');
  process.exit(0);
}

if (!fs.existsSync(certsPath)) {
  fs.mkdirSync(certsPath);
}

const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, {
  keySize: 2048,
  algorithm: 'sha256',
  days: 365,
  extensions: [{
    name: 'subjectAltName',
    altNames: [{
      type: 2, // DNS
      value: 'localhost'
    }]
  }]
});

fs.writeFileSync(certPath, pems.cert);
fs.writeFileSync(keyPath, pems.private);

console.log('Certificates generated successfully.');
