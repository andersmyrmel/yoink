

<p align="center">
  <img src="logo.png" alt="Yoink" width="120">
</p>

<h1 align="center">Yoink</h1>

<p align="center">Una extensión para Chrome y Firefox que extrae el sistema de diseño de cualquier sitio web en YAML estructurado que puedes pasar directamente a asistentes de IA para código como Claude.</p>

## ¿Por qué?

Ves un sitio web con un gran diseño y quieres que tu asistente de IA para código construya algo que lo iguale. Pero describir colores, espaciado y estilos de componentes con palabras es tedioso y propenso a errores. Yoink soluciona esto extrayendo sistemas de diseño completos en formato YAML que puedes pegar directamente en Claude o tu asistente de IA.

## Cómo funciona

1. Visita cualquier sitio web (Stripe, Linear, GitHub, etc.)
2. Haz clic en la extensión Yoink
3. Haz clic en "Escanear página" (opcionalmente activa "Incluir componentes" para una detección detallada de componentes)
4. Copia la salida en YAML
5. Pégalo en Claude: "Construye un panel de control usando este sistema de diseño..."

Yoink extrae colores, tipografía, espaciado, sombras, componentes, diseños y animaciones en un YAML limpio que los asistentes de IA entienden a la perfección.

## Privacidad

Yoink es 100 % privado. Todo el procesamiento se realiza de forma local en tu navegador con cero solicitudes de red, sin recopilación de datos y sin análisis. Solo requiere permisos mínimos (activeTab, scripting, clipboardWrite) para funcionar. El código es de código abierto, por lo que puedes auditarlo tú mismo.

## Instalación

### Chrome

**Chrome Web Store:** [Instalar Yoink](https://chromewebstore.google.com/detail/yoink-design-token-style/bgdlplmmdmekinbhmmbmmfgpiapmommc)

**Desde el código fuente:**

```bash
git clone https://github.com/andersmyrmel/yoink
cd yoink
nvm use
npm run deps:safe-install
npm run build
```

Las dependencias se instalan con los scripts de ciclo de vida deshabilitados, se auditan contra una lista blanca de versiones exactas almacenada en el control de versiones y, a continuación, solo se reconstruyen los paquetes revisados. Consulta [seguridad en la instalación de dependencias](docs/dependency-install-security.md).

Luego en Chrome:

1. Ve a `chrome://extensions/`
2. Activa el "Modo desarrollador"
3. Haz clic en "Cargar desempaquetado"
4. Selecciona la carpeta `dist/`

### Firefox

**Desde el código fuente:**

```bash
git clone https://github.com/andersmyrmel/yoink
cd yoink
nvm use
npm run deps:safe-install
npm run build:firefox
```

Luego en Firefox:

1. Ve a `about:debugging#/runtime/this-firefox`
2. Haz clic en "Cargar complemento temporal"
3. Navega a la carpeta `dist/` y selecciona el archivo `manifest.json`

**Nota:** Firefox requiere el comando `build:firefox` (no `build`), que utiliza un manifiesto específico para Firefox. Firefox requiere un complemento temporal para el desarrollo. Para una instalación permanente, empaqueta la extensión con `npm run package:firefox` e instala el archivo resultante `yoink-firefox.zip` a través de Complementos de Firefox (requiere firma para su uso en producción).

## Licencia

MIT - Consulta el archivo LICENSE
