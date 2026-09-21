const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const cssPath = path.join(__dirname, 'style.css');
const jsPath = path.join(__dirname, 'app.js');
const standalonePath = path.join(__dirname, 'standalone.html');

let html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);
html = html.replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`);

fs.writeFileSync(standalonePath, html, 'utf8');
console.log('standalone.html generated successfully, size:', (Buffer.byteLength(html) / 1024).toFixed(1), 'KB');
