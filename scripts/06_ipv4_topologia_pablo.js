/*
 * ==============================================================================
 * Cisco Packet Tracer - Script 6: Topología de Pablo (VLSM 192.168.10.0/26 + Anillo WAN)
 * Repositorio: autofill_cisco_packet_tracer
 * Documentación API: https://tutorials.ptnetacad.net/help/default/IpcAPI/
 * ==============================================================================
 * Este script detecta automáticamente las 4 islas LAN de la topología de Pablo
 * conectadas a los 4 Routers (Subred1, Subred2, Subred3, Subred4) bajo la red 192.168.10.0/26:
 *   - Subred 1 (Top-Left):     Red 192.168.10.0/26   | Gateway 192.168.10.1   | Hosts .2 - .62
 *   - Subred 2 (Top-Right):    Red 192.168.10.64/26  | Gateway 192.168.10.65  | Hosts .66 - .126
 *   - Subred 3 (Bottom-Left):  Red 192.168.10.128/26 | Gateway 192.168.10.129 | Hosts .130 - .190
 *   - Subred 4 (Bottom-Right): Red 192.168.10.192/26 | Gateway 192.168.10.193 | Hosts .194 - .254
 */

// ==============================================================================
// ⚙️ 1. PARÁMETROS DE SUBREDES Y GATEWAYS (Topología Pablo)
// ==============================================================================
var ROUTER_SUBNETS = {
    // Router Subred 1 (Top-Left / Izquierda)
    "Subred1": { 
        network: "192.168.10.0", 
        gateway: "192.168.10.1", 
        startIp: 2, 
        endIp: 62, 
        mask: "255.255.255.192", 
        alias: "Subred 1 (Izquierda)",
        swPrefix: "SW_Sub1"
    },
    // Router Subred 2 (Top-Right / Arriba)
    "Subred2": { 
        network: "192.168.10.64", 
        gateway: "192.168.10.65", 
        startIp: 66, 
        endIp: 126, 
        mask: "255.255.255.192", 
        alias: "Subred 2 (Arriba)",
        swPrefix: "SW_Sub2"
    },
    // Router Subred 3 (Bottom-Left / Abajo)
    "Subred3": { 
        network: "192.168.10.128", 
        gateway: "192.168.10.129", 
        startIp: 130, 
        endIp: 190, 
        mask: "255.255.255.192", 
        alias: "Subred 3 (Abajo)",
        swPrefix: "SW_Sub3"
    },
    // Router Subred 4 (Bottom-Right / Derecha)
    "Subred4": { 
        network: "192.168.10.192", 
        gateway: "192.168.10.193", 
        startIp: 194, 
        endIp: 254, 
        mask: "255.255.255.192", 
        alias: "Subred 4 (Derecha)",
        swPrefix: "SW_Sub4"
    }
};

// Aliases polimórficos para soportar nombres R1-R4 o Router0-Router3
ROUTER_SUBNETS["R1"] = ROUTER_SUBNETS["Subred1"];
ROUTER_SUBNETS["R2"] = ROUTER_SUBNETS["Subred2"];
ROUTER_SUBNETS["R3"] = ROUTER_SUBNETS["Subred3"];
ROUTER_SUBNETS["R4"] = ROUTER_SUBNETS["Subred4"];

ROUTER_SUBNETS["Router0"] = ROUTER_SUBNETS["Subred1"];
ROUTER_SUBNETS["Router1"] = ROUTER_SUBNETS["Subred2"];
ROUTER_SUBNETS["Router2"] = ROUTER_SUBNETS["Subred3"];
ROUTER_SUBNETS["Router3"] = ROUTER_SUBNETS["Subred4"];

// ==============================================================================
// 🎨 2. SISTEMA ANTI-PLAGIO: ESTILO DE RÓTULO DE HOSTS
// ==============================================================================
// 1 = Corchetes clásicos  -> "PC1 [192.168.10.2]"
// 2 = Paréntesis limpios  -> "PC1 (192.168.10.2)"
// 3 = Guion separador     -> "PC1 - 192.168.10.2"
// 4 = Solo la dirección   -> "192.168.10.2" (Estilo original de Pablo)
// 5 = Sin rotular         -> Conserva el nombre original del equipo
var HOST_LABEL_STYLE = 4; // Por defecto estilo 4 (como en la imagen de Pablo)

// true = Prefija switches con su subred (ej: "SW_Sub1_Switch12 [192.168.10.0/26]")
// false = Mantiene los nombres de los switches originales intactos
var RENAME_SWITCHES = false;

// ==============================================================================
// 🚀 MOTOR DE DESCUBRIMIENTO Y CONFIGURACIÓN
// ==============================================================================
var net = ipc.network();
var devCount = net.getDeviceCount();

console.log("=== INICIANDO AUTO-FILL PARA LA TOPOLOGÍA DE PABLO (192.168.10.0/26) ===");

function getConnectedDevice(device, portIndex) {
    try {
        var port = device.getPortAt(portIndex);
        if (!port) return null;
        var link = port.getLink();
        if (!link) return null;
        
        var p1 = link.getPort1();
        var p2 = link.getPort2();
        if (!p1 || !p2) return null;
        
        var d1 = p1.getOwnerDevice();
        var d2 = p2.getOwnerDevice();
        
        if (d1.getName() === device.getName()) {
            return d2;
        } else {
            return d1;
        }
    } catch(e) {
        return null;
    }
}

function formatHostLabel(originalName, ip, style) {
    var baseName = originalName.split(" [")[0].split(" (")[0].split(" - ")[0];
    baseName = baseName.replace(/(\(\d+\))+$/g, ""); // Remueve sufijos feos (1)(1)
    switch (style) {
        case 1: return baseName + " [" + ip + "]";
        case 2: return baseName + " (" + ip + ")";
        case 3: return baseName + " - " + ip;
        case 4: return ip;
        case 5: return baseName;
        default: return ip;
    }
}

// ------------------------------------------------------------------------------
// FASE 1: RASTREO BFS DESDE CADA ROUTER HACIA SU ISLA LAN
// ------------------------------------------------------------------------------
var switchSubnetMap = {}; // SwitchName -> "Subred1", "Subred2", etc.
var targetKeys = ["Subred1", "Subred2", "Subred3", "Subred4"];

for (var k = 0; k < targetKeys.length; k++) {
    var key = targetKeys[k];
    var routerDev = null;

    // Búsqueda flexible del router
    for (var d = 0; d < devCount; d++) {
        var cand = net.getDeviceAt(d);
        if (!cand || cand.getType() !== 0) continue; // 0 = eRouter

        var cName = cand.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
        cName = cName.replace(/(\(\d+\))+$/g, "");

        if (cName.toLowerCase() === key.toLowerCase() || 
            cName.toLowerCase() === ("r" + (k + 1)).toLowerCase() || 
            cName.toLowerCase() === ("router" + k).toLowerCase()) {
            routerDev = cand;
            break;
        }
    }

    if (!routerDev) {
        console.log("⚠️ No se encontró Router para " + key + ". Verifica el nombre del equipo.");
        continue;
    }

    console.log(">> Router detectado: " + routerDev.getName() + " -> " + ROUTER_SUBNETS[key].alias);

    // Encontrar switches conectados directamente al router
    var queue = [];
    var visitedSwitches = {};

    for (var p = 0; p < routerDev.getPortCount(); p++) {
        var neighbor = getConnectedDevice(routerDev, p);
        if (neighbor && neighbor.getType() === 1) { // 1 = eSwitch
            var swName = neighbor.getName();
            if (!visitedSwitches[swName]) {
                visitedSwitches[swName] = true;
                queue.push(neighbor);
                console.log("   [LAN Entry] " + swName + " conectado a " + routerDev.getName());
            }
        }
    }

    // BFS a través de todos los switches de la isla LAN (con protección anti-bucles)
    while (queue.length > 0) {
        var currentSw = queue.shift();
        switchSubnetMap[currentSw.getName()] = key;

        for (var sp = 0; sp < currentSw.getPortCount(); sp++) {
            var swNeighbor = getConnectedDevice(currentSw, sp);
            // Solo expandir a switches para no saltar a routers ni PCs
            if (swNeighbor && swNeighbor.getType() === 1) {
                var nName = swNeighbor.getName();
                if (!visitedSwitches[nName]) {
                    visitedSwitches[nName] = true;
                    queue.push(swNeighbor);
                }
            }
        }
    }
}

// ------------------------------------------------------------------------------
// FASE 2: ASIGNACIÓN DE IP, GATEWAY Y MÁSCARA A TODOS LOS PCS
// ------------------------------------------------------------------------------
var configuredCount = 0;

for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    // 8 = ePC, 18 = eLaptop
    if (!dev || (dev.getType() !== 8 && dev.getType() !== 18)) continue;

    var pcPort = dev.getPortAt(0);
    if (!pcPort) continue;

    // Identificar el switch al que está conectado el PC
    var connectedSwitch = null;
    for (var pp = 0; pp < dev.getPortCount(); pp++) {
        var neigh = getConnectedDevice(dev, pp);
        if (neigh && neigh.getType() === 1) {
            connectedSwitch = neigh;
            break;
        }
    }

    if (!connectedSwitch) {
        console.log("⚠️ " + dev.getName() + " no tiene cable conectado a un switch.");
        continue;
    }

    var subKey = switchSubnetMap[connectedSwitch.getName()];
    if (!subKey) {
        console.log("⚠️ " + dev.getName() + " -> " + connectedSwitch.getName() + " no tiene enlace conocido a ningún Router.");
        continue;
    }

    var cfg = ROUTER_SUBNETS[subKey];

    if (cfg.startIp > cfg.endIp) {
        console.log("❌ Límite excedido: No quedan IPs libres en " + cfg.alias + " para " + dev.getName());
        continue;
    }

    // Construir la IP
    var netOctets = cfg.network.split(".");
    var assignedIp = netOctets[0] + "." + netOctets[1] + "." + netOctets[2] + "." + cfg.startIp;

    try {
        // 1. Configurar IP y Máscara /26
        pcPort.setIpSubnetMask(assignedIp, cfg.mask);

        // 2. Configurar Default Gateway hacia el Router de su subred
        if (typeof pcPort.setDefaultGateway === "function") {
            pcPort.setDefaultGateway(cfg.gateway);
        }

        // 3. Rotular equipo
        var newLabel = formatHostLabel(dev.getName(), assignedIp, HOST_LABEL_STYLE);
        dev.setName(newLabel);

        console.log("✓ " + newLabel + " | IP: " + assignedIp + " | GW: " + cfg.gateway + " (" + cfg.alias + ")");
        
        cfg.startIp++;
        configuredCount++;
    } catch(err) {
        console.log("Error en " + dev.getName() + ": " + err);
    }
}

// ------------------------------------------------------------------------------
// FASE 3: ROTULADO DE SWITCHES (OPCIONAL)
// ------------------------------------------------------------------------------
if (RENAME_SWITCHES) {
    for (var s = 0; s < devCount; s++) {
        var sDev = net.getDeviceAt(s);
        if (!sDev || sDev.getType() !== 1) continue;

        var subId = switchSubnetMap[sDev.getName()];
        if (!subId) continue;

        var swCfg = ROUTER_SUBNETS[subId];
        var cleanSwName = sDev.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
        cleanSwName = cleanSwName.replace(/(\(\d+\))+$/g, "");

        if (cleanSwName.indexOf(swCfg.swPrefix) === -1) {
            cleanSwName = swCfg.swPrefix + "_" + cleanSwName;
        }

        var fullLabel = cleanSwName + " [" + swCfg.network + "/26]";
        try {
            if (sDev.getName() !== fullLabel) {
                sDev.setName(fullLabel);
            }
        } catch(eSw) {}
    }
}

console.log("=======================================================================");
console.log("=== FINALIZADO: " + configuredCount + " PCS CONFIGURADOS Y ROTULADOS CON ÉXITO ===");
console.log("=======================================================================");
