const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      filelist.push(dirFile);
    }
  });
  return filelist;
};

const renameFiles = [
  ['src/utils/bitdrum.ts', 'src/utils/botrem.ts'],
  ['src/utils/somnia.ts', 'src/utils/botchain.ts'],
  ['src/components/BitdrumWalletProvider.tsx', 'src/components/BotremWalletProvider.tsx'],
];

renameFiles.forEach(([oldPath, newPath]) => {
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed ${oldPath} to ${newPath}`);
  }
});

const files = walkSync('./src');
files.push('./package.json', './next.config.ts', './.env.example');

files.forEach(file => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.json') && !file.endsWith('.js') && !file.endsWith('.example')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Protect the SDK import path
  content = content.replace(/@somnia-chain\/markets-sdk/g, '@@PROTECTED_SDK@@');
  
  // Replacements
  content = content.replace(/BitDrum/g, 'Botrem');
  content = content.replace(/bitdrum/g, 'botrem');
  content = content.replace(/Bitdrum/g, 'Botrem');
  content = content.replace(/BITDRUM/g, 'BOTREM');
  
  content = content.replace(/Somnia/g, 'BotChain');
  content = content.replace(/somnia/g, 'botchain');
  content = content.replace(/SOMNIA/g, 'BOTCHAIN');
  
  // Restore SDK import path
  content = content.replace(/@@PROTECTED_SDK@@/g, '@somnia-chain/markets-sdk');
  
  fs.writeFileSync(file, content);
});

console.log("Replacement complete.");
