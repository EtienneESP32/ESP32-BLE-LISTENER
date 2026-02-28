let whitelist = [];
let vendors = {};

// Bluetooth SIG Appearance Categories
const BLE_APPEARANCE = {
    64: '📱 Smartphone',
    128: '🖥️ Ordinateur',
    192: '⌚ Montre/Bracelet',
    512: '🌡️ Capteur',
    832: '💓 Cardio',
    961: '⌨️ Clavier',
    962: '🖱️ Souris',
    1024: '🎮 Manette Jvx',
    1152: '🖨️ Imprimante',
    2368: '🚲 Vélo',
    3136: '🧴 Pèse-personne'
};

// Common BLE Service UUIDs
const KNOWN_SERVICES = {
    "180D": '<i class="fa-solid fa-heartbeat"></i> Cardio',
    "180F": '<i class="fa-solid fa-battery-half"></i> Batterie',
    "180A": '<i class="fa-solid fa-circle-info"></i> Info Appareil',
    "1812": '<i class="fa-solid fa-keyboard"></i> HID (Clavier/Souris)',
    "FD6F": '<i class="fa-solid fa-virus-covid"></i> Exposure (Alerte COVID)',
    "FE2C": '<i class="fa-brands fa-google"></i> Google Fast Pair',
    "FE9F": '<i class="fa-brands fa-android"></i> Android TV',
    "FEED": '<i class="fa-solid fa-location-dot"></i> Tile/Tracker'
};

const KNOWN_MFG = {
    "4C00": '<i class="fa-brands fa-apple"></i> Apple',
    "0600": '<i class="fa-brands fa-microsoft"></i> Microsoft',
    "E000": '<i class="fa-brands fa-google"></i> Google',
    "7500": '<i class="fa-brands fa-samsung"></i> Samsung',
    "0a00": '<i class="fa-solid fa-headphones"></i> Sony',
    "1d00": '<i class="fa-solid fa-headphones"></i> Bose'
};

// Initialization
async function initData() {
    try {
        const venRes = await fetch('/vendors.json');
        vendors = await venRes.json();
    } catch (e) { console.warn("Could not load vendors.json", e); }
    fetchData();
    setInterval(fetchData, 3000);
}

async function fetchData() {
    try {
        const wlRes = await fetch('/api/whitelist');
        whitelist = await wlRes.json();
        renderWhitelist();

        const devRes = await fetch('/api/devices');
        const data = await devRes.json();
        const devices = data.devices || [];

        if (data.version) {
            document.getElementById('firmware-version').innerText = data.version;
        }
        renderDevices(devices);
    } catch (e) { console.error("Error fetching data:", e); }
}

function getMacVendor(mac) {
    const prefix = mac.substring(0, 8).toUpperCase();
    return vendors[prefix] || null;
}

function parseServices(serviceString) {
    if (!serviceString) return [];
    const arr = serviceString.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const badges = [];
    arr.forEach(uuid => {
        let shortId = uuid.length >= 8 ? uuid.substring(4, 8).toUpperCase() : uuid.toUpperCase();
        if (KNOWN_SERVICES[shortId]) badges.push(KNOWN_SERVICES[shortId]);
        else badges.push(`🧩 Srv:0x${shortId}`);
    });
    return badges;
}

function parseMfg(mfgString) {
    if (!mfgString || mfgString.length < 4) return null;
    const mfgId = mfgString.substring(0, 4).toUpperCase();
    const rawHex = mfgString.substring(4).toUpperCase();
    let known = KNOWN_MFG[mfgId];
    let semantic = "";

    // 🔬 MICROSOFT DECIPHERING (MS-CDP)
    if (mfgId === "0600" && rawHex.length >= 4) {
        const scenario = rawHex.substring(0, 2);
        const deviceType = rawHex.substring(2, 4);

        if (scenario === "01") {
            if (deviceType === "09") semantic = " [Surface / Windows 10+]";
            else if (deviceType === "0F") semantic = " [PC Portable Windows]";
            else if (deviceType === "01") semantic = " [Xbox One / Series]";
            else if (deviceType === "0A") semantic = " [Tablette Windows]";
        }
    }

    // 🔬 APPLE DECIPHERING (Continuity)
    if (mfgId === "4C00" && rawHex.length >= 2) {
        const type = rawHex.substring(0, 2);
        if (type === "07") {
            semantic = " [AirPods/Beats]";
            // Find model code
            if (rawHex.includes("0E")) semantic = " [AirPods Pro]";
            else if (rawHex.includes("0F")) semantic = " [AirPods 2]";
            else if (rawHex.includes("13")) semantic = " [AirPods 3]";
            else if (rawHex.includes("0A")) semantic = " [AirPods Max]";
        }
        else if (type === "12") semantic = " [Réseau Localiser/AirTag]";
        else if (type === "05") semantic = " [AirDrop]";
        else if (type === "10") semantic = " [Handoff/Continuity]";
        else if (type === "09") semantic = " [AirPlay]";
    }

    const rawSuffix = rawHex.length > 0 ? ` <small><b>[HEX: ${rawHex}]</b></small>` : "";
    if (known) return `${known}${semantic}${rawSuffix}`;
    return `🏭 Mfg:0x${mfgId}${semantic}${rawSuffix}`;
}

function renderDevices(devices) {
    const list = document.getElementById('detected-list');
    document.getElementById('device-count').innerText = devices.length;

    if (devices.length === 0) {
        list.innerHTML = `<div class="empty-state">Scan en cours...</div>`;
        return;
    }

    list.innerHTML = '';
    devices.sort((a, b) => b.rssi - a.rssi);

    devices.forEach(dev => {
        if (dev.whitelisted) return;

        let percent = Math.min(Math.max((dev.rssi + 100) / 60 * 100, 0), 100);
        let color = percent > 60 ? 'var(--success)' : percent > 30 ? '#eab308' : 'var(--danger)';

        let jsVendor = getMacVendor(dev.mac);
        let finalVendor = dev.vendor !== "N/A" ? dev.vendor : jsVendor;
        let displayName = dev.name && dev.name !== 'Unknown' ? dev.name : "Appareil Inconnu";

        // Badges aggregation
        let badgesHtml = `<span class="badge-type">${dev.addressType || 'Inconnue'}</span>`;
        if (dev.appearance && BLE_APPEARANCE[dev.appearance]) {
            badgesHtml += `<span class="badge-appearance">${BLE_APPEARANCE[dev.appearance]}</span>`;
        }
        if (finalVendor) badgesHtml += `<span class="badge-vendor">${finalVendor}</span>`;

        let mfgBadge = parseMfg(dev.mfgData);
        if (mfgBadge) badgesHtml += `<span class="badge-mfg">${mfgBadge}</span>`;

        let srvBadges = parseServices(dev.services);
        srvBadges.forEach(b => { badgesHtml += `<span class="badge-srv">${b}</span>`; });

        let txHtml = (dev.txPower && dev.txPower !== -999) ? `<div class="tx-power">Tx: ${dev.txPower} dBm</div>` : "";

        const item = document.createElement('div');
        item.className = 'device-item';
        item.innerHTML = `
            <div class="device-info">
                <span class="mac-address">${dev.mac}</span>
                <div class="device-meta">
                    <div class="device-title"><b>${displayName}</b></div>
                    <div class="badges-container">
                        ${badgesHtml}
                    </div>
                </div>
            </div>
            <div class="device-right">
                ${txHtml}
                <div class="rssi">
                    <span>${dev.rssi} dBm</span>
                    <div class="rssi-bar"><div class="rssi-fill" style="width: ${percent}%; background: ${color}"></div></div>
                </div>
                <button class="btn btn-primary" style="margin-top: 10px; width: 100%;" onclick="addToWhitelist('${dev.mac}')">
                    ✅ Autoriser
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}
// Other functions remain same (Whitelist management)
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
    const formData = new URLSearchParams(); formData.append('mac', mac);
    await fetch('/api/whitelist/add', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
    fetchData();
}

async function removeFromWhitelist(mac) {
    if (!confirm("Supprimer ?")) return;
    const formData = new URLSearchParams(); formData.append('mac', mac);
    await fetch('/api/whitelist/remove', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
    fetchData();
}

async function addManualMac() {
    const input = document.getElementById('manual-mac');
    const mac = input.value.trim().toUpperCase();
    const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/;
    if (!macRegex.test(mac)) { alert("MAC Invalide"); return; }
    await addToWhitelist(mac);
    input.value = '';
    document.getElementById('add-modal').classList.remove('active');
}

initData();
