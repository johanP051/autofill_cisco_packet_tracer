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
    "Switch0": { network: "192.168.0.0", startIp: 1, mask: "255.255.255.192" },
    // Topología Anillo
    "Switch1": { network: "192.168.0.64", startIp: 65, mask: "255.255.255.192" },
    // Topología Árbol
    "Switch2": { network: "192.168.0.128", startIp: 129, mask: "255.255.255.192" },
    // Topología Malla
    "Switch3": { network: "192.168.0.192", startIp: 193, mask: "255.255.255.192" }
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
var rootNames = ["Switch0", "Switch1", "Switch2", "Switch3"]; // Nombres del Backbone

for (var r = 0; r < rootNames.length; r++) {
    var rootName = rootNames[r];
    var rootDevice = net.getDevice(rootName);
    
    if (!rootDevice) {
        console.log("⚠️ ADVERTENCIA: No se encontró el switch central '" + rootName + "'. Verifica el nombre.");
        continue;
    }
    
    // Cola para el BFS (recorrido por niveles)
    var queue = [rootDevice];
    // Memoria para evitar bucles infinitos en el Anillo y Malla
    var visited = {};
    visited[rootName] = true;
    
    console.log(">> Rastreando rama de topología a partir de: " + rootName);
    
    while (queue.length > 0) {
        var currentSwitch = queue.shift();
        
        // Asignamos el switch actual a la raíz que lo descubrió
        switchSubnetMap[currentSwitch.getName()] = rootName;
        
        // Recorrer todos los puertos del switch actual
        for (var p = 0; p < currentSwitch.getPortCount(); p++) {
            var neighbor = getConnectedDevice(currentSwitch, p);
            
            // Si el vecino es otro Switch (Tipo 1)
            if (neighbor && neighbor.getType() === 1) {
                var neighborName = neighbor.getName();
                
                // CRÍTICO: No cruzar hacia OTROS switches centrales (el backbone en Bus)
                var isOtherRoot = false;
                for (var i = 0; i < rootNames.length; i++) {
                    if (rootNames[i] === neighborName && neighborName !== rootName) {
                        isOtherRoot = true;
                        break;
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
            console.log("⚠️ " + dev.getName() + " está conectado a " + connectedSwitch.getName() + " el cual no tiene ruta hacia ningún Switch Central.");
        }
    }
}

console.log("=== FINALIZADO: " + configuredCount + " PCs configurados exitosamente ===");
