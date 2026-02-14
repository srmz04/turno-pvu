# PRD - TURNO-PVU
## Sistema de Gestion de Turnos para Puestos de Vacunacion Universal
### Durango, Mexico - Respuesta al Brote de Sarampion 2025-2026

**Version:** 1.0
**Fecha:** 14 de febrero de 2026
**Estado:** URGENTE - Emergencia sanitaria activa
**Clasificacion:** Herramienta operativa de salud publica

---

## INDICE

1. [Contexto y Justificacion](#1-contexto-y-justificacion)
2. [Definicion del Problema](#2-definicion-del-problema)
3. [Objetivos del Sistema](#3-objetivos-del-sistema)
4. [Usuarios y Roles](#4-usuarios-y-roles)
5. [Alcance Funcional](#5-alcance-funcional)
6. [Flujo Operativo Detallado](#6-flujo-operativo-detallado)
7. [Reglas de Negocio](#7-reglas-de-negocio)
8. [Supuestos, Excepciones y Flujos Alternos](#8-supuestos-excepciones-y-flujos-alternos)
9. [Modulos del Sistema](#9-modulos-del-sistema)
10. [Modelo de Datos](#10-modelo-de-datos)
11. [Arquitectura Tecnica](#11-arquitectura-tecnica)
12. [Infraestructura y Hardware](#12-infraestructura-y-hardware)
13. [Panel Publico](#13-panel-publico)
14. [Seguridad y Auditoria](#14-seguridad-y-auditoria)
15. [Adopcion y Resistencia al Cambio](#15-adopcion-y-resistencia-al-cambio)
16. [Plan de Contingencia](#16-plan-de-contingencia)
17. [Fases de Desarrollo](#17-fases-de-desarrollo)
18. [Metricas de Exito](#18-metricas-de-exito)
19. [Glosario](#19-glosario)

---

## 1. CONTEXTO Y JUSTIFICACION

### 1.1 Situacion Epidemiologica

Mexico enfrenta un brote activo de sarampion con 8,899 casos acumulados entre 2025 y 2026. El estado de Durango registra 62 casos confirmados y una defuncion: un nino de 8 anos originario de Mezquital, contagiado en Sinaloa, fallecido el 10 de febrero de 2026 en el Hospital Materno Infantil de Durango.

La distribucion geografica en Durango se concentra en:
- Durango capital: 15 casos
- Mezquital: 5 casos (poblacion migrante agricola, alta vulnerabilidad)
- Gomez Palacio: 1 caso
- Vicente Guerrero: 1 caso

El 58% de los casos son ninos de 1 a 11 anos. La transmision es interestatal (Sinaloa-Durango) con tendencia ascendente.

### 1.2 Problema Operativo Inmediato

La muerte del menor y la cobertura mediatica generaron panico en la poblacion. Los centros de salud se abarrotaron con personas de todas las edades pidiendo vacuna, incluyendo adultos que no son poblacion objetivo en esta fase. Esto provoco:

- **Consumo acelerado de biologico** sin priorizacion por grupo de riesgo
- **Filas de horas** sin garantia de atencion
- **Desabasto parcial** en algunos centros
- **Caos logistico** sin control de cuantas dosis se aplican ni a quien
- **Frustracion ciudadana** por llegar temprano y no alcanzar vacuna

### 1.3 Directriz de la Secretaria de Salud

Se instruye que la vacunacion con SRP (Triple Viral) se priorice exclusivamente a **menores de 6 meses a 12 anos de edad**. Adicionalmente, se aprovechara el contacto con menores de 11 y 12 anos para completar esquemas de VPH (Virus del Papiloma Humano).

### 1.4 Por que un sistema digital

Un sistema de fichas en papel presenta problemas conocidos:
- No hay control en tiempo real del inventario
- No se puede saber desde gobierno cuantas fichas quedan en cada centro
- No hay trazabilidad (fichas perdidas, duplicadas, falsificadas)
- No se puede informar al publico la disponibilidad actual
- No se puede auditar quien hizo que y cuando

TURNO-PVU resuelve esto con una herramienta digital minima, sin papel, que funciona en hardware existente (MeeBox 2018 con camara) y no requiere presupuesto adicional.

---

## 2. DEFINICION DEL PROBLEMA

### 2.1 Problema Principal

No existe un mecanismo para controlar el flujo de pacientes en los puestos de vacunacion que:
- Limite la entrega de fichas al numero exacto de dosis disponibles
- Valide automaticamente que el menor esta en el rango de edad autorizado
- Informe en tiempo real cuantos turnos quedan
- Bloquee la emision de fichas cuando el biologico se agota
- Permita monitoreo centralizado de 15 centros de salud

### 2.2 Problemas Secundarios

- **Oportunidad perdida de VPH:** Cuando llegan menores de 11-12 anos por sarampion, no se les pregunta si tienen esquema de VPH. Se pierde la oportunidad de completar esquemas.
- **Falta de datos para toma de decisiones:** El coordinador no sabe cuantas dosis se aplicaron hoy, en que centro, a que hora se agotaron. Toda esta informacion llega al dia siguiente (o nunca).
- **Resistencia del personal:** El personal operativo tiene apatia hacia sistemas nuevos, curvas de aprendizaje, mala actitud ante la tecnologia, y falta de tiempo. Cualquier sistema que se implemente DEBE ser mas facil que lo que ya hacen, no mas dificil.

### 2.3 Lo que NO es este sistema

- NO es un padron de vacunacion (no se registran nombres, CURP, ni datos personales del menor)
- NO es un sistema de notificaciones (no envia SMS, WhatsApp ni emails)
- NO es una app publica de citas (el publico no agenda, llega al centro y se le atiende por orden de llegada)
- NO es un sistema de expediente clinico
- NO requiere internet en el punto de vacunacion para funcionar en modo basico

---

## 3. OBJETIVOS DEL SISTEMA

### 3.1 Objetivo General

Proveer un sistema digital de control de turnos que garantice que cada dosis de biologico disponible se asigne a un menor dentro del rango autorizado, con trazabilidad completa y visibilidad en tiempo real para coordinadores y publico general.

### 3.2 Objetivos Especificos

| # | Objetivo | Metrica |
|---|----------|---------|
| 1 | Nunca emitir mas fichas que dosis disponibles | Fichas emitidas <= inventario capturado |
| 2 | Validar 100% de las fichas por rango de edad | 0 fichas emitidas fuera de 6m-12a |
| 3 | Captar oportunidades de VPH en 11-12 anos | % de menores elegibles a los que se les pregunto |
| 4 | Visibilidad en tiempo real por centro | Dashboard actualizado cada 30 segundos |
| 5 | Informar al publico sin colapsar infraestructura | Panel publico estatico con cache |
| 6 | Trazabilidad de cada ficha emitida | 100% de fichas con usuario, hora, centro |
| 7 | Adopcion >90% del personal en la primera semana | Centros usando el sistema / centros totales |

---

## 4. USUARIOS Y ROLES

### 4.1 Registrador (Punto de Filtro)

**Quien es:** Personal de salud asignado a la entrada del modulo de vacunacion. NO es el enfermero vacunador. Es una persona dedicada exclusivamente a registrar y emitir fichas.

**Que hace:**
- Pregunta la edad del menor
- Pregunta el sexo
- Si aplica, pregunta si tiene VPH
- Genera la ficha digital
- Muestra la pantalla al acompanante para que le tome foto
- Pasa al siguiente

**Cantidad estimada:** 1-2 por centro de salud = 15-30 personas

**Nivel tecnico esperado:** Sabe usar WhatsApp. No se requiere mas.

### 4.2 Aplicador (Vacunador)

**Quien es:** Enfermero/a que aplica la vacuna. NO deja de vacunar para usar el sistema.

**Que hace:**
- Recibe al menor con la ficha (foto en celular del acompanante)
- Lee el folio de 4 digitos en la pantalla del acompanante
- Busca el folio en el sistema y marca "APLICADA"
- Sigue vacunando

**Cantidad estimada:** 1-3 por centro = 15-45 personas

**Nota critica:** Este usuario NO escanea QR. Busca por numero de folio. Es mas rapido y no requiere hardware extra.

### 4.3 Coordinador de Centro

**Quien es:** Responsable del centro de salud o jefe de enfermeria.

**Que hace:**
- Al inicio del turno, captura cuantas dosis tiene disponibles (SRP y VPH por separado)
- Monitorea el avance del dia en su centro
- Recibe alertas cuando quedan pocas dosis
- Exporta reporte al final del turno

**Cantidad estimada:** 1 por centro = 15 personas

### 4.4 Coordinador General (Gobierno/Jurisdiccion)

**Quien es:** El responsable de coordinar los 15 centros. Probablemente tu.

**Que hace:**
- Ve el dashboard general con todos los centros
- Identifica centros con desabasto para reasignar biologico
- Genera reportes consolidados para la Secretaria de Salud
- Administra usuarios y centros

**Cantidad estimada:** 1-3 personas

### 4.5 Publico General

**Quien es:** Ciudadanos que quieren saber si hay vacunas disponibles antes de ir al centro.

**Que hace:**
- Consulta una pagina web simple con la disponibilidad por centro
- Ve cuantos turnos quedan y tiempo estimado de espera
- Ve cuando se agotaron los turnos y cuando habra mas

**Cantidad estimada:** Potencialmente miles, pero NO interactuan con el sistema operativo.

### Resumen de usuarios internos

| Rol | Cantidad | Acceso |
|-----|----------|--------|
| Registrador | 15-30 | Modulo de registro unicamente |
| Aplicador | 15-45 | Modulo de aplicacion (marcar fichas) |
| Coordinador Centro | 15 | Dashboard de su centro + inventario |
| Coordinador General | 1-3 | Dashboard general + admin |
| **Total** | **~50-90 max** | |

---

## 5. ALCANCE FUNCIONAL

### 5.1 Dentro del alcance (SI se construye)

- Registro de fichas digitales con validacion de edad
- Generacion de QR con folio unico
- Pantalla de ficha optimizada para foto
- Control de inventario de biologico por centro y turno (SRP, SR y VPH)
- Logica de asignacion de SRP, SR y VPH segun edad/sexo/esquema
- Dashboard en tiempo real para coordinadores
- Panel publico de disponibilidad (pagina estatica)
- Busqueda de folio para marcar vacuna aplicada (flujo secuencial asistido)
- Bloqueo automatico cuando se agotan dosis
- Registro de auditoria (quien, que, cuando, donde)
- Exportacion de reportes CSV/Excel
- Persistencia offline con IndexedDB (el sistema no muere si se pierde internet)
- Panel del Coordinador para gestion de dispositivos: alta de registradores/vacunadores, generacion de URLs persistentes y distribucion de bloques de folios
- Protocolo de "Cortes Informativos Manuales" como respaldo cuando falla la conectividad de los dispositivos

### 5.2 Fuera del alcance (NO se construye)

- Registro de datos personales (nombre, CURP, domicilio)
- Padron nominal de vacunacion
- Integracion con SISMOS, SINBA u otros sistemas federales
- Notificaciones SMS/WhatsApp/Email
- Citas programadas o agenda previa
- Modo offline completo con sincronizacion bidireccional (se implementa un modo offline parcial basado en IndexedDB y bloques de folios pre-asignados; ver seccion 9.5)
- App nativa para iOS/Android
- Sistema de pago o cobro
- Expediente clinico electronico

---

## 6. FLUJO OPERATIVO DETALLADO

### 6.1 Inicio de Turno

```
7:50 AM  El coordinador del centro abre el sistema
         Selecciona su centro de salud
         Ingresa inventario del turno:
           - SRP: 120 dosis
           - VPH: 25 dosis
         El sistema fija el tope: maximo 120 fichas SRP, 25 fichas VPH
         El sistema habilita el modulo de registro
         El panel publico se actualiza: "CS Durango Centro: 120 turnos disponibles"
```

### 6.2 Llegada del Ciudadano

```
8:05 AM  Mama llega con su hijo de 7 anos al centro de salud
         Se dirige al modulo de vacunacion
         En la entrada hay una persona con una MeeBox (registrador)

REGISTRADOR:
  - "Buenos dias, cuantos anos tiene el menor?"
  - "7 anos"
  - "Es nino o nina?"
  - "Nino"
  - [Ingresa: 7 anos, 0 meses, Masculino]
  - [Sistema valida: 7 anos esta entre 6m y 12a = VALIDO]
  - [Sistema asigna: SRP]
  - [Sistema genera folio: PVU-001-0001]
  - [Pantalla muestra ficha con QR grande]

REGISTRADOR:
  - "Tomele foto a esta pantalla, es su turno"
  - "Su numero es el 1, le toca SRP"
  - "Pase a la fila de vacunacion"
  - [Presiona SIGUIENTE para limpiar pantalla]
```

### 6.3 Caso con VPH

```
8:12 AM  Papa llega con su hija de 11 anos

REGISTRADOR:
  - Ingresa: 11 anos, Femenino
  - Sistema detecta: mujer 11-12 anos = elegible VPH
  - Pantalla muestra pregunta: "Tiene esquema de VPH?"
  - Papa dice: "No, no se la han puesto"
  - Registrador marca: "No tiene VPH"
  - Sistema asigna: SRP + VPH
  - Se genera ficha con ambos biologicos
  - QR refleja los dos biologicos asignados
```

### 6.4 Caso de Rechazo

```
8:20 AM  Senora de 35 anos llega pidiendo vacuna

REGISTRADOR:
  - Ingresa: 35 anos
  - Sistema: EDAD FUERA DE RANGO
  - Pantalla muestra en rojo:
    "EDAD NO AUTORIZADA"
    "La vacunacion en esta fase es exclusiva para menores de 6 meses a 12 anos"
    "Consulte con su medico para opciones de vacunacion"
  - NO se genera ficha
  - NO se descuenta inventario
```

### 6.5 Aplicacion de Vacuna

```
8:30 AM  El menor con folio PVU-001-0001 llega con el vacunador

APLICADOR:
  - "Muestreme su ficha" (foto en el celular)
  - Lee el numero: 0001
  - En su pantalla busca: [0001] [BUSCAR]
  - Sistema muestra: "Folio PVU-001-0001 | SRP | 7 anos | Masculino"
  - Aplica la vacuna
  - Presiona [MARCAR APLICADA]
  - Sistema registra hora de aplicacion
```

### 6.6 Agotamiento de Dosis

```
12:45 PM  Inventario SRP: 5/120

  - Dashboard del coordinador muestra ALERTA AMARILLA
  - Panel publico: "CS Durango Centro: ULTIMOS 5 TURNOS"

1:10 PM   Inventario SRP: 0/120

  - Sistema BLOQUEA la generacion de fichas SRP en ese centro
  - Pantalla del registrador: "DOSIS AGOTADAS - NO SE PUEDEN GENERAR MAS FICHAS"
  - Panel publico: "CS Durango Centro: SIN DISPONIBILIDAD"
  - El registrador informa a la fila: "Se terminaron las vacunas por hoy"
```

### 6.7 Fin de Turno

```
2:00 PM  Coordinador cierra el turno

  - Sistema genera resumen automatico:
    - Fichas emitidas: 120
    - Vacunas aplicadas: 118
    - Fichas no utilizadas: 2 (personas que se fueron sin vacunarse)
    - VPH captadas: 8
    - Rechazos por edad: 34
  - Coordinador exporta reporte CSV
  - Datos quedan disponibles en el dashboard general
```

---

## 7. REGLAS DE NEGOCIO

### 7.1 Validacion de Edad y Asignacion de Biologico (SRP, SR, VPH)

| Edad | Resultado | Biologico |
|------|-----------|-----------|
| < 6 meses | RECHAZADO | Ninguno |
| 6 meses a 10 anos (cualquier sexo) | ACEPTADO | SRP |
| Mujer 11 anos | ACEPTADO | SR + pregunta VPH |
| Hombre 11 anos | ACEPTADO | SR + pregunta VPH |
| Mujer 12 anos | ACEPTADO | SR + pregunta VPH |
| Hombre 12 anos | ACEPTADO | SR |
| > 12 anos | RECHAZADO | Ninguno |

**Nota sobre SRP vs SR:**
- SRP (Triple Viral: Sarampion, Rubeola, Parotiditis) se aplica a menores de 6 meses a 10 anos.
- SR (Doble Viral: Sarampion, Rubeola) se aplica a mayores de 10 anos (11 y 12).
- El sistema determina automaticamente cual biologico corresponde segun la edad.

### 7.2 Logica de VPH

La pregunta de VPH SOLO aparece cuando la edad y sexo lo ameritan:
- Mujeres de 11 y 12 anos
- Hombres de 11 anos

El flujo es:
1. Sistema detecta elegibilidad VPH
2. Muestra pregunta: "El menor tiene esquema de VPH?"
3. Si responde NO → Se asignan SRP + VPH
4. Si responde SI → Se asigna solo SRP
5. Si hay dosis VPH = 0 → Se asigna solo SRP (no se pregunta)

### 7.3 Control de Inventario

- El inventario se captura al inicio de cada turno por el coordinador del centro: dosis SRP, dosis SR y dosis VPH por separado
- Cada ficha emitida resta 1 del biologico correspondiente (SRP o SR segun la edad)
- Si la ficha incluye SR + VPH, resta 1 de cada uno
- Cuando inventario de un biologico llega a 0, se bloquea la emision de fichas que lo requieran
- Si VPH = 0 pero SRP/SR > 0, se siguen emitiendo fichas SRP/SR (sin ofrecer VPH)
- El inventario NO se puede modificar una vez iniciado el turno (solo el coordinador general puede hacer ajustes de emergencia)

### 7.3.1 Distribucion de Bloques de Folios (Operacion Multi-Dispositivo)

Cuando hay mas de un registrador operando simultaneamente en un centro (ej. dos MeeBox), se asignan bloques de folios a cada dispositivo para evitar conflictos, especialmente en modo offline:

- El Coordinador asigna digitalmente "paquetes" de folios desde su panel: *"Dispositivo Reg-01: Folios 001-050"*, *"Dispositivo Reg-02: Folios 051-100"*
- Cada dispositivo solo puede emitir folios dentro de su rango asignado
- Cuando un dispositivo agota su bloque, solicita uno nuevo al Coordinador
- Esto garantiza que, incluso sin internet, dos dispositivos NUNCA generen el mismo folio
- Si solo hay 1 registrador por turno, no es necesario dividir en bloques

### 7.4 Folios

- Formato: `PVU-[CODIGO_CENTRO]-[CONSECUTIVO]`
- Ejemplo: `PVU-001-0047`
- El consecutivo es por centro, por dia, reinicia cada turno
- El folio es unico globalmente (la combinacion centro+fecha+consecutivo no se repite)

### 7.5 Estados de una Ficha

```
EMITIDA ──→ APLICADA                (vacuna aplicada exitosamente)
EMITIDA ──→ CANCELADA               (cancelacion manual por coordinador)
EMITIDA ──→ NO_UTILIZADA            (cierre de turno sin aplicar)
EMITIDA ──→ REEMITIDA               (se perdio el folio, se genero reemplazo)

CANCELADA ──→ (estado terminal, no se puede revertir)
APLICADA ──→ (estado terminal, no se puede revertir)
NO_UTILIZADA ──→ (estado terminal, no se puede revertir)
REEMITIDA ──→ (estado terminal, la ficha original queda muerta)
```

Toda transicion queda en auditoria con usuario, motivo y timestamp.

### 7.6 Alertas de Inventario

| Nivel | Condicion | Accion |
|-------|-----------|--------|
| VERDE | > 20% del inventario inicial | Operacion normal |
| AMARILLO | <= 20% y > 0 | Alerta visual en dashboard |
| ROJO | = 0 | Bloqueo de emision + aviso en panel publico |

---

## 8. SUPUESTOS, EXCEPCIONES Y FLUJOS ALTERNOS

Esta seccion documenta TODOS los escenarios que pueden salir del flujo normal. Cada uno tiene: que pasa, como responde el sistema, quien lo resuelve, y que queda registrado.

---

### 8.1 PERDIDA DE FOLIO

**Situacion:** El acompanante tomo foto de la ficha pero perdio la foto, se le apago el celular, la foto salio borrosa, o simplemente no le tomo foto.

**Flujo:**

```
1. Acompanante llega con el vacunador: "Se me borro la foto"
2. Vacunador NO puede hacer nada (no tiene el folio)
3. Acompanante regresa al punto de filtro (registrador)
4. Registrador llama al COORDINADOR del centro
5. Coordinador abre el modulo de busqueda de fichas del turno actual
6. Busca por hora aproximada de emision:
   "Hace como una hora, era un nino de 7 anos"
7. Sistema muestra fichas emitidas en ese rango:
   - PVU-001-0034 | 7a | M | EMITIDA | 09:45
   - PVU-001-0036 | 8a | F | EMITIDA | 09:48
8. Coordinador identifica la ficha correcta (PVU-001-0034)
9. Tiene dos opciones:
   a) Darle el numero verbalmente al acompanante → va con el vacunador
   b) Reemitir: marca la ficha original como REEMITIDA y genera una nueva
      con los mismos datos. La nueva ficha tiene folio nuevo.
```

**Reglas:**
- Solo el COORDINADOR puede buscar fichas y reemitir
- La ficha original queda con estado REEMITIDA y apunta al folio nuevo
- La ficha nueva tiene referencia a la ficha original
- Se registra en auditoria: quien reemitio, por que, ficha vieja y nueva
- El inventario NO se afecta (no se resta otra dosis, es la misma)

**Proteccion anti-fraude:**
- Si la ficha original aparece despues y alguien intenta usarla, el sistema muestra: "FICHA REEMITIDA - NO VALIDA. Folio reemplazo: PVU-001-0089"
- No se puede vacunar dos veces con la misma dosis logica

---

### 8.2 CANCELACION DE FICHA

**Situacion:** Se emitio una ficha pero la persona decide no vacunarse. Razones posibles:
- El nino esta llorando y la mama decide irse
- La mama se entero que el nino ya tenia la vacuna
- El nino tiene fiebre y el medico dice que no se le puede aplicar hoy
- La persona simplemente se fue de la fila

**Flujo:**

```
1. Acompanante informa al registrador: "Ya no quiero vacunarlo"
   O bien: el vacunador detecta que una ficha lleva 2+ horas sin aplicarse
2. Registrador informa al COORDINADOR
3. Coordinador busca la ficha por folio
4. Coordinador presiona [CANCELAR FICHA]
5. Sistema pide motivo (obligatorio, seleccion de lista):
   - "Acompanante desistio"
   - "Menor con contraindicacion"
   - "Menor ya vacunado previamente"
   - "Error de registro"
   - "Otro" (campo libre)
6. Sistema marca ficha como CANCELADA
7. CRITICO: El inventario se DEVUELVE (+1 dosis SRP, +1 VPH si aplica)
8. Se habilita la emision de una ficha mas
```

**Reglas:**
- Solo COORDINADOR o ADMIN pueden cancelar fichas
- El REGISTRADOR no puede cancelar (evita cancelaciones sin supervision)
- Motivo obligatorio, queda en auditoria
- La dosis se devuelve al inventario del turno
- Si el turno ya cerro, NO se puede cancelar (queda como NO_UTILIZADA)
- Una ficha APLICADA nunca se puede cancelar

**Proteccion anti-fraude:**
- Si un coordinador cancela un numero anormal de fichas (>10% del turno), el dashboard general marca una ALERTA
- El patron "emitir y cancelar repetidamente" se detecta en auditoria

---

### 8.3 INTENTO DE DUPLICACION POR CIUDADANO

**Situacion:** Una persona intenta obtener dos fichas. Escenarios:

**Escenario A: Misma persona, mismo centro, mismo turno**
```
1. Mama ya tiene ficha PVU-001-0034 para su hijo de 7 anos
2. Mama vuelve a formarse y dice: "Mi hijo tiene 7 anos"
3. Registrador genera ficha PVU-001-0067
4. Mama ahora tiene dos fichas para el mismo nino
```

**Como lo maneja el sistema:**
- El sistema NO puede detectar esto automaticamente porque no registra datos personales (nombre, CURP). Esta es una decision de diseno consciente: no se registran datos personales.
- La proteccion es OPERATIVA, no tecnologica:
  - El registrador debe estar en la entrada unica del modulo. Si alguien ya paso, no deberia poder volver a formarse sin que lo note.
  - El vacunador, al aplicar la segunda ficha, estaria vacunando al mismo nino dos veces. Un vacunador competente lo nota ("este nino ya paso").
  - En el peor caso: se desperdicia 1 dosis. Es un riesgo aceptable vs. la friccion de pedir CURP a cada persona.

**Escenario B: Misma persona, diferente centro**
```
1. Mama obtiene ficha en CS Durango Centro
2. Mama va a CS Mezquital y pide otra ficha
```

**Como lo maneja el sistema:**
- No se puede detectar automaticamente (no hay datos personales cruzados)
- Es un riesgo bajo: la mama tendria que trasladarse a otro centro, hacer fila de nuevo, y el nino recibiria doble dosis (que medicamente no es peligroso con SRP, solo es desperdicio)
- Mitigacion operativa: si en el futuro se detecta un patron, se puede agregar validacion por CURP como feature opcional

**Regla general:** El sistema prioriza velocidad y simplicidad sobre prevencion de duplicados. El costo de pedir CURP a 800 personas al dia es mayor que el costo de 2-3 dosis duplicadas.

---

### 8.4 INTENTO DE FRAUDE POR PERSONAL

Los fraudes posibles del personal y como se detectan:

**Fraude 1: Fichas fantasma**
Un registrador emite fichas sin que haya pacientes reales para desviar biologico.

```
Deteccion:
- Fichas emitidas que nunca se marcan como APLICADA = ratio anormal
- Si un centro tiene 80 fichas emitidas pero solo 50 aplicadas, hay 30 fichas fantasma
- El dashboard muestra el ratio emitidas/aplicadas por centro
- Un ratio < 90% dispara ALERTA en el dashboard general
- Auditoria muestra que usuario emitio esas fichas y a que hora
```

**Fraude 2: Inventario inflado**
Un coordinador declara 150 dosis cuando solo tiene 100, para tener fichas sobrantes.

```
Deteccion:
- Al cierre de turno, el sistema pide capturar "dosis fisicas sobrantes"
- Si declaro 150, emitio 150 fichas, aplico 100, y reporta 0 sobrantes:
  hay 50 dosis sin justificar
- Formula de integridad:
  dosis_iniciales = fichas_aplicadas + fichas_canceladas + fichas_no_utilizadas + sobrantes_fisicos
- Si no cuadra, el sistema marca DISCREPANCIA DE INVENTARIO
- Solo el ADMIN puede resolver discrepancias
```

**Fraude 3: Cancelacion masiva para reventa**
Un coordinador emite fichas, las cancela para recuperar inventario, y repite.

```
Deteccion:
- Numero de cancelaciones por turno se monitorea
- Alerta si cancelaciones > 10% de fichas emitidas
- Patron temporal: si se cancelan y reemiten fichas en rafaga, es sospechoso
- Cada cancelacion tiene motivo obligatorio - si todos dicen "otro", es bandera roja
```

**Fraude 4: Emision fuera de horario**
Un registrador emite fichas a las 3 AM sin pacientes.

```
Deteccion:
- Toda ficha tiene timestamp de emision
- Fichas emitidas fuera del horario del turno se marcan automaticamente como ANOMALIA
- El reporte de auditoria filtra por hora y muestra actividad fuera de horario
```

**Fraude 5: Uso de credenciales ajenas**
Alguien usa la cuenta de otro para operar.

```
Mitigacion:
- Cada sesion registra IP
- Si un usuario esta activo en dos IPs simultaneamente, se invalida la sesion mas antigua
- El JWT expira en 8 horas, forzando relogin diario
```

---

### 8.5 FOLIO YA APLICADO (INTENTO DE REUTILIZACION)

**Situacion:** Alguien presenta una foto de un folio que ya fue marcado como APLICADA.

**Flujo:**

```
1. Vacunador ingresa folio: 0034
2. Sistema muestra en ROJO:
   "FICHA YA APLICADA"
   "Este folio fue utilizado a las 09:52 AM"
   "No se puede aplicar nuevamente"
3. Vacunador informa al acompanante
4. NO se aplica vacuna
5. El intento queda registrado en auditoria como INTENTO_REUTILIZACION
```

**Reglas:**
- Una ficha APLICADA es terminal. No hay vuelta atras.
- El sistema NUNCA permite marcar una ficha aplicada dos veces
- Cada intento de reutilizacion se registra con usuario, folio, hora

---

### 8.6 FOLIO DE OTRO CENTRO

**Situacion:** Una persona obtuvo ficha en CS Durango Centro pero se fue a CS Mezquital a vacunarse.

**Flujo:**

```
1. Vacunador en CS Mezquital ingresa folio: PVU-001-0034
2. El sistema encuentra la ficha (los folios son globales)
3. Sistema muestra ADVERTENCIA AMARILLA:
   "FICHA DE OTRO CENTRO"
   "Emitida en: CS Durango Centro"
   "Centro actual: CS Mezquital"
   [APLICAR DE TODAS FORMAS]  [RECHAZAR]
4. Si el vacunador aplica:
   - La ficha se marca como APLICADA
   - Se registra que se aplico en centro diferente al de emision
   - El inventario del centro DONDE SE APLICA se decrementa
   - El inventario del centro de emision se DEVUELVE (+1)
5. Si el vacunador rechaza:
   - Se informa al acompanante que debe ir al centro original
```

**Reglas:**
- El sistema PERMITE aplicar fichas de otros centros (la prioridad es vacunar al nino)
- Pero queda registrado como APLICACION_CRUZADA en auditoria
- Los inventarios se ajustan automaticamente entre centros
- Solo funciona si ambos centros tienen turno abierto

---

### 8.7 PERSONA LLEGA SIN FICHA AL VACUNADOR

**Situacion:** Alguien se brinca el filtro y llega directo con el vacunador sin ficha.

**Flujo:**

```
1. Vacunador: "Muestreme su ficha"
2. Acompanante: "No me dieron ficha" / "No sabia que tenia que pasar"
3. Vacunador: "Pase primero al registro en la entrada"
4. Acompanante regresa al filtro y sigue el flujo normal
```

**Regla del sistema:**
- El vacunador NO puede generar fichas (su rol es APLICADOR)
- Para marcar una vacuna como APLICADA, DEBE existir un folio
- No hay forma de registrar una aplicacion sin ficha previa
- Esto OBLIGA a que todos pasen por el filtro

**Excepcion unica:** Si el coordinador del centro autoriza una "ficha de emergencia" (ejemplo: menor en estado critico que necesita vacunacion inmediata), el coordinador genera la ficha y el vacunador la aplica. Queda registrada como FICHA_EMERGENCIA en auditoria.

---

### 8.8 ERROR DE REGISTRO (EDAD O SEXO INCORRECTO)

**Situacion:** El registrador capturo mal la edad o el sexo.

**Escenario A: Error detectado ANTES de aplicar**

```
1. Registrador se da cuenta: "Le puse 7 anos pero tiene 11"
2. Registrador informa al COORDINADOR
3. Coordinador cancela la ficha (motivo: "Error de registro")
4. Dosis se devuelve al inventario
5. Registrador genera nueva ficha con datos correctos
6. Ahora el sistema detecta elegibilidad VPH (11 anos)
```

**Escenario B: Error detectado DESPUES de aplicar**

```
1. Ya se aplico SRP al menor de 11 anos, pero sin VPH porque
   el registro decia 7 anos
2. El error se detecta despues
3. Coordinador NO puede revertir la aplicacion (ya se puso la vacuna)
4. Coordinador genera una ficha manual de tipo "CORRECCION"
   con los datos correctos y asignacion de VPH solamente
5. El menor recibe VPH con la ficha de correccion
6. Ambas fichas quedan ligadas en auditoria
```

**Reglas:**
- Fichas canceladas por error NO cuentan como desperdicio
- Fichas de correccion son un tipo especial que solo el COORDINADOR puede emitir
- El error se documenta con ficha original y ficha correctiva

---

### 8.9 MULTIPLE MENORES CON UN SOLO ACOMPANANTE

**Situacion:** Una mama llega con 3 hijos de 2, 7 y 11 anos.

**Flujo:**

```
1. Registrador genera ficha para hijo de 2 anos → PVU-001-0045 (SRP)
2. Mama le toma foto
3. Registrador genera ficha para hijo de 7 anos → PVU-001-0046 (SRP)
4. Mama le toma foto
5. Registrador genera ficha para hija de 11 anos → PVU-001-0047 (SRP + VPH)
6. Mama le toma foto
7. Mama tiene 3 fotos, una por hijo
8. Se forman los 3 en la fila de vacunacion
```

**Reglas:**
- No hay limite de fichas por acompanante
- Cada ficha es independiente
- El acompanante debe tener UNA FOTO POR HIJO (no una foto con los 3)
- Si la mama pierde una foto, se reemite solo esa ficha (ver 8.1)

---

### 8.10 FICHA EMITIDA PERO TURNO CERRADO ANTES DE APLICAR

**Situacion:** Se emitio ficha a las 12:30 PM, el turno cerro a la 1:00 PM, y la persona aun no pasaba con el vacunador.

**Flujo:**

```
1. Coordinador intenta cerrar turno
2. Sistema muestra ADVERTENCIA:
   "Hay 8 fichas EMITIDAS sin aplicar"
   "Si cierra el turno, estas fichas pasaran a NO_UTILIZADA"
   [ESPERAR] [CERRAR DE TODAS FORMAS]
3. Opcion A: Coordinador espera a que se apliquen
4. Opcion B: Coordinador cierra
   - Las 8 fichas pasan a NO_UTILIZADA
   - Las 8 dosis correspondientes se consideran SOBRANTES FISICOS
   - El coordinador debe reportar esas dosis como disponibles para el siguiente turno
```

**Reglas:**
- El cierre de turno con fichas pendientes SIEMPRE muestra advertencia
- Las fichas NO_UTILIZADA no se pueden recuperar despues del cierre
- Las dosis fisicas correspondientes siguen existiendo y se recargan en el proximo turno
- Se registra en auditoria: cierre con fichas pendientes, cuantas, motivo

---

### 8.11 INTENTO DE ABRIR DOS TURNOS SIMULTANEOS

**Situacion:** Un coordinador intenta abrir turno matutino cuando ya hay uno abierto.

**Flujo:**

```
1. Coordinador presiona "Abrir Turno Matutino"
2. Sistema detecta: ya existe un turno MATUTINO abierto hoy para este centro
3. Sistema muestra en ROJO:
   "YA EXISTE UN TURNO ABIERTO"
   "Turno Matutino abierto a las 07:55 por usuario: coord.maria"
   "Cierre el turno actual antes de abrir otro"
4. NO se permite abrir otro turno
```

**Reglas:**
- Maximo 1 turno abierto por centro a la vez
- Para abrir vespertino, primero hay que cerrar matutino
- Solo COORDINADOR y ADMIN pueden abrir/cerrar turnos
- No se puede abrir un turno con 0 dosis (minimo 1 SRP)

---

### 8.12 VPH AGOTADO A MITAD DE TURNO

**Situacion:** Se capturaron 25 dosis VPH al inicio. A las 10 AM se acabaron. Llega una nina de 11 anos.

**Flujo:**

```
1. Registrador ingresa: 11 anos, Femenino
2. Sistema detecta: elegible para VPH
3. Sistema detecta: VPH disponible = 0
4. Sistema NO pregunta por VPH (no hay dosis)
5. Sistema asigna SOLO SRP
6. La ficha queda con:
   - asigna_srp = TRUE
   - asigna_vph = FALSE
   - vph_preguntado = FALSE (no se pregunto porque no habia)
7. Registrador informa: "Solo le toca SRP hoy, VPH no hay disponible"
```

**Reglas:**
- Si VPH = 0, la pregunta de VPH no aparece (no genera expectativas falsas)
- La ficha registra que NO se pregunto y la razon implicita es el desabasto
- El reporte muestra "oportunidades VPH perdidas por desabasto" como metrica
- Cuando llegue mas VPH, esas personas no estan registradas (no hay forma de avisarles porque no hay datos personales)

---

### 8.13 DISCREPANCIA DE INVENTARIO AL CIERRE

**Situacion:** El coordinador declaro 120 dosis. Se emitieron 120 fichas. Se aplicaron 115. Al cerrar, dice que le sobran 0 dosis fisicas. Faltan 5 dosis.

**Flujo:**

```
1. Coordinador cierra turno
2. Sistema pide: "Cuantas dosis SRP le sobraron fisicamente?"
3. Coordinador ingresa: 0
4. Sistema calcula:
   - Declaradas: 120
   - Aplicadas: 115
   - Canceladas: 0
   - No utilizadas: 5
   - Sobrantes reportados: 0
   - Balance: 120 - 115 - 0 - 5 - 0 = 0 ✓ (pero 5 fichas no utilizadas sin dosis sobrante)
5. Sistema muestra ALERTA:
   "5 fichas NO UTILIZADAS pero 0 dosis sobrantes"
   "Las dosis correspondientes deberian estar fisicamente disponibles"
   "Por favor verifique su conteo"
6. Coordinador puede:
   a) Corregir sobrantes a 5 → balance cuadra
   b) Confirmar 0 sobrantes → se registra DISCREPANCIA
```

**Reglas:**
- La formula de integridad siempre se verifica al cierre:
  `declaradas = aplicadas + canceladas_devueltas + no_utilizadas + sobrantes_fisicos`
- Si no cuadra, se registra DISCREPANCIA en auditoria
- El ADMIN recibe alerta de discrepancia en el dashboard general
- Las discrepancias recurrentes en un centro disparan investigacion

---

### 8.14 FOLIO INEXISTENTE

**Situacion:** El vacunador teclea un folio que no existe en el sistema.

**Flujo:**

```
1. Vacunador ingresa: 9999
2. Sistema busca PVU-[centro]-9999
3. No existe
4. Sistema muestra: "FOLIO NO ENCONTRADO"
5. Opciones para el vacunador:
   - Verificar el numero con el acompanante
   - Buscar por rango: "Folios emitidos entre 09:00 y 10:00" (solo lectura)
   - Llamar al coordinador
```

**Causas posibles:**
- El vacunador tecleo mal (la mas comun, se corrige reintentando)
- La foto esta borrosa y el numero se lee mal
- La ficha es de ayer (folios del turno anterior ya no aparecen en busqueda rapida)
- La ficha es falsa (alguien fabrico un folio que no existe)

**Reglas:**
- El sistema registra busquedas fallidas en auditoria
- Si hay multiples busquedas fallidas seguidas, puede indicar un problema sistematico

---

### 8.15 FOTO MANIPULADA / QR FALSO

**Situacion:** Alguien edita la foto de la ficha para cambiar el biologico o el folio.

**Flujo:**

```
1. Acompanante muestra foto con folio PVU-001-0034
2. Vacunador ingresa 0034
3. Sistema muestra los datos REALES de la ficha:
   "PVU-001-0034 | SRP | 7 anos | Masculino"
4. Si la foto dice "SRP + VPH" pero el sistema dice "SRP",
   el sistema tiene la verdad
5. El vacunador aplica lo que dice el SISTEMA, no lo que dice la FOTO
```

**Proteccion de diseno:**
- La foto/QR es solo un REFERENCIA para el folio. No es la fuente de verdad.
- La fuente de verdad SIEMPRE es la base de datos
- El QR solo contiene el folio (no biologico, no edad, no centro)
- Asi, editar el QR no cambia nada: el vacunador busca el folio y ve los datos reales
- No hay forma de "hackear" una ficha editando la foto

---

### 8.16 REGISTRADOR ABANDONA EL PUESTO

**Situacion:** El registrador se va al bano, a comer, o simplemente deja de atender. La fila crece.

**Flujo:**

```
1. El sistema no genera fichas automaticamente. Si el registrador no opera, no hay fichas.
2. El dashboard del coordinador muestra: "Ultima ficha emitida hace 25 minutos"
3. Si pasan mas de 15 minutos sin actividad, el dashboard marca:
   "CENTRO SIN ACTIVIDAD - CS Durango Centro"
4. Coordinador general lo ve y actua (llamada, visita)
```

**Reglas:**
- El sistema detecta inactividad por ausencia de emision de fichas
- No se bloquea la sesion por inactividad (el registrador puede retomar sin relogin)
- La inactividad queda implicita en el log temporal de fichas

---

### 8.17 ACOMPANANTE LLEGA DESPUES DE CIERRE DE TURNO

**Situacion:** Tiene ficha del turno matutino pero llega a las 3 PM (turno vespertino).

**Flujo:**

```
1. Vacunador busca folio del turno matutino
2. Sistema muestra:
   "FICHA DE TURNO CERRADO"
   "Turno: Matutino (cerrado a las 13:00)"
   "Estado: NO_UTILIZADA"
3. La ficha ya no es valida
4. El acompanante debe obtener nueva ficha en el turno vespertino
   (si hay disponibilidad)
```

**Reglas:**
- Fichas de turnos cerrados NO se pueden aplicar
- El acompanante debe pasar nuevamente por el filtro
- Se genera nueva ficha, se resta del inventario del turno vespertino
- No hay "pase automatico" entre turnos

---

### 8.18 CAIDA DEL SISTEMA DURANTE EMISION DE FICHA

**Situacion:** El registrador presiono GENERAR pero el servidor no respondio.

**Flujo:**

```
1. Registrador presiona GENERAR FICHA
2. La pantalla muestra "Procesando..."
3. Timeout de 10 segundos: no hay respuesta
4. Pantalla muestra: "ERROR DE CONEXION - No se pudo generar la ficha"
   [REINTENTAR]
5. Registrador presiona REINTENTAR
6. Si el servidor ya proceso la primera peticion:
   - El backend detecta la peticion duplicada (mismos datos + ventana de 60 seg)
   - Devuelve la ficha ya generada (idempotencia)
7. Si el servidor NO proceso la primera:
   - Genera la ficha normalmente
```

**Proteccion tecnica:**
- El endpoint de emision de fichas es IDEMPOTENTE
- Si se reciben dos peticiones identicas en menos de 60 segundos del mismo usuario, se devuelve la misma ficha
- Esto evita doble emision por timeout/reintento
- La idempotencia se implementa con un token unico por peticion generado en el frontend

---

### 8.19 INTENTO DE OPERAR SIN TURNO ABIERTO

**Situacion:** El registrador intenta generar fichas pero nadie abrio el turno.

**Flujo:**

```
1. Registrador abre el modulo de registro
2. Sistema detecta: no hay turno abierto para este centro hoy
3. Pantalla muestra:
   "NO HAY TURNO ABIERTO"
   "El coordinador debe abrir el turno e ingresar el inventario
    antes de poder generar fichas"
4. El boton GENERAR FICHA esta DESHABILITADO (gris, no clickeable)
5. El registrador llama al coordinador
```

**Reglas:**
- No se puede emitir fichas sin turno abierto
- No se puede abrir turno sin declarar inventario > 0
- El registrador ve claramente POR QUE no puede operar

---

### 8.20 RESUMEN DE ESTADOS TERMINALES Y TRANSICIONES

```
ESCENARIO                          ESTADO FINAL      DOSIS DEVUELTA   QUIEN RESUELVE
─────────────────────────────────────────────────────────────────────────────────────
Flujo normal exitoso               APLICADA           No               Aplicador
Persona se va sin vacunarse        NO_UTILIZADA       Al sig. turno    Auto (cierre)
Cancelacion voluntaria             CANCELADA          Si               Coordinador
Error de registro                  CANCELADA          Si               Coordinador
Folio perdido, se reemite          REEMITIDA          No (misma dosis) Coordinador
Cierre de turno forzado            NO_UTILIZADA       Al sig. turno    Coordinador
Ficha de emergencia                APLICADA           No               Coordinador
Ficha de correccion                APLICADA           No               Coordinador
Aplicacion en otro centro          APLICADA           Ajuste cruzado   Aplicador
```

### 8.21 DIAGRAMA DE FLUJO MAESTRO CON TODAS LAS SALIDAS

```
CIUDADANO LLEGA AL CENTRO
        |
        v
  [TIENE MENOR DE EDAD?]
        |
   NO───┘───SI
   |         |
   v         v
 "Vacunacion   [FILTRO: REGISTRADOR]
  solo para         |
  menores"    [INGRESA EDAD + SEXO]
  (se va)           |
                    v
            [EDAD 6m - 12a?]
                |
           NO───┘───SI
           |         |
           v         v
      RECHAZADO   [TURNO ABIERTO?]
      (se registra    |
       en rechazos) NO─┘───SI
                   |       |
                   v       v
              "Espere a  [INVENTARIO > 0?]
               que abran     |
               turno"    NO──┘───SI
                         |       |
                         v       v
                    "Dosis    [ELEGIBLE VPH?]
                     agotadas"    |
                     (se va)  NO──┘───SI
                              |       |
                              v       v
                         Solo SRP  [TIENE VPH?]
                              |     |       |
                              |   SI─┘     NO
                              |   |         |
                              |   v         v
                              | Solo SRP  SRP + VPH
                              |   |         |
                              └───┴────┬────┘
                                       |
                                       v
                              [GENERA FICHA + QR]
                                       |
                                       v
                              [ACOMPANANTE TOMA FOTO]
                                       |
                              ┌────────┼────────┐
                              |        |        |
                              v        v        v
                         No tomo   Tomo foto  Foto
                         foto      OK         borrosa
                         (ver 8.1) |          (ver 8.1)
                                   |
                                   v
                              [FILA DE VACUNACION]
                                   |
                         ┌─────────┼──────────────┐
                         |         |              |
                         v         v              v
                    Se fue      Llega con      Llega sin
                    (ver 8.2)   el vacunador   folio
                                   |           (ver 8.7)
                                   v
                              [VACUNADOR BUSCA FOLIO]
                                   |
                    ┌──────┬───────┼───────┬──────────┐
                    |      |       |       |          |
                    v      v       v       v          v
                No existe  Ya     Otro   Turno     ENCONTRADA
                (ver 8.14) aplicada centro cerrado  estado OK
                           (8.5)  (8.6)  (8.17)      |
                                                      v
                                                [APLICA VACUNA]
                                                      |
                                                      v
                                                [MARCA APLICADA]
                                                      |
                                                      v
                                                   FIN ✓
```

---

## 9. MODULOS DEL SISTEMA

### 9.1 Modulo de Registro (Registrador)

**Proposito:** Emitir fichas digitales validando edad y biologico.

**Pantalla principal:**
- Campo: Edad en anos (numerico, 0-15)
- Campo: Edad en meses (numerico, 0-11)
- Selector: Sexo (Masculino / Femenino)
- Indicador: "Turnos disponibles SRP: XX/YY"
- Indicador: "Turnos disponibles VPH: XX/YY"
- Boton: GENERAR FICHA (grande, centrado, imposible de confundir)

**Pantalla de ficha (para foto):**
- Folio en texto grande (legible a 1 metro)
- QR centrado y grande (conteniendo el folio)
- Biologico asignado: "SRP" o "SRP + VPH"
- Numero de turno
- Hora de emision
- Nombre del centro de salud
- Leyenda: "PRESENTE ESTA PANTALLA AL VACUNADOR"
- Boton: SIGUIENTE (limpia pantalla para el proximo)

**Pantalla de rechazo:**
- Mensaje en rojo: "EDAD NO AUTORIZADA"
- Texto explicativo breve
- Boton: SIGUIENTE

**Pantalla de pregunta VPH (condicional):**
- "El menor tiene esquema de VPH aplicado?"
- Boton: SI (asigna solo SRP)
- Boton: NO (asigna SRP + VPH)

**Restricciones de diseno:**
- Maximo 3 campos de entrada
- Botones minimo 48px de alto (touch friendly)
- Texto minimo 16px
- Colores de alto contraste
- Sin menus, sin navegacion compleja, sin scroll

### 9.2 Modulo de Aplicacion (Vacunador) — Flujo Secuencial Asistido

**Proposito:** Marcar fichas como aplicadas con la menor friccion posible.

**Concepto clave: Prediccion Inteligente de Cola (FIFO)**
La fila se respeta en un ~95% de los casos. En lugar de obligar al vacunador a escribir o escanear cada folio, el sistema PREDICE quien sigue y solo pide confirmacion.

**Pantalla principal:**
- Muestra en grande: "SIGUIENTE: FOLIO 0045" (basado en el consecutivo anterior)
- Datos del paciente (si estan en cache): "Nino 7 anios - SRP"
- Boton de vacuna dinamico segun edad:
  - Si es <10 anios: Boton dice **[APLICAR SRP]** (naranja)
  - Si es >10 anios: Boton dice **[APLICAR SR]** (morado)
  - Si es 11 anios mujer: Muestra dos botones **[SR]** y **[VPH]**
- Lista: Ultimas 10 fichas aplicadas (para referencia)

**Interaccion (3 escenarios):**

- **Escenario A (95% - Flujo Normal):** Llega el nino. Vacunador pregunta: "Trae el 45?". Mama: "Si". Vacunador presiona boton gigante [CONFIRMAR Y APLICAR]. Listo. 1 segundo.
- **Escenario B (Se saltaron uno):** Mama dice "No, soy el 46, el 45 fue al bano". Vacunador presiona [SALTAR]. Sistema muestra FOLIO 0046. Vacunador confirma.
- **Escenario C (Desorden total):** Vacunador presiona boton pequeno [Teclado Manual]. Se abre teclado numerico grande. Digita el folio manualmente. Solo necesario en casos excepcionales.

**Seguridad Anti-Error:**
- Si el folio no ha sido emitido o ya fue aplicado, el sistema vibra y muestra error rojo
- La validacion ocurre contra la base de datos local (sincronizada previamente o por logica de rangos)

**Por que NO se escanea QR:**
- El vacunador tiene guantes puestos
- Manipular camara/celular entre pacientes es antihigienico
- El flujo secuencial (1 click) es mas rapido que enfocar un QR
- No depende de calidad de la foto del acompanante

### 9.3 Modulo de Inventario y Gestion (Coordinador de Centro)

**Proposito:** Configurar dosis disponibles, administrar dispositivos y personal, y servir como respaldo de datos ante fallas de conectividad.

**Pantalla de inicio de turno:**
- Selector: Turno (Matutino / Vespertino)
- Campo: Dosis SRP disponibles (numerico)
- Campo: Dosis SR disponibles (numerico)
- Campo: Dosis VPH disponibles (numerico)
- Boton: INICIAR TURNO (una vez presionado, los numeros quedan fijos)

**Pantalla de monitoreo de centro:**
- Barra de progreso SRP: emitidas / total
- Barra de progreso SR: emitidas / total
- Barra de progreso VPH: emitidas / total
- Fichas aplicadas vs fichas emitidas
- Lista de fichas del turno actual

**Seccion: Gestion de Usuarios y Dispositivos:**
- Boton: **[CREAR REGISTRADOR]** → Genera URL unica persistente (ej. `pvu.mx/r/centro01-reg01-tokenXYZ`)
- Boton: **[CREAR VACUNADOR]** → Genera URL unica persistente (ej. `pvu.mx/v/centro01-vac01-tokenABC`)
- Tabla de usuarios activos con su URL, rol, y estado de conexion
- Boton: **[REVOCAR ACCESO]** para desactivar una URL
- Las URLs no caducan por turno; se instalan como PWA en los dispositivos y recuerdan su configuracion hasta ser revocadas
- El Coordinador configura fisicamente los equipos (MeeBox o celulares) usando estos links al inicio del operativo

**Seccion: Distribucion de Bloques de Folios:**
- Tabla de dispositivos activos con bloques asignados
- Boton: **[ASIGNAR BLOQUE]** → Permite repartir rangos de folios a cada dispositivo (ej. "Reg-01: 001-050", "Reg-02: 051-100")
- Solo necesario cuando hay mas de 1 registrador en el centro

**Seccion: Cortes Informativos Manuales (Respaldo):**
Se utiliza UNICAMENTE cuando falla la conectividad automatica de los dispositivos (MeeBox sin internet).
- Si hay internet: los dispositivos sincronizan solos y el Coordinador solo monitorea
- Si NO hay internet en los dispositivos:
  - El Coordinador camina a las MeeBox y lee el contador en pantalla
  - Desde su celular (datos moviles propios), accede a "Reportar Corte Manual"
  - Ingresa: hora del corte y dosis restantes por biologico
  - Al enviar, se actualiza el Dashboard Central y el Panel Publico

### 9.4 Modulo Dashboard (Coordinador General)

**Proposito:** Vision general de los 15 centros en tiempo real.

**Pantalla principal:**
- Tabla de centros con columnas:
  - Centro | SRP emitidas/total | SR emitidas/total | VPH emitidas/total | Aplicadas | Estado
- Semaforo por centro (verde/amarillo/rojo)
- Totales consolidados
- Filtros: por municipio, por estado de alerta

**Pantalla de reportes:**
- Seleccionar rango de fechas
- Exportar a CSV
- Datos: fichas por centro, por dia, por biologico (SRP, SR, VPH), fichas no utilizadas, rechazos por edad, captacion VPH

**Pantalla de administracion:**
- Alta/baja de centros de salud
- Alta/baja de usuarios
- Asignacion de roles
- Ajuste de emergencia de inventario (con registro en auditoria)

### 9.5 Modulo de Persistencia Offline (Todos los Roles)

**Proposito:** Garantizar que el sistema no deje de funcionar si se pierde la conexion a internet en los dispositivos.

**Tecnologia:** IndexedDB (base de datos en el navegador) + Service Worker (PWA) + Background Sync.

**Funcionamiento:**
- **Con internet:** Cada accion (emitir ficha, marcar aplicada) se envia al servidor en tiempo real y se guarda localmente como respaldo.
- **Sin internet:** Las acciones se guardan en IndexedDB (cola de salida). El sistema sigue funcionando normalmente con los datos locales y los bloques de folios pre-asignados.
- **Al recuperar internet:** El Service Worker sube automaticamente las acciones pendientes en segundo plano (Background Sync), incluso si el usuario cerro la pestana.

**Indicador visual:**
- Barra superior verde: "CONECTADO" (operacion normal)
- Barra superior naranja: "MODO CONTINGENCIA - Sin conexion" (operando localmente)

---

## 10. MODELO DE DATOS

### 10.1 Entidades

```sql
-- CENTROS DE SALUD
CREATE TABLE centros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo VARCHAR(10) UNIQUE NOT NULL,    -- 'CS001'
    nombre VARCHAR(100) NOT NULL,          -- 'CS Durango Centro'
    municipio VARCHAR(50) NOT NULL,        -- 'Durango'
    activo BOOLEAN DEFAULT 1
);

-- USUARIOS
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    centro_id INTEGER,
    rol VARCHAR(20) NOT NULL,              -- 'REGISTRADOR','APLICADOR','COORDINADOR','ADMIN'
    activo BOOLEAN DEFAULT 1,
    FOREIGN KEY (centro_id) REFERENCES centros(id)
);

-- TURNOS (un turno = una sesion de vacunacion en un centro)
CREATE TABLE turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    tipo VARCHAR(15) NOT NULL,             -- 'MATUTINO', 'VESPERTINO'
    srp_inicial INTEGER NOT NULL,          -- dosis SRP cargadas
    sr_inicial INTEGER NOT NULL DEFAULT 0, -- dosis SR (Doble Viral) cargadas
    vph_inicial INTEGER NOT NULL,          -- dosis VPH cargadas
    srp_emitidas INTEGER DEFAULT 0,        -- fichas SRP emitidas
    sr_emitidas INTEGER DEFAULT 0,         -- fichas SR emitidas
    vph_emitidas INTEGER DEFAULT 0,        -- fichas VPH emitidas
    srp_aplicadas INTEGER DEFAULT 0,       -- SRP efectivamente aplicadas
    sr_aplicadas INTEGER DEFAULT 0,        -- SR efectivamente aplicadas
    vph_aplicadas INTEGER DEFAULT 0,       -- VPH efectivamente aplicadas
    abierto BOOLEAN DEFAULT 1,
    usuario_apertura INTEGER NOT NULL,
    ts_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
    ts_cierre DATETIME,
    FOREIGN KEY (centro_id) REFERENCES centros(id),
    FOREIGN KEY (usuario_apertura) REFERENCES usuarios(id)
);

-- FICHAS
CREATE TABLE fichas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio VARCHAR(20) UNIQUE NOT NULL,     -- 'PVU-001-0047'
    turno_id INTEGER NOT NULL,
    consecutivo INTEGER NOT NULL,
    edad_anios INTEGER NOT NULL,
    edad_meses INTEGER NOT NULL,
    sexo CHAR(1) NOT NULL,                 -- 'M' o 'F'
    asigna_srp BOOLEAN DEFAULT 0,          -- Triple Viral (6m-10a)
    asigna_sr BOOLEAN DEFAULT 0,           -- Doble Viral (11-12a)
    asigna_vph BOOLEAN DEFAULT 0,
    vph_preguntado BOOLEAN DEFAULT 0,      -- se le pregunto por VPH?
    vph_tenia BOOLEAN DEFAULT 0,           -- ya tenia VPH?
    estado VARCHAR(15) DEFAULT 'EMITIDA',  -- 'EMITIDA','APLICADA','NO_UTILIZADA','CANCELADA','REEMITIDA'
    motivo_cancelacion VARCHAR(100),       -- razon de cancelacion/reemision (si aplica)
    folio_reemplazo VARCHAR(20),           -- folio nuevo si fue reemitida
    ts_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    ts_aplicacion DATETIME,
    usuario_registro_id INTEGER NOT NULL,
    usuario_aplicacion_id INTEGER,
    FOREIGN KEY (turno_id) REFERENCES turnos(id),
    FOREIGN KEY (usuario_registro_id) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_aplicacion_id) REFERENCES usuarios(id)
);

-- AUDITORIA
CREATE TABLE auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion VARCHAR(50) NOT NULL,           -- 'FICHA_EMITIDA','FICHA_APLICADA','TURNO_ABIERTO', etc.
    entidad VARCHAR(20),                   -- 'ficha','turno','inventario'
    entidad_id INTEGER,
    detalle TEXT,
    ip VARCHAR(45),
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- RECHAZOS (para estadisticas)
CREATE TABLE rechazos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    edad_anios INTEGER NOT NULL,
    edad_meses INTEGER NOT NULL,
    sexo CHAR(1),
    motivo VARCHAR(50) NOT NULL,           -- 'MENOR_6M','MAYOR_12A'
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

-- CORTES MANUALES (respaldo cuando falla internet en dispositivos)
CREATE TABLE cortes_manuales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,           -- coordinador que reporto
    srp_restantes INTEGER,
    sr_restantes INTEGER,
    vph_restantes INTEGER,
    notas TEXT,
    ts TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turno_id) REFERENCES turnos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- BLOQUES DE FOLIOS (asignacion a dispositivos)
CREATE TABLE bloques_folios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    dispositivo_token TEXT NOT NULL,        -- token del dispositivo registrador
    folio_inicio INTEGER NOT NULL,
    folio_fin INTEGER NOT NULL,
    consumidos INTEGER DEFAULT 0,
    ts_asignacion TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
);
```

### 10.2 Notas sobre el modelo

**Por que no hay tabla de inventario separada?**
Porque el inventario esta implicito en la tabla `turnos`. Si un turno tiene `srp_inicial = 120` y `srp_emitidas = 47`, entonces quedan `120 - 47 = 73` dosis. No se necesita una tabla mas.

**Por que hay tabla de rechazos?**
Porque es dato valioso. Si en un centro se rechazan 200 personas por dia, eso indica que la comunicacion al publico esta fallando y hay que reforzar el mensaje de que solo es para menores.

**Por que no se guardan datos personales?**
Porque no es el proposito del sistema. Agregar nombre/CURP/domicilio triplicaria la friccion en el registro, requeriria manejo de datos sensibles (INAI), y no aporta al objetivo de controlar flujo y turnos.

---

## 11. ARQUITECTURA TECNICA

### 11.1 Principios de Diseno

1. **Minimalismo extremo:** Menos codigo = menos bugs = menos mantenimiento
2. **Zero cost:** Todo con herramientas gratuitas y open source
3. **Hardware existente:** Funciona en MeeBox 2018 con navegador web
4. **Despliegue en minutos:** No en semanas
5. **Un solo punto de verdad:** Una base de datos, un servidor

### 11.2 Stack Tecnico

| Componente | Tecnologia | Justificacion |
|-----------|------------|---------------|
| Frontend | HTML + CSS + JavaScript vanilla | No necesita React para 3 pantallas simples. Menos complejidad, menos build, corre en cualquier navegador |
| Backend | Python (FastAPI) o Node.js (Express) | Un archivo, un proceso, API REST simple |
| Base de datos | SQLite | Archivo unico, sin servidor de BD, portable, respaldo = copiar archivo |
| QR | Libreria qrcode (JS en front o Python en back) | El QR solo contiene el folio, no datos |
| Hosting | Servidor local o VPS gratuito (Oracle Cloud Free, Railway) | Para 50 usuarios no se necesita nada potente |
| Panel publico | Archivo JSON estatico servido desde CDN gratuito | Cero carga al servidor principal |

### 11.3 Diagrama de Componentes

```
                    INTERNET
                       |
            +----------+----------+
            |                     |
    [Panel Publico]        [Sistema TURNO-PVU]
    HTML estatico +        Backend (API REST)
    JSON con cache              |
    (CDN gratuito)          [SQLite]
                               |
                    +----------+----------+
                    |          |          |
              [Registro] [Aplicacion] [Dashboard]
              MeeBox #1   MeeBox #2   MeeBox #3
              (por centro) (por centro) (coordinador)
```

### 11.4 API REST

```
POST   /api/auth/login              - Iniciar sesion
POST   /api/auth/logout             - Cerrar sesion

GET    /api/centros                  - Listar centros activos
POST   /api/centros                  - Crear centro (admin)

POST   /api/turnos/abrir            - Abrir turno con inventario
POST   /api/turnos/cerrar           - Cerrar turno
GET    /api/turnos/activo/:centroId  - Turno activo de un centro

POST   /api/fichas                  - Emitir ficha nueva
GET    /api/fichas/:folio           - Consultar ficha por folio
PATCH  /api/fichas/:folio/aplicar   - Marcar ficha como aplicada
GET    /api/fichas/turno/:turnoId   - Listar fichas de un turno

GET    /api/dashboard               - Datos consolidados todos los centros
GET    /api/dashboard/:centroId     - Datos de un centro especifico
GET    /api/reportes                - Exportar datos (CSV)

GET    /api/publico/disponibilidad  - JSON para panel publico (con cache)
```

### 11.5 Que contiene el QR

Solo el folio: `PVU-001-0047`

**Por que no un JSON completo?**
- Un QR con mucho texto se vuelve denso y dificil de leer en una foto
- El folio es suficiente para buscar todo en la base de datos
- Si el QR solo tiene el folio, es legible incluso en fotos borrosas
- Menos datos en el QR = QR mas grande = mas facil de fotografiar

---

## 12. INFRAESTRUCTURA Y HARDWARE

### 12.1 Hardware Disponible

**MeeBox 2018:**
- Mini PC con camara integrada
- Procesador suficiente para navegador web
- Pantalla conectada (o se conecta a monitor/TV del centro)
- La camara NO se usa para escaneo QR (ver seccion 8.2)
- Se usa como terminal de registro y aplicacion

**Requisitos por centro:**
- 1 MeeBox para registro (punto de filtro)
- 1 MeeBox o cualquier computadora/celular para el aplicador
- Conexion a internet (WiFi o datos moviles)

### 12.2 Servidor

**Opcion A - VPS gratuito:**
- Oracle Cloud Free Tier: 1 vCPU, 1 GB RAM (suficiente para 50 usuarios)
- Railway free tier
- Render free tier

**Opcion B - Servidor local (SSA):**
- Cualquier computadora en la jurisdiccion con IP fija o accesible en red
- Ventaja: datos dentro de la red de salud
- Desventaja: si se cae, se cae todo

**Opcion C - Hibrido:**
- Servidor local como principal
- Respaldo automatico a la nube cada hora

### 12.3 Red

- Los centros necesitan internet para comunicarse con el servidor
- Ancho de banda minimo: cada operacion es < 1KB de datos
- Con conexion 3G es suficiente

---

## 13. PANEL PUBLICO

### 13.1 Concepto

El publico necesita saber si vale la pena ir a un centro. Pero NO vamos a exponer el servidor operativo a miles de peticiones.

**Solucion:** Cada 5 minutos, el servidor genera un archivo JSON con la disponibilidad de todos los centros. Este JSON se sube a un CDN gratuito (GitHub Pages, Netlify, Vercel). Una pagina HTML estatica lee ese JSON y lo muestra.

### 13.2 Estructura del JSON publico

```json
{
  "actualizado": "2026-02-14T10:30:00",
  "centros": [
    {
      "nombre": "CS Durango Centro",
      "municipio": "Durango",
      "srp_disponibles": 73,
      "estado": "DISPONIBLE",
      "estimado_espera_min": 45
    },
    {
      "nombre": "CS Mezquital",
      "municipio": "Mezquital",
      "srp_disponibles": 0,
      "estado": "AGOTADO",
      "estimado_espera_min": null
    }
  ]
}
```

### 13.3 Pagina Publica

- HTML + CSS estatico, sin framework
- Lee el JSON y renderiza tarjetas por centro
- Boton "Actualizar" recarga el JSON
- Colores claros: verde = disponible, amarillo = pocos, rojo = agotado
- Mensaje cuando todo esta agotado: "Las vacunas se agotaron hoy. Los centros reabren manana a las 8:00 AM"
- NO tiene login, NO tiene formularios, NO interactua con el servidor

### 13.4 Costo del panel publico

**$0.** GitHub Pages + JSON de 2KB = ilimitadas visitas sin costo.

---

## 14. SEGURIDAD Y AUDITORIA

### 14.1 Autenticacion

- Login con usuario y contrasena
- Sesion con token JWT (expira en 8 horas = un turno)
- Sin registro publico: los usuarios los crea el administrador
- Contrasenas hasheadas con bcrypt

### 14.2 Autorizacion por Rol

| Accion | REGISTRADOR | APLICADOR | COORDINADOR | ADMIN |
|--------|:-----------:|:---------:|:-----------:|:-----:|
| Emitir ficha | SI | NO | SI | SI |
| Marcar aplicada | NO | SI | SI | SI |
| Abrir/cerrar turno | NO | NO | SI | SI |
| Ver dashboard centro | NO | NO | SI | SI |
| Ver dashboard general | NO | NO | NO | SI |
| Crear usuarios | NO | NO | NO | SI |
| Exportar reportes | NO | NO | SI | SI |
| Ajustar inventario | NO | NO | NO | SI |

### 14.3 Auditoria

Cada accion queda registrada con:
- Usuario que la realizo
- Accion exacta
- Entidad afectada (ficha, turno, etc.)
- Timestamp
- IP de origen

Esto permite:
- Saber si un registrador emitio fichas fuera de horario
- Detectar si un turno se abrio con numeros inflados
- Verificar que las fichas emitidas coinciden con las aplicadas
- Rastrear cualquier anomalia

### 14.4 Integridad de Inventario

El numero de fichas emitidas NUNCA puede superar el inventario capturado. Esta validacion esta en el backend, no en el frontend. Asi, incluso si alguien manipula el navegador, el servidor rechaza la peticion.

---

## 15. ADOPCION Y RESISTENCIA AL CAMBIO

### 15.1 Realidad del Personal

Hay que ser honestos: el personal operativo de los centros de salud tiene:
- Carga de trabajo alta y creciente por la emergencia
- Poca familiaridad con sistemas digitales (mas alla de WhatsApp)
- Resistencia natural a "una cosa mas que hacer"
- Presion de las filas de ciudadanos afuera
- Turnos largos y estresantes

### 15.2 Estrategia de Adopcion

**A) Diseno a prueba de errores:**
- 3 campos de entrada. Nada mas.
- Botones enormes con texto claro
- No hay menus, no hay navegacion
- Si algo esta mal, el sistema lo dice en rojo y grande
- El operativo NO necesita entender el sistema, solo seguir 3 pasos

**B) Los 3 pasos del registrador:**
1. Poner edad y sexo
2. Dar click en GENERAR
3. Que le tomen foto → click en SIGUIENTE

Tiempo total: 15 segundos por paciente.

**C) Los 2 pasos del aplicador:**
1. Escribir 4 digitos del folio
2. Click en APLICADA

Tiempo total: 5 segundos por paciente.

**D) Argumento para vencer resistencia:**
"El sistema te protege. Si se terminan las vacunas, el sistema le dice a la gente, no tu. Si preguntan por que no les toco, el folio demuestra que se respeto el orden de llegada. Sin el sistema, tu tienes que dar la cara."

**E) Capacitacion:**
- No se necesita manual de 50 paginas
- Un video de 90 segundos por rol
- Practica en vivo de 5 minutos antes del primer turno
- Un numero de WhatsApp para soporte en caso de duda

### 14.3 Que pasa si alguien no usa el sistema

- La auditoria detecta centros sin actividad en el sistema
- El coordinador general ve en el dashboard que un centro no ha emitido fichas
- Accion inmediata: llamada al coordinador del centro
- El dato queda registrado para rendicion de cuentas

---

## 15. PLAN DE CONTINGENCIA

### 15.1 Se cae el internet en un centro

**Plan A (Automatico - Modo Offline):** El sistema sigue operando localmente gracias a IndexedDB y los bloques de folios pre-asignados. Los registradores y vacunadores siguen trabajando sin interrupcion. Cuando la conexion regrese, el Service Worker sincroniza automaticamente los datos pendientes.

**Plan B (Cortes Manuales):** Si la desconexion se prolonga y el Dashboard Central necesita actualizarse, el Coordinador del centro usa su celular (datos moviles propios) para enviar un "Corte Informativo Manual" con las dosis restantes. Esto actualiza el Panel Publico.

**Plan C (Ultimo recurso):** Si los dispositivos tambien fallan, el registrador anota en un cuaderno: numero de turno, edad, sexo, biologico. Al volver la conexion, se capturan las fichas retroactivamente. El sistema permite captura retroactiva con timestamp manual (solo coordinador).

### 15.2 Se cae el servidor

**Mitigacion:** Respaldo automatico de la base de datos cada hora. Si el servidor cae, se levanta en otro lado con el respaldo. Tiempo de recuperacion estimado: 30 minutos.

**Plan B inmediato:** Los dispositivos continuan operando con datos locales (IndexedDB). Al levantarse el servidor, sincronizan automaticamente.

### 15.3 Se queda sin bateria la MeeBox

**Mitigacion:** Conectar a corriente siempre. Si no hay corriente, es un problema mayor que el sistema (el centro probablemente cierra).

### 15.4 Un registrador se equivoca en la edad

La ficha se marca como NO_UTILIZADA y se emite una nueva. Solo el coordinador puede cancelar fichas.

---

## 16. FASES DE DESARROLLO

### Fase 1: MVP Funcional (2-3 dias)

**Entregable:** Sistema operativo minimo para empezar a usar en 1-2 centros piloto.

Incluye:
- Backend con API REST basica
- Base de datos SQLite con esquema completo
- Modulo de registro con validacion de edad y emision de ficha
- Pantalla de ficha con QR (solo folio)
- Modulo de aplicacion (busqueda por folio + marcar aplicada)
- Modulo de inventario (abrir turno con dosis)
- Login basico
- Seed de datos: centros de salud y usuarios de prueba

NO incluye:
- Dashboard consolidado
- Panel publico
- Reportes
- Auditoria detallada

### Fase 2: Produccion (1 semana despues del piloto)

**Entregable:** Sistema completo para los 15 centros.

Incluye:
- Dashboard de coordinador de centro
- Dashboard general (coordinador jurisdiccion)
- Panel publico con JSON estatico
- Exportacion CSV
- Auditoria completa
- Tabla de rechazos
- Roles y permisos completos
- Alta/baja de usuarios y centros

### Fase 3: Refinamiento (semana 3+)

**Entregable:** Mejoras basadas en uso real.

Incluye:
- Ajustes de UX basados en feedback del personal
- Graficas en dashboard
- Alertas visuales/sonoras de desabasto
- Captura retroactiva para centros sin internet temporal
- Respaldo automatico de base de datos
- Documentacion final

---

## 17. METRICAS DE EXITO

| Metrica | Objetivo | Como se mide |
|---------|----------|-------------- |
| Fichas emitidas sin exceder inventario | 100% | fichas_emitidas <= inventario_inicial (siempre) |
| Fichas fuera de rango de edad | 0 | fichas con edad < 6m o > 12a = 0 |
| Centros usando el sistema | 15/15 | Centros con actividad en el dia |
| Tiempo de registro por paciente | < 20 seg | Diferencia entre fichas consecutivas |
| Captacion VPH en elegibles | > 80% | Fichas con vph_preguntado / fichas elegibles |
| Diferencia fichas vs aplicadas | < 5% | (emitidas - aplicadas) / emitidas |
| Disponibilidad del sistema | > 99% uptime | Monitoreo basico |

---

## 18. GLOSARIO

| Termino | Significado |
|---------|-------------|
| SRP | Vacuna Triple Viral (Sarampion, Rubeola, Parotiditis) - se aplica a menores de 6 meses a 10 anios |
| SR | Vacuna Doble Viral (Sarampion, Rubeola) - se aplica a menores de 11 y 12 anios |
| VPH | Vacuna contra Virus del Papiloma Humano |
| Biologico | Termino tecnico para referirse a la vacuna como producto |
| Ficha | Turno digital asignado a un menor para vacunacion |
| Folio | Identificador unico de la ficha |
| Turno | Sesion de vacunacion en un centro (matutino/vespertino) |
| Corte Informativo | Reporte manual de dosis restantes que el Coordinador sube desde su celular cuando los dispositivos no tienen internet |
| Bloque de Folios | Rango de folios pre-asignado a un dispositivo para operar offline sin conflictos |
| Registrador | Personal que emite fichas en el punto de filtro |
| Aplicador | Enfermero que aplica la vacuna y marca la ficha |
| MeeBox | Mini PC disponible en los centros de salud (modelo 2018) |
| PVU | Puesto de Vacunacion Universal |
| CDN | Content Delivery Network - red de distribucion de contenido |
| IndexedDB | Base de datos en el navegador para persistencia offline |
| PWA | Progressive Web App - aplicacion web instalable que funciona offline |

---

## NOTAS FINALES

Este PRD esta disenado para un contexto de emergencia sanitaria real. Las decisiones tecnicas priorizan:

1. **Velocidad de implementacion** sobre elegancia de codigo
2. **Simplicidad de uso** sobre riqueza de funcionalidades
3. **Cero costo** sobre rendimiento optimo
4. **Pragmatismo** sobre best practices academicas

El sistema mas sofisticado del mundo no sirve si el personal no lo usa. TURNO-PVU tiene que ser tan facil que no haya excusa para no usarlo.

---

*Documento vivo. Se actualizara conforme avance el desarrollo y se reciba feedback del piloto.*
