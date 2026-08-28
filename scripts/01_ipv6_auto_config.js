/*
 * ==============================================================================
 * Cisco Packet Tracer - Script 1: Auto-Configuración y Rotulado IPv6
 * Repositorio: autofill_cisco_packet_tracer
 * Documentación API: https://tutorials.ptnetacad.net/help/default/IpcAPI/
 * ==============================================================================
 */

// ==============================================================================
// ⚙️ 1. PARÁMETROS DE RED (Ajusta estos valores según la guía de tu profesor)
// ==============================================================================
var PREFIX = "2607:f8b0:4005:80a::"; // Prefijo IPv6 de tu laboratorio
var PREFIXLEN = 64;                  // Longitud del prefijo (típicamente 64)
var TOTAL_HOSTS = 32;                // Cantidad total de hosts a configurar (1..N)
var HOST_START_INDEX = 1;            // Número inicial de host (1 -> ::1)

// ==============================================================================
// 🎨 2. SISTEMA ANTI-PLAGIO: ESTILOS DE RÓTULO VISUAL
// ¡IMPORTANTE! Cambia este número para que el formato de tus PCs sea diferente
// al de tus compañeros y evites sospechas de plagio:
//
// 1 = Corchetes clásicos  -> "PC1 [2607:f8b0:4005:80a::1]"
// 2 = Paréntesis limpios  -> "PC1 (2607:f8b0:4005:80a::1)"
// 3 = Separador con guion -> "PC1 - 2607:f8b0:4005:80a::1"
// 4 = Solo la dirección   -> "2607:f8b0:4005:80a::1"
// 5 = Sin rotular         -> No modifica el nombre (deja "PC0", "PC1", etc.)
// ==============================================================================
var LABEL_STYLE = 1; 

// ==============================================================================
// LÓGICA DE EJECUCIÓN (No es necesario modificar a partir de aquí)
// ==============================================================================

var net = ipc.network();
var devCount = net.getDeviceCount();
var hostIndex = HOST_START_INDEX;
var configuredCount = 0;

console.log("=== INICIANDO AUTO-CONFIGURACIÓN IPv6 ===");
console.log("Prefijo: " + PREFIX + "/" + PREFIXLEN + " | Total hosts: " + TOTAL_HOSTS);
console.log("Estilo de rótulo seleccionado: " + LABEL_STYLE);

// Función auxiliar para formatear la etiqueta del PC según el estilo elegido
function formatHostLabel(originalName, index, ipv6, style) {
    var baseName = originalName.split(" [")[0].split(" (")[0].split(" - ")[0];
    baseName = baseName.replace(/(\(\d+\))+$/g, "");
    switch (style) {
        case 1: // Corchetes
            return "PC" + index + " [" + ipv6 + "]";
        case 2: // Paréntesis
            return "PC" + index + " (" + ipv6 + ")";
        case 3: // Guion
            return "PC" + index + " - " + ipv6;
        case 4: // Solo IP
            return ipv6;
        case 5: // Sin rotular (conserva nombre original)
            return baseName;
        default:
            return "PC" + index + " [" + ipv6 + "]";
    }
}

for (var i = 0; i < devCount; i++) {
    var dev = net.getDeviceAt(i);
    if (!dev) continue;

    var devModel = dev.getModel() ? dev.getModel() : "";
    var devName = dev.getName() ? dev.getName() : "";

    // Filtrar PCs o Laptops
    if (devModel.indexOf("PC") !== -1 || devName.indexOf("PC") !== -1 || dev.getType() === 8 || dev.getType() === 18) {
        if (configuredCount >= TOTAL_HOSTS) break;

        var hexId = hostIndex.toString(16); // Convierte 1..32 a hexadecimal 1..20
        var fullIpv6 = PREFIX + hexId;

        var port = dev.getPortAt(0); // FastEthernet0
        if (port) {
            // Habilitar IPv6 y desactivar autoconfiguración
            if (typeof port.setIpv6Enabled === "function") {
                port.setIpv6Enabled(true);
            }
            if (typeof port.setIpv6AddressAutoConfig === "function") {
                port.setIpv6AddressAutoConfig(false);
            }

            // Asignar dirección IPv6 con la firma oficial de 4 argumentos:
            // bool HostPort::addIpv6Address(ipv6, prefixLen, Ipv6AddressType, bool bAllowDup)
            if (typeof port.addIpv6Address === "function") {
                try {
                    var ok = port.addIpv6Address(fullIpv6, PREFIXLEN, 0, false);
                    console.log("PC " + hostIndex + " (" + devName + ") -> " + fullIpv6 + "/" + PREFIXLEN + " [OK: " + ok + "]");
                } catch (e) {
                    console.log("Error asignando IPv6 a " + devName + ": " + e);
                }
            }
        }

        // Aplicar rotulado personalizado
        if (typeof dev.setName === "function") {
            var newLabel = formatHostLabel(devName, hostIndex, fullIpv6, LABEL_STYLE);
            dev.setName(newLabel);
        }

        hostIndex++;
        configuredCount++;
    }
}

console.log("=== PROCESO IPv6 COMPLETADO: " + configuredCount + " HOSTS CONFIGURADOS ===");
