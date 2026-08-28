/*
 * ==============================================================================
 * Cisco Packet Tracer - Script 4: VLSM por Topologías Físicas (/26)
 * Repositorio: autofill_cisco_packet_tracer
 * Documentación API: https://tutorials.ptnetacad.net/help/default/IpcAPI/
 * ==============================================================================
 * Este script asigna 4 subredes /26 distintas (Estrella, Anillo, Árbol, Malla)
 * detectando automáticamente a qué Switch Central (Backbone) está conectado un PC
 * mediante un algoritmo de rastreo Breadth-First Search con protección Anti-Bucles.
 */

// ==============================================================================
// ⚙️ 1. PARÁMETROS VLSM DE LAS TOPOLOGÍAS (Según Laboratorio)
// ==============================================================================
var ROOT_SWITCHES = {
    // Topología Estrella
    "Switch0": { network: "192.168.0.0", startIp: 1, mask: "255.255.255.192", alias: "Subred1" },
    // Topología Anillo
    "Switch1": { network: "192.168.0.64", startIp: 65, mask: "255.255.255.192", alias: "Subred2" },
    // Topología Árbol
    "Switch2": { network: "192.168.0.128", startIp: 129, mask: "255.255.255.192", alias: "Subred3" },
    // Topología Malla
    "Switch3": { network: "192.168.0.192", startIp: 193, mask: "255.255.255.192", alias: "Subred4" },
    // Alias backups for re-runs
    "Subred1": { network: "192.168.0.0", startIp: 1, mask: "255.255.255.192", alias: "Subred1" },
    "Subred2": { network: "192.168.0.64", startIp: 65, mask: "255.255.255.192", alias: "Subred2" },
    "Subred3": { network: "192.168.0.128", startIp: 129, mask: "255.255.255.192", alias: "Subred3" },
    "Subred4": { network: "192.168.0.192", startIp: 193, mask: "255.255.255.192", alias: "Subred4" }
};

// ==============================================================================
// 🎨 2. SISTEMA ANTI-PLAGIO: ESTILOS DE RÓTULO VISUAL
// ==============================================================================
// 1 = "PC1 [192.168.0.2]" | 2 = "PC1 (192.168.0.2)" | 3 = "PC1 - 192.168.0.2" | 4 = "192.168.0.2"
var HOST_LABEL_STYLE = 1;


var net = ipc.network();
var devCount = net.getDeviceCount();

console.log("=== INICIANDO DETECCIÓN DE TOPOLOGÍAS Y ASIGNACIÓN VLSM ===");

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
        
        // Si d1 es mi propio dispositivo, el vecino es d2
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
// Función Auxiliar: Formatear nombre de los PCs
// ------------------------------------------------------------------------------
function formatHostLabel(originalName, ip, style) {
    var baseName = originalName.split(" [")[0].split(" (")[0].split(" - ")[0];
    baseName = baseName.replace(/(\(\d+\))+$/g, "");
    switch (style) {
        case 1: return baseName + " [" + ip + "]";
        case 2: return baseName + " (" + ip + ")";
        case 3: return baseName + " - " + ip;
        case 4: return ip;
        default: return baseName + " [" + ip + "]";
    }
}

// ------------------------------------------------------------------------------
// FASE 1: BREADTH-FIRST SEARCH (BFS) DESDE LOS SWITCHES CENTRALES
// Mapea a qué 'Switch Central' (Raíz) pertenece cada Switch de Acceso.
// ------------------------------------------------------------------------------
var switchSubnetMap = {}; 
var rootNames = ["Switch0", "Switch1", "Switch2", "Switch3", "Subred1", "Subred2", "Subred3", "Subred4"];

// Buscar dinámicamente los Root Devices aunque tengan corchetes en el nombre
var rootDevices = [];
for (var d = 0; d < devCount; d++) {
    var possibleDev = net.getDeviceAt(d);
    if (!possibleDev || possibleDev.getType() !== 1) continue;
    
    var bName = possibleDev.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
    bName = bName.replace(/(\(\d+\))+$/g, ""); // Anti-copias
    
    if (rootNames.indexOf(bName) > -1) {
        rootDevices.push({ dev: possibleDev, bName: bName });
    }
}

if (rootDevices.length === 0) {
    console.log("⚠️ ADVERTENCIA: No se encontró ningún switch central.");
}

for (var r = 0; r < rootDevices.length; r++) {
    var rootDevice = rootDevices[r].dev;
    var rootName = rootDevice.getName(); // Exact name
    var bName = rootDevices[r].bName;
    var rootAlias = ROOT_SWITCHES[bName].alias; // e.g. "Subred1"
    
    // Cola para el BFS (recorrido por niveles)
    var queue = [rootDevice];
    // Memoria para evitar bucles infinitos en el Anillo y Malla
    var visited = {};
    visited[rootName] = true;
    
    console.log(">> Rastreando rama de topología a partir de: " + bName);
    
    while (queue.length > 0) {
        var currentSwitch = queue.shift();
        
        // Asignamos el switch actual a la raíz que lo descubrió
        switchSubnetMap[currentSwitch.getName()] = bName;
        
        // Recorrer todos los puertos del switch actual
        for (var p = 0; p < currentSwitch.getPortCount(); p++) {
            var neighbor = getConnectedDevice(currentSwitch, p);
            
            // Si el vecino es otro Switch (Tipo 1)
            if (neighbor && neighbor.getType() === 1) {
                var neighborName = neighbor.getName();
                
                // CRÍTICO: No cruzar hacia OTROS switches centrales (el backbone en Bus)
                var isOtherRoot = false;
                for (var i = 0; i < rootDevices.length; i++) {
                    if (rootDevices[i].dev.getName() === neighborName && neighborName !== rootName) {
                        // Check if it's not actually the same alias 
                        if (ROOT_SWITCHES[rootDevices[i].bName].alias !== rootAlias) {
                            isOtherRoot = true;
                            break;
                        }
                    }
                }
                if (isOtherRoot) continue; // Ignoramos el cable de backbone
                
                // Si no lo hemos visitado en esta rama, agregarlo a la cola
                if (!visited[neighborName]) {
                    visited[neighborName] = true;
                    queue.push(neighbor);
                }
            }
        }
    }
}

// ------------------------------------------------------------------------------
// FASE 2: ASIGNACIÓN DE IPs A LOS PCs
// Buscamos a qué Switch Central pertenece el Switch al que está conectado el PC.
// ------------------------------------------------------------------------------
var configuredCount = 0;

for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    // Tipo 8 = PC, Tipo 18 = Laptop
    if (!dev || (dev.getType() !== 8 && dev.getType() !== 18)) continue;

    var pcPort = dev.getPortAt(0);
    if (!pcPort) continue;

    // Buscar a qué Switch está conectado directamente el PC
    var connectedSwitch = null;
    for (var p = 0; p < dev.getPortCount(); p++) {
        var neighbor = getConnectedDevice(dev, p);
        if (neighbor && neighbor.getType() === 1) {
            connectedSwitch = neighbor;
            break;
        }
    }
    
    if (connectedSwitch) {
        // Consultar el Mapa BFS: ¿A qué Switch Central (Topología) pertenece este switch de acceso?
        var rootId = switchSubnetMap[connectedSwitch.getName()];
        
        if (rootId) {
            var subnetConfig = ROOT_SWITCHES[rootId];
            
            // Construir la IP actual (ej. 192.168.0. + 65)
            var baseOctets = subnetConfig.network.split(".");
            var newIp = baseOctets[0] + "." + baseOctets[1] + "." + baseOctets[2] + "." + subnetConfig.startIp;
            
            try {
                // Aplicar IP y Máscara
                pcPort.setIpSubnetMask(newIp, subnetConfig.mask);
                // Gateway 0.0.0.0 porque en estas topologías (capa 2) no hay Router activo documentado
                if (typeof pcPort.setDefaultGateway === "function") {
                    pcPort.setDefaultGateway("0.0.0.0");
                }
                
                // Rotular visualmente el PC
                var newName = formatHostLabel(dev.getName(), newIp, HOST_LABEL_STYLE);
                dev.setName(newName);
                
                console.log("Configurado: " + dev.getName() + " -> " + newIp + " (Pertenece a " + rootId + ")");
                
                // Incrementar para el siguiente PC de esta topología
                subnetConfig.startIp++;
                configuredCount++;
                
            } catch(e) {
                console.log("Error configurando " + dev.getName() + ": " + e);
            }
        } else {
            // El usuario fue avisado en caso de switches aislados
        }
    }
}

// ------------------------------------------------------------------------------
// FASE 3: ROTULADO DE SWITCHES (OPCIONAL)
// ------------------------------------------------------------------------------
for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    if (!dev || dev.getType() !== 1) continue; // Solo switches
    
    var rootId = switchSubnetMap[dev.getName()];
    // Si el switch es uno de los roots, rootId será undefined en el mapa porque el BFS no lo mapea a sí mismo
    if (!rootId && ROOT_SWITCHES[dev.getName()]) {
        rootId = dev.getName();
    }
    
    if (rootId) {
        var subnetConfig = ROOT_SWITCHES[rootId];
        var baseName = dev.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
        baseName = baseName.replace(/(\(\d+\))+$/g, ""); // Anti-copias
        
        // Si el switch era el root original (Switch0), renombrarlo a Subred1
        if (baseName === "Switch0" || baseName === "Subred1") baseName = "Subred1";
        else if (baseName === "Switch1" || baseName === "Subred2") baseName = "Subred2";
        else if (baseName === "Switch2" || baseName === "Subred3") baseName = "Subred3";
        else if (baseName === "Switch3" || baseName === "Subred4") baseName = "Subred4";
        else {
            // Para los switches de acceso, prefijarlos con el nombre de la subred si no lo tienen
            if (baseName.indexOf(subnetConfig.alias) === -1) {
                baseName = subnetConfig.alias + "_" + baseName;
            }
        }
        
        var newSwName = baseName + " [" + subnetConfig.network + "/26]";
        
        try {
            if (dev.getName() !== newSwName) {
                dev.setName(newSwName);
                console.log("Switch Renombrado: " + newSwName);
            }
        } catch(e) { }
    }
}

console.log("=== FINALIZADO: " + configuredCount + " PCs configurados exitosamente ===");
