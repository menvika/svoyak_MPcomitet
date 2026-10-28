const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3001;

// Файлы сайта, которые сервер отдаёт сам (чтобы всё открывалось одним адресом)
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function lanAddresses() {
  // Собираем адреса компьютера в сети и ставим «настоящий» Wi-Fi/LAN адрес первым,
  // а адреса виртуальных адаптеров (VirtualBox, WSL, Docker, VPN) — в конец.
  const found = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach(name => {
    (nets[name] || []).forEach(n => {
      if (n.family !== 'IPv4' || n.internal) return;
      const a = n.address;
      let rank = 5;
      if (/^192\.168\./.test(a)) rank = 0;
      else if (/^10\./.test(a)) rank = 1;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a)) rank = 2;
      if (/^192\.168\.(56|99|137|203)\./.test(a)) rank += 3;          // VirtualBox / VMware
      if (/virtual|vbox|vmware|vethernet|wsl|docker|hyper-v|hamachi|radmin|tailscale|zerotier|vpn|tap|tun/i.test(name)) rank += 6;
      if (/^169\.254\./.test(a)) rank = 20;                              // адрес «без сети»
      found.push({ a, rank });
    });
  });
  found.sort((x, y) => x.rank - y.rank);
  return found.map(f => f.a);
}

function serveStatic(url, res) {
  let rel;
  try { rel = decodeURIComponent(url); } catch (e) { rel = ''; }
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.normalize(path.join(__dirname, rel));
  const base = path.basename(full);
  const ext = path.extname(full).toLowerCase();
  // только внутри папки игры, без скрытых файлов и без самого server.js
  if (!full.startsWith(__dirname + path.sep) || base.startsWith('.') || base === 'server.js' || !MIME[ext]) {
    res.writeHead(404); res.end('Not found'); return;
  }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

// Состояние игры (его присылает ведущий, читает проектор)
let gameState = null;

// Кнопки участников. Хранятся на сервере, чтобы «кто первый» решал порядок
// прихода запросов, а не часы телефонов.
//   open    — кнопки открыты и ждут нажатия
//   winner  — индекс игрока, нажавшего первым (null, если никто)
//   locked  — игроки, которым нельзя нажимать на этом вопросе (уже ответили неверно)
const buzz = { open: false, winner: null, locked: [], round: 0, winnerAt: 0 };

function buzzPublic() {
  return {
    open: buzz.open,
    winner: buzz.winner,
    locked: buzz.locked.slice(),
    round: buzz.round,
    winnerAt: buzz.winnerAt,
    now: Date.now(),
  };
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req, cb) {
  let body = '';
  let tooBig = false;
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1e6) { tooBig = true; req.destroy(); }
  });
  req.on('end', () => {
    if (tooBig) return;
    try { cb(null, body ? JSON.parse(body) : {}); } catch (e) { cb(e); }
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Путь без параметров и без возможного префикса прокси
  const url = req.url.split('?')[0].replace(/^\/port\/3001/, '').replace(/\/+$/, '') || '/';

  // ---------- информация о сервере (для ссылки участникам) ----------
  if (url === '/info' && req.method === 'GET') {
    send(res, 200, { ok: true, version: 2, port: PORT, ips: lanAddresses() });
    return;
  }

  // ---------- состояние игры ----------
  if (url === '/state' && req.method === 'GET') {
    send(res, 200, Object.assign({}, gameState || {}, { buzz: buzzPublic() }));
    return;
  }

  if (url === '/state' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err) return send(res, 400, { error: 'bad json' });
      // Запросы могут прийти не по порядку: старый не должен затирать новый
      if (gameState && gameState.seq && data.seq && data.seq < gameState.seq) {
        return send(res, 200, { ok: true, stale: true });
      }
      gameState = data;
      send(res, 200, { ok: true });
    });
    return;
  }

  // ---------- кнопки участников ----------
  if (url === '/buzz' && req.method === 'GET') {
    send(res, 200, buzzPublic());
    return;
  }

  // Нажатие участника
  if (url === '/buzz' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err) return send(res, 400, { error: 'bad json' });
      const p = Number.isInteger(data.player) ? data.player : -1;
      const max = gameState && Array.isArray(gameState.players) && gameState.players.length ? gameState.players.length : 20;
      if (p < 0 || p >= max) return send(res, 400, { error: 'bad player' });

      let reason = null;
      if (!buzz.open && buzz.winner === null) reason = 'closed';
      else if (buzz.locked.includes(p)) reason = 'locked';
      else if (buzz.winner !== null) reason = p === buzz.winner ? 'you' : 'late';
      else if (!buzz.open) reason = 'closed';

      if (reason) return send(res, 200, Object.assign({ ok: false, reason }, buzzPublic()));

      buzz.winner = p;
      buzz.open = false;
      buzz.winnerAt = Date.now();
      send(res, 200, Object.assign({ ok: true, reason: 'first' }, buzzPublic()));
    });
    return;
  }

  // Управление кнопками (ведущий)
  if (url === '/buzz/control' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err) return send(res, 400, { error: 'bad json' });
      switch (data.action) {
        case 'new':     // новый вопрос: всё сброшено, кнопки закрыты
          buzz.open = false; buzz.winner = null; buzz.locked = []; buzz.winnerAt = 0; buzz.round++;
          break;
        case 'open':    // открыть кнопки для тех, кто не заблокирован
          buzz.winner = null; buzz.winnerAt = 0; buzz.open = true; buzz.round++;
          break;
        case 'close':   // закрыть кнопки (победитель, если был, остаётся виден)
          buzz.open = false;
          break;
        case 'wrong':   // ответ неверный: игрок блокируется, кнопки открываются остальным
          if (buzz.winner !== null && !buzz.locked.includes(buzz.winner)) buzz.locked.push(buzz.winner);
          buzz.winner = null; buzz.winnerAt = 0; buzz.open = true; buzz.round++;
          break;
        case 'reset':   // сбросить всё и открыть для всех
          buzz.winner = null; buzz.winnerAt = 0; buzz.locked = []; buzz.open = true; buzz.round++;
          break;
        default:
          return send(res, 400, { error: 'bad action' });
      }
      send(res, 200, buzzPublic());
    });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') { serveStatic(url, res); return; }

  res.writeHead(404);
  res.end('Not found');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('Порт ' + PORT + ' уже занят. Закройте старый сервер (или старое окно с node server.js) и запустите снова.');
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Сервер игры запущен.');
  console.log('  Ведущий:      http://localhost:' + PORT + '/');
  console.log('  Проектор:     http://localhost:' + PORT + '/?view=display');
  lanAddresses().forEach(ip => console.log('  Участники:    http://' + ip + ':' + PORT + '/?view=buzzer'));
});
