#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// --- ESTRUCTURAS BIBLIA ---
#[derive(Serialize, Deserialize, Clone, Debug)]
struct Verse {
    libro: String,
    capitulo: i32,
    versiculo: i32,
    texto: String,
}

#[derive(Serialize)]
struct BookInfo {
    nombre: String,
    capitulos: i32,
}

// --- ESTRUCTURAS CANTOS ---
#[derive(Serialize)]
struct Canto {
    id: i32,
    titulo: String,
    tono: String,
    categoria: String,
}

#[derive(Serialize)]
struct Diapositiva {
    id: i32,
    orden: i32,
    texto: String,
}

// ==========================================
// COMANDOS DE CANTOS (NUEVOS: CRUD)
// ==========================================

#[tauri::command]
fn get_all_cantos() -> Vec<Canto> {
    let conn = Connection::open("cantos.db").expect("DB no encontrada");
    let mut stmt = conn.prepare("SELECT id, titulo, COALESCE(tono, ''), COALESCE(categoria, '') FROM cantos ORDER BY titulo").unwrap();
    let iter = stmt.query_map([], |row| {
        Ok(Canto {
            id: row.get(0)?,
            titulo: row.get(1)?,
            tono: row.get(2)?,
            categoria: row.get(3)?,
        })
    }).unwrap();
    iter.map(|c| c.unwrap()).collect()
}

#[tauri::command]
fn get_canto_diapositivas(canto_id: i32) -> Vec<Diapositiva> {
    let conn = Connection::open("cantos.db").expect("DB no encontrada");
    let mut stmt = conn.prepare("SELECT id, orden, texto FROM diapositivas WHERE canto_id = ? ORDER BY orden").unwrap();
    let iter = stmt.query_map(params![canto_id], |row| {
        Ok(Diapositiva {
            id: row.get(0)?,
            orden: row.get(1)?,
            texto: row.get(2)?,
        })
    }).unwrap();
    iter.map(|d| d.unwrap()).collect()
}

#[tauri::command]
fn add_canto(titulo: String, letra: String) -> Result<(), String> {
    let conn = Connection::open("cantos.db").map_err(|e| e.to_string())?;
    
    // 1. Inserta el canto
    conn.execute(
        "INSERT INTO cantos (titulo, tono, categoria) VALUES (?, '', 'Personalizado')",
        params![titulo],
    ).map_err(|e| e.to_string())?;
    
    let canto_id = conn.last_insert_rowid();

    // 2. Divide la letra por doble salto de línea y guarda las diapositivas
    let estrofas: Vec<&str> = letra.split("\n\n").collect();
    let mut orden = 1;
    for estrofa in estrofas {
        let estrofa = estrofa.trim();
        if !estrofa.is_empty() {
            conn.execute(
                "INSERT INTO diapositivas (canto_id, orden, texto) VALUES (?, ?, ?)",
                params![canto_id, orden, estrofa],
            ).map_err(|e| e.to_string())?;
            orden += 1;
        }
    }
    Ok(())
}

#[tauri::command]
fn update_canto(id: i32, titulo: String, letra: String) -> Result<(), String> {
    let conn = Connection::open("cantos.db").map_err(|e| e.to_string())?;
    
    // 1. Actualiza el título
    conn.execute("UPDATE cantos SET titulo = ? WHERE id = ?", params![titulo, id])
        .map_err(|e| e.to_string())?;

    // 2. Borra las diapositivas viejas
    conn.execute("DELETE FROM diapositivas WHERE canto_id = ?", params![id])
        .map_err(|e| e.to_string())?;

    // 3. Inserta las nuevas diapositivas
    let estrofas: Vec<&str> = letra.split("\n\n").collect();
    let mut orden = 1;
    for estrofa in estrofas {
        let estrofa = estrofa.trim();
        if !estrofa.is_empty() {
            conn.execute(
                "INSERT INTO diapositivas (canto_id, orden, texto) VALUES (?, ?, ?)",
                params![id, orden, estrofa],
            ).map_err(|e| e.to_string())?;
            orden += 1;
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_canto(id: i32) -> Result<(), String> {
    let conn = Connection::open("cantos.db").map_err(|e| e.to_string())?;
    // Primero borramos sus diapositivas
    conn.execute("DELETE FROM diapositivas WHERE canto_id = ?", params![id])
        .map_err(|e| e.to_string())?;
    // Luego borramos el canto
    conn.execute("DELETE FROM cantos WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}


// ==========================================
// COMANDOS BIBLIA Y GENERALES
// ==========================================

#[tauri::command]
async fn select_background_image(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app.dialog()
        .file()
        .add_filter("Imágenes", &["png", "jpg", "jpeg", "webp"])
        .blocking_pick_file();

    file_path.map(|path| path.to_string())
}

#[tauri::command]
fn trigger_style_update(app: tauri::AppHandle, styles: serde_json::Value) {
    if let Some(projector_window) = app.get_webview_window("projector") {
        let _ = projector_window.emit("update-styles", &styles);
    }
}

#[tauri::command]
fn get_bible_versions() -> Vec<String> {
    let conn = Connection::open("biblias.db").expect("DB no encontrada");
    let mut stmt = conn.prepare("SELECT nombre FROM versiones").unwrap();
    let version_iter = stmt.query_map([], |row| row.get(0)).unwrap();
    version_iter.map(|v| v.unwrap()).collect()
}

#[tauri::command]
fn get_books(version: String) -> Vec<BookInfo> {
    let conn = Connection::open("biblias.db").expect("DB no encontrada");
    let mut stmt = conn
        .prepare("SELECT libro_nombre, MAX(capitulo) FROM versiculos v JOIN versiones ver ON v.version_id = ver.id WHERE ver.nombre = ? GROUP BY libro_nombre ORDER BY libro_numero")
        .unwrap();

    let book_iter = stmt.query_map(params![version], |row| {
        Ok(BookInfo { nombre: row.get(0)?, capitulos: row.get(1)? })
    }).unwrap();
    book_iter.map(|b| b.unwrap()).collect()
}

#[tauri::command]
fn get_chapter_verses(version: String, book: String, cap: i32) -> Vec<Verse> {
    let conn = Connection::open("biblias.db").expect("DB no encontrada");
    let mut stmt = conn
        .prepare("SELECT libro_nombre, capitulo, versiculo, texto FROM versiculos v JOIN versiones ver ON v.version_id = ver.id WHERE ver.nombre = ? AND libro_nombre = ? AND capitulo = ? ORDER BY versiculo")
        .unwrap();

    let v_iter = stmt.query_map(params![version, book, cap], |row| {
        Ok(Verse { libro: row.get(0)?, capitulo: row.get(1)?, versiculo: row.get(2)?, texto: row.get(3)? })
    }).unwrap();
    v_iter.map(|v| v.unwrap()).collect()
}

#[tauri::command]
fn get_single_verse(version: String, book: String, cap: i32, ver: i32) -> Option<Verse> {
    let conn = Connection::open("biblias.db").ok()?;
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init()) 
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
            add_canto,            // <--- NUEVO
            update_canto,         // <--- NUEVO
            delete_canto          // <--- NUEVO
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}