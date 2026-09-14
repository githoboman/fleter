const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}
const files = walk('c:/Users/OWNER/Desktop/fleter/frontend/src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/Somnia Shannon/g, 'Bot Chain Testnet');
  content = content.replace(/Somnia wallet/ig, 'Bot Chain wallet');
  content = content.replace(/Somnia won't/g, "Bot Chain won't");
  content = content.replace(/Somnia execution profile/g, 'Bot Chain execution profile');
  content = content.replace(/from the Somnia faucet/g, 'from the Bot Chain faucet');
  content = content.replace(/Somnia rejected/g, 'Bot Chain rejected');
  content = content.replace(/DreamDEX Event Contracts/g, 'BitDrum Markets');
  content = content.replace(/DreamDEX Event Contract/g, 'BitDrum Market');
  content = content.replace(/DreamDEX windows/g, 'BitDrum windows');
  content = content.replace(/DreamDEX window/g, 'BitDrum window');
  content = content.replace(/DreamDEX feed/g, 'BitDrum feed');
  content = content.replace(/DreamDEX Up\/Down window/g, 'BitDrum Up/Down window');
  content = content.replace(/DreamDEX Index Pulse/g, 'BitDrum Index Pulse');
  content = content.replace(/DreamDEX positions/g, 'BitDrum positions');
  content = content.replace(/DreamDEX/g, 'BitDrum');
  content = content.replace(/TestUSDC/g, 'BOT');
  content = content.replace(/COLLATERAL_SYMBOL = 'USDC'/g, 'COLLATERAL_SYMBOL = \'BOT\'');
  content = content.replace(/COLLATERAL_SYMBOL = "USDC"/g, 'COLLATERAL_SYMBOL = "BOT"');
  content = content.replace(/1 USDC per winning share/g, '1 BOT per winning share');
  content = content.replace(/no STT for gas/g, 'no BOT for gas');
  content = content.replace(/Shannon STT/g, 'Testnet BOT');
  content = content.replace(/Somnia/g, 'Bot Chain');
  fs.writeFileSync(file, content);
});
console.log('Replaced Somnia/DreamDEX/USDC terms in all src files.');
