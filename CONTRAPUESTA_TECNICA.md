# Contrapropuesta Técnica: TURNO-PVU "Land Rover Edition" (v4)

**Objetivo:** Transformar la arquitectura "Ferrari" en una solución "Land Rover" (4x4, robusta, offline-first) que garantice operatividad con conectividad intermitente, dando control total y manual al Coordinador sobre la gestión de reportes (ante fallas) y la administración de dispositivos.

---

## 1. Módulo Crítico: Contingencia y Operación Manual (El "Modo 4x4")

### 1.1 Dashboard del Coordinador: Control de Usuarios y Dispositivos
El Coordinador es el administrador operativo del centro. Su Dashboard ("El Cerebro") incluye una nueva sección vital: **Gestión de Activos**.

*   **Alta de Dispositivos (URLs Persistentes):**
    *   **Funcionalidad:** El Coordinador puede crear accesos únicos para cada rol.
    *   **Generador de URLs:**
        *   Botón: **[CREAR REGISTRADOR]** -> Genera `pvu.mx/r/centro01-reg01-tokenXYZ`
        *   Botón: **[CREAR VACUNADOR]** -> Genera `pvu.mx/v/centro01-vac01-tokenABC`
    *   **Persistencia:** Estas URLs no caducan cada turno. Se instalan como PWA en los dispositivos (MeeBox o celulares) y "recuerdan" su rol y configuración para siempre (hasta que el Coordinador las revoque).
    *   **Entrega:** El Coordinador configura físicamente los equipos al inicio del operativo usando estos links.

*   **Distribución de Bloques de Folios (Papel Digital):**
    *   Desde este mismo panel, el Coordinador asigna digitalmente "paquetes de 50 folios" a cada dispositivo activo.
    *   *"Dispositivo Reg-01: Folios 001-050"*, *"Dispositivo Reg-02: Folios 051-100"*.
    *   Esto evita conflictos offline: cada dispositivo sabe qué rango puede emitir sin consultar internet.

### 1.2 Protocolo de "Cortes Informativos" (Respaldo Manual)
**Definición:** Un reporte del estado real del centro, subido manualmente por el Coordinador, que **SOLO** se utiliza cuando falla la conectividad automática de los dispositivos.

**Flujo Operativo:**
1.  **Escenario A (Hay Internet en MeeBox):**
    *   Los dispositivos suben sus datos en tiempo real (o background sync).
    *   El Dashboard Central se actualiza solo.
    *   El Coordinador **NO** necesita intervenir manualmente. Solo monitorea.

2.  **Escenario B (Falla Internet en MeeBox / Contingencia):**
    *   El Dashboard Central deja de recibir datos.
    *   **Acción Manual:** El Coordinador camina a las MeeBox y ve el contador en pantalla ("Quedan 15 dosis").
    *   **Captura Móvil:** Abre su celular (usando sus propios datos móviles) y entra a "Reportar Corte Manual".
    *   Ingresa: *"Hora 12:00 PM. Dosis Restantes: 15"*.
    *   Al enviar, reactiva la visibilidad del Dashboard Público.

---

## 2. Nueva Interfaz de Vacunador: "Flujo Secuencial Asistido"

**El Reto:** Lograr la velocidad de un "Click" (Opción B) sin perder el control del folio (Opción A), evitando inputs manuales lentos.

**La Propuesta: Predicción Inteligente de Cola (FIFO)**
Asumimos que la fila se respeta en un 95%. La gente no se desordena aleatoriamente.

### Pantalla "One-Tap Confirm"
En lugar de escribir "0045" o escanear siempre, el sistema **PREDICE** quién sigue.

1.  **Pantalla del Vacunador:**
    *   Muestra gigante: **"SIGUIENTE: FOLIO 0045"** (Basado en el consecutivo anterior).
    *   Datos del niño (si se tiene cache): *"Niño 7 años - SRP"*.

2.  **Interacción (3 escenarios):**

    *   **Escenario A (95% Flujo Normal):**
        *   Llega el niño. Vacunador pregunta: *"¿Trae el 45?"*. Mamá: *"Sí"*.
        *   Vacunador presiona botón gigante **[CONFIRMAR Y APLICAR]**.
        *   *Acción:* Listo. 1 segundo.

    *   **Escenario B (Se saltaron uno):**
        *   Llega el niño. Vacunador: *"¿Trae el 45?"*. Mamá: *"No, soy el 46, el 45 fue al baño"*.
        *   Vacunador presiona botón **[SALTAR / SIGUIENTE]**.
        *   Sistema muestra: **"FOLIO 0046"**.
        *   Vacunador: **[CONFIRMAR Y APLICAR]**.

    *   **Escenario C (Desorden total / Perdido):**
        *   Vacunador presiona botón pequeño *[Teclado Manual]*.
        *   Se abre teclado numérico grande. Digita `4` `8`. Enter.
        *   (Solo necesario en caos).

### Seguridad Anti-Error
*   Si el vacunador intenta confirmar un folio que *no ha sido emitido* o que *ya fue aplicado*, el sistema vibra y muestra error rojo (la validación ocurre contra la base de datos local del dispositivo del vacunador, que se sincronizó previamente o funciona por lógica de rangos).

---

## 3. Inclusión de SR y VPH

*   **Interfaz de Aplicación:**
    *   Al confirmar el folio, el sistema muestra qué vacuna *debería* tocarle según la edad (regla precargada).
    *   Botón principal cambia dinámicamente:
        *   Si es <10 años: Botón dice **[APLICAR SRP]** (Naranja).
        *   Si es >10 años: Botón dice **[APLICAR SR]** (Morado).
        *   Si es 11 años mujer: Muestra dos botones **[SRP]** y **[VPH]**.

---

## 4. Resumen de Impacto en Cronograma (Ajustado v4)

| Feature | Esfuerzo Extra | Valor para el Negocio |
| :--- | :--- | :--- |
| **Persistencia Offline (Local-First)** | +5h | *Indispensable.* El sistema no muere sin red. |
| **Panel Coordinador: Gestión de Roles/URLs** | +4h | Autonomía para crear usuarios y configurar equipos sin IT. |
| **Panel Coordinador: Cortes Manuales de Respaldo** | +2h | Plan B seguro si falla la red en dispositivos. |
| **Lógica de Bloques de Folios** | +3h | Evita duplicidad de folios en offline. |
| **Algoritmo Secuencial Vaccinator ("Next Folio")** | +4h | Velocidad extrema sin perder control. |
| **Lógica SR/SRP Dinámica** | +2h | Cumplimiento normativo de salud. |
| **TOTAL EXTRA** | **~20 horas** | **Total Proyecto: ~40-45 horas** |

**Conclusión v4:**
Esta versión empodera al Coordinador con herramientas de administración:
1.  **Crea su propio equipo:** Genera URLs persistentes para sus Registradores y Vacunadores.
2.  **Gestiona su inventario:** Reparte bloques de folios.
3.  **Respalda la operación:** Si falla el internet de sus equipos, él entra al quite con reportes manuales desde su celular.
Es el equilibrio perfecto entre automatización (cuando hay red) y control humano (cuando no la hay).
