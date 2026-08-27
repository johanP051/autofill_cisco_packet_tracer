// ================== CONFIGURACIÓN ==================
var CONFIGURE_ROUTERS = true;   // true = asignar IP a interfaces de router vía CLI, false = omitir routers (los configuras tú)
var IP_BASE = "192.168";        // primeros dos octetos
var SWITCH_SUBNET_START = 1;    // tercer octeto inicial (se incrementa por cada switch nuevo detectado)
var HOST_START = 2;             // último octeto donde inician los PCs (ej. .2, .3, .4...)
var SUBNET_MASK = "255.255.255.0";
var GATEWAY_OCTET = 1;          // el router (si existe y CONFIGURE_ROUTERS=true) siempre toma el .1 de cada subred
// =====================================================

var net = ipc.network();
var devCount = net.getDeviceCount();

var switchSubnets = {};   // nombreSwitch -> índice de subred (tercer octeto)
var hostCounters = {};    // nombreSwitch -> siguiente último octeto disponible para PCs
var nextSubnetIndex = SWITCH_SUBNET_START;

function getOrAssignSubnet(switchName) {
    if (!(switchName in switchSubnets)) {
        switchSubnets[switchName] = nextSubnetIndex;
        hostCounters[switchName] = HOST_START;
        nextSubnetIndex++;
        console.log("Nueva subred -> " + switchName + " = " + IP_BASE + "." + switchSubnets[switchName] + ".0/24");
    }
    return switchSubnets[switchName];
}

// Retorna el nombre del switch al que está conectado directamente un puerto, o null.
function findConnectedSwitchName(port) {
    if (!port) return null;
    var link = port.getLink();
    if (!link) return null;
    var otherPort = link.getOtherPort(port);
    if (!otherPort) return null;
    var otherDevice = otherPort.getOwnerDevice();
    if (!otherDevice) return null;
    if (otherDevice.getType() === 1) { // 1 = eSwitch
        return otherDevice.getName();
    }
    return null;
}

// ---------- FASE 1: PCs ----------
for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    if (!dev) continue;
    if (dev.getType() !== 8) continue; // 8 = ePc

    var portCount = dev.getPortCount();
    var switchName = null;
    var connectedPort = null;

    for (var p = 0; p < portCount; p++) {
        var port = dev.getPortAt(p);
        var sw = findConnectedSwitchName(port);
        if (sw) {
            switchName = sw;
            connectedPort = port;
            break;
        }
    }

    if (!switchName) {
        console.log(dev.getName() + ": sin conexión a switch detectada, se omite.");
        continue;
    }

    var subnetIdx = getOrAssignSubnet(switchName);
    var hostOctet = hostCounters[switchName];
    hostCounters[switchName] = hostOctet + 1;

    var ip = IP_BASE + "." + subnetIdx + "." + hostOctet;
    var gateway = IP_BASE + "." + subnetIdx + "." + GATEWAY_OCTET;

    try {
        connectedPort.setIpSubnetMask(ip, SUBNET_MASK);
        if (typeof connectedPort.setDefaultGateway === "function") {
            connectedPort.setDefaultGateway(gateway);
        }
        console.log(dev.getName() + " [" + switchName + "] -> " + ip + "/" + SUBNET_MASK + " GW:" + gateway);
    } catch (eIp) {
        console.log(dev.getName() + ": fallo al asignar IP -> " + eIp);
    }

    dev.setName(dev.getName().split(" [")[0] + " [" + ip + "]");
}

// ---------- FASE 2: Routers (condicionada por CONFIGURE_ROUTERS) ----------
if (CONFIGURE_ROUTERS) {
    for (var j = 0; j < devCount; j++) {
        var rdev = net.getDeviceAt(j);
        if (!rdev) continue;
        if (rdev.getType() !== 0) continue; // 0 = eRouter

        var rPortCount = rdev.getPortCount();
        var cmdLine = rdev.getCommandLine();

        for (var q = 0; q < rPortCount; q++) {
            var rport = rdev.getPortAt(q);
            var rSwitchName = findConnectedSwitchName(rport);
            if (!rSwitchName) continue;

            var rSubnetIdx = getOrAssignSubnet(rSwitchName);
            var rIp = IP_BASE + "." + rSubnetIdx + "." + GATEWAY_OCTET;

            try {
                cmdLine.enterCommand("enable");
                cmdLine.enterCommand("configure terminal");
                cmdLine.enterCommand("interface " + rport.getName());
                cmdLine.enterCommand("ip address " + rIp + " " + SUBNET_MASK);
                cmdLine.enterCommand("no shutdown");
                cmdLine.enterCommand("end");
                console.log(rdev.getName() + " " + rport.getName() + " [" + rSwitchName + "] -> " + rIp + "/" + SUBNET_MASK);
            } catch (eRouter) {
                console.log(rdev.getName() + ": fallo al configurar interfaz -> " + eRouter);
            }
        }
    }
} else {
    console.log("CONFIGURE_ROUTERS = false -> se omite configuración de routers (los dejas para ti).");
}

console.log("Proceso finalizado.");