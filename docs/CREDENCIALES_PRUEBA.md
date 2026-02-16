# 🔑 Credenciales de Prueba (Actualizado 16/02/2026)

Este documento contiene las credenciales de acceso actualizadas tras la carga de la base de datos de producción con los centros oficiales.

---

## 📋 Lista de Centros y Usuarios

El rol de **Administrador Global** se mantiene:
- **Usuario:** `admin`
- **Contraseña:** `Admin123!`

### Centros Activados

| Centro de Salud | Municipio | Usuario Coordinador | Usuario Registrador | Usuario Aplicador | Contraseña (CLUES) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CESSA 450** | DURANGO | `cessa450` | `reg.cessa450` | `app.cessa450` | `DGSSA017860` |
| **CESSA DR. CARLOS STA. MARÍA** | DURANGO | `centro2` | `reg.centro2` | `app.centro2` | `DGSSA000495` |
| **CESSA DR. CARLOS LEÓN DE LA PEÑA** | DURANGO | `cessa1` | `reg.cessa1` | `app.cessa1` | `DGSSA003182` |
| **HOSPITAL GENERAL DE DURANGO** | DURANGO | `materno` | `reg.materno` | `app.materno` | `DGSSA000191` |
| **C.S.U. DR. ISAURO VENZOR** | GÓMEZ PALACIO | `isauro` | `reg.isauro` | `app.isauro` | `DGSSA000780` |
| **C.S.U. DR. ROBERTO GARCIA SOSA** | LERDO | `roberto` | `reg.roberto` | `app.roberto` | `DGSSA001031` |

> **Nota:** La contraseña para todos los usuarios de un centro es su código CLUES correspondiente.

---

## 🧪 Flujo de Pruebas Recomendado

### **Paso 1: Coordinador - Abrir Turno**
1. Accede a: `https://master.turno-pvu.pages.dev/coordinador/`
2. **Login:** Usa cualquier usuario coordinador (ej. `cessa450` / `DGSSA017860`)
3. Si no hay turno activo, haz clic en **"Abrir Turno"**
4. Selecciona tipo de turno:
   - **Matutino** o **Vespertino**
5. Ingresa inventario inicial de ejemplo:
   - **SRP:** 500 dosis
   - **SR:** 50 dosis
   - **VPH:** 100 dosis
6. Confirma que aparece el **Monitor** con barras de progreso de inventario

---

### **Paso 2: Registro - Emitir Fichas**
1. Accede a: `https://master.turno-pvu.pages.dev/registro/`
2. **Login:** Usa el usuario registrador del mismo centro (ej. `reg.cessa450` / `DGSSA017860`)
3. El sistema debe detectar automáticamente el turno activo
4. Registra un paciente de prueba:
   - **Edad:** 7 años, 0 meses
   - **Sexo:** Masculino
5. Verifica que se genere un folio

---

### **Paso 3: Aplicador - Aplicar Vacunas**
1. Accede a: `https://master.turno-pvu.pages.dev/aplicar/`
2. **Login:** Usa el usuario aplicador del mismo centro (ej. `app.cessa450` / `DGSSA017860`)
3. Ingresa el folio generado en el paso anterior
4. Verifica que aparezcan los datos del paciente
5. Confirma la aplicación de la vacuna
6. Verifica que el estado cambie a **"APLICADA"**

---

## 🛠️ Solución de Problemas Comunes

### ❌ "Sin Turno Activo" en Registro o Aplicar
**Solución:** Primero debes abrir un turno como **Coordinador** (Paso 1)

### ❌ Pantalla en Blanco o Error 404
**Solución:** 
- Limpia la caché del navegador: `Ctrl + Shift + R` (Windows/Linux) o `Cmd + Shift + R` (Mac)
- Prueba en modo incógnito
- Espera 1-2 minutos (propagación de Cloudflare Pages)

### ❌ Error CORS en Consola
**Solución:**
- Limpia los datos del sitio en configuración del navegador
- Espera unos minutos para que se propague la configuración del backend
- Prueba en modo incógnito

---

## 🔗 Enlaces Rápidos

- **Frontend Principal:** [https://master.turno-pvu.pages.dev](https://master.turno-pvu.pages.dev)
- **Backend API Health:** [https://turno-pvu-backend-dev.xtrctr.workers.dev/api/health](https://turno-pvu-backend-dev.xtrctr.workers.dev/api/health)
- **Panel Público:** [https://master.turno-pvu.pages.dev/publico/](https://master.turno-pvu.pages.dev/publico/)

---

**Última actualización:** 16/02/2026
