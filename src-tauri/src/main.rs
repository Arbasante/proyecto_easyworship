#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

// --- ESTRUCTURAS ---
#[derive(Serialize, Deserialize, Clone, Debug)]
struct Verse { libro: String, capitulo: i32, versiculo: i32, texto: String }

#[derive(Serialize)]
struct BookInfo { nombre: String, capitulos: i32 }

#[derive(Serialize)]
struct Canto { id: i32, titulo: String, tono: String, categoria: String }

#[derive(Serialize)]
struct Diapositiva { id: i32, orden: i32, texto: String }

#[derive(Serialize)]
struct Imagen { id: i32, nombre: String, ruta: String, aspecto: String }

// NUEVA ESTRUCTURA: Video (Añadido 'bucle')
#[derive(Serialize)]
struct Video { id: i32, nombre: String, ruta: String, bucle: bool }

// --- ESTADO GLOBAL ---
struct AppState {
    cantos_db: Mutex<Connection>,
    biblias_db: Mutex<Connection>,
    multimedia_db: Mutex<Connection>,
}

// ==========================================
// COMANDOS DE CANTOS
// ==========================================
#[tauri::command]
fn get_all_cantos(state: State<AppState>) -> Result<Vec<Canto>, String> {
    let conn = state.cantos_db.lock().map_err(|_| "Error de concurrencia")?;
    let mut stmt = conn.prepare("SELECT id, titulo, COALESCE(tono, ''), COALESCE(categoria, '') FROM cantos ORDER BY titulo").map_err(|e| e.to_string())?;
    let iter = stmt.query_map([], |row| { Ok(Canto { id: row.get(0)?, titulo: row.get(1)?, tono: row.get(2)?, categoria: row.get(3)? }) }).map_err(|e| e.to_string())?;
    Ok(iter.filter_map(Result::ok).collect())
}

#[tauri::command]
fn get_canto_diapositivas(canto_id: i32, state: State<AppState>) -> Result<Vec<Diapositiva>, String> {
    let conn = state.cantos_db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, orden, texto FROM diapositivas WHERE canto_id = ? ORDER BY orden").unwrap();
    let iter = stmt.query_map(params![canto_id], |row| { Ok(Diapositiva { id: row.get(0)?, orden: row.get(1)?, texto: row.get(2)? }) }).unwrap();
    Ok(iter.filter_map(Result::ok).collect())
}

#[tauri::command]
fn add_canto(titulo: String, letra: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.cantos_db.lock().unwrap();
    conn.execute("INSERT INTO cantos (titulo, tono, categoria) VALUES (?, '', 'Personalizado')", params![titulo]).map_err(|e| e.to_string())?;
    let canto_id = conn.last_insert_rowid();
    let estrofas: Vec<&str> = letra.split("\n\n").collect();
    let mut orden = 1;
    for estrofa in estrofas {
        let estrofa = estrofa.trim();
        if !estrofa.is_empty() {
            conn.execute("INSERT INTO diapositivas (canto_id, orden, texto) VALUES (?, ?, ?)", params![canto_id, orden, estrofa]).map_err(|e| e.to_string())?;
            orden += 1;
        }
    }
    Ok(())
}

#[tauri::command]
fn update_canto(id: i32, titulo: String, letra: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.cantos_db.lock().unwrap();
    conn.execute("UPDATE cantos SET titulo = ? WHERE id = ?", params![titulo, id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM diapositivas WHERE canto_id = ?", params![id]).map_err(|e| e.to_string())?;
    let estrofas: Vec<&str> = letra.split("\n\n").collect();
    let mut orden = 1;
    for estrofa in estrofas {
        let estrofa = estrofa.trim();
        if !estrofa.is_empty() {
            conn.execute("INSERT INTO diapositivas (canto_id, orden, texto) VALUES (?, ?, ?)", params![id, orden, estrofa]).map_err(|e| e.to_string())?;
            orden += 1;
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_canto(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.cantos_db.lock().unwrap();
    conn.execute("DELETE FROM diapositivas WHERE canto_id = ?", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM cantos WHERE id = ?", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ==========================================
// COMANDOS DE IMÁGENES
// ==========================================
#[tauri::command]
fn get_all_images(state: State<AppState>) -> Result<Vec<Imagen>, String> {
    let conn = state.multimedia_db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, nombre, ruta, COALESCE(aspecto, 'contain') FROM imagenes ORDER BY id DESC").unwrap();
    let iter = stmt.query_map([], |row| Ok(Imagen { id: row.get(0)?, nombre: row.get(1)?, ruta: row.get(2)?, aspecto: row.get(3)? })).unwrap();
    Ok(iter.filter_map(Result::ok).collect())
}

#[tauri::command]
fn add_image_db(nombre: String, ruta: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.multimedia_db.lock().unwrap();
    conn.execute("INSERT INTO imagenes (nombre, ruta, aspecto) VALUES (?, ?, 'contain')", params![nombre, ruta]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_image_db(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.multimedia_db.lock().unwrap();
    conn.execute("DELETE FROM imagenes WHERE id = ?", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_image_aspect(id: i32, aspecto: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.multimedia_db.lock().unwrap();
    conn.execute("UPDATE imagenes SET aspecto = ? WHERE id = ?", params![aspecto, id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ==========================================
// COMANDOS DE VIDEOS
// ==========================================
#[tauri::command]
fn get_all_videos(state: State<AppState>) -> Result<Vec<Video>, String> {
    let conn = state.multimedia_db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, nombre, ruta, COALESCE(bucle, 0) FROM videos ORDER BY id DESC").unwrap();
    let iter = stmt.query_map([], |row| Ok(Video { 
        id: row.get(0)?, 
        nombre: row.get(1)?, 
        ruta: row.get(2)?,
        bucle: row.get::<_, i32>(3)? != 0 // Convertir INTEGER (0/1) a bool
    })).unwrap();
    Ok(iter.filter_map(Result::ok).collect())
}

#[tauri::command]
fn add_video_db(nombre: String, ruta: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.multimedia_db.lock().unwrap();
    conn.execute("INSERT INTO videos (nombre, ruta, bucle) VALUES (?, ?, 0)", params![nombre, ruta]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_video_db(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.multimedia_db.lock().unwrap();
    conn.execute("DELETE FROM videos WHERE id = ?", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// NUEVO COMANDO: Bucle de video
#[tauri::command]
fn update_video_loop(id: i32, bucle: bool, state: State<AppState>) -> Result<(), String> {
    let conn = state.multimedia_db.lock().unwrap();
    let b_val = if bucle { 1 } else { 0 };
    conn.execute("UPDATE videos SET bucle = ? WHERE id = ?", params![b_val, id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn select_video_file(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app.dialog()
        .file()
        .add_filter("Videos", &["mp4", "webm", "mkv", "mov", "avi"])
        .blocking_pick_file();
    file_path.map(|path| path.to_string())
}

#[tauri::command]
fn trigger_video_control(app: tauri::AppHandle, action: String) {
    if let Some(projector_window) = app.get_webview_window("projector") {
        let _ = projector_window.emit("video-control", &action);
    }
}

// ==========================================
// COMANDOS BIBLIA Y GENERALES
// ==========================================
#[tauri::command]
async fn select_background_image(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app.dialog().file().add_filter("Imágenes", &["png", "jpg", "jpeg", "webp", "gif"]).blocking_pick_file();
    file_path.map(|path| path.to_string())
}

#[tauri::command]
fn trigger_style_update(app: tauri::AppHandle, styles: serde_json::Value) {
    if let Some(projector_window) = app.get_webview_window("projector") {
        let _ = projector_window.emit("update-styles", &styles);
    }
}

#[tauri::command]
fn get_bible_versions(state: State<AppState>) -> Result<Vec<String>, String> {
    let conn = state.biblias_db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT nombre FROM versiones").unwrap();
    let iter = stmt.query_map([], |row| row.get(0)).unwrap();
    Ok(iter.filter_map(Result::ok).collect())
}

#[tauri::command]
fn get_books(version: String, state: State<AppState>) -> Result<Vec<BookInfo>, String> {
    let conn = state.biblias_db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT libro_nombre, MAX(capitulo) FROM versiculos v JOIN versiones ver ON v.version_id = ver.id WHERE ver.nombre = ? GROUP BY libro_nombre ORDER BY libro_numero").unwrap();
    let iter = stmt.query_map(params![version], |row| Ok(BookInfo { nombre: row.get(0)?, capitulos: row.get(1)? })).unwrap();
    Ok(iter.filter_map(Result::ok).collect())
}

#[tauri::command]
fn get_chapter_verses(version: String, book: String, cap: i32, state: State<AppState>) -> Result<Vec<Verse>, String> {
    let conn = state.biblias_db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT libro_nombre, capitulo, versiculo, texto FROM versiculos v JOIN versiones ver ON v.version_id = ver.id WHERE ver.nombre = ? AND libro_nombre = ? AND capitulo = ? ORDER BY versiculo").unwrap();
    let iter = stmt.query_map(params![version, book, cap], |row| Ok(Verse { libro: row.get(0)?, capitulo: row.get(1)?, versiculo: row.get(2)?, texto: row.get(3)? })).unwrap();
    Ok(iter.filter_map(Result::ok).collect())
}

#[tauri::command]
fn get_single_verse(version: String, book: String, cap: i32, ver: i32, state: State<AppState>) -> Option<Verse> {
    let conn = state.biblias_db.lock().ok()?;
    conn.query_row(
        "SELECT libro_nombre, capitulo, versiculo, texto FROM versiculos v JOIN versiones ver ON v.version_id = ver.id WHERE ver.nombre = ? AND libro_nombre = ? AND capitulo = ? AND versiculo = ?",
        params![version, book, cap, ver],
        |row| Ok(Verse { libro: row.get(0)?, capitulo: row.get(1)?, versiculo: row.get(2)?, texto: row.get(3)? })
    ).optional().unwrap_or(None)
}

#[tauri::command]
fn trigger_projection(app: tauri::AppHandle, verse: serde_json::Value) {
    if let Some(projector_window) = app.get_webview_window("projector") {
        let _ = projector_window.emit("update-proyeccion", &verse);
    }
}

#[tauri::command]
async fn open_projector(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("projector") {
        let _ = window.set_focus();
        return;
    }
    let win_builder = WebviewWindowBuilder::new(&app, "projector", WebviewUrl::App("/projector".into()))
            .title("Proyector")
            .inner_size(800.0, 600.0);

    if let Ok(window) = win_builder.build() {
        if let Ok(monitors) = window.available_monitors() {
            if monitors.len() > 1 {
                let _ = window.set_position(monitors[1].position().clone());
                let _ = window.set_fullscreen(true);
            }
        }
    }
}

fn setup_db(db_name: &str) -> Connection {
    let conn = Connection::open(db_name).expect(&format!("No se pudo abrir {}", db_name));
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA cache_size = -64000; PRAGMA temp_store = MEMORY;").unwrap();
    conn
}

fn setup_multimedia_db() -> Connection {
    let conn = setup_db("multimedia.db");
    
    // TABLA DE IMÁGENES
    conn.execute("CREATE TABLE IF NOT EXISTS imagenes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, ruta TEXT NOT NULL, aspecto TEXT DEFAULT 'contain')", []).unwrap();
    let _ = conn.execute("ALTER TABLE imagenes ADD COLUMN aspecto TEXT DEFAULT 'contain'", []);
    
    // TABLA DE VIDEOS (Agregada la columna de bucle)
    conn.execute("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, ruta TEXT NOT NULL, bucle INTEGER DEFAULT 0)", []).unwrap();
    let _ = conn.execute("ALTER TABLE videos ADD COLUMN bucle INTEGER DEFAULT 0", []);
    
    conn
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init()) 
        .setup(|app| {
            let app_state = AppState {
                cantos_db: Mutex::new(setup_db("cantos.db")),
                biblias_db: Mutex::new(setup_db("biblias.db")),
                multimedia_db: Mutex::new(setup_multimedia_db()),
            };
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_projector,
            get_bible_versions,
            get_books,
            get_chapter_verses,
            get_single_verse,
            trigger_projection,
            select_background_image,
            trigger_style_update,
            get_all_cantos,
            get_canto_diapositivas,
            add_canto,
            update_canto,
            delete_canto,
            get_all_images,
            add_image_db,
            delete_image_db,
            update_image_aspect,
            get_all_videos,
            add_video_db,
            delete_video_db,
            update_video_loop, // <--- Comando Registrado
            select_video_file,
            trigger_video_control
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}