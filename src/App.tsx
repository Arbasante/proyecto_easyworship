import { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Music, BookOpen, Image, Video, FileText, Star, MonitorPlay, Search, ChevronLeft, Settings, Trash2, Palette, Upload, Type, X, Plus } from "lucide-react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
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
// 1. VISTA DEL PROYECTOR
// ==========================================
const ProjectorView = () => {
  const [liveVerse, setLiveVerse] = useState<any>(null);
  const [displayVerse, setDisplayVerse] = useState<any>(null);
  const [fontSize, setFontSize] = useState(100);
  const [opacity, setOpacity] = useState(0);
  
  const [styles, setStyles] = useState({ 
      bgColor: '#000000', 
      textColor: '#ffffff', 
      bgImage: '' 
  });

  useEffect(() => {
    const un1 = listen("update-proyeccion", (e: any) => setLiveVerse(e.payload));
    const un2 = listen("update-styles", (e: any) => setStyles(e.payload));
    return () => { un1.then(f => f()); un2.then(f => f()); };
  }, []);

  useEffect(() => {
    if (!liveVerse) return;
    setOpacity(0);
    const timeout = setTimeout(() => {
        const length = liveVerse.texto.length;
        let newSize = 100;
        if (length < 20) newSize = 220;
        else if (length < 50) newSize = 160;
        else if (length < 100) newSize = 110;
        else if (length < 180) newSize = 85;
        else if (length < 300) newSize = 65;
        else newSize = 50;

        setFontSize(newSize);
        setDisplayVerse(liveVerse);
        requestAnimationFrame(() => setOpacity(1));
    }, 250);
    return () => clearTimeout(timeout);
  }, [liveVerse]);

  const containerStyle: any = {
      backgroundColor: styles.bgColor,
      color: styles.textColor,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
  };

  if (styles.bgImage) {
      containerStyle.backgroundImage = `url('${convertFileSrc(styles.bgImage)}')`;
  } else {
      containerStyle.backgroundImage = 'none';
  }

  return (
    <div 
        className="h-screen w-screen flex flex-col justify-center items-center p-6 select-none overflow-hidden bg-cover bg-center transition-all duration-500"
        style={containerStyle}
    >
      {displayVerse && (
        <div className="w-full h-full flex flex-col justify-center transition-opacity duration-300" style={{ opacity }}>
          <div className="flex-1 flex items-center justify-center">
            <p style={{ fontSize: `${fontSize}px`, lineHeight: 1.1 }} className="font-bold text-center font-sans w-full leading-tight">
                "{displayVerse.texto}"
            </p>
          </div>
          <div className="flex justify-end mt-2">
             <div className="border-r-8 pr-4" style={{ borderColor: styles.textColor === '#ffffff' ? '#3b82f6' : styles.textColor }}>
                <p className="text-5xl font-black italic uppercase tracking-widest">
                   {displayVerse.libro} {displayVerse.capitulo}:{displayVerse.versiculo}
                </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. BIBLIOTECA (ACTUALIZADO: RVR 1960 POR DEFECTO)
// ==========================================
const BiblesLibrary = ({ onSelectChapter, onDirectSearch, currentVersion, onVersionChange }: any) => {
  const [versions, setVersions] = useState<string[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [view, setView] = useState({ mode: 'books', book: null as any });
  const [search, setSearch] = useState("");
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    invoke("get_bible_versions").then((v: any) => {
      // ORDENAMOS LAS VERSIONES: "1960" de primera, el resto alfabéticamente
      const sortedVersions = [...v].sort((a: string, b: string) => {
          const aIs1960 = a.includes("1960");
          const bIs1960 = b.includes("1960");
          if (aIs1960 && !bIs1960) return -1;
          if (!aIs1960 && bIs1960) return 1;
          return a.localeCompare(b);
      });

      setVersions(sortedVersions);
      
      // Seleccionamos la primera por defecto (que ahora será la 1960 si existe)
      if (sortedVersions.length > 0 && !currentVersion) {
          onVersionChange(sortedVersions[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (currentVersion) invoke("get_books", { version: currentVersion }).then((b: any) => setBooks(b));
  }, [currentVersion]);

  const handleSearchChange = (e: any) => {
    const val = e.target.value;
    setSearch(val);
    if (val && !val.match(/\d/) && books.length > 0) {
        const normVal = normalizeText(val);
        const match = books.find(b => normalizeText(b.nombre).startsWith(normVal));
        if (match && normalizeText(match.nombre) !== normVal) setSuggestion(match.nombre);
        else setSuggestion("");
    } else { setSuggestion(""); }
  };

  const handleKeyDown = (e: any) => {
    if ((e.key === 'ArrowRight' || e.key === 'Tab') && suggestion) {
        e.preventDefault(); setSearch(suggestion + " "); setSuggestion("");
    }
    if (e.key === 'Enter') {
        const matchFull = search.match(/(.+?)\s+(\d+)[:\s](\d+)/);
        const matchCap = search.match(/(.+?)\s+(\d+)$/);
        let rawBook = "", cap = 0, ver = 1;

        if (matchFull) {
            rawBook = matchFull[1].trim(); cap = parseInt(matchFull[2]); ver = parseInt(matchFull[3]);
        } else if (matchCap) {
            rawBook = matchCap[1].trim(); cap = parseInt(matchCap[2]);
        }

        if (rawBook) {
            const realBook = books.find(b => normalizeText(b.nombre) === normalizeText(rawBook));
            if (realBook) {
                onDirectSearch(currentVersion, realBook.nombre, cap, ver);
                setSearch(""); setSuggestion("");
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
            {filteredBooks.length > 0 ? filteredBooks.map(b => (
              <div key={b.nombre} onClick={() => setView({ mode: 'chapters', book: b })}
                className="p-2 text-[11px] text-gray-400 hover:bg-accent/20 hover:text-white rounded flex justify-between items-center group cursor-pointer transition-all border-b border-white/5">
                <span className="font-medium">{b.nombre}</span>
                <span className="text-[9px] text-gray-600 group-hover:text-accent">{b.capitulos}</span>
              </div>
            )) : <div className="p-4 text-center text-gray-600 text-[10px] italic">Sin resultados...</div>}
          </div>
        ) : (
          <div className="animate-in slide-in-from-right duration-300 flex flex-col h-full">
            <button onClick={() => setView({ mode: 'books', book: null })} className="flex items-center gap-1 text-accent text-[10px] font-black mb-4 hover:brightness-125 transition-all w-full border-b border-white/10 pb-2 flex-shrink-0">
              <ChevronLeft size={14}/> {view.book.nombre}
            </button>
            <div className="flex-1 overflow-y-auto scrollbar-thin pb-2">
                <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: view.book.capitulos }, (_, i) => (
                    <div key={i} onClick={() => onSelectChapter(currentVersion, view.book.nombre, i + 1)}
                    className="aspect-square bg-panel hover:bg-accent flex items-center justify-center text-[10px] font-black rounded border border-white/5 cursor-pointer transition-all active:scale-90 shadow-sm">
                    {i + 1}
                    </div>
                ))}
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. SIDEBAR IZQUIERDO
// ==========================================
const SidebarLeft = ({ favorites, setFavorites, onProjectFavorite }: any) => {
  const location = useLocation();
  const menuClass = (path: string) => `flex items-center gap-3 p-2.5 mx-2 rounded-lg transition-all text-xs font-medium ${location.pathname === path ? 'bg-accent text-white shadow-md' : 'text-gray-400 hover:bg-panel/50 hover:text-gray-200'}`;
  const removeFavorite = (idx: number, e: any) => { e.stopPropagation(); setFavorites(favorites.filter((_: any, i: number) => i !== idx)); };

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
          <span className="text-yellow-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1"><Star size={10} fill="currentColor"/> Favoritos ({favorites.length})</span>
          {favorites.length > 0 && <span className="text-[8px] text-gray-600 cursor-pointer hover:text-red-500" onClick={() => setFavorites([])}>Limpiar</span>}
        </div>
        <div className={`flex-1 rounded-lg flex flex-col p-1 overflow-y-auto scrollbar-thin transition-colors ${favorites.length === 0 ? 'bg-panel/10 border-2 border-dashed border-white/5 justify-center items-center' : 'bg-transparent'}`}>
           {favorites.length === 0 ? (
             <p className="text-[9px] text-gray-500 font-medium uppercase text-center pointer-events-none">Selecciona la estrella <br/> para añadir aquí</p>
           ) : (
             <div className="space-y-1.5 w-full pb-2">
               {favorites.map((fav: any, idx: number) => (
                  <div key={idx} onDoubleClick={() => onProjectFavorite(fav)} className="bg-panel border border-white/5 p-3 rounded group relative cursor-pointer hover:bg-accent/20 transition-all shadow-sm flex items-center justify-between">
                      <span className="text-[11px] font-black text-accent truncate">{fav.libro} {fav.capitulo}:{fav.versiculo}</span>
                      <span className="text-[9px] font-bold text-gray-500 bg-black/20 px-1.5 py-0.5 rounded border border-white/5 ml-2 min-w-[30px] text-center">{getShortVersion(fav.versionName)}</span>
                      <button onClick={(e) => removeFavorite(idx, e)} className="absolute -right-2 -top-2 bg-red-500/90 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-md"><Trash2 size={10} /></button>
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
// 4. DASHBOARD
// ==========================================
const DashboardLayout = () => {
  const [currentChapter, setCurrentChapter] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState("");
  const [activeBookInfo, setActiveBookInfo] = useState({ book: "", cap: 0 });
  const [previewVerse, setPreviewVerse] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null); 

  const [projStyles, setProjStyles] = useState({ bgColor: '#000000', textColor: '#ffffff', bgImage: '' });
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [recentImages, setRecentImages] = useState<string[]>([]);
  const presetColors = ['#ffffff', '#000000', '#facc15', '#22d3ee', '#f87171', '#4ade80'];

  useEffect(() => {
    if (activeVersion && activeBookInfo.book) loadChapter(activeVersion, activeBookInfo.book, activeBookInfo.cap);
  }, [activeVersion]);

  useEffect(() => {
    if (previewVerse) {
        const index = currentChapter.findIndex(v => isSameVerse(v, previewVerse));
        if (index !== -1) document.getElementById(`verse-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const handleKey = (e: KeyboardEvent) => {
        if (document.activeElement?.tagName === 'INPUT' || !currentChapter.length || !previewVerse) return;
        const idx = currentChapter.findIndex(v => isSameVerse(v, previewVerse));
        if (e.key === 'ArrowDown' && currentChapter[idx + 1]) projectVerse(currentChapter[idx + 1]);
        if (e.key === 'ArrowUp' && currentChapter[idx - 1]) projectVerse(currentChapter[idx - 1]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewVerse, currentChapter]);

  const loadChapter = (version: string, book: string, cap: number) => {
    invoke("get_chapter_verses", { version, book, cap }).then((verses: any) => {
      setCurrentChapter(verses);
      setActiveBookInfo({ book, cap });
    });
  };

  const projectVerse = (verse: any) => {
    const vWithVersion = { ...verse, versionName: verse.versionName || activeVersion };
    if (verse.libro !== activeBookInfo.book || verse.capitulo !== activeBookInfo.cap) {
        loadChapter(vWithVersion.versionName, verse.libro, verse.capitulo);
    }
    invoke("trigger_projection", { verse: vWithVersion });
    setPreviewVerse(vWithVersion);
  };

  const updateStyles = (newS: any) => {
    const s = { ...projStyles, ...newS };
    if (newS.bgColor && !newS.bgImage) s.bgImage = ""; 
    setProjStyles(s);
    invoke("trigger_style_update", { styles: s });
  };

  const handleBgImageUpload = async () => {
    try {
        const path = await invoke("select_background_image");
        if (path) {
            const pStr = path as string;
            if (!recentImages.includes(pStr)) setRecentImages([...recentImages, pStr]);
            updateStyles({ bgImage: pStr, bgColor: 'transparent' });
        }
    } catch (error) {
        console.error("Error seleccionando imagen:", error);
    }
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
                const isFav = favorites.some((f: any) => isSameVerse(f, v));
                const active = isSameVerse(previewVerse, v);
                return (
                  <div key={i} id={`verse-${i}`} onDoubleClick={() => projectVerse(v)} 
                    className={`group relative p-4 pr-12 rounded-xl border transition-all cursor-pointer ${active ? 'bg-accent/10 border-accent' : 'hover:bg-accent/5 border-transparent hover:border-accent/20'}`}>
                    <span className={`absolute right-12 top-4 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity border px-1 rounded mr-2 ${active ? 'text-accent border-accent opacity-100' : 'text-gray-500 border-gray-600'}`}>{active ? 'EN VIVO' : 'PROYECTAR'}</span>
                    <button onClick={(e) => { e.stopPropagation(); setFavorites(isFav ? favorites.filter(f=>!isSameVerse(f,v)) : [...favorites, {...v, versionName: activeVersion}]) }} 
                        className="absolute right-4 top-4 transition-transform active:scale-90 hover:scale-110">
                        <Star size={18} className={isFav ? "text-yellow-500" : "text-gray-600 hover:text-yellow-500"} fill={isFav ? "currentColor" : "none"}/>
                    </button>
                    <p className={`text-xl leading-relaxed font-serif ${active ? 'text-white' : 'text-gray-300'}`}><span className="text-accent font-sans font-black text-xs mr-3 align-top select-none">{v.versiculo}</span>{v.texto}</p>
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
                  <Route path="/bibles" element={<BiblesLibrary currentVersion={activeVersion} onVersionChange={setActiveVersion} onSelectChapter={loadChapter} onDirectSearch={(v:any, b:any, c:any, vr:any) => invoke("get_single_verse", {version:v,book:b,cap:c,ver:vr}).then((r:any)=>r&&projectVerse(r))} />} />
               </Routes>
            </div>
        </div>

        <div className="flex-shrink-0 relative z-20 mt-2 pl-4">
             <button 
                onClick={() => setShowStyleModal(true)} 
                className="bg-accent hover:bg-accent/90 text-white text-[9px] font-bold uppercase py-1 px-4 rounded-t-lg shadow-sm flex items-center gap-2 transition-all translate-y-[1px]"
            >
                <Palette size={10}/> PERSONALIZAR
            </button>
        </div>

        <div className="p-4 bg-black/40 border-t border-white/10 space-y-3 relative z-10">
            <div className="h-28 bg-black rounded-lg flex items-center justify-center border border-white/5 relative overflow-hidden bg-cover bg-center"
                 style={{ 
                    backgroundImage: projStyles.bgImage ? `url('${convertFileSrc(projStyles.bgImage)}')` : 'none',
                    backgroundColor: projStyles.bgColor 
                 }}>
                 {previewVerse ? (
                    <div className="p-3 text-center w-full">
                        <p className="text-[10px] font-bold line-clamp-3 leading-tight" style={{ color: projStyles.textColor }}>"{previewVerse.texto}"</p>
                    </div>
                 ) : (
                    <span className="text-[10px] opacity-20 uppercase font-black">Monitor</span>
                 )}
            </div>

            <button onClick={() => invoke('open_projector')} className="w-full py-3 bg-red-600 hover:bg-red-500 rounded text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                <MonitorPlay size={12}/> Abrir Proyector
            </button>
        </div>
      </aside>

      {/* --- VENTANA FLOTANTE --- */}
      {showStyleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-sidebar border border-white/10 w-[500px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-center p-4 border-b border-white/5 bg-panel/50">
                    <h2 className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2">
                        <Palette size={14}/> Personalizar Proyección
                    </h2>
                    <button onClick={() => setShowStyleModal(false)} className="text-gray-500 hover:text-white transition-colors">
                        <X size={16}/>
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div>
                        <p className="text-[9px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1"><Image size={10}/> Fondo de Pantalla</p>
                        
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div onClick={() => updateStyles({ bgColor: '#000000', bgImage: '' })} 
                                className={`aspect-video rounded-lg bg-black border cursor-pointer flex items-center justify-center ${projStyles.bgColor==='#000000' && !projStyles.bgImage ? 'border-accent ring-1 ring-accent' : 'border-white/20 hover:border-white/50'}`}>
                                <span className="text-[8px] text-gray-700 font-bold">NEGRO</span>
                            </div>
                            <div onClick={() => updateStyles({ bgColor: '#ffffff', bgImage: '' })} 
                                className={`aspect-video rounded-lg bg-white border cursor-pointer flex items-center justify-center ${projStyles.bgColor==='#ffffff' && !projStyles.bgImage ? 'border-accent ring-1 ring-accent' : 'border-white/20 hover:border-white/50'}`}>
                                <span className="text-[8px] text-gray-300 font-bold">BLANCO</span>
                            </div>
                            <div onClick={handleBgImageUpload} 
                                className="aspect-video rounded-lg bg-panel border border-dashed border-white/20 cursor-pointer flex flex-col items-center justify-center gap-1 hover:bg-white/5 hover:border-accent text-gray-500 hover:text-accent transition-all">
                                <Plus size={14} />
                                <span className="text-[8px] font-bold">AGREGAR</span>
                            </div>
                        </div>

                        {recentImages.length > 0 && (
                            <div>
                                <p className="text-[8px] font-bold text-gray-600 mb-2 uppercase">Galería</p>
                                <div className="grid grid-cols-4 gap-3">
                                    {recentImages.map((img, idx) => (
                                        <div key={idx} onClick={() => updateStyles({ bgImage: img, bgColor: 'transparent' })}
                                             className={`aspect-video rounded-lg border cursor-pointer bg-cover bg-center relative group ${projStyles.bgImage === img ? 'border-accent ring-1 ring-accent' : 'border-white/10 hover:border-white/40'}`}
                                             style={{ backgroundImage: `url('${convertFileSrc(img)}')` }}>
                                             <button onClick={(e) => {e.stopPropagation(); setRecentImages(recentImages.filter(i => i !== img))}} 
                                                className="absolute top-1 right-1 bg-black/50 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500">
                                                <X size={8}/>
                                             </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-[9px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1"><Type size={10}/> Color del Texto</p>
                        <div className="flex gap-3 items-center bg-black/20 p-3 rounded-lg border border-white/5">
                            {presetColors.map(c => (
                                <div key={c} onClick={() => updateStyles({ textColor: c })} 
                                    className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${projStyles.textColor === c ? 'border-accent scale-125 ring-2 ring-accent/30' : 'border-white/20 hover:scale-110'}`} style={{ backgroundColor: c }}></div>
                            ))}
                            <div className="w-px h-6 bg-white/10 mx-1"></div>
                            <div className="relative group">
                                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 cursor-pointer group-hover:border-accent">
                                    <Type size={12} className="text-white drop-shadow-md"/>
                                </div>
                                <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" 
                                    value={projStyles.textColor} onChange={(e) => updateStyles({ textColor: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
                    <button onClick={() => setShowStyleModal(false)} className="bg-white text-black px-6 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-gray-200 transition-colors">
                        Listo
                    </button>
                </div>
            </div>
        </div>
      )}

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