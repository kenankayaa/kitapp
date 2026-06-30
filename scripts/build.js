const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function rm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function copy(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    mkdir(dest);
    for (const item of fs.readdirSync(src)) copy(path.join(src, item), path.join(dest, item));
  } else {
    mkdir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function readDirJson(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ ...readJson(path.join(folder, file)), __file: file }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.title || '').localeCompare(String(b.title || ''), 'tr'));
}

rm(dist);
mkdir(dist);
copy(path.join(root, 'src'), dist);
copy(path.join(root, 'admin'), path.join(dist, 'admin'));
copy(path.join(root, 'content'), path.join(dist, 'content'));

const index = {
  site: readJson(path.join(root, 'content', 'site.json')),
  about: readJson(path.join(root, 'content', 'pages', 'about.json')),
  books: readDirJson(path.join(root, 'content', 'books')),
  posts: readDirJson(path.join(root, 'content', 'posts')).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
};

fs.writeFileSync(path.join(dist, 'content', 'index.json'), JSON.stringify(index, null, 2));
console.log('Kenan Kaya sitesi hazırlandı: dist/');
