# ChatBot Frontend

Sistema de frontend para chatbot con IA y operadores humanos.

## Características

- ✅ Autenticación completa (Login/Registro)
- ✅ Chat en tiempo real con IA
- ✅ Solicitud de operador humano
- ✅ Dashboard de operadores
- ✅ Sistema de calificaciones
- ✅ Confirmación de ventas
- ✅ Estadísticas en tiempo real

## Tecnologías

- **Next.js 14** - Framework React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Socket.IO Client** - WebSockets
- **Radix UI** - Componentes accesibles

## Instalación

1. Instalar dependencias:
\`\`\`bash
npm install
\`\`\`

2. Configurar variables de entorno:
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

3. Ejecutar en desarrollo:
\`\`\`bash
npm run dev
\`\`\`

## Variables de Entorno

\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:3002
\`\`\`

## Estructura del Proyecto

\`\`\`
├── app/                    # App Router de Next.js
├── components/            # Componentes React
│   ├── auth/             # Autenticación
│   ├── chat/             # Chat del cliente
│   ├── operator/         # Dashboard del operador
│   ├── providers/        # Context providers
│   └── ui/               # Componentes de UI
├── hooks/                # Custom hooks
├── lib/                  # Utilidades
└── public/               # Archivos estáticos
\`\`\`

## Scripts

- `npm run dev` -  Desarrollo
- `npm run build` - Construir para producción
- `npm run start` - Ejecutar en producción
- `npm run lint` - Linter

## Roles de Usuario

### Cliente
- Iniciar chat con IA
- Solicitar operador humano
- Calificar la experiencia

### Operador
- Ver dashboard con estadísticas
- Atender chats en espera
- Confirmar ventas
- Ver clientes conectados

### Admin
- Acceso completo al dashboard
- Gestión de operadores
- Estadísticas avanzadas

## Conexión con Backend

El frontend se conecta al backend NestJS a través de:

1. **API REST** - Autenticación y datos
2. **WebSockets** - Chat en tiempo real
3. **Socket.IO** - Eventos del sistema

Asegúrate de que el backend esté ejecutándose en el puerto 3002.
\`\`\`
