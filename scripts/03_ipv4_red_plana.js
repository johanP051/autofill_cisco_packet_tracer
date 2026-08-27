/*
 * ==============================================================================
 * Cisco Packet Tracer - Script 3: Red Normal sin Subredes / Red Plana (IPv4)
 * Repositorio: autofill_cisco_packet_tracer
 * Documentación API: https://tutorials.ptnetacad.net/help/default/IpcAPI/
 * ==============================================================================
 */

// ==============================================================================
// ⚙️ 1. PARÁMETROS DE RED (Ajusta estos valores según la guía de tu profesor)
// ==============================================================================
var NETWORK_BASE = "192.168.1.0"; // Red común (ej. "10.0.0.0", "172.16.0.0", "192.168.1.0")
var AUTO_MASK = true;             // true = calcular según Clase A/B/C, false = usar CUSTOM_MASK
var CUSTOM_MASK = "255.255.255.0";

var HOST_START = 2;               // Primer host asignado a PCs (.2, .3, .4...)
var ASSIGN_GATEWAY = false;       // false = sin router (deja 0.0.0.0), true = asigna GATEWAY_IP
var GATEWAY_IP = "192.168.1.1";   // Solo se aplica si ASSIGN_GATEWAY = true
var DNS_SERVER = "";              // "" = sin DNS (0.0.0.0), o escribe la IP ej: "8.8.8.8"

// ==============================================================================
// 🎨 2. SISTEMA ANTI-PLAGIO: ESTILOS DE RÓTULO VISUAL
// ¡IMPORTANTE! Cambia estos números para que el formato de tus PCs y Switches
// sea diferente al de tus compañeros y evites sospechas de copia:
//
// --- Estilo de Hosts (PCs / Laptops) ---
// 1 = Corchetes clásicos  -> "PC1 [192.168.1.2]"
// 2 = Paréntesis limpios  -> "PC1 (192.168.1.2)"
// 3 = Guion separador     -> "PC1 - 192.168.1.2"
// 4 = Solo la dirección   -> "192.168.1.2"
// 5 = Sin rotular         -> Conserva el nombre original del equipo
var HOST_LABEL_STYLE = 1;

// --- Estilo de Switches ---
// 1 = Corchetes con red   -> "Switch1 [192.168.1.0/24]"
// 2 = Paréntesis con red  -> "SW1 (192.168.1.0)"
// 3 = Solo nombre limpio  -> "Switch1"
// 4 = Prefijo corto       -> "SW1"
// 5 = Sin renombrar       -> Conserva el nombre original de Packet Tracer
var SWITCH_LABEL_STYLE = 1;
// ==============================================================================

function detectClassAndMask(ipStr) {
    var firstOctet = parseInt(ipStr.split(".")[0], 10);
    if (firstOctet >= 1 && firstOctet <= 126) return { networkClass: "A", defaultMask: "255.0.0.0", cidr: "/8" };
    if (firstOctet >= 128 && firstOctet <= 191) return { networkClass: "B", defaultMask: "255.255.0.0", cidr: "/16" };
    if (firstOctet >= 192 && firstOctet <= 223) return { networkClass: "C", defaultMask: "255.255.255.0", cidr: "/24" };
    return { networkClass: "Personalizada", defaultMask: "255.255.255.0", cidr: "/24" };
}

var classInfo = detectClassAndMask(NETWORK_BASE);
var FINAL_MASK = AUTO_MASK ? classInfo.defaultMask : CUSTOM_MASK;

console.log("=== INICIANDO RED PLANA (SINGLE SUBNET) ===");
console.log("Red Base: " + NETWORK_BASE + " (" + classInfo.networkClass + " -> " + FINAL_MASK + ")");

var net = ipc.network();
var devCount = net.getDeviceCount();
var globalHostCounter = HOST_START;
var switchCounter = 1;

function generateIpSingleSubnet(networkBase, classType, hostNum) {
    var octets = networkBase.split(".");
    return octets[0] + "." + octets[1] + "." + octets[2] + "." + hostNum;
}

function formatSwitchLabel(originalName, index, subnetStr, style) {
    switch (style) {
        case 1: return "Switch" + index + " [" + subnetStr + "]";
        case 2: return "SW" + index + " (" + subnetStr.split("/")[0] + ")";
        case 3: return "Switch" + index;
        case 4: return "SW" + index;
        case 5: return originalName.split(" [")[0];
        default: return "Switch" + index + " [" + subnetStr + "]";
    }
}

function formatHostLabel(originalName, ip, style) {
    var baseName = originalName.split(" [")[0].split(" (")[0].split(" - ")[0];
    switch (style) {
        case 1: return baseName + " [" + ip + "]";
        case 2: return baseName + " (" + ip + ")";
        case 3: return baseName + " - " + ip;
        case 4: return ip;
        case 5: return baseName;
        default: return baseName + " [" + ip + "]";
    }
}

// 1. Rotular Switches
for (var s = 0; s < devCount; s++) {
    var sDev = net.getDeviceAt(s);
    if (!sDev || sDev.getType() !== 1) continue;

    var rawName = sDev.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
    var subnetStr = NETWORK_BASE + classInfo.cidr;
    var swLabel = formatSwitchLabel(rawName, switchCounter, subnetStr, SWITCH_LABEL_STYLE);

    sDev.setName(swLabel);
    switchCounter++;
}

// 2. Configurar Hosts Consecutivamente
var configuredHosts = 0;
for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    if (!dev || (dev.getType() !== 8 && dev.getType() !== 18)) continue;

    var port = dev.getPortAt(0);
    if (!port) continue;

    var assignedIp = generateIpSingleSubnet(NETWORK_BASE, classInfo.networkClass, globalHostCounter);
    globalHostCounter++;

    try {
        port.setIpSubnetMask(assignedIp, FINAL_MASK);
        
        if (ASSIGN_GATEWAY && typeof port.setDefaultGateway === "function") {
            port.setDefaultGateway(GATEWAY_IP);
        } else if (typeof port.setDefaultGateway === "function") {
            port.setDefaultGateway("0.0.0.0");
        }

        if (DNS_SERVER !== "" && typeof port.setDnsServerIp === "function") {
            port.setDnsServerIp(DNS_SERVER);
        }

        console.log(dev.getName() + " -> IP: " + assignedIp + "/" + FINAL_MASK);
    } catch (err) {
        console.log(dev.getName() + ": Error -> " + err);
    }

    var newHostName = formatHostLabel(dev.getName(), assignedIp, HOST_LABEL_STYLE);
    dev.setName(newHostName);
    configuredHosts++;
}

console.log("=== PROCESO COMPLETADO: " + configuredHosts + " HOSTS EN LA MISMA RED ===");
