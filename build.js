const fs = require('fs-extra');
const path = require('path');

const BUILD_DIR = 'dist';

// Files and directories to copy
const FILES_TO_COPY = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.js',
  'popup.html',
  'options.js',
  'options.html',
  'icons'
];

// Clean build directory
if (fs.existsSync(BUILD_DIR)) {
  fs.removeSync(BUILD_DIR);
}
fs.mkdirSync(BUILD_DIR);

// Copy files
FILES_TO_COPY.forEach(file => {
  const sourcePath = path.join(__dirname, file);
  const targetPath = path.join(__dirname, BUILD_DIR, file);
  
  if (fs.existsSync(sourcePath)) {
    if (fs.lstatSync(sourcePath).isDirectory()) {
      fs.copySync(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
    console.log(`Copied ${file} to ${BUILD_DIR}`);
  } else {
    console.warn(`Warning: ${file} not found`);
  }
});

console.log('Build completed successfully!'); 