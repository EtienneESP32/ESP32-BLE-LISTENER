let whitelist = [];
let vendors = {};
let surveillanceActive = false;

// Track which MACs were already present when page loaded (toast flood fix)
let initialMacs = null; // null = not yet initialized
const alertedOnClient = new Set();
const deviceElements = new Map();
const wlElements = new Map();

const BLE_APPEARANCE = {
    64: '📱 Smartphone', 128: '🖥️ Ordinateur', 192: '⌚ Montre/Bracelet',
    512: '🌡️ Capteur', 832: '💓 Cardio', 961: '⌨️ Clavier', 962: '🖱️ Souris',
    1024: '🎮 Manette', 1152: '🖨️ Imprimante', 2368: '🚲 Vélo', 3136: '🧴 Pèse-personne'
};
const KNOWN_SERVICES = {
    "180D": '<i class="fa-solid fa-heartbeat"></i> Cardio',
    "180F": '<i class="fa-solid fa-battery-half"></i> Batterie',
    "180A": '<i class="fa-solid fa-circle-info"></i> Info Appareil',
    "1812": '<i class="fa-solid fa-keyboard"></i> HID',
    "FD6F": '<i class="fa-solid fa-virus-covid"></i> Exposure',
    "FE2C": '<i class="fa-brands fa-google"></i> Fast Pair',
    "FE9F": '<i class="fa-brands fa-android"></i> Android TV',
    "FEED": '<i class="fa-solid fa-location-dot"></i> Tile'
};
const KNOWN_MFG = {
    "4C00": '<i class="fa-brands fa-apple"></i> Apple',
    "0600": '<i class="fa-brands fa-microsoft"></i> Microsoft',
    "E000": '<i class="fa-brands fa-google"></i> Google',
    "7500": '<i class="fa-brands fa-samsung"></i> Samsung',
    "0A00": '<i class="fa-solid fa-headphones"></i> Sony',
    "1D00": '<i class="fa-solid fa-headphones"></i> Bose'
};

async function initData() {
    try { vendors = await (await fetch('/vendors.json')).json(); } catch (e) { }
    await fetchSurveillanceStatus();
    fetchData();
    setInterval(fetchData, 3000);
}

async function fetchSurveillanceStatus() {
    try {
        const data = await (await fetch('/api/surveillance')).json();
        surveillanceActive = data.active;
        updateSurveillanceButton();
    } catch (e) { }
}

function updateSurveillanceButton() {
    const btn = document.getElementById('btn-surveillance');
    if (!btn) return;
    btn.innerHTML = surveillanceActive ? '🔒 Désarmer' : '🔓 Armer la surveillance';
    btn.className = 'btn-surveillance ' + (surveillanceActive ? 'armed' : 'disarmed');
}

async function toggleSurveillance() {
    const data = await (await fetch('/api/surveillance/toggle', { method: 'POST' })).json();
    surveillanceActive = data.active;
    if (!surveillanceActive) {
        alertedOnClient.clear();
        // Remove intrus class from all elements
        deviceElements.forEach(c => c.el.classList.remove('intrus'));
    }
    updateSurveillanceButton();
}

async function fetchData() {
    try {
        const [wlData, devData] = await Promise.all([
            fetch('/api/whitelist').then(r => r.json()),
            fetch('/api/devices').then(r => r.json())
        ]);

        if (devData.version) document.getElementById('firmware-version').innerText = devData.version;
        const all = devData.devices || [];

        // TOAST FLOOD FIX: record initial MACs on first load
        if (initialMacs === null) {
            initialMacs = new Set(all.filter(d => !d.whitelisted).map(d => d.mac));
        }

        renderDevices(all.filter(d => !d.whitelisted));
        renderWhitelist(wlData); // wlData is now array of objects with mac+lastSeen
    } catch (e) { console.error("Fetch error:", e); }
}

function getMacVendor(mac) {
    return vendors[mac.substring(0, 8).toUpperCase()] || null;
}
function parseServices(s) {
    if (!s) return [];
    return s.split(',').map(u => u.trim()).filter(u => u.length > 0).map(uuid => {
        const id = uuid.length >= 8 ? uuid.substring(4, 8).toUpperCase() : uuid.toUpperCase();
        return KNOWN_SERVICES[id] || `🧩 ${id}`;
    });
}
function parseMfg(mfgString) {
    if (!mfgString || mfgString.length < 4) return null;
    const mfgId = mfgString.substring(0, 4).toUpperCase();
    const rawHex = mfgString.substring(4).toUpperCase();
    let known = KNOWN_MFG[mfgId], semantic = "";
    if (mfgId === "0600" && rawHex.length >= 4) {
        const s = rawHex.substring(0, 2), t = rawHex.substring(2, 4);
        if (s === "01") {
            if (t === "01") semantic = " [🎮 Xbox One]";
            else if (t === "09") semantic = " [🖥️ PC Desktop]";
            else if (t === "0B") semantic = " [🎮 Xbox One S]";
            else if (t === "0C") semantic = " [🎮 Xbox Series X]";
            else if (t === "0D") semantic = " [🎮 Xbox One X]";
            else if (t === "0E") semantic = " [📺 Surface Hub]";
            else if (t === "0F") semantic = " [💻 Surface Pro/Laptop]";
            else if (t === "10") semantic = " [📱 Tablette Windows]";
        }
        if (rawHex.length >= 10 && (parseInt(rawHex.substring(4, 6), 16) & 1) === 1) semantic += " [Nearby Share]";
    }
    if (mfgId === "4C00" && rawHex.length >= 2) {
        const t = rawHex.substring(0, 2);
        if (t === "07" && rawHex.length >= 8) {
            const m = rawHex.substring(6, 8);
            if (m === "0E") semantic = " [🎧 AirPods Pro]";
            else if (m === "0F") semantic = " [🎧 AirPods 2]";
            else if (m === "13") semantic = " [🎧 AirPods 3]";
            else if (m === "0A") semantic = " [🎧 AirPods Max]";
            else semantic = " [🎧 AirPods/Beats]";
        }
        else if (t === "12") semantic = " [📍 AirTag]";
        else if (t === "05") semantic = " [📡 AirDrop]";
        else if (t === "10") semantic = " [🤝 Handoff]";
        else if (t === "09") semantic = " [📺 AirPlay]";
        else if (t === "02") semantic = " [📡 iBeacon]";
    }
    const rawSuffix = rawHex.length > 0 ? ` <small><b>[HEX: ${rawHex}]</b></small>` : "";
    return known ? `${known}${semantic}${rawSuffix}` : `🏭 0x${mfgId}${semantic}${rawSuffix}`;
}
function buildBadgesHtml(dev) {
    const vendor = (dev.vendor && dev.vendor !== "N/A") ? dev.vendor : getMacVendor(dev.mac || "");
    let h = `<span class="badge-type">${dev.addressType || 'Inconnue'}</span>`;
    if (dev.appearance && BLE_APPEARANCE[dev.appearance]) h += `<span class="badge-appearance">${BLE_APPEARANCE[dev.appearance]}</span>`;
    if (vendor) h += `<span class="badge-vendor">${vendor}</span>`;
    if (dev.battery !== undefined && dev.battery >= 0) h += `<span class="badge-battery">🔋 ${dev.battery}%</span>`;
    const mfg = parseMfg(dev.mfgData); if (mfg) h += `<span class="badge-mfg">${mfg}</span>`;
    parseServices(dev.services).forEach(b => { h += `<span class="badge-srv">${b}</span>`; });
    return h;
}

// Relative time with color
function formatRelativeTime(unixTs) {
    if (!unixTs || unixTs === 0) return { text: '⚫ Jamais vu', cls: 'ls-never', full: '' };
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixTs;
    const date = new Date(unixTs * 1000).toLocaleString('fr-FR');
    let text, cls;
    if (diff < 60) { text = `🟢 Il y a ${diff}s`; cls = 'ls-recent'; }
    else if (diff < 3600) { text = `🟢 Il y a ${Math.floor(diff / 60)}min`; cls = 'ls-recent'; }
    else if (diff < 86400) { text = `🟡 Il y a ${Math.floor(diff / 3600)}h`; cls = 'ls-today'; }
    else { text = `🔴 Il y a ${Math.floor(diff / 86400)}j`; cls = 'ls-old'; }
    return { text, cls, full: date };
}

function showToast(mac, name) {
    const existing = document.getElementById('intrus-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'intrus-toast'; toast.className = 'toast-alert';
    toast.innerHTML = `<div class="toast-icon">🚨</div><div class="toast-body"><b>INTRUS DÉTECTÉ</b><br><span class="toast-mac">${mac}</span><br><small>${name}</small></div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 5000);
}

function renderDevices(devices) {
    const list = document.getElementById('detected-list');
    document.getElementById('device-count').innerText = devices.length;
    if (devices.length === 0) {
        deviceElements.clear();
        list.innerHTML = `<div class="empty-state">Scan en cours...</div>`;
        return;
    }
    const activeMacs = new Set(devices.map(d => d.mac));
    deviceElements.forEach((c, mac) => {
        if (!activeMacs.has(mac)) {
            c.el.style.opacity = '0'; c.el.style.transition = 'opacity 0.5s';
            setTimeout(() => { if (c.el.parentNode) c.el.parentNode.removeChild(c.el); }, 500);
            deviceElements.delete(mac);
        }
    });
    devices.forEach(dev => {
        // Toast flood fix: only alert MACs that appeared AFTER initial load
        const isNew = initialMacs !== null && !initialMacs.has(dev.mac);
        if (surveillanceActive && isNew && !alertedOnClient.has(dev.mac)) {
            alertedOnClient.add(dev.mac);
            const dn = dev.gattName || dev.name || 'Appareil Inconnu';
            showToast(dev.mac, dn);
        }
        const intrusClass = (surveillanceActive && alertedOnClient.has(dev.mac)) ? ' intrus' : '';
        const displayName = dev.gattName ? `<span title="Nom GATT">🔗 ${dev.gattName}</span>`
            : (dev.name && dev.name !== 'Unknown' ? dev.name : 'Appareil Inconnu');
        const pct = Math.min(Math.max((dev.rssi + 100) / 60 * 100, 0), 100);
        const col = pct > 60 ? 'var(--success)' : pct > 30 ? '#eab308' : 'var(--danger)';
        const txHtml = (dev.txPower && dev.txPower !== -999) ? `<div class="tx-power">Tx: ${dev.txPower} dBm</div>` : "";
        const badges = buildBadgesHtml(dev);
        if (deviceElements.has(dev.mac)) {
            const c = deviceElements.get(dev.mac);
            c.el.querySelector('.device-title').innerHTML = `<b>${displayName}</b>`;
            c.el.querySelector('.badges-container').innerHTML = badges;
            c.el.querySelector('.rssi span').textContent = `${dev.rssi} dBm`;
            c.el.querySelector('.rssi-fill').style.cssText = `width:${pct}%;background:${col}`;
            if (intrusClass) c.el.classList.add('intrus');
        } else {
            const emptyState = list.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            const item = document.createElement('div');
            item.className = `device-item${intrusClass}`;
            item.innerHTML = `
                <div class="device-info"><span class="mac-address">${dev.mac}</span>
                <div class="device-meta"><div class="device-title"><b>${displayName}</b></div>
                <div class="badges-container">${badges}</div></div></div>
                <div class="device-right">${txHtml}
                <div class="rssi"><span>${dev.rssi} dBm</span>
                <div class="rssi-bar"><div class="rssi-fill" style="width:${pct}%;background:${col}"></div></div></div>
                <button class="btn btn-primary" style="margin-top:10px;width:100%;" onclick="addToWhitelist('${dev.mac}')">✅ Autoriser</button>
                </div>`;
            const emptyState2 = list.querySelector('.empty-state'); if (emptyState2) emptyState2.remove();
            list.appendChild(item);
            deviceElements.set(dev.mac, { el: item });
        }
    });
}

// wlData = array of {mac, name, vendor, mfgData, lastSeen, ...}
function renderWhitelist(wlData) {
    const list = document.getElementById('whitelist-list');
    document.getElementById('whitelist-count').innerText = wlData.length;
    if (wlData.length === 0) { list.innerHTML = `<div class="empty-state">Aucun appareil autorisé.</div>`; return; }

    const activeMacs = new Set(wlData.map(d => d.mac));
    wlElements.forEach((c, mac) => {
        if (!activeMacs.has(mac)) { c.el.remove(); wlElements.delete(mac); }
    });

    wlData.forEach(dev => {
        const displayName = dev.name && dev.name.length > 0 ? dev.name : dev.mac;
        const badges = buildBadgesHtml(dev);
        const ls = formatRelativeTime(dev.lastSeen);
        const lastSeenHtml = `<span class="last-seen ${ls.cls}" title="${ls.full}">${ls.text}</span>`;

        if (wlElements.has(dev.mac)) {
            const c = wlElements.get(dev.mac);
            c.el.querySelector('.device-title').innerHTML = `<b>${displayName}</b>`;
            c.el.querySelector('.badges-container').innerHTML = badges;
            c.el.querySelector('.last-seen').outerHTML = lastSeenHtml;
        } else {
            const item = document.createElement('div');
            item.className = 'device-item whitelisted';
            item.innerHTML = `
                <div class="device-info"><span class="mac-address">${dev.mac}</span>
                <div class="device-meta"><div class="device-title"><b>${displayName}</b></div>
                <div class="badges-container">${badges}</div>
                ${lastSeenHtml}</div></div>
                <div class="device-right">
                <button class="btn btn-danger" onclick="removeFromWhitelist('${dev.mac}')">🗑️</button>
                </div>`;
            list.appendChild(item);
            wlElements.set(dev.mac, { el: item });
        }
    });
}

async function addToWhitelist(mac) {
    const fd = new URLSearchParams(); fd.append('mac', mac);
    await fetch('/api/whitelist/add', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd });
    deviceElements.delete(mac);
    fetchData();
}
async function removeFromWhitelist(mac) {
    if (!confirm("Retirer de la liste blanche ?")) return;
    const fd = new URLSearchParams(); fd.append('mac', mac);
    await fetch('/api/whitelist/remove', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd });
    wlElements.delete(mac);
    fetchData();
}
async function addManualMac() {
    const input = document.getElementById('manual-mac');
    const mac = input.value.trim().toUpperCase();
    if (!/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/.test(mac)) { alert("MAC Invalide"); return; }
    await addToWhitelist(mac);
    input.value = '';
    document.getElementById('add-modal').classList.remove('active');
}

initData();
