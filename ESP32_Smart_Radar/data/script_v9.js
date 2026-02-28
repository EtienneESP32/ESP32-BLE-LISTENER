let whitelist = [];
let vendors = {};
let surveillanceActive = false;
const alertedOnClient = new Set(); // Pour n'afficher le toast qu'une fois par MAC

// Stable DOM cache
const deviceElements = new Map();

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
    "FD6F": '<i class="fa-solid fa-virus-covid"></i> Exposure',
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
    await fetchSurveillanceStatus();
    fetchData();
    setInterval(fetchData, 3000);
}

async function fetchSurveillanceStatus() {
    try {
        const res = await fetch('/api/surveillance');
        const data = await res.json();
        surveillanceActive = data.active;
        updateSurveillanceButton();
    } catch (e) { console.error("Surveillance status error:", e); }
}

function updateSurveillanceButton() {
    const btn = document.getElementById('btn-surveillance');
    if (!btn) return;
    if (surveillanceActive) {
        btn.innerHTML = '🔒 Désarmer';
        btn.className = 'btn-surveillance armed';
    } else {
        btn.innerHTML = '🔓 Armer la surveillance';
        btn.className = 'btn-surveillance disarmed';
    }
}

async function toggleSurveillance() {
    try {
        const res = await fetch('/api/surveillance/toggle', { method: 'POST' });
        const data = await res.json();
        surveillanceActive = data.active;
        if (!surveillanceActive) alertedOnClient.clear();
        updateSurveillanceButton();
    } catch (e) { console.error("Toggle error:", e); }
}

async function fetchData() {
    try {
        const [wlRes, devRes] = await Promise.all([
            fetch('/api/whitelist'),
            fetch('/api/devices')
        ]);
        whitelist = await wlRes.json();
        const data = await devRes.json();
        if (data.version) document.getElementById('firmware-version').innerText = data.version;

        const all = data.devices || [];
        renderDevices(all.filter(d => !d.whitelisted));
        renderWhitelist(all.filter(d => d.whitelisted));
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
            if ((flags & 0x01) === 1) semantic += " [Nearby Share]";
        }
    }

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
        else if (type === "12") semantic = " [📍 AirTag / Localiser]";
        else if (type === "05") semantic = " [📡 AirDrop]";
        else if (type === "10") semantic = " [🤝 Handoff]";
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
    if (finalVendor) html += `<span class="badge-vendor">${finalVendor}</span>`;
    if (dev.battery !== undefined && dev.battery >= 0)
        html += `<span class="badge-battery">🔋 ${dev.battery}%</span>`;
    const mfgBadge = parseMfg(dev.mfgData);
    if (mfgBadge) html += `<span class="badge-mfg">${mfgBadge}</span>`;
    parseServices(dev.services).forEach(b => { html += `<span class="badge-srv">${b}</span>`; });
    return html;
}

function showToast(mac, name) {
    const existing = document.getElementById('intrus-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'intrus-toast';
    toast.className = 'toast-alert';
    toast.innerHTML = `
        <div class="toast-icon">🚨</div>
        <div class="toast-body">
            <b>INTRUS DÉTECTÉ</b><br>
            <span class="toast-mac">${mac}</span><br>
            <small>${name}</small>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// ---------------------------------------------------------------
// STABLE RENDER — detected (non-whitelisted) devices
// ---------------------------------------------------------------
function renderDevices(devices) {
    const list = document.getElementById('detected-list');
    document.getElementById('device-count').innerText = devices.length;

    if (devices.length === 0) {
        deviceElements.clear();
        list.innerHTML = `<div class="empty-state">Scan en cours...</div>`;
        return;
    }

    const activeMacs = new Set(devices.map(d => d.mac));

    // Remove disappeared devices
    deviceElements.forEach((cached, mac) => {
        if (!activeMacs.has(mac)) {
            cached.el.style.opacity = '0';
            cached.el.style.transition = 'opacity 0.5s';
            setTimeout(() => { if (cached.el.parentNode) cached.el.parentNode.removeChild(cached.el); }, 500);
            deviceElements.delete(mac);
        }
    });

    devices.forEach(dev => {
        const isIntrus = surveillanceActive && !alertedOnClient.has(dev.mac);
        // Trigger alert for new devices when surveillance is active
        if (surveillanceActive && !alertedOnClient.has(dev.mac)) {
            alertedOnClient.add(dev.mac);
            const displayName = (dev.gattName && dev.gattName.length > 0) ? dev.gattName
                : (dev.name && dev.name !== 'Unknown' ? dev.name : 'Appareil Inconnu');
            showToast(dev.mac, displayName);
        }

        const displayName = (dev.gattName && dev.gattName.length > 0)
            ? `<span title="Nom GATT">🔗 ${dev.gattName}</span>`
            : (dev.name && dev.name !== 'Unknown' ? dev.name : 'Appareil Inconnu');

        const percent = Math.min(Math.max((dev.rssi + 100) / 60 * 100, 0), 100);
        const color = percent > 60 ? 'var(--success)' : percent > 30 ? '#eab308' : 'var(--danger)';
        const txHtml = (dev.txPower && dev.txPower !== -999) ? `<div class="tx-power">Tx: ${dev.txPower} dBm</div>` : "";
        const badgesHtml = buildBadgesHtml(dev);
        const intrusClass = (surveillanceActive && alertedOnClient.has(dev.mac)) ? ' intrus' : '';

        if (deviceElements.has(dev.mac)) {
            const cached = deviceElements.get(dev.mac);
            cached.el.querySelector('.device-title').innerHTML = `<b>${displayName}</b>`;
            cached.el.querySelector('.badges-container').innerHTML = badgesHtml;
            cached.el.querySelector('.rssi span').textContent = `${dev.rssi} dBm`;
            cached.el.querySelector('.rssi-fill').style.width = `${percent}%`;
            cached.el.querySelector('.rssi-fill').style.background = color;
            if (intrusClass) cached.el.classList.add('intrus');
        } else {
            const emptyState = list.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            const item = document.createElement('div');
            item.className = `device-item${intrusClass}`;
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
            list.appendChild(item);
            deviceElements.set(dev.mac, { el: item });
        }
    });
}

// ---------------------------------------------------------------
// WHITELIST with full device info
// ---------------------------------------------------------------
function renderWhitelist(wlDevices) {
    const list = document.getElementById('whitelist-list');
    document.getElementById('whitelist-count').innerText = wlDevices.length;

    if (wlDevices.length === 0) {
        list.innerHTML = `<div class="empty-state">Aucun appareil autorisé.</div>`;
        return;
    }

    list.innerHTML = '';
    wlDevices.forEach(dev => {
        const displayName = (dev.gattName && dev.gattName.length > 0) ? `🔗 ${dev.gattName}`
            : (dev.name && dev.name !== 'Unknown' ? dev.name : 'Appareil Autorisé');
        const badgesHtml = buildBadgesHtml(dev);

        const item = document.createElement('div');
        item.className = 'device-item whitelisted';
        item.innerHTML = `
            <div class="device-info">
                <span class="mac-address">${dev.mac}</span>
                <div class="device-meta">
                    <div class="device-title"><b>${displayName}</b></div>
                    <div class="badges-container">${badgesHtml}</div>
                </div>
            </div>
            <div class="device-right">
                <button class="btn btn-danger" onclick="removeFromWhitelist('${dev.mac}')">🗑️ Retirer</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function addToWhitelist(mac) {
    const fd = new URLSearchParams(); fd.append('mac', mac);
    await fetch('/api/whitelist/add', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd });
    deviceElements.delete(mac); // Force DOM rebuild for this device
    fetchData();
}

async function removeFromWhitelist(mac) {
    if (!confirm("Retirer de la liste blanche ?")) return;
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
