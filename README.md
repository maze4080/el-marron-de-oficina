# ☕ El Marrón de Oficina

Foro anónimo para compartir experiencias, chismes y quejas de oficinas en Perú.

## 🚀 Características

- ✅ **Registro anónimo** - Usuarios verificados por email con identidades tipo "Marrón 1", "Marrón 2", etc.
- ✅ **Autenticación sin contraseña** - Login mediante OTP (código de 6 dígitos) enviado al email
- ✅ **Posts categorizados** - Chismes, Quejas, Humor, Consejos, Random
- ✅ **Sistema de likes** - Interacción con los posts
- ✅ **Respuestas anidadas** - Conversaciones en cada post
- ✅ **Diseño retro-futurista** - Estética 80s/90s con gradientes neón
- ✅ **Responsive** - Funciona en móvil y escritorio

---

## 📁 Estructura del Proyecto

```
el-marron-fullstack/
├── backend/
│   ├── config/
│   │   └── database.js      # Conexión a PostgreSQL
│   ├── middleware/
│   │   └── auth.js          # JWT authentication
│   ├── routes/
│   │   ├── auth.js          # Rutas de autenticación
│   │   └── posts.js         # Rutas de posts
│   ├── services/
│   │   └── emailService.js  # Envío de emails
│   ├── server.js            # Servidor Express
│   ├── package.json
│   └── .env.example         # Variables de entorno
├── frontend/
│   └── index.html           # Aplicación frontend
└── database/
    └── schema.sql           # Schema de PostgreSQL
```

---

## 🛠️ Instalación Local

### Prerrequisitos

- Node.js v18+
- PostgreSQL 14+
- npm o yarn

### 1. Clonar y configurar

```bash
# Clonar el repositorio
git clone <tu-repo>
cd el-marron-fullstack

# Instalar dependencias del backend
cd backend
npm install
```

### 2. Configurar la base de datos

```bash
# Crear la base de datos en PostgreSQL
psql -U postgres
CREATE DATABASE el_marron_db;
\q

# Ejecutar el schema
psql -U postgres -d el_marron_db -f ../database/schema.sql
```

### 3. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar con tus credenciales
nano .env
```

**Configuración mínima del `.env`:**

```env
PORT=3000
NODE_ENV=development

# Base de datos
DATABASE_URL=postgresql://tu_usuario:tu_password@localhost:5432/el_marron_db

# JWT
JWT_SECRET=cambia_esto_por_algo_seguro_y_largo_12345
JWT_EXPIRES_IN=7d

# Email (para desarrollo, los OTP se muestran en consola)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password

# Frontend
FRONTEND_URL=http://localhost:5500
```

### 4. Iniciar el backend

```bash
npm start
# o para desarrollo con auto-reload:
npm run dev
```

### 5. Iniciar el frontend

Opción A - Usando Live Server (VS Code):
- Abre `frontend/index.html` en VS Code
- Click derecho → "Open with Live Server"

Opción B - Usando http-server:
```bash
npx http-server frontend -p 5500
```

Opción C - Abrir directamente:
- Abre `frontend/index.html` en tu navegador

### 6. ¡Listo!

- Frontend: http://localhost:5500
- Backend API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

---

## 📧 Configuración de Email

### Desarrollo (sin SMTP)
En modo desarrollo, los códigos OTP se muestran en:
1. La consola del servidor backend
2. La respuesta de la API (campo `dev_otp`)
3. La consola del navegador

### Producción (con SMTP)

**Gmail:**
1. Habilita la verificación en 2 pasos
2. Genera una "App Password": https://myaccount.google.com/apppasswords
3. Usa esa contraseña en `SMTP_PASS`

**Otros proveedores:**
- SendGrid, Mailgun, Amazon SES, etc.
- Actualiza `SMTP_HOST` y `SMTP_PORT` según el proveedor

---

## 🌐 Despliegue en Producción

### Backend (Railway, Render, Fly.io)

**Railway (recomendado):**
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y deploy
railway login
railway init
railway add postgresql
railway up
```

**Variables de entorno en producción:**
```env
NODE_ENV=production
DATABASE_URL=<provista_por_railway>
JWT_SECRET=<genera_uno_muy_seguro>
FRONTEND_URL=https://tu-dominio.com
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=<tu_sendgrid_api_key>
```

### Frontend (Vercel, Netlify, GitHub Pages)

1. Actualiza `API_URL` en `index.html`:
```javascript
const API_URL = 'https://tu-backend.railway.app/api';
```

2. Sube a GitHub y conecta con Vercel/Netlify

**GitHub Pages:**
```bash
# En la raíz del proyecto
git add frontend/
git commit -m "Deploy frontend"
git subtree push --prefix frontend origin gh-pages
```

---

## 🔒 Seguridad

- ✅ Helmet para headers de seguridad
- ✅ Rate limiting (100 req/15min general, 10 req/15min para auth)
- ✅ Validación de inputs con express-validator
- ✅ JWT con expiración configurable
- ✅ OTP con expiración de 10 minutos
- ✅ Máximo 5 intentos por OTP
- ✅ Usuarios anónimos (no se expone el email)
- ✅ Soft delete para posts y replies
- ✅ CORS configurado

### Recomendaciones adicionales para producción:
- Usar HTTPS
- Configurar Content Security Policy
- Implementar backup de base de datos
- Monitoreo con Sentry o similar
- Logs centralizados

---

## 📡 API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/register/send-otp` | Enviar OTP para registro |
| POST | `/api/auth/register/verify-otp` | Verificar OTP y crear cuenta |
| POST | `/api/auth/login/send-otp` | Enviar OTP para login |
| POST | `/api/auth/login/verify-otp` | Verificar OTP y obtener token |
| GET | `/api/auth/me` | Obtener perfil actual |

### Posts
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/posts` | Listar posts (paginado) |
| GET | `/api/posts/:uuid` | Obtener post con replies |
| POST | `/api/posts` | Crear post (auth requerido) |
| DELETE | `/api/posts/:uuid` | Eliminar post propio |
| POST | `/api/posts/:uuid/like` | Toggle like |
| POST | `/api/posts/:uuid/replies` | Responder a post |
| GET | `/api/posts/stats/summary` | Estadísticas del foro |

---

## 🎨 Personalización

### Colores (CSS Variables)
```css
:root {
    --accent-orange: #ff6b35;
    --accent-teal: #00c9b7;
    --accent-purple: #9d4edd;
    --accent-pink: #ff69b4;
    --accent-yellow: #ffd23f;
    --bg-dark: #1a1a2e;
    --bg-card: #16213e;
}
```

### Categorías
Edita en `backend/routes/posts.js`:
```javascript
const VALID_CATEGORIES = ['chisme', 'queja', 'humor', 'consejo', 'random'];
```

---

## 🐛 Troubleshooting

**"No se puede conectar al servidor"**
- Verifica que el backend esté corriendo en el puerto correcto
- Revisa la configuración de CORS
- Verifica que `API_URL` en el frontend sea correcto

**"Error de base de datos"**
- Verifica que PostgreSQL esté corriendo
- Comprueba las credenciales en `.env`
- Asegúrate de haber ejecutado `schema.sql`

**"No recibo el código OTP"**
- En desarrollo, revisa la consola del backend
- En producción, verifica la configuración SMTP
- Revisa la carpeta de spam

---

## 📄 Licencia

MIT License - Siéntete libre de usar y modificar.

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu branch (`git checkout -b feature/nueva-funcion`)
3. Commit tus cambios (`git commit -m 'Agrega nueva función'`)
4. Push al branch (`git push origin feature/nueva-funcion`)
5. Abre un Pull Request

---

Hecho con ☕ y algo de frustración laboral en Perú 🇵🇪
