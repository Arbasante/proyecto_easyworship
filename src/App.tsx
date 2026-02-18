import { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Music, BookOpen, Image, Video, FileText, Star, MonitorPlay, Search, ChevronLeft, Settings, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// --- UTILIDADES ---
const normalizeText = (text: string) => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const getShortVersion = (versionName: string) => {
    const match = versionName.match(/\((.*?)\)/);
    return match ? match[1] : versionName.substring(0, 3).toUpperCase();
};

const isSameVerse = (v1: any, v2: any) => {
    if (!v1 || !v2) return false;
    return v1.libro === v2.libro && 
           v1.capitulo === v2.capitulo && 
           v1.versiculo === v2.versiculo;
};

// ==========================================
// 1. VISTA DEL PROYECTOR (CON TRANSICIÓN)
// ==========================================
// REEMPLAZA TODO EL COMPONENTE ProjectorView POR ESTE:
const ProjectorView = () => {
  const [liveVerse, setLiveVerse] = useState<any>(null); // Dato entrante
  const [displayVerse, setDisplayVerse] = useState<any>(null); // Dato visible
  const [fontSize, setFontSize] = useState(100);
  const [opacity, setOpacity] = useState(0); // Empezamos invisible

  useEffect(() => {
    const unlistenPromise = listen("update-proyeccion", (event: any) => {
        setLiveVerse(event.payload);
    });
    return () => { unlistenPromise.then(u => u()); };
  }, []);

  // --- ALGORITMO DE TRANSICIÓN INVISIBLE ---
  useEffect(() => {
    if (!liveVerse) return;

    // 1. Ocultar inmediatamente el texto actual (Fade Out)
    setOpacity(0);

    // 2. Esperar a que se oculte (300ms es la duración de la transición CSS)
    const timeout = setTimeout(() => {
        
        // --- CÁLCULO DE TAMAÑO (Mientras está invisible) ---
        const length = liveVerse.texto.length;
        let newSize = 100;
        if (length < 20) newSize = 220;
        else if (length < 50) newSize = 160;
        else if (length < 100) newSize = 110;
        else if (length < 180) newSize = 85;
        else if (length < 300) newSize = 65;
        else newSize = 50;
        
        // Aplicamos cambios de estado mientras la opacidad es 0
        setFontSize(newSize);
        setDisplayVerse(liveVerse);

        // 3. Pequeña pausa técnica para asegurar que el navegador "pintó" el tamaño
        // antes de volver a mostrarlo.
        requestAnimationFrame(() => {
            setOpacity(1); // Reaparecer (Fade In) con el tamaño ya correcto
        });

    }, 250); // Un poco menos de 300ms para que se sienta ágil

    return () => clearTimeout(timeout);

  }, [liveVerse]);

  return (
    <div className="h-screen w-screen bg-black flex flex-col justify-center items-center p-6 select-none overflow-hidden relative">
      {displayVerse ? (
        <div 
            className="w-full h-full flex flex-col justify-center transition-opacity duration-300 ease-in-out"
            style={{ opacity: opacity }} // Controlamos la opacidad aquí
        >
          <div className="flex-1 flex items-center justify-center">
            <p 
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.1 }}
                className="font-bold text-white text-center drop-shadow-[0_4px_10px_rgba(0,0,0,1)] font-sans w-full leading-tight"
            >
                "{displayVerse.texto}"
            </p>
          </div>
          <div className="flex justify-end mt-2">
             <div className="border-r-8 border-accent pr-4">
                <p className="text-5xl text-accent font-black italic uppercase tracking-widest drop-shadow-md">
                   {displayVerse.libro} {displayVerse.capitulo}:{displayVerse.versiculo}
                </p>
                {displayVerse.versionName && (
                    <p className="text-2xl text-gray-500 font-bold text-right mt-1">
                        {getShortVersion(displayVerse.versionName)}
                    </p>
                )}
             </div>
          </div>
        </div>
      ) : (
        <div className="opacity-10 text-gray-500 font-black text-9xl tracking-tighter">
           WORSHIP RS
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. BIBLIOTECA (BUG CORREGIDO: LIMPIAR AL BUSCAR)
// ==========================================
// REEMPLAZA EL COMPONENTE BiblesLibrary POR ESTE:
const BiblesLibrary = ({ onSelectChapter, onDirectSearch, currentVersion, onVersionChange }: any) => {
  const [versions, setVersions] = useState<string[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [view, setView] = useState({ mode: 'books', book: null as any });
  const [search, setSearch] = useState("");
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    invoke("get_bible_versions").then((v: any) => {
      setVersions(v);
      if (v.length > 0 && !currentVersion) onVersionChange(v[0]);
    });
  }, []);

  useEffect(() => {
    if (currentVersion) invoke("get_books", { version: currentVersion }).then((b: any) => setBooks(b));
  }, [currentVersion]);

  const handleSearchChange = (e: any) => {
    const val = e.target.value;
    setSearch(val);
    
    // Autocompletado de libros (ignorando si hay números para no estorbar)
    if (val && !val.match(/\d/) && books.length > 0) {
        const normVal = normalizeText(val);
        const match = books.find(b => normalizeText(b.nombre).startsWith(normVal));
        if (match && normalizeText(match.nombre) !== normVal) {
             setSuggestion(match.nombre);
        } else {
             setSuggestion("");
        }
    } else { 
        setSuggestion(""); 
    }
  };

  const handleKeyDown = (e: any) => {
    // 1. AUTOCOMPLETAR (Flecha Derecha o Tab)
    if ((e.key === 'ArrowRight' || e.key === 'Tab') && suggestion) {
        e.preventDefault(); 
        setSearch(suggestion + " "); 
        setSuggestion("");
    }
    
    // 2. BUSCAR (Enter)
    if (e.key === 'Enter') {
        let rawBookName = "";
        let cap = 0;
        let ver = 0;

        // CASO A: Libro Capítulo:Verso (Ej: "Rut 1:5" o "Rut 1 5")
        const matchFull = search.match(/(.+?)\s+(\d+)[:\s](\d+)/);

        // CASO B: Libro Capítulo (Ej: "Rut 1") -> Asumimos Verso 1
        const matchChapterOnly = search.match(/(.+?)\s+(\d+)$/);

        if (matchFull) {
            rawBookName = matchFull[1].trim(); 
            cap = parseInt(matchFull[2]);
            ver = parseInt(matchFull[3]);
        } else if (matchChapterOnly) {
            // Si solo puso capítulo, usamos versículo 1 por defecto
            rawBookName = matchChapterOnly[1].trim();
            cap = parseInt(matchChapterOnly[2]);
            ver = 1; 
        }

        // Si logramos capturar datos válidos, buscamos el libro real
        if (rawBookName && cap > 0 && ver > 0) {
            const realBook = books.find(b => normalizeText(b.nombre) === normalizeText(rawBookName));
            
            if (realBook) {
                // Esto cargará el capítulo en el panel y proyectará el verso automáticamente
                onDirectSearch(currentVersion, realBook.nombre, cap, ver);
                
                // Limpiar buscador
                setSearch(""); 
                setSuggestion("");
            }
        }
    }
  };

  const filteredBooks = books.filter(b => normalizeText(b.nombre).includes(normalizeText(search)));

  return (
    <div className="flex flex-col h-full p-3 select-none bg-sidebar/30">
      <div className="flex gap-2 mb-3">
        <select value={currentVersion} onChange={(e) => onVersionChange(e.target.value)} 
          className="bg-panel p-2 rounded border border-white/10 text-[10px] w-32 outline-none focus:border-accent font-bold truncate">
          {versions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        
        <div className="flex-1 relative group">
          <Search className="absolute left-2 top-2.5 text-gray-500 group-focus-within:text-accent transition-colors" size={12} />
          {suggestion && search && !search.match(/\d/) && normalizeText(suggestion).startsWith(normalizeText(search)) && (
             <div className="absolute left-8 top-2 text-[10px] text-gray-500 pointer-events-none font-mono flex">
                <span className="opacity-0">{search}</span>
                <span className="opacity-50">{suggestion.slice(search.length)}</span>
                <span className="ml-2 text-[8px] border border-gray-700 rounded px-1 text-gray-600 bg-black/20">TAB</span>
             </div>
          )}
          <input type="text" placeholder="Ej: Rut 1 (Enter)..." value={search} onChange={handleSearchChange} onKeyDown={handleKeyDown}
            className="w-full bg-panel border border-white/10 rounded py-2 pl-8 pr-2 text-[10px] focus:border-accent outline-none font-medium placeholder:text-gray-600 relative z-10 bg-transparent" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-black/40 rounded-lg border border-white/5 p-2 scrollbar-thin">
        {view.mode === 'books' ? (
          <div className="grid grid-cols-1 gap-0.5">
            {filteredBooks.length > 0 ? (
                filteredBooks.map(b => (
                <div key={b.nombre} onClick={() => setView({ mode: 'chapters', book: b })}
                    className="p-2 text-[11px] text-gray-400 hover:bg-accent/20 hover:text-white rounded flex justify-between items-center group cursor-pointer transition-all border-b border-white/5">
                    <span className="font-medium">{b.nombre}</span>
                    <span className="text-[9px] text-gray-600 group-hover:text-accent">{b.capitulos}</span>
                </div>
                ))
            ) : (
                <div className="p-4 text-center text-gray-600 text-[10px] italic">Sin resultados...</div>
            )}
          </div>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
            <button onClick={() => setView({ mode: 'books', book: null })} className="flex items-center gap-1 text-accent text-[10px] font-black mb-4 hover:brightness-125 transition-all w-full border-b border-white/10 pb-2">
              <ChevronLeft size={14}/> {view.book.nombre}
            </button>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: view.book.capitulos }, (_, i) => (
                <div key={i} onClick={() => onSelectChapter(currentVersion, view.book.nombre, i + 1)}
                  className="aspect-square bg-panel hover:bg-accent flex items-center justify-center text-[10px] font-black rounded border border-white/5 cursor-pointer transition-all active:scale-90 shadow-sm">
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. SIDEBAR IZQUIERDO (SIN CAMBIOS MAYORES)
// ==========================================
const SidebarLeft = ({ favorites, setFavorites, onProjectFavorite }: any) => {
  const location = useLocation();
  const menuClass = (path: string) => `flex items-center gap-3 p-2.5 mx-2 rounded-lg transition-all text-xs font-medium ${location.pathname === path ? 'bg-accent text-white shadow-md' : 'text-gray-400 hover:bg-panel/50 hover:text-gray-200'}`;

  const removeFavorite = (idx: number, e: any) => {
      e.stopPropagation();
      setFavorites(favorites.filter((_: any, i: number) => i !== idx));
  };

  return (
    <aside className="w-60 bg-sidebar border-r border-black/50 flex flex-col h-full shrink-0 z-20 shadow-xl">
      <div className="h-14 flex items-center px-4 border-b border-white/5 gap-2">
        <MonitorPlay size={20} className="text-accent" />
        <span className="font-black text-sm tracking-tight text-gray-100">WORSHIP RS</span>
      </div>
      
      <nav className="flex-1 py-3 space-y-1">
        <Link to="/" className={menuClass('/')}><Music size={16}/> Cantos</Link>
        <Link to="/bibles" className={menuClass('/bibles')}><BookOpen size={16}/> Biblias</Link>
        <div className="pt-4 pb-2 text-[9px] font-bold text-gray-600 uppercase px-4 tracking-widest">Multimedia</div>
        <Link to="#" className={menuClass('/images')}><Image size={16}/> Imágenes</Link>
        <Link to="#" className={menuClass('/videos')}><Video size={16}/> Videos</Link>
        <Link to="#" className={menuClass('/pdf')}><FileText size={16}/> Presentación PDF</Link>
      </nav>

      <div className="h-[500px] bg-black/20 border-t border-white/5 p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-yellow-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
            <Star size={10} fill="currentColor"/> Favoritos ({favorites.length})
          </span>
          {favorites.length > 0 && (
             <span className="text-[8px] text-gray-600 cursor-pointer hover:text-red-500" onClick={() => setFavorites([])}>Limpiar</span>
          )}
        </div>

        <div className={`flex-1 rounded-lg flex flex-col p-1 overflow-y-auto scrollbar-thin transition-colors ${favorites.length === 0 ? 'bg-panel/10 border-2 border-dashed border-white/5 justify-center items-center' : 'bg-transparent'}`}>
           {favorites.length === 0 ? (
             <p className="text-[9px] text-gray-500 font-medium uppercase text-center pointer-events-none">
               Selecciona la estrella <br/> para añadir aquí
             </p>
           ) : (
             <div className="space-y-1.5 w-full pb-2">
               {favorites.map((fav: any, idx: number) => (
                  <div key={idx} onDoubleClick={() => onProjectFavorite(fav)}
                       className="bg-panel border border-white/5 p-3 rounded group relative cursor-pointer hover:bg-accent/20 hover:border-accent/50 transition-all shadow-sm flex items-center justify-between">
                      <span className="text-[11px] font-black text-accent truncate">
                          {fav.libro} {fav.capitulo}:{fav.versiculo}
                      </span>
                      <span className="text-[9px] font-bold text-gray-500 bg-black/20 px-1.5 py-0.5 rounded border border-white/5 ml-2 min-w-[30px] text-center">
                          {getShortVersion(fav.versionName)}
                      </span>
                      <button onClick={(e) => removeFavorite(idx, e)} className="absolute -right-2 -top-2 bg-red-500/90 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-md">
                         <Trash2 size={10} />
                      </button>
                  </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </aside>
  );
};

// ==========================================
// 4. DASHBOARD (PANEL CENTRAL)
// ==========================================
const DashboardLayout = () => {
  const [currentChapter, setCurrentChapter] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState("");
  const [activeBookInfo, setActiveBookInfo] = useState({ book: "", cap: 0 });
  const [previewVerse, setPreviewVerse] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    if (activeVersion && activeBookInfo.book) {
       loadChapter(activeVersion, activeBookInfo.book, activeBookInfo.cap);
    }
  }, [activeVersion]);

  useEffect(() => {
    // SCROLL AUTOMÁTICO
    if (previewVerse) {
        const index = currentChapter.findIndex(v => isSameVerse(v, previewVerse));
        if (index !== -1) {
            const element = document.getElementById(`verse-${index}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    // NAVEGACIÓN CON TECLADO
    const handleKeyDown = (e: KeyboardEvent) => {
        if (document.activeElement?.tagName === 'INPUT') return;
        
        if (!currentChapter.length || !previewVerse) return;

        const currentIndex = currentChapter.findIndex(v => isSameVerse(v, previewVerse));
        if (currentIndex === -1) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = currentChapter[currentIndex + 1];
            if (next) projectVerse(next);
        }
        if (e.key === 'ArrowUp') {
             e.preventDefault();
             const prev = currentChapter[currentIndex - 1];
             if (prev) projectVerse(prev);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

  }, [previewVerse, currentChapter]);

  const loadChapter = (version: string, book: string, cap: number) => {
    invoke("get_chapter_verses", { version, book, cap }).then((verses: any) => {
      setCurrentChapter(verses);
      setActiveBookInfo({ book, cap });
    });
  };

  const handleDirectSearch = (version: string, book: string, cap: number, ver: number) => {
    invoke("get_single_verse", { version, book, cap, ver }).then((verse: any) => {
      if (verse) {
        loadChapter(version, book, cap);
        projectVerse({ ...verse, versionName: version });
      } else {
        console.warn("Versículo no encontrado");
      }
    });
  };

  const projectVerse = (verse: any) => {
    const verseWithVersion = { ...verse, versionName: verse.versionName || activeVersion };
    invoke("trigger_projection", { verse: verseWithVersion });
    setPreviewVerse(verseWithVersion);
  };

  const toggleFavorite = (verse: any, e: any) => {
      e.stopPropagation();
      const verseData = { ...verse, versionName: activeVersion };
      const exists = favorites.some((f: any) => isSameVerse(f, verseData));
      
      if (exists) {
          setFavorites(favorites.filter((f: any) => !isSameVerse(f, verseData)));
      } else {
          setFavorites([...favorites, verseData]);
      }
  };

  const isFavorite = (verse: any) => {
      return favorites.some((f: any) => isSameVerse(f, verse));
  };

  const isLive = (verse: any) => {
      return isSameVerse(previewVerse, verse);
  };

  return (
    <div className="flex h-screen w-screen bg-mainbg text-gray-100 overflow-hidden font-sans select-none">
      
      <SidebarLeft favorites={favorites} setFavorites={setFavorites} onProjectFavorite={projectVerse} />

      <main className="flex-1 flex flex-col border-r border-black/50 bg-mainbg shadow-inner relative z-10">
        <header className="h-14 border-b border-white/5 flex items-center px-8 justify-between bg-black/10">
          <div className="flex flex-col">
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Panel de Edición</span>
             <span className="text-lg font-black text-accent tracking-tight">
                {activeBookInfo.book || "Biblia"} <span className="text-gray-400">{activeBookInfo.cap > 0 ? activeBookInfo.cap : ""}</span>
             </span>
          </div>
          <Settings size={16} className="text-gray-700 hover:text-gray-300 cursor-pointer" />
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sidebar via-mainbg to-mainbg scrollbar-thin" ref={scrollRef}>
          {currentChapter.length > 0 ? (
            <div className="max-w-4xl mx-auto space-y-4">
              {currentChapter.map((v, i) => {
                const isFav = isFavorite(v);
                const active = isLive(v); 

                return (
                  <div 
                    key={i} 
                    id={`verse-${i}`}
                    onDoubleClick={() => projectVerse(v)} 
                    className={`group relative p-4 pr-12 rounded-xl border transition-all cursor-pointer ${active ? 'bg-accent/10 border-accent' : 'hover:bg-accent/5 border-transparent hover:border-accent/20'}`}>
                    
                    <span className={`absolute right-12 top-4 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity border px-1 rounded mr-2 ${active ? 'text-accent border-accent opacity-100' : 'text-gray-500 border-gray-600'}`}>
                       {active ? 'EN VIVO' : 'PROYECTAR'}
                    </span>

                    <button 
                        onClick={(e) => toggleFavorite(v, e)}
                        className="absolute right-4 top-4 transition-transform active:scale-90 hover:scale-110"
                        title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
                    >
                        <Star 
                            size={18} 
                            className={isFav ? "text-yellow-500" : "text-gray-600 hover:text-yellow-500"} 
                            fill={isFav ? "currentColor" : "none"}
                        />
                    </button>
                    
                    <p className={`text-xl leading-relaxed font-serif ${active ? 'text-white' : 'text-gray-300'}`}>
                      <span className="text-accent font-sans font-black text-xs mr-3 align-top select-none">{v.versiculo}</span>
                      {v.texto}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
                <BookOpen size={80} className="mb-4" />
                <p className="text-xl font-black italic">SELECCIONA UN CAPÍTULO A LA DERECHA</p>
            </div>
          )}
        </div>
      </main>

      <aside className="w-[340px] bg-sidebar flex flex-col h-full shadow-2xl relative z-10">
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="h-10 border-b border-white/5 flex items-center px-4 bg-panel/10">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Biblioteca</span>
            </div>
            <div className="flex-1 overflow-hidden">
               <Routes>
                  <Route path="/" element={<div className="p-10 text-center text-gray-500 text-xs">Lista de Cantos Aquí</div>} />
                  <Route path="/bibles" element={
                     <BiblesLibrary 
                        currentVersion={activeVersion} 
                        onVersionChange={setActiveVersion}
                        onSelectChapter={loadChapter} 
                        onDirectSearch={handleDirectSearch}
                     />
                  } />
               </Routes>
            </div>
        </div>

        <div className="h-52 bg-black/60 p-5 flex flex-col border-t border-white/10 backdrop-blur-md">
          <div className="flex-1 flex flex-col items-center justify-center border border-white/5 rounded-xl mb-4 bg-black relative overflow-hidden group">
             {previewVerse ? (
                <div className="text-center p-4">
                    <p className="text-white font-bold text-[10px] line-clamp-3 leading-tight mb-2">"{previewVerse.texto}"</p>
                    <p className="text-[8px] text-accent font-black uppercase">{previewVerse.libro} {previewVerse.capitulo}:{previewVerse.versiculo}</p>
                </div>
             ) : (
                <div className="text-center">
                    <p className="text-gray-600 font-bold text-[10px]">Sin salida</p>
                </div>
             )}
             <span className="absolute bottom-1 right-2 text-[8px] font-mono text-gray-700">LIVE</span>
          </div>
          <button onClick={() => invoke('open_projector')} className="bg-live hover:bg-live/90 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
             <MonitorPlay size={12}/> Abrir Proyector
          </button>
        </div>
      </aside>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/projector" element={<ProjectorView />} />
        <Route path="/*" element={<DashboardLayout />} />
      </Routes>
    </Router>
  );
}