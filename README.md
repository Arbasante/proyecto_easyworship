# 📽️ Easy Presenter

Sistema de proyección profesional para iglesias optimizado para computadoras de bajos recursos. Desarrollado con **Tauri + React + Rust + SQLite**.

## 🛠️ Requisitos Previos

Antes de empezar, asegúrate de tener instalado lo siguiente en tu sistema:

### 1. Entorno de Desarrollo (Windows)
* **Node.js:** Versión 18 o superior.
* **Rust:** Instálalo vía [rustup.rs](https://rustup.rs/).
* **C++ Build Tools:** Al instalar Rust en Windows, selecciona la opción de instalar las herramientas de compilación de C++.
* **WebView2:** (Viene por defecto en Windows 10/11), necesario para renderizar el frontend.

### 2. Bases de Datos
El sistema utiliza tres archivos SQLite que deben estar en la carpeta `src-tauri/`:
* `cantos.db` (Gestión de letras)
* `biblias.db` (Debe contener las tablas de versículos)
* `multimedia.db` (Rutas de imágenes, videos y PDFs)

## 🚀 Configuración del Proyecto

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/easy-presenter.git](https://github.com/tu-usuario/easy-presenter.git)
   cd easy-presenter