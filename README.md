# ⚡ Autofill Cisco Packet Tracer

> **Suite universal de scripts en JavaScript nativo para la auto-configuración de direcciones IP (IPv4 e IPv6), cálculo de subredes, configuración de routers y rotulado visual inteligente en Cisco Packet Tracer.**

---

## 🎯 ¿Qué problema resuelve este proyecto?

Configurar manualmente decenas de computadores en Cisco Packet Tracer (abrir equipo por equipo $\rightarrow$ Desktop $\rightarrow$ IP Configuration $\rightarrow$ escribir IP $\rightarrow$ máscara $\rightarrow$ gateway $\rightarrow$ cerrar $\rightarrow$ rotular la etiqueta en el lienzo) es un proceso lento, aburrido y propenso a errores humanos.

Con estos scripts, **toda la red se configura y se rotula automáticamente en menos de 1 segundo**, directamente desde el motor interno de Packet Tracer (`ipc.network()`), sin necesidad de programas externos ni clics de ratón.

---

## 🚀 Guía Rápida: Cómo Ejecutar un Script en Packet Tracer (En 5 Pasos)

Para que Packet Tracer permita ejecutar el código sin arrojar errores de seguridad (`IPC Call ERROR`), sigue este flujo exacto:

```text
[+] Crear Script  ──►  Pegar Código  ──►  General (Permisos)  ──►  Info (Save)  ──►  Script Engine (Start + Debug)
```

1. **Abrir el Editor de Scripts:**
   - En el menú superior de Packet Tracer: **`Extensions` $\rightarrow$ `Scripting` $\rightarrow$ `New PT Script Module...`** (o `Edit File Script Module...`).
2. **Crear el archivo:**
   - Ve a la pestaña **`Script Engine`**.
   - Haz clic en el botón **`+`** (abajo a la izquierda), escribe un nombre (ej. `mi_script.js`) y presiona **OK**.
   - Pega el código del script que vayas a usar.
3. **Conceder Permisos de Seguridad (IPC):**
   - Ve a la pestaña **`General`**.
   - Desplázate hacia abajo hasta la sección **`Security`** y marca obligatoriamente:
     - ☑️ **Get Network Info**
     - ☑️ **Change Network Info**
4. **Guardar el Módulo:**
   - Ve a la pestaña **`Info`**.
   - En la sección **6. Saving**, presiona el botón **`Save`** (fija los permisos y el código en el archivo).
5. **Ejecutar y Monitorear:**
   - Regresa a la pestaña **`Script Engine`** y presiona **`Start`** (o *Run File*).
   - Haz clic en **`Debug`** para abrir la consola de salida y ver las confirmaciones `[OK]` en tiempo real.
   - Presiona dos veces **`Alt + D`** en el teclado para acelerar la simulación y pasar los puertos del switch a verde de inmediato.

---

## 📂 Catálogo de Scripts Disponibles

En la carpeta [`scripts/`](./scripts/) encontrarás 3 scripts independientes listos para usar según el tipo de laboratorio:

| Archivo | Caso de Uso | Características Principales |
| :--- | :--- | :--- |
| **`01_ipv6_auto_config.js`** | **Laboratorios de IPv6** | Asigna direcciones estáticas con prefijo `/64` a N hosts (`::1`, `::2`... `::20` en hexadecimal). Habilita IPv6 y desactiva autoconfig. |
| **`02_ipv4_subredes_routers.js`** | **Subredes por Switch + Router** | Detecta qué PCs están en cada switch y les crea subredes separadas (`192.168.1.x`, `192.168.2.x`...). Configura el Gateway (`.1`) en los PCs y enciende las interfaces del Router vía CLI y API. |
| **`03_ipv4_red_plana.js`** | **Red Normal sin Subredes** | Todos los switches y PCs pertenecen a la **misma red** (`192.168.1.x`). Auto-detecta Clases A, B y C. Numera los hosts consecutivamente (`.2`, `.3`, `.4`...). Deja Gateway en `0.0.0.0` (sin router). |

---

## ⚠️ Configuración y Sistema Anti-Plagio

> [!IMPORTANT]
> ### 🛡️ ¡IMPORTANTE PARA EVITAR COPIAS O PLAGIO EN CLASE!
> Si varios estudiantes entregan topologías donde todos los PCs están rotulados exactamente igual (ej. todos con corchetes `PC1 [192.168.1.2]`), el profesor puede notar que usaron la misma plantilla.
> 
> **Cada estudiante DEBE personalizar las variables en la cabecera del script antes de ejecutarlo**. Puedes elegir entre 6 formatos de rótulo para los hosts y 5 formatos para los switches, o incluso elegir **no rotular** para que no se note que usaste un script.

### 🎨 Opciones de Rotulado para Hosts (`HOST_LABEL_STYLE`):

```javascript
// Cambia este valor al inicio del script:
var HOST_LABEL_STYLE = 1;
```

- **`1` = Corchetes clásicos:** `PC1 [192.168.1.2]`
- **`2` = Paréntesis limpios:** `PC1 (192.168.1.2)`
- **`3` = Guion separador:** `PC1 - 192.168.1.2`
- **`4` = Prefijo con Switch:** `SW1_PC1_192.168.1.2`
- **`5` = Solo la dirección IP:** `192.168.1.2`
- **`6` = Sin rotular (Discreto):** No modifica el nombre del equipo (deja `PC0`, `PC1`, etc. tal como venían, pero asigna la IP internamente sin dejar rastro visible en el lienzo).

### 🎨 Opciones de Rotulado para Switches (`SWITCH_LABEL_STYLE`):

```javascript
// Cambia este valor al inicio del script:
var SWITCH_LABEL_STYLE = 1;
```

- **`1` = Corchetes con subred:** `Switch1 [192.168.1.0/24]`
- **`2` = Paréntesis con subred:** `SW1 (192.168.1.0)`
- **`3` = Solo nombre limpio:** `Switch1`
- **`4` = Prefijo corto:** `SW1`
- **`5` = Sin renombrar:** Conserva el nombre original que le dio Packet Tracer.

---

### ⚙️ Parámetros de Red Modificables en la Cabecera

En los scripts de IPv4 puedes ajustar fácilmente:
- **`NETWORK_BASE`:** Define la red base. Por ejemplo:
  - `"10.0.0.0"` $\rightarrow$ Auto-detecta **Clase A** y asigna máscara `255.0.0.0` (`/8`).
  - `"172.16.0.0"` $\rightarrow$ Auto-detecta **Clase B** y asigna máscara `255.255.0.0` (`/16`).
  - `"192.168.1.0"` $\rightarrow$ Auto-detecta **Clase C** y asigna máscara `255.255.255.0` (`/24`).
- **`AUTO_MASK`:** `true` calcula la máscara por clase. Si tu profesor te pide una máscara personalizada (ej. `/26` $\rightarrow$ `255.255.255.192`), pon `AUTO_MASK = false;` y coloca tu máscara en `CUSTOM_MASK`.
- **`HOST_START`:** El número del host inicial para los PCs (ej. `2` para empezar en `.2`, dejando `.1` libre para el router).
- **`ASSIGN_GATEWAY`:** `true` asigna la IP del router a los PCs; `false` deja `0.0.0.0`.
- **`DNS_SERVER`:** Si el laboratorio tiene un servidor DNS, coloca su IP (ej. `"8.8.8.8"` o `"192.168.1.250"`). Si se deja en `""`, no asigna DNS.

En el script de IPv6 (`01_ipv6_auto_config.js`):
- **`PREFIX`:** Prefijo asignado (ej. `"2607:f8b0:4005:80a::"` o `"2001:db8:acad::"`).
- **`TOTAL_HOSTS`:** Cuántos equipos quieres configurar (ej. `32`, `50` o los que tengas en tu topología).

---

## ⚡ Atajos de Teclado Imprescindibles (Cisco Packet Tracer)

Ahorra tiempo al diseñar y montar tu topología con estos atajos verificados:

| Atajo | Función | ¿Para qué sirve? |
| :--- | :--- | :--- |
| **`Ctrl` + Clic** | **Fijar Herramienta / Modo Continuo** | Haz clic en el rayito de cable con `Ctrl` presionado: podrás conectar decenas de PCs seguidos sin volver a seleccionar el cable. Lo mismo sirve para colocar múltiples PCs o switches. |
| **`Ctrl` + Arrastrar** | **Duplicación Rápida** | Arrastra cualquier equipo en el lienzo con `Ctrl` presionado para clonarlo inmediatamente. |
| **`Alt` + `D`** | **Fast Forward Time** | **¡El mejor atajo!** Adelanta 30 segundos el reloj de simulación. Pasa los puertos del switch de **naranja a verde** al instante sin esperar la convergencia de Spanning Tree (STP). |
| **`Alt` + `S`** | **Power Cycle Devices** | Reinicia la energía de toda la topología para comprobar si las configuraciones sobrevivieron en la memoria. |
| **`P`** | **Add Simple PDU** | Activa el sobrecito de ping visual para probar conectividad entre dos PCs con un solo clic en cada uno. |
| **`I`** | **Inspect Tool** | Haz clic en un switch o router para ver sus tablas ARP, tablas MAC y tablas de rutas sin entrar a la CLI. |
| **`Ctrl + Shift + 6`** | **Cancelar Búsqueda DNS en IOS** | Si cometes un error tipográfico en la consola del router y se congela diciendo `Translating "..." domain server`, este atajo lo desbloquea de inmediato. |
| **`Esc`** | **Cancelar / Cursor Normal** | Cancela la herramienta fija y vuelve al cursor de selección. |

---

## 🧪 Cómo Verificar que tu Red Funcione

1. **Prueba visual rápida con PDU:**
   - Presiona la tecla **`P`**.
   - Haz clic en un PC de un switch y luego en un PC de otro switch.
   - En la esquina inferior derecha verás el estado:
     - *Nota:* El primer intento puede salir en `Failed` mientras el router resuelve la tabla ARP. Vuelve a presionar **`P`** y repetir: ahora dirá **`Successful`**.
2. **Prueba por consola (Command Prompt):**
   - Entra a cualquier PC $\rightarrow$ **Desktop** $\rightarrow$ **Command Prompt**.
   - Haz ping a tu propio Gateway:
     ```bash
     ping 192.168.1.1
     ```
     *(Debe responder `Reply from 192.168.1.1` con TTL=255 y 0% de pérdida)*.
   - Haz ping a un PC en otro switch:
     ```bash
     ping 192.168.3.3
     ```
     *(El primer paquete puede expirar por ARP y los siguientes responderán con TTL=127. El TTL=127 confirma que el paquete atravesó el router con éxito)*.

---

## 🖧 Hardware Recomendado en Packet Tracer

- **Switches:** Usa el **`Cisco Catalyst 2960-24TT`**. Tiene 24 puertos FastEthernet + 2 puertos Gigabit para interconexión.
- **Routers:**
  - **`Cisco 2911`:** El estándar CCNA, con 3 puertos GigabitEthernet integrados.
  - **`Router-PT` (Genérico):** Trae 2 puertos FastEthernet, pero tiene 10 ranuras libres para agregar módulos `PT-ROUTER-NM-1CFE` si necesitas muchas interfaces.
  
> [!TIP]
> **Recordatorio físico:** Si apagas un router para agregarle módulos de red (`NM-1CFE`), **¡acuérdate de volver a encender el interruptor físico (*Power Switch en ON*)!** Si el router está apagado, las conexiones se quedarán en rojo y ningún ping pasará.

---

## 📄 Licencia y Contribuciones

Proyecto desarrollado para estudiantes de Ingeniería de Sistemas y Computación y entusiastas de redes Cisco. ¡Úsalo, compártelo con tus compañeros y adáptalo a tus propios laboratorios!
