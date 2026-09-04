/*
 * ==============================================================================
 * Cisco Packet Tracer - Script 5: VLSM por Enrutamiento Estático y Routers (/26)
 * Repositorio: autofill_cisco_packet_tracer
 * Documentación API: https://tutorials.ptnetacad.net/help/default/IpcAPI/
 * ==============================================================================
 * Este script detecta automáticamente las 4 topologías LAN (Estrella, Anillo, Malla, Árbol)
 * conectadas a los 4 Routers (R1, R2, R3, R4) a través de enlaces FastEthernet.
 * Configura en cada PC:
 *   1. Su IP única dentro del rango de su subred /26.
 *   2. La máscara de subred (255.255.255.192).
 *   3. El Default Gateway exacto de su Router.
 *   4. Rotulado limpio anti-plagio (eliminando sufijos feos como (1)(1)).
 */

// ==============================================================================
// ⚙️ 1. PARÁMETROS DE SUBREDES Y GATEWAYS (Según configuración de Routers)
// ==============================================================================
var ROUTER_SUBNETS = {
    // Router 1: Topología Estrella (Fa0/0: 192.168.1.1)
    "R1": { 
        network: "192.168.1.0", 
        gateway: "192.168.1.1", 
        startIp: 2, 
        endIp: 62, 
        mask: "255.255.255.192", 
        alias: "R1_Estrella",
        swPrefix: "SW_R1"
    },
    // Router 2: Topología Anillo (Fa0/0: 192.168.1.65)
    "R2": { 
        network: "192.168.1.64", 
        gateway: "192.168.1.65", 
        startIp: 66, 
        endIp: 126, 
        mask: "255.255.255.192", 
        alias: "R2_Anillo",
        swPrefix: "SW_R2"
    },
    // Router 3: Topología Malla (Fa0/0: 192.168.1.129)
    "R3": { 
        network: "192.168.1.128", 
        gateway: "192.168.1.129", 
        startIp: 130, 
        endIp: 190, 
        mask: "255.255.255.192", 
        alias: "R3_Malla",
        swPrefix: "SW_R3"
    },
    // Router 4: Topología Árbol (Fa0/0: 192.168.1.193)
    "R4": { 
        network: "192.168.1.192", 
        gateway: "192.168.1.193", 
        startIp: 194, 
        endIp: 254, 
        mask: "255.255.255.192", 
        alias: "R4_Arbol",
        swPrefix: "SW_R4"
    }
};

// Aliases por si los routers tienen nombres alternativos por defecto
ROUTER_SUBNETS["Router0"] = ROUTER_SUBNETS["R1"];
ROUTER_SUBNETS["Router1"] = ROUTER_SUBNETS["R2"];
ROUTER_SUBNETS["Router2"] = ROUTER_SUBNETS["R3"];
ROUTER_SUBNETS["Router3"] = ROUTER_SUBNETS["R4"];

// ==============================================================================
// 🎨 2. SISTEMA ANTI-PLAGIO: FORMATO DE RÓTULO DE HOSTS Y SWITCHES
// ==============================================================================
// 1 = Corchetes clásicos  -> "PC1 [192.168.1.2]"
// 2 = Paréntesis limpios  -> "PC1 (192.168.1.2)"
// 3 = Guion separador     -> "PC1 - 192.168.1.2"
// 4 = Solo la dirección   -> "192.168.1.2"
// 5 = Sin rotular         -> Conserva el nombre original del equipo
var HOST_LABEL_STYLE = 1;

// true = Renombrar switches con prefijo de router y subred (ej: "SW_R1_Switch5 [192.168.1.0/26]")
// false = Mantener nombres de switches intactos
var RENAME_SWITCHES = true;

// ==============================================================================
// 🚀 INICIO DEL PROCESO DE CONFIGURACIÓN
// ==============================================================================
var net = ipc.network();
var devCount = net.getDeviceCount();

console.log("=== INICIANDO CONFIGURACIÓN AUTOMÁTICA DE ENRUTAMIENTO Y GATEWAYS ===");

// ------------------------------------------------------------------------------
// Función Auxiliar: Obtener el dispositivo vecino conectado a un puerto
// ------------------------------------------------------------------------------
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

// ------------------------------------------------------------------------------
// Función Auxiliar: Formatear nombre de los PCs (limpieza de copias (1)(1))
// ------------------------------------------------------------------------------
function formatHostLabel(originalName, ip, style) {
    var baseName = originalName.split(" [")[0].split(" (")[0].split(" - ")[0];
    baseName = baseName.replace(/(\(\d+\))+$/g, ""); // Remueve sufijos (1)(1)
    switch (style) {
        case 1: return baseName + " [" + ip + "]";
        case 2: return baseName + " (" + ip + ")";
        case 3: return baseName + " - " + ip;
        case 4: return ip;
        case 5: return baseName;
        default: return baseName + " [" + ip + "]";
    }
}

// ------------------------------------------------------------------------------
// FASE 1: DETECCIÓN DE ROUTERS Y RASTREO BFS HACIA LAS ISLAS LAN
// ------------------------------------------------------------------------------
var switchSubnetMap = {}; // SwitchName -> RouterKey (ej: "R1")
var routerKeys = ["R1", "R2", "R3", "R4"];

for (var k = 0; k < routerKeys.length; k++) {
    var rKey = routerKeys[k];
    var routerDev = null;

    // Buscar router por nombre exacto o normalizado
    for (var d = 0; d < devCount; d++) {
        var cand = net.getDeviceAt(d);
        if (!cand || cand.getType() !== 0) continue; // 0 = eRouter

        var cName = cand.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
        cName = cName.replace(/(\(\d+\))+$/g, "");

        if (cName === rKey || cName === "Router" + k) {
            routerDev = cand;
            break;
        }
    }

    if (!routerDev) {
        console.log("⚠️ No se encontró el Router para " + rKey + " (buscando por " + rKey + " o Router" + k + ")");
        continue;
    }

    console.log(">> Router detectado: " + routerDev.getName() + " -> Mapeando " + ROUTER_SUBNETS[rKey].alias);

    // Encontrar switches conectados directamente a las interfaces LAN del router
    var queue = [];
    var visitedSwitches = {};

    for (var p = 0; p < routerDev.getPortCount(); p++) {
        var neighbor = getConnectedDevice(routerDev, p);
        if (neighbor && neighbor.getType() === 1) { // 1 = eSwitch
            var swName = neighbor.getName();
            if (!visitedSwitches[swName]) {
                visitedSwitches[swName] = true;
                queue.push(neighbor);
                console.log("   [LAN Entry] Switch conectado al Router: " + swName);
            }
        }
    }

    // BFS dentro de la LAN del Router (protección estricta contra bucles en Anillo y Malla)
    while (queue.length > 0) {
        var currentSw = queue.shift();
        switchSubnetMap[currentSw.getName()] = rKey;

        for (var sp = 0; sp < currentSw.getPortCount(); sp++) {
            var swNeighbor = getConnectedDevice(currentSw, sp);
            // Solo expandir a otros Switches (ignorar PCs y Routers para no salir de la LAN)
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
// FASE 2: ASIGNACIÓN DE IP, GATEWAY Y MÁSCARA A CADA HOST (PC/LAPTOP)
// ------------------------------------------------------------------------------
var configuredHosts = 0;

for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    // 8 = ePC, 18 = eLaptop
    if (!dev || (dev.getType() !== 8 && dev.getType() !== 18)) continue;

    var pcPort = dev.getPortAt(0);
    if (!pcPort) continue;

    // Buscar el Switch de acceso conectado directamente al PC
    var connectedSwitch = null;
    for (var pp = 0; pp < dev.getPortCount(); pp++) {
        var neigh = getConnectedDevice(dev, pp);
        if (neigh && neigh.getType() === 1) {
            connectedSwitch = neigh;
            break;
        }
    }

    if (!connectedSwitch) {
        console.log("⚠️ " + dev.getName() + " no está conectado a ningún switch.");
        continue;
    }

    var rKey = switchSubnetMap[connectedSwitch.getName()];
    if (!rKey) {
        console.log("⚠️ " + dev.getName() + " conectado a " + connectedSwitch.getName() + " sin enlace a ningún Router.");
        continue;
    }

    var subConfig = ROUTER_SUBNETS[rKey];

    if (subConfig.startIp > subConfig.endIp) {
        console.log("❌ ERROR: Se agotaron las IPs disponibles en " + subConfig.alias + " para " + dev.getName());
        continue;
    }

    // Construir la IP válida del host
    var netOctets = subConfig.network.split(".");
    var assignedIp = netOctets[0] + "." + netOctets[1] + "." + netOctets[2] + "." + subConfig.startIp;

    try {
        // 1. Configurar IP y Máscara
        pcPort.setIpSubnetMask(assignedIp, subConfig.mask);

        // 2. Configurar Default Gateway hacia el Router correspondiente
        if (typeof pcPort.setDefaultGateway === "function") {
            pcPort.setDefaultGateway(subConfig.gateway);
        }

        // 3. Renombrar PC con rótulo limpio
        var cleanHostLabel = formatHostLabel(dev.getName(), assignedIp, HOST_LABEL_STYLE);
        dev.setName(cleanHostLabel);

        console.log("✓ " + dev.getName() + " -> IP: " + assignedIp + " | GW: " + subConfig.gateway + " (" + subConfig.alias + ")");
        
        subConfig.startIp++;
        configuredHosts++;
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

        var rId = switchSubnetMap[sDev.getName()];
        if (!rId) continue;

        var sCfg = ROUTER_SUBNETS[rId];
        var cleanSwName = sDev.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
        cleanSwName = cleanSwName.replace(/(\(\d+\))+$/g, "");

        if (cleanSwName.indexOf(sCfg.swPrefix) === -1) {
            cleanSwName = sCfg.swPrefix + "_" + cleanSwName;
        }

        var fullSwLabel = cleanSwName + " [" + sCfg.network + "/26]";
        try {
            if (sDev.getName() !== fullSwLabel) {
                sDev.setName(fullSwLabel);
            }
        } catch(eSw) {}
    }
}

console.log("===============================================================");
console.log("=== FINALIZADO EXITOSAMENTE: " + configuredHosts + " HOSTS CONFIGURADOS ===");
console.log("===============================================================");
