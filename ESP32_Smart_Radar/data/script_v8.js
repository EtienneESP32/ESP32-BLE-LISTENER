let whitelist = [];
let vendors = {};

// Stable DOM cache: mac -> { element, lastRssi }
const deviceElements = new Map();

// Bluetooth SIG Appearance Categories
const BLE_APPEARANCE = {
    64: '📱 Smartphone', 128: '🖥️ Ordinateur', 192: '⌚ Montre/Bracelet',
    512: '🌡️ Capteur', 832: '💓 Cardio', 961: '⌨️ Clavier', 962: '🖱️ Souris',
    1024: '🎮 Manette', 1152: '🖨️ Imprimante', 2368: '🚲 Vélo', 3136: '🧴 Pèse-personne'
};

const KNOWN_SERVICES = {
    "180D": '<i class="fa-solid fa-heartbeat"></i> Cardio',
    "180F": '<i class="fa-solid fa-battery-half"></i> Batterie',
    "180A": '<i class="fa-solid fa-circle-info"></i> Info Appareil',
    "1812": '<i class="fa-solid fa-keyboard"></i> HID (Clavier/Souris)',
    "FD6F": '<i class="fa-solid fa-virus-covid"></i> Exposure (Contact Tracing)',
    "FE2C": '<i class="fa-brands fa-google"></i> Google Fast Pair',
    "FE9F": '<i class="fa-brands fa-android"></i> Android TV',
    "FEED": '<i class="fa-solid fa-location-dot"></i> Tile/Tracker'
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
    try {
        const venRes = await fetch('/vendors.json');
        vendors = await venRes.json();
    } catch (e) { console.warn("vendors.json not loaded", e); }
    fetchData();
    setInterval(fetchData, 3000);
}

async function fetchData() {
    try {
        const [wlRes, devRes] = await Promise.all([
            fetch('/api/whitelist'),
            fetch('/api/devices')
        ]);
        whitelist = await wlRes.json();
        renderWhitelist();

        const data = await devRes.json();
        if (data.version) document.getElementById('firmware-version').innerText = data.version;
        renderDevices(data.devices || []);
    } catch (e) { console.error("Fetch error:", e); }
}

function getMacVendor(mac) {
    return vendors[mac.substring(0, 8).toUpperCase()] || null;
}

function parseServices(serviceString) {
    if (!serviceString) return [];
    return serviceString.split(',').map(s => s.trim()).filter(s => s.length > 0).map(uuid => {
        let shortId = uuid.length >= 8 ? uuid.substring(4, 8).toUpperCase() : uuid.toUpperCase();
        return KNOWN_SERVICES[shortId] || `🧩 Srv:0x${shortId}`;
    });
}

function parseMfg(mfgString) {
    if (!mfgString || mfgString.length < 4) return null;
    const mfgId = mfgString.substring(0, 4).toUpperCase();
    const rawHex = mfgString.substring(4).toUpperCase();
    let known = KNOWN_MFG[mfgId];
    let semantic = "";

    // Microsoft MS-CDP
    if (mfgId === "0600" && rawHex.length >= 4) {
        const scenario = rawHex.substring(0, 2);
        const deviceType = rawHex.substring(2, 4);
        if (scenario === "01") {
            if (deviceType === "01") semantic = " [🎮 Xbox One]";
            else if (deviceType === "09") semantic = " [🖥️ PC Windows Desktop]";
            else if (deviceType === "0B") semantic = " [🎮 Xbox One S]";
            else if (deviceType === "0C") semantic = " [🎮 Xbox Series X]";
            else if (deviceType === "0D") semantic = " [🎮 Xbox One X]";
            else if (deviceType === "0E") semantic = " [📺 Surface Hub]";
            else if (deviceType === "0F") semantic = " [💻 PC Portable / Surface Pro]";
            else if (deviceType === "10") semantic = " [📱 Tablette Windows]";
        }
        if (rawHex.length >= 10) {
            const flags = parseInt(rawHex.substring(4, 6), 16);
            if ((flags & 0x01) === 1) semantic += " [Nearby Share: Visible par tous]";
        }
    }

    // Apple Continuity
    if (mfgId === "4C00" && rawHex.length >= 2) {
        const type = rawHex.substring(0, 2);
        if (type === "07" && rawHex.length >= 8) {
            const modelCode = rawHex.substring(6, 8);
            if (modelCode === "0E") semantic = " [🎧 AirPods Pro]";
            else if (modelCode === "0F") semantic = " [🎧 AirPods 2]";
            else if (modelCode === "13") semantic = " [🎧 AirPods 3]";
            else if (modelCode === "0A") semantic = " [🎧 AirPods Max]";
            else semantic = " [🎧 AirPods/Beats]";
        }
        else if (type === "12") semantic = " [📍 Réseau Localiser / AirTag]";
        else if (type === "05") semantic = " [📡 AirDrop]";
        else if (type === "10") semantic = " [🤝 Handoff/Continuity]";
        else if (type === "09") semantic = " [📺 AirPlay]";
        else if (type === "02") semantic = " [📡 iBeacon]";
    }

    const rawSuffix = rawHex.length > 0 ? ` <small><b>[HEX: ${rawHex}]</b></small>` : "";
    if (known) return `${known}${semantic}${rawSuffix}`;
    return `🏭 Mfg:0x${mfgId}${semantic}${rawSuffix}`;
}

function buildBadgesHtml(dev) {
    const finalVendor = dev.vendor !== "N/A" ? dev.vendor : getMacVendor(dev.mac);
    let html = `<span class="badge-type">${dev.addressType || 'Inconnue'}</span>`;
    if (dev.appearance && BLE_APPEARANCE[dev.appearance])
        html += `<span class="badge-appearance">${BLE_APPEARANCE[dev.appearance]}</span>`;
    if (finalVendor)
        html += `<span class="badge-vendor">${finalVendor}</span>`;
    if (dev.battery !== undefined && dev.battery >= 0)
        html += `<span class="badge-battery">🔋 ${dev.battery}%</span>`;
    const mfgBadge = parseMfg(dev.mfgData);
    if (mfgBadge) html += `<span class="badge-mfg">${mfgBadge}</span>`;
    parseServices(dev.services).forEach(b => { html += `<span class="badge-srv">${b}</span>`; });
    return html;
}

// ---------------------------------------------------------------
// STABLE RENDER — updates in-place, no DOM rebuild on every tick
// ---------------------------------------------------------------
function renderDevices(devices) {
    const list = document.getElementById('detected-list');
    const nonWl = devices.filter(d => !d.whitelisted);
    document.getElementById('device-count').innerText = nonWl.length;

    if (nonWl.length === 0) {
        deviceElements.clear();
        list.innerHTML = `<div class="empty-state">Scan en cours...</div>`;
        return;
    }

    // Track which MACs are still active
    const activeMacs = new Set(nonWl.map(d => d.mac));

    // Remove disappeared devices with fade
    deviceElements.forEach((cached, mac) => {
        if (!activeMacs.has(mac)) {
            cached.el.style.opacity = '0';
            cached.el.style.transition = 'opacity 0.5s';
            setTimeout(() => { if (cached.el.parentNode) cached.el.parentNode.removeChild(cached.el); }, 500);
            deviceElements.delete(mac);
        }
    });

    // Update or create elements
    nonWl.forEach(dev => {
        // Priority name: GATT > regular name > "Appareil Inconnu"
        const displayName = (dev.gattName && dev.gattName.length > 0)
            ? `<span title="Nom lu via connexion GATT directe">🔗 ${dev.gattName}</span>`
            : (dev.name && dev.name !== 'Unknown' ? dev.name : 'Appareil Inconnu');

        const percent = Math.min(Math.max((dev.rssi + 100) / 60 * 100, 0), 100);
        const color = percent > 60 ? 'var(--success)' : percent > 30 ? '#eab308' : 'var(--danger)';
        const txHtml = (dev.txPower && dev.txPower !== -999) ? `<div class="tx-power">Tx: ${dev.txPower} dBm</div>` : "";
        const badgesHtml = buildBadgesHtml(dev);

        if (deviceElements.has(dev.mac)) {
            // UPDATE IN PLACE — only touch changed elements
            const cached = deviceElements.get(dev.mac);
            cached.el.querySelector('.device-title').innerHTML = `<b>${displayName}</b>`;
            cached.el.querySelector('.badges-container').innerHTML = badgesHtml;
            cached.el.querySelector('.rssi span').textContent = `${dev.rssi} dBm`;
            cached.el.querySelector('.rssi-fill').style.width = `${percent}%`;
            cached.el.querySelector('.rssi-fill').style.background = color;
            const txEl = cached.el.querySelector('.tx-power');
            if (txEl) txEl.outerHTML = txHtml;
        } else {
            // NEW DEVICE — create and append
            const item = document.createElement('div');
            item.className = 'device-item';
            item.innerHTML = `
                <div class="device-info">
                    <span class="mac-address">${dev.mac}</span>
                    <div class="device-meta">
                        <div class="device-title"><b>${displayName}</b></div>
                        <div class="badges-container">${badgesHtml}</div>
                    </div>
                </div>
                <div class="device-right">
                    ${txHtml}
                    <div class="rssi">
                        <span>${dev.rssi} dBm</span>
                        <div class="rssi-bar"><div class="rssi-fill" style="width:${percent}%;background:${color}"></div></div>
                    </div>
                    <button class="btn btn-primary" style="margin-top:10px;width:100%;" onclick="addToWhitelist('${dev.mac}')">
                        ✅ Autoriser
                    </button>
                </div>
            `;
            // Remove stale empty-state if present
            const emptyState = list.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            list.appendChild(item);
            deviceElements.set(dev.mac, { el: item });
        }
    });
}

function renderWhitelist() {
    const list = document.getElementById('whitelist-list');
    document.getElementById('whitelist-count').innerText = whitelist.length;
    if (whitelist.length === 0) { list.innerHTML = `<div class="empty-state">Aucun appareil autorisé.</div>`; return; }
    list.innerHTML = '';
    whitelist.forEach(mac => {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.innerHTML = `
            <div class="device-info">
                <span class="mac-address">${mac}</span>
                <span class="device-meta vendor">Autorisé</span>
            </div>
            <button class="btn btn-danger" onclick="removeFromWhitelist('${mac}')">🗑️</button>
        `;
        list.appendChild(item);
    });
}

async function addToWhitelist(mac) {
    const fd = new URLSearchParams(); fd.append('mac', mac);
    await fetch('/api/whitelist/add', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd });
    fetchData();
}

async function removeFromWhitelist(mac) {
    if (!confirm("Supprimer ?")) return;
    const fd = new URLSearchParams(); fd.append('mac', mac);
    await fetch('/api/whitelist/remove', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd });
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
