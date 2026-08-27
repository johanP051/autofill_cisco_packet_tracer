/*
 * ==============================================================================
 * Cisco Packet Tracer - Script 2: Subredes Segmentadas por Switch + Routers (IPv4)
 * Repositorio: autofill_cisco_packet_tracer
 * Documentación API: https://tutorials.ptnetacad.net/help/default/IpcAPI/
 * ==============================================================================
 */

// ==============================================================================
// ⚙️ 1. PARÁMETROS DE RED (Ajusta estos valores según la guía de tu profesor)
// ==============================================================================
var NETWORK_BASE = "192.168.1.0"; // Red base (ej. "10.0.0.0", "172.16.0.0", "192.168.1.0")
var AUTO_MASK = true;             // true = calcular según Clase A/B/C, false = usar CUSTOM_MASK
var CUSTOM_MASK = "255.255.255.0";

var HOST_START = 2;               // Primer host asignado a PCs (.2, .3... el .1 es el router)
var GATEWAY_OCTET = 1;            // Octeto asignado al Router en cada subred (usualmente .1)
var CONFIGURE_ROUTERS = true;     // true = configura y enciende interfaces del router
var ASSIGN_GATEWAY = true;        // true = llena el Default Gateway en los PCs
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
// 4 = Prefijo con Switch  -> "SW1_PC1_192.168.1.2"
// 5 = Solo la dirección   -> "192.168.1.2"
// 6 = Sin rotular         -> Conserva el nombre original del equipo
var HOST_LABEL_STYLE = 1;

// --- Estilo de Switches ---
// 1 = Corchetes con subred  -> "Switch1 [192.168.1.0/24]"
// 2 = Paréntesis con subred -> "SW1 (192.168.1.0)"
// 3 = Solo nombre limpio    -> "Switch1"
// 4 = Prefijo corto         -> "SW1"
// 5 = Sin renombrar         -> Conserva el nombre original de Packet Tracer
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

console.log("=== INICIANDO SUBREDES + ROUTERS ===");
console.log("Red Base: " + NETWORK_BASE + " (" + classInfo.networkClass + " -> " + FINAL_MASK + ")");

var net = ipc.network();
var devCount = net.getDeviceCount();

var switchSubnets = {};
var switchCleanNames = {};
var hostCounters = {};
var switchCounter = 1;

function findConnectedSwitchDevice(port) {
    if (!port) return null;
    var link = port.getLink();
    if (!link) return null;

    var port1 = link.getPort1();
    var port2 = link.getPort2();
    if (!port1 || !port2) return null;

    var myDevice = port.getOwnerDevice();
    var otherPort = (port1.getOwnerDevice() && myDevice && port1.getOwnerDevice().getName() === myDevice.getName()) ? port2 : port1;
    if (!otherPort) return null;
    
    var otherDevice = otherPort.getOwnerDevice();
    if (otherDevice && otherDevice.getType() === 1) return otherDevice; // 1 = eSwitch
    return null;
}

function generateIpPerSwitch(networkBase, classType, subnetNum, hostNum) {
    var octets = networkBase.split(".");
    var o1 = octets[0], o2 = octets[1];
    if (classType === "A") return o1 + "." + subnetNum + ".0." + hostNum;
    if (classType === "B") return o1 + "." + o2 + "." + subnetNum + "." + hostNum;
    return o1 + "." + o2 + "." + subnetNum + "." + hostNum;
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

function formatHostLabel(originalName, switchTag, ip, style) {
    var baseName = originalName.split(" [")[0].split(" (")[0].split(" - ")[0];
    switch (style) {
        case 1: return baseName + " [" + ip + "]";
        case 2: return baseName + " (" + ip + ")";
        case 3: return baseName + " - " + ip;
        case 4: return switchTag + "_" + baseName + "_" + ip;
        case 5: return ip;
        case 6: return baseName;
        default: return baseName + " [" + ip + "]";
    }
}

// 1. Rotular y Registrar Switches
for (var s = 0; s < devCount; s++) {
    var sDev = net.getDeviceAt(s);
    if (!sDev || sDev.getType() !== 1) continue;

    var rawName = sDev.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
    var subnetIp = generateIpPerSwitch(NETWORK_BASE, classInfo.networkClass, switchCounter, 0);
    var subnetStr = subnetIp + classInfo.cidr;
    var swLabel = formatSwitchLabel(rawName, switchCounter, subnetStr, SWITCH_LABEL_STYLE);

    sDev.setName(swLabel);
    switchSubnets[rawName] = switchCounter;
    switchCleanNames[rawName] = "SW" + switchCounter;
    hostCounters[rawName] = HOST_START;
    switchCounter++;
}

// 2. Configurar Hosts (PCs / Laptops)
for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    if (!dev || (dev.getType() !== 8 && dev.getType() !== 18)) continue;

    var portCount = dev.getPortCount();
    var switchDevice = null;
    var connectedPort = null;

    for (var p = 0; p < portCount; p++) {
        var port = dev.getPortAt(p);
        var sw = findConnectedSwitchDevice(port);
        if (sw) { switchDevice = sw; connectedPort = port; break; }
    }

    if (!switchDevice) continue;

    var rawSwitchName = switchDevice.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
    var sIdx = switchSubnets[rawSwitchName];
    var hIdx = hostCounters[rawSwitchName];

    var assignedIp = generateIpPerSwitch(NETWORK_BASE, classInfo.networkClass, sIdx, hIdx);
    var gatewayIp = generateIpPerSwitch(NETWORK_BASE, classInfo.networkClass, sIdx, GATEWAY_OCTET);
    hostCounters[rawSwitchName] = hIdx + 1;

    try {
        connectedPort.setIpSubnetMask(assignedIp, FINAL_MASK);
        if (ASSIGN_GATEWAY && typeof connectedPort.setDefaultGateway === "function") {
            connectedPort.setDefaultGateway(gatewayIp);
        }
        if (DNS_SERVER !== "" && typeof connectedPort.setDnsServerIp === "function") {
            connectedPort.setDnsServerIp(DNS_SERVER);
        }
    } catch (err) {
        console.log(dev.getName() + ": Error -> " + err);
    }

    var newHostName = formatHostLabel(dev.getName(), switchCleanNames[rawSwitchName], assignedIp, HOST_LABEL_STYLE);
    dev.setName(newHostName);
}

// 3. Configurar Routers (Nativo + CLI)
if (CONFIGURE_ROUTERS) {
    for (var r = 0; r < devCount; r++) {
        var rdev = net.getDeviceAt(r);
        if (!rdev || rdev.getType() !== 0) continue; // 0 = eRouter

        var rPortCount = rdev.getPortCount();
        var cmdLine = rdev.getCommandLine();

        for (var q = 0; q < rPortCount; q++) {
            var rport = rdev.getPortAt(q);
            var rSwitchDevice = findConnectedSwitchDevice(rport);
            if (!rSwitchDevice) continue;

            var rRawSwitchName = rSwitchDevice.getName().split(" [")[0].split(" (")[0].split(" - ")[0];
            var rSubnetIdx = switchSubnets[rRawSwitchName];
            var rIp = generateIpPerSwitch(NETWORK_BASE, classInfo.networkClass, rSubnetIdx, GATEWAY_OCTET);

            try {
                if (typeof rport.setIpSubnetMask === "function") rport.setIpSubnetMask(rIp, FINAL_MASK);
                if (typeof rport.setPower === "function") rport.setPower(true);

                if (cmdLine) {
                    cmdLine.enterCommand("no");
                    cmdLine.enterCommand("enable");
                    cmdLine.enterCommand("configure terminal");
                    cmdLine.enterCommand("interface " + rport.getName());
                    cmdLine.enterCommand("ip address " + rIp + " " + FINAL_MASK);
                    cmdLine.enterCommand("no shutdown");
                    cmdLine.enterCommand("end");
                }
                console.log("Router " + rdev.getName() + " [" + rport.getName() + " -> " + rRawSwitchName + "] IP: " + rIp + " [UP]");
            } catch (eRouter) {
                console.log(rdev.getName() + ": Error -> " + eRouter);
            }
        }
    }
}

console.log("=== PROCESO COMPLETADO EXITOSAMENTE ===");
