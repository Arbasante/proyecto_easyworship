import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Music, BookOpen, Image as ImageIcon, Video, FileText, Star, MonitorPlay, Search, ChevronLeft, ChevronRight, Settings, Trash2, Palette, X, Plus, Edit2, AlertTriangle, Type, Maximize, Minimize, Play, Pause, RotateCcw, Clapperboard } from "lucide-react";
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
    if (v1.tipo === 'imagen' || v2.tipo === 'imagen' || v1.tipo === 'video' || v2.tipo === 'video') return v1.ruta === v2.ruta;
    return v1.libro === v2.libro && v1.capitulo === v2.capitulo && v1.versiculo === v2.versiculo;
};

// ==========================================
// 1. VISTA DEL PROYECTOR 
// ==========================================
const ProjectorView = () => {
  const [liveVerse, setLiveVerse] = useState<any>(null);
  const [displayVerse, setDisplayVerse] = useState<any>(null);
  const [fontSize, setFontSize] = useState(100);
  const [opacity, setOpacity] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // NUEVO: Agregamos bgVideo al estado
  const [styles, setStyles] = useState({ 
      biblia: { bgColor: '#000000', textColor: '#ffffff', bgImage: '', bgVideo: '' },
      cantos: { bgColor: '#000000', textColor: '#ffffff', bgImage: '', bgVideo: '' }
  });

  useEffect(() => {
    const un1 = listen("update-proyeccion", (e: any) => setLiveVerse(e.payload));
    const un2 = listen("update-styles", (e: any) => setStyles(e.payload));
    
    const un3 = listen("video-control", (e: any) => {
        if (!videoRef.current) return;
        const action = e.payload;
        if (action === 'play') videoRef.current.play();
        if (action === 'pause') videoRef.current.pause();
        if (action === 'restart') {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    });

    return () => { un1.then(f => f()); un2.then(f => f()); un3.then(f => f()); };
  }, []);

  useEffect(() => {
    if (!liveVerse) return;
    setOpacity(0);
    const timeout = setTimeout(() => { setDisplayVerse(liveVerse); }, 250);
    return () => clearTimeout(timeout);
  }, [liveVerse]);

  useLayoutEffect(() => {
    if (!displayVerse || displayVerse.tipo === 'imagen' || displayVerse.tipo === 'video' || displayVerse.tipo === 'pdf' || !containerRef.current || !textRef.current) {
        if (displayVerse?.tipo === 'imagen' || displayVerse?.tipo === 'video' || displayVerse?.tipo === 'pdf') requestAnimationFrame(() => setOpacity(1));
        return;
    }
    const container = containerRef.current;
    const text = textRef.current;
    let min = 20; let max = 300; let best = 20;

    while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        text.style.fontSize = `${mid}px`;
        if (text.scrollHeight <= container.clientHeight && text.scrollWidth <= container.clientWidth) {
            best = mid; min = mid + 1;  
        } else { max = mid - 1; }
    }
    const finalSize = best - 2;
    setFontSize(finalSize);
    text.style.fontSize = `${finalSize}px`;
    requestAnimationFrame(() => setOpacity(1));
  }, [displayVerse]);

  // ---> AQUÍ AGREGAMOS EL RENDER DEL PDF
  if (displayVerse?.tipo === 'pdf') {
      return (
          <div className="h-screen w-screen bg-black transition-opacity duration-500 flex items-center justify-center overflow-hidden" style={{ opacity }}>
              <iframe 
                  key={`${displayVerse.ruta}-${displayVerse.pagina}`}
                  src={`${convertFileSrc(displayVerse.ruta)}#page=${displayVerse.pagina}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`} 
                  className="w-full h-full border-none bg-black pointer-events-none" 
              />
          </div>
      );
  }

  // RENDER: VIDEO MULTIMEDIA
  if (displayVerse?.tipo === 'video') {
      return (
          <div className="h-screen w-screen bg-black transition-opacity duration-500 flex items-center justify-center overflow-hidden" style={{ opacity }}>
              <video 
                  ref={videoRef}
                  src={convertFileSrc(displayVerse.ruta)} 
                  className="w-full h-full object-contain" 
                  autoPlay 
                  loop={displayVerse.bucle} // <--- APLICAMOS EL BUCLE
              />
          </div>
      );
  }

  // RENDER: IMAGEN MULTIMEDIA
  if (displayVerse?.tipo === 'imagen') {
      const fitClass = displayVerse.aspecto === 'cover' ? 'w-full h-full object-cover' : displayVerse.aspecto === 'fill' ? 'w-full h-full object-fill' : 'max-w-full max-h-full object-contain'; 
      return (
          <div className="h-screen w-screen bg-black transition-opacity duration-500 flex items-center justify-center overflow-hidden" style={{ opacity }}>
              <img src={convertFileSrc(displayVerse.ruta)} className={fitClass} />
          </div>
      );
  }

  // RENDER: TEXTO CON FONDO (IMAGEN O VIDEO)
  const isCanto = displayVerse?.capitulo === 0;
  const currentStyle = isCanto ? styles.cantos : styles.biblia;
  
  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center select-none overflow-hidden transition-all duration-500 relative" style={{ backgroundColor: currentStyle?.bgColor || '#000', color: currentStyle?.textColor || '#fff' }}>
      
      {/* CAPA DE FONDO: Imagen o Video */}
      {currentStyle?.bgImage && <img src={convertFileSrc(currentStyle.bgImage)} className="absolute inset-0 w-full h-full object-cover z-0" />}
      {currentStyle?.bgVideo && <video src={convertFileSrc(currentStyle.bgVideo)} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover z-0" />}
      
      {/* CAPA DE TEXTO */}
      {displayVerse && (
        <div className="w-full h-full flex flex-col justify-between transition-opacity duration-300 px-8 py-8 relative z-10" style={{ opacity }}>
          <div ref={containerRef} className="flex-1 w-full flex items-center justify-center min-h-0 min-w-0">
            <p ref={textRef} style={{ fontSize: `${fontSize}px`, lineHeight: 1.25 }} className="font-bold text-center font-sans w-full max-w-full break-words whitespace-pre-line drop-shadow-md">
                {isCanto ? displayVerse.texto : `"${displayVerse.texto}"`}
            </p>
          </div>
          {!isCanto && (
            <div className="flex justify-end mt-4 shrink-0">
               <div className="border-r-8 pr-4" style={{ borderColor: currentStyle.textColor === '#ffffff' ? '#3b82f6' : currentStyle.textColor }}>
                  <p className="text-5xl font-black italic uppercase tracking-widest drop-shadow-md">
                     {displayVerse.libro} {displayVerse.capitulo}:{displayVerse.versiculo}
                  </p>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// EDITOR DE CANTOS
// ==========================================
const CantoEditorModal = ({ isEdit, initialData, onClose, onSave }: any) => {
    const [formData, setFormData] = useState(initialData || { titulo: '', letra: '' });

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-sidebar border border-white/10 w-[600px] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-white/5 bg-panel/50">
                    <h2 className="text-sm font-black uppercase text-accent tracking-widest flex items-center gap-2">
                        {isEdit ? <><Edit2 size={16}/> Editar Canto</> : <><Plus size={16}/> Nuevo Canto</>}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={18}/></button>
                </div>
                <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Título del Canto</label>
                        <input type="text" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} placeholder="Ej: Cuan Grande es Él" className="w-full bg-panel border border-white/10 rounded-lg p-3 text-sm focus:border-accent outline-none font-bold text-white shadow-inner" />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Letra</label>
                        <textarea value={formData.letra} onChange={(e) => setFormData({...formData, letra: e.target.value})} placeholder="Señor mi Dios..." className="w-full flex-1 bg-panel border border-white/10 rounded-lg p-4 text-sm focus:border-accent outline-none text-gray-300 shadow-inner min-h-[300px] resize-none custom-scrollbar leading-relaxed" />
                    </div>
                </div>
                <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 rounded-lg text-[10px] font-bold uppercase text-gray-400 hover:text-white transition-colors">Cancelar</button>
                    <button onClick={() => onSave(formData)} disabled={!formData.titulo.trim() || !formData.letra.trim()} className="bg-accent text-white px-6 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-accent/80 transition-colors disabled:opacity-50">Guardar</button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 2A. BIBLIOTECA DE CANTOS
// ==========================================
const CantosLibrary = ({ onSelectCanto, favorites, setFavorites, onCantoUpdated, onCantoDeleted }: any) => {
    const [cantos, setCantos] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, canto: any | null } | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editData, setEditData] = useState<any>(null); 
    const [showDeleteModal, setShowDeleteModal] = useState<any>(null);
  
    const loadCantosFromDB = () => { invoke("get_all_cantos").then((data: any) => setCantos(data)); };
    useEffect(() => { 
        loadCantosFromDB(); 
        // NUEVO: Escucha si Rust importó datos para actualizar la lista al instante
        const unlisten = listen("reload-cantos", () => loadCantosFromDB());
        return () => { unlisten.then(f => f()); };
    }, []);
  
    const filteredCantos = useMemo(() => {
        if (!search) return cantos;
        return cantos.filter(c => normalizeText(c.titulo).includes(normalizeText(search)));
    }, [cantos, search]);

    const toggleFavCanto = (e: any, canto: any) => {
        e.stopPropagation(); 
        const isFav = favorites.some((f: any) => f.cantoId === canto.id);
        if (isFav) setFavorites(favorites.filter((f: any) => f.cantoId !== canto.id));
        else setFavorites([...favorites, { isCanto: true, cantoId: canto.id, libro: canto.titulo, capitulo: 0, versiculo: '🎵', texto: 'Canto completo', versionName: 'CANTO', cantoData: canto }]);
    };

    const handleSongContextMenu = (e: React.MouseEvent, canto: any) => {
        e.preventDefault(); e.stopPropagation();
        let x = e.clientX; let y = e.clientY;
        if (window.innerHeight - y < 150) y -= 150; 
        if (window.innerWidth - x < 250) x -= 250;  
        setContextMenu({ x, y, canto });
    };

    const handleBgContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); let x = e.clientX; let y = e.clientY;
        if (window.innerHeight - y < 100) y -= 100;
        setContextMenu({ x, y, canto: null });
    };

    const closeContextMenu = () => setContextMenu(null);
    const openAddModal = () => { setShowAddModal(true); closeContextMenu(); };
    const openEditModal = async () => {
        const canto = contextMenu?.canto; closeContextMenu();
        if (!canto) return;
        const slides: any = await invoke("get_canto_diapositivas", { cantoId: canto.id });
        const letraCompleta = slides.map((s: any) => s.texto).join('\n\n');
        setEditData({ id: canto.id, titulo: canto.titulo, letra: letraCompleta });
    };
    const openDeleteModal = () => { setShowDeleteModal(contextMenu?.canto); closeContextMenu(); };

    const handleSaveAdd = async (data: any) => { setShowAddModal(false); await invoke("add_canto", { titulo: data.titulo, letra: data.letra }); loadCantosFromDB(); };
    const handleSaveEdit = async (data: any) => {
        const idToEdit = editData.id; setEditData(null);
        setCantos(prev => prev.map(c => c.id === idToEdit ? { ...c, titulo: data.titulo } : c));
        if (onCantoUpdated) onCantoUpdated(idToEdit, data.titulo, data.letra);
        await invoke("update_canto", { id: idToEdit, titulo: data.titulo, letra: data.letra });
    };
    const handleConfirmDelete = async () => {
        const idToDelete = showDeleteModal.id; setShowDeleteModal(null); 
        setCantos(prev => prev.filter(c => c.id !== idToDelete));
        setFavorites(favorites.filter((f: any) => f.cantoId !== idToDelete));
        if (onCantoDeleted) onCantoDeleted(idToDelete);
        await invoke("delete_canto", { id: idToDelete });
    };
  
    return (
      <div className="flex flex-col h-full p-3 select-none bg-sidebar/30 relative" onContextMenu={handleBgContextMenu}>
        <div className="mb-3 relative group">
           <Search className="absolute left-2 top-2.5 text-gray-500 group-focus-within:text-accent transition-colors" size={12} />
           <input type="text" placeholder="Buscar canto..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-panel border border-white/10 rounded py-2 pl-8 pr-2 text-[10px] focus:border-accent outline-none font-medium placeholder:text-gray-600 shadow-inner" />
        </div>
        <div className="flex-1 overflow-y-auto bg-black/40 rounded-lg border border-white/5 p-2 scrollbar-thin">
           <div className="grid grid-cols-1 gap-0.5">
              {filteredCantos.length > 0 ? filteredCantos.map(c => {
                 const isFav = favorites.some((f: any) => f.cantoId === c.id);
                 return (
                 <div key={c.id} onClick={() => onSelectCanto(c)} onContextMenu={(e) => handleSongContextMenu(e, c)} className="p-2 text-[11px] text-gray-400 hover:bg-accent/20 hover:text-white rounded flex justify-between items-center group cursor-pointer transition-all border-b border-white/5">
                    <span className="font-bold text-gray-200 group-hover:text-accent truncate pr-2">{c.titulo}</span>
                    <button onClick={(e) => toggleFavCanto(e, c)} className={`transition-all hover:scale-110 ${isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                       <Star size={14} className={isFav ? "text-yellow-500" : "text-gray-500 hover:text-yellow-500"} fill={isFav ? "currentColor" : "none"} />
                    </button>
                 </div>
              )}) : (<div className="p-4 text-center text-gray-600 text-[10px] italic pointer-events-none">Click derecho aquí para agregar un canto</div>)}
           </div>
        </div>

        {contextMenu && (
            <>
                <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}></div>
                <div className="fixed z-50 bg-sidebar border border-white/10 rounded-lg shadow-2xl py-1 w-44 animate-in fade-in zoom-in duration-150" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <button onClick={openAddModal} className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Plus size={12}/> Agregar Canto</button>
                    {contextMenu.canto && (
                        <>
                            <div className="h-px bg-white/5 my-1 mx-2"></div>
                            <button onClick={openEditModal} className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Edit2 size={12}/> Editar Canto</button>
                            <button onClick={openDeleteModal} className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/20 hover:text-red-500 flex items-center gap-2"><Trash2 size={12}/> Eliminar Canto</button>
                        </>
                    )}
                </div>
            </>
        )}

        {showAddModal && <CantoEditorModal isEdit={false} onClose={() => setShowAddModal(false)} onSave={handleSaveAdd} />}
        {editData && <CantoEditorModal isEdit={true} initialData={editData} onClose={() => setEditData(null)} onSave={handleSaveEdit} />}
        {showDeleteModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-sidebar border border-white/10 w-[400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-center">
                    <div className="p-8 pb-4 flex flex-col items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
                        <div><h3 className="text-lg font-black text-white mb-2">¿Eliminar Canto?</h3><p className="text-xs text-gray-400 leading-relaxed">Estás a punto de eliminar <strong className="text-white">"{showDeleteModal.titulo}"</strong>. <br/> Esta acción no se puede deshacer.</p></div>
                    </div>
                    <div className="p-4 bg-black/40 border-t border-white/5 flex gap-3 mt-4">
                        <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-gray-400 bg-panel hover:bg-white/5 transition-colors border border-white/5">No, Cancelar</button>
                        <button onClick={handleConfirmDelete} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20">Sí, Eliminar</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
};

// ==========================================
// 2B. BIBLIOTECA DE BIBLIAS
// ==========================================
const BiblesLibrary = ({ onSelectChapter, onDirectSearch, currentVersion, onVersionChange }: any) => {
  const [versions, setVersions] = useState<string[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [view, setView] = useState({ mode: 'books', book: null as any });
  const [search, setSearch] = useState("");
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    invoke("get_bible_versions").then((v: any) => {
      const sortedVersions = [...v].sort((a: string, b: string) => {
          const aIs1960 = a.includes("1960"); const bIs1960 = b.includes("1960");
          if (aIs1960 && !bIs1960) return -1; if (!aIs1960 && bIs1960) return 1; return a.localeCompare(b);
      });
      setVersions(sortedVersions);
      if (sortedVersions.length > 0 && !currentVersion) onVersionChange(sortedVersions[0]);
    });
  }, []);

  useEffect(() => { if (currentVersion) invoke("get_books", { version: currentVersion }).then((b: any) => setBooks(b)); }, [currentVersion]);

  const handleSearchChange = (e: any) => {
    const val = e.target.value; setSearch(val);
    if (val && !val.match(/\d/) && books.length > 0) {
        const normVal = normalizeText(val); const match = books.find(b => normalizeText(b.nombre).startsWith(normVal));
        if (match && normalizeText(match.nombre) !== normVal) setSuggestion(match.nombre); else setSuggestion("");
    } else { setSuggestion(""); }
  };

const handleKeyDown = (e: any) => {
    // 1. Aplica el autocompletado si presiona Tab o Flecha Derecha
    if ((e.key === 'ArrowRight' || e.key === 'Tab') && suggestion) { 
        e.preventDefault(); 
        setSearch(suggestion + " "); 
        setSuggestion(""); 
    }
    
    // 2. Ejecuta la búsqueda si presiona Enter
    if (e.key === 'Enter') {
        let rawBook = "", cap = 0, ver = 1;
        // La expresión regular ya soporta espacios y dos puntos ("gen 1 1" o "gen 1:1")
        const match = search.match(/(.+?)\s+(\d+)(?:[:\s](\d+))?/);
        if (match) { 
            rawBook = match[1].trim(); 
            cap = parseInt(match[2]); 
            if(match[3]) ver = parseInt(match[3]); 
        }
        
        if (rawBook) {
            const normRaw = normalizeText(rawBook); // Limpia tildes y pasa a minúsculas
            
            // BÚSQUEDA INTELIGENTE: 
            // Primero busca si el usuario escribió el nombre completo sin tildes (ej: "genesis")
            // Si no lo encuentra, busca si el libro "empieza con" lo escrito (ej: "gen")
            const realBook = books.find(b => normalizeText(b.nombre) === normRaw) 
                          || books.find(b => normalizeText(b.nombre).startsWith(normRaw));
            
            if (realBook) { 
                // Envía al proyector el nombre oficial correcto (ej: "Génesis")
                onDirectSearch(currentVersion, realBook.nombre, cap, ver); 
                setSearch(""); 
                setSuggestion(""); 
                e.target.blur();
            }
        }
    }
  };

  const filteredBooks = books.filter(b => normalizeText(b.nombre).includes(normalizeText(search)));

  return (
    <div className="flex flex-col h-full p-3 select-none bg-sidebar/30">
      <div className="flex gap-2 mb-3">
        <select value={currentVersion} onChange={(e) => onVersionChange(e.target.value)} className="bg-panel p-2 rounded border border-white/10 text-[10px] w-32 outline-none focus:border-accent font-bold truncate">
          {versions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="flex-1 relative group">
          <Search className="absolute left-2 top-2.5 text-gray-500 group-focus-within:text-accent transition-colors" size={12} />
          {suggestion && search && !search.match(/\d/) && normalizeText(suggestion).startsWith(normalizeText(search)) && (
             <div className="absolute left-8 top-2 text-[10px] text-gray-500 pointer-events-none font-mono flex"><span className="opacity-0">{search}</span><span className="opacity-50">{suggestion.slice(search.length)}</span></div>
          )}
          <input type="text" placeholder="Ej: Rut 1..." value={search} onChange={handleSearchChange} onKeyDown={handleKeyDown} className="w-full bg-panel border border-white/10 rounded py-2 pl-8 pr-2 text-[10px] focus:border-accent outline-none font-medium placeholder:text-gray-600 relative z-10 bg-transparent" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-black/40 rounded-lg border border-white/5 p-2 scrollbar-thin">
        {view.mode === 'books' ? (
          <div className="grid grid-cols-1 gap-0.5">
            {filteredBooks.map(b => (
              <div key={b.nombre} onClick={() => setView({ mode: 'chapters', book: b })} className="p-2 text-[11px] text-gray-400 hover:bg-accent/20 hover:text-white rounded flex justify-between items-center cursor-pointer border-b border-white/5">
                <span>{b.nombre}</span><span className="text-[9px] text-gray-600">{b.capitulos}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="animate-in slide-in-from-right duration-300 flex flex-col h-full">
            <button onClick={() => setView({ mode: 'books', book: null })} className="flex items-center gap-1 text-accent text-[10px] font-black mb-4 w-full border-b border-white/10 pb-2"><ChevronLeft size={14}/> {view.book.nombre}</button>
            <div className="flex-1 overflow-y-auto scrollbar-thin pb-2">
                <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: view.book.capitulos }, (_, i) => (
                    <div key={i} onClick={() => onSelectChapter(currentVersion, view.book.nombre, i + 1)} className="aspect-square bg-panel hover:bg-accent flex items-center justify-center text-[10px] font-black rounded border border-white/5 cursor-pointer">{i + 1}</div>
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
// 2C. BIBLIOTECA DE IMÁGENES
// ==========================================
const ImagesLibrary = ({ onSelectImage, onProjectImage, onImageDeleted, onImageAspectChanged }: any) => {
    const [images, setImages] = useState<any[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, image: any | null } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<any>(null); 
    const [showAspectSubMenu, setShowAspectSubMenu] = useState(false); 

    const loadImages = () => { invoke("get_all_images").then((data: any) => setImages(data)); };
    useEffect(() => { loadImages(); }, []);

    const handleBgContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); 
        let x = e.clientX; let y = e.clientY;
        
        // Evitar que se salga por la derecha o por abajo de la pantalla
        if (x + 220 > window.innerWidth) x = window.innerWidth - 220;
        if (y + 150 > window.innerHeight) y = window.innerHeight - 150;
        
        setContextMenu({ x, y, image: null }); setShowAspectSubMenu(false);
    };

    const handleItemContextMenu = (e: React.MouseEvent, img: any) => {
        e.preventDefault(); e.stopPropagation(); 
        let x = e.clientX; let y = e.clientY;
        
        // Evitar que se salga por la derecha o por abajo de la pantalla
        if (x + 220 > window.innerWidth) x = window.innerWidth - 220;
        if (y + 180 > window.innerHeight) y = window.innerHeight - 180;
        
        setContextMenu({ x, y, image: img }); setShowAspectSubMenu(false); 
    };

    const closeContextMenu = () => { setContextMenu(null); setShowAspectSubMenu(false); };

    const handleAddImage = async () => {
        closeContextMenu();
        try {
            const path = await invoke("select_background_image");
            if (path) {
                const pathStr = path as string;
                const nombre = pathStr.split(/[/\\]/).pop() || "Imagen";
                await invoke("add_image_db", { nombre, ruta: pathStr });
                loadImages();
            }
        } catch (error) { console.error("Error agregando imagen", error); }
    };

    const handleDeleteImage = async () => {
        if (!showDeleteModal) return;
        await invoke("delete_image_db", { id: showDeleteModal.id });
        if (onImageDeleted) onImageDeleted(showDeleteModal.ruta); 
        setShowDeleteModal(null); loadImages();
    };

    const handleAspectChange = async (newAspect: string) => {
        if (!contextMenu?.image) return;
        const imgId = contextMenu.image.id;
        await invoke("update_image_aspect", { id: imgId, aspecto: newAspect });
        setImages(prev => prev.map(img => img.id === imgId ? { ...img, aspecto: newAspect } : img));
        if (onImageAspectChanged) onImageAspectChanged(imgId, newAspect);
        closeContextMenu();
    };

    return (
        <div className="flex flex-col h-full p-3 select-none bg-sidebar/30 relative" onContextMenu={handleBgContextMenu}>
            <div className="flex-1 overflow-y-auto bg-black/40 rounded-lg border border-white/5 p-2 scrollbar-thin relative">
                {images.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                        <ImageIcon size={40} className="mb-2 text-gray-400" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-relaxed pointer-events-none">Presione clic derecho<br/>para ver las opciones</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1">
                        {images.map(img => (
                            <div key={img.id} onClick={() => onSelectImage(img)} onDoubleClick={() => onProjectImage(img)} onContextMenu={(e) => handleItemContextMenu(e, img)}
                                 className="p-1 text-[11px] text-gray-400 hover:bg-accent/20 hover:text-white rounded flex items-center gap-3 group cursor-pointer transition-all border border-transparent hover:border-white/10">
                                <img src={convertFileSrc(img.ruta)} className="w-16 h-10 object-cover rounded shadow-sm bg-black" alt={img.nombre} />
                                <span className="font-bold text-gray-300 group-hover:text-accent truncate flex-1 leading-tight">{img.nombre}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}></div>
                    <div className="fixed z-50 bg-sidebar border border-white/10 rounded-lg shadow-2xl py-1 w-52 animate-in fade-in zoom-in duration-150" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={handleAddImage} className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Plus size={12}/> Agregar Imagen</button>
                        {contextMenu.image && (
                            <>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <div className="relative group/aspect">
                                    <button onClick={(e) => { e.stopPropagation(); setShowAspectSubMenu(!showAspectSubMenu); }} className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center justify-between">
                                        <div className="flex items-center gap-2"><Maximize size={12}/> Aspecto de Imagen</div>
                                        <ChevronRight size={12} className={showAspectSubMenu ? "text-accent" : ""} />
                                    </button>
                                    
                                    {showAspectSubMenu && (
                                        <div className="absolute top-0 right-[98%] bg-sidebar border border-white/10 rounded-lg shadow-2xl py-1 w-48 animate-in slide-in-from-right-2 duration-150 z-50">
                                            <button onClick={() => handleAspectChange('contain')} className={`w-full text-left px-4 py-2 text-[11px] font-bold flex items-center gap-2 ${contextMenu.image.aspecto === 'contain' ? 'text-accent bg-accent/10' : 'text-gray-300 hover:bg-white/5'}`}><Minimize size={12}/> Ajustar al centro</button>
                                            <button onClick={() => handleAspectChange('cover')} className={`w-full text-left px-4 py-2 text-[11px] font-bold flex items-center gap-2 ${contextMenu.image.aspecto === 'cover' ? 'text-accent bg-accent/10' : 'text-gray-300 hover:bg-white/5'}`}><Maximize size={12}/> Rellenar pantalla</button>
                                            <button onClick={() => handleAspectChange('fill')} className={`w-full text-left px-4 py-2 text-[11px] font-bold flex items-center gap-2 ${contextMenu.image.aspecto === 'fill' ? 'text-accent bg-accent/10' : 'text-gray-300 hover:bg-white/5'}`}><Type size={12}/> Estirar</button>
                                        </div>
                                    )}
                                </div>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button onClick={() => { setShowDeleteModal(contextMenu.image); closeContextMenu(); }} className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/20 hover:text-red-500 flex items-center gap-2"><Trash2 size={12}/> Eliminar Imagen</button>
                            </>
                        )}
                    </div>
                </>
            )}

            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-sidebar border border-white/10 w-[400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-center">
                        <div className="p-8 pb-4 flex flex-col items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
                            <div><h3 className="text-lg font-black text-white mb-2">¿Eliminar Imagen?</h3><p className="text-xs text-gray-400 leading-relaxed">Desaparecerá de la biblioteca.</p></div>
                        </div>
                        <div className="p-4 bg-black/40 border-t border-white/5 flex gap-3 mt-4">
                            <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-gray-400 bg-panel hover:bg-white/5 transition-colors border border-white/5">No, Cancelar</button>
                            <button onClick={handleDeleteImage} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// 2D. BIBLIOTECA DE VIDEOS (NUEVO CON BUCLE)
// ==========================================
const VideosLibrary = ({ onSelectVideo, onProjectVideo, onVideoDeleted, onVideoLoopChanged }: any) => {
    const [videos, setVideos] = useState<any[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, video: any | null } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<any>(null);
    const [showLoopSubMenu, setShowLoopSubMenu] = useState(false);

    const loadVideos = () => { invoke("get_all_videos").then((data: any) => setVideos(data)); };
    useEffect(() => { loadVideos(); }, []);

    const handleBgContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); let x = e.clientX; let y = e.clientY;
        if (window.innerHeight - y < 100) y -= 100;
        setContextMenu({ x, y, video: null });
        setShowLoopSubMenu(false);
    };

    const handleItemContextMenu = (e: React.MouseEvent, vid: any) => {
        e.preventDefault(); e.stopPropagation(); let x = e.clientX; let y = e.clientY;
        if (window.innerHeight - y < 150) y -= 150; 
        if (window.innerWidth - x < 250) x -= 250;  
        setContextMenu({ x, y, video: vid });
        setShowLoopSubMenu(false);
    };

    const closeContextMenu = () => { setContextMenu(null); setShowLoopSubMenu(false); };

    const handleAddVideo = async () => {
        closeContextMenu();
        try {
            const path = await invoke("select_video_file");
            if (path) {
                const pathStr = path as string;
                const nombre = pathStr.split(/[/\\]/).pop() || "Video";
                await invoke("add_video_db", { nombre, ruta: pathStr });
                loadVideos();
            }
        } catch (error) { console.error("Error agregando video", error); }
    };

    const handleDeleteVideo = async () => {
        if (!showDeleteModal) return;
        await invoke("delete_video_db", { id: showDeleteModal.id });
        if (onVideoDeleted) onVideoDeleted(showDeleteModal.ruta); 
        setShowDeleteModal(null); loadVideos();
    };

    const handleLoopChange = async (isLoop: boolean) => {
        if (!contextMenu?.video) return;
        const vidId = contextMenu.video.id;
        
        await invoke("update_video_loop", { id: vidId, bucle: isLoop });
        setVideos(prev => prev.map(vid => vid.id === vidId ? { ...vid, bucle: isLoop } : vid));
        if (onVideoLoopChanged) onVideoLoopChanged(vidId, isLoop);
        closeContextMenu();
    };

    return (
        <div className="flex flex-col h-full p-3 select-none bg-sidebar/30 relative" onContextMenu={handleBgContextMenu}>
            <div className="flex-1 overflow-y-auto bg-black/40 rounded-lg border border-white/5 p-2 scrollbar-thin relative">
                {videos.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                        <Video size={40} className="mb-2 text-gray-400" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-relaxed pointer-events-none">Presione clic derecho<br/>para agregar videos</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1">
                        {videos.map(vid => (
                            <div key={vid.id} onClick={() => onSelectVideo(vid)} onDoubleClick={() => onProjectVideo(vid)} onContextMenu={(e) => handleItemContextMenu(e, vid)}
                                 className="p-1 text-[11px] text-gray-400 hover:bg-accent/20 hover:text-white rounded flex items-center gap-3 group cursor-pointer transition-all border border-transparent hover:border-white/10 relative">
                                <div className="w-16 h-10 bg-black rounded shadow-sm overflow-hidden relative flex items-center justify-center">
                                    <video src={`${convertFileSrc(vid.ruta)}#t=0.1`} className="w-full h-full object-cover opacity-80" preload="metadata" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"><Play size={12} className="text-white"/></div>
                                </div>
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <span className="font-bold text-gray-300 group-hover:text-accent truncate leading-tight">{vid.nombre}</span>
                                    {vid.bucle && <span className="text-[8px] font-black text-accent/60 uppercase">Bucle Activado</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}></div>
                    <div className="fixed z-50 bg-sidebar border border-white/10 rounded-lg shadow-2xl py-1 w-44 animate-in fade-in zoom-in duration-150" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={handleAddVideo} className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Plus size={12}/> Agregar Video</button>
                        {contextMenu.video && (
                            <>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <div className="relative group/loop">
                                    <button onClick={(e) => { e.stopPropagation(); setShowLoopSubMenu(!showLoopSubMenu); }} className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center justify-between">
                                        <div className="flex items-center gap-2"><RotateCcw size={12}/> Reproducción</div>
                                        <ChevronRight size={12} className={showLoopSubMenu ? "text-accent" : ""} />
                                    </button>
                                    {showLoopSubMenu && (
                                        <div className="absolute top-0 left-[98%] bg-sidebar border border-white/10 rounded-lg shadow-2xl py-1 w-48 animate-in slide-in-from-left-2 duration-150 z-50">
                                            <button onClick={() => handleLoopChange(false)} className={`w-full text-left px-4 py-2 text-[11px] font-bold flex items-center gap-2 ${!contextMenu.video.bucle ? 'text-accent bg-accent/10' : 'text-gray-300 hover:bg-white/5'}`}>Normal (Una vez)</button>
                                            <button onClick={() => handleLoopChange(true)} className={`w-full text-left px-4 py-2 text-[11px] font-bold flex items-center gap-2 ${contextMenu.video.bucle ? 'text-accent bg-accent/10' : 'text-gray-300 hover:bg-white/5'}`}>Bucle Infinito</button>
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button onClick={() => { setShowDeleteModal(contextMenu.video); closeContextMenu(); }} className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/20 hover:text-red-500 flex items-center gap-2"><Trash2 size={12}/> Eliminar Video</button>
                            </>
                        )}
                    </div>
                </>
            )}

            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-sidebar border border-white/10 w-[400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-center">
                        <div className="p-8 pb-4 flex flex-col items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
                            <div><h3 className="text-lg font-black text-white mb-2">¿Eliminar Video?</h3><p className="text-xs text-gray-400 leading-relaxed">Desaparecerá de la biblioteca.</p></div>
                        </div>
                        <div className="p-4 bg-black/40 border-t border-white/5 flex gap-3 mt-4">
                            <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-gray-400 bg-panel hover:bg-white/5 transition-colors border border-white/5">No, Cancelar</button>
                            <button onClick={handleDeleteVideo} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// EDITOR DE PDF
// ==========================================
const PdfLibrary = ({ onSelectPdf, onPdfDeleted }: any) => {
    const [pdfs, setPdfs] = useState<any[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, pdf: any | null } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<any>(null);

    const loadPdfs = () => { invoke("get_all_pdfs").then((data: any) => setPdfs(data)); };
    useEffect(() => { loadPdfs(); }, []);

    const handleBgContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); let x = e.clientX; let y = e.clientY;
        if (x + 220 > window.innerWidth) x = window.innerWidth - 220;
        if (y + 150 > window.innerHeight) y = window.innerHeight - 150;
        setContextMenu({ x, y, pdf: null });
    };

    const handleItemContextMenu = (e: React.MouseEvent, doc: any) => {
        e.preventDefault(); e.stopPropagation(); let x = e.clientX; let y = e.clientY;
        if (x + 220 > window.innerWidth) x = window.innerWidth - 220;
        if (y + 150 > window.innerHeight) y = window.innerHeight - 150;
        setContextMenu({ x, y, pdf: doc });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleAddPdf = async () => {
        closeContextMenu();
        try {
            const path = await invoke("select_pdf_file");
            if (path) {
                const pathStr = path as string;
                const nombre = pathStr.split(/[/\\]/).pop() || "Presentacion";
                await invoke("add_pdf_db", { nombre, ruta: pathStr });
                loadPdfs();
            }
        } catch (error) { console.error("Error agregando PDF", error); }
    };

    const handleDeletePdf = async () => {
        if (!showDeleteModal) return;
        await invoke("delete_pdf_db", { id: showDeleteModal.id });
        if (onPdfDeleted) onPdfDeleted(showDeleteModal.ruta); 
        setShowDeleteModal(null); loadPdfs();
    };

    return (
        <div className="flex flex-col h-full p-3 select-none bg-sidebar/30 relative" onContextMenu={handleBgContextMenu}>
            <div className="flex-1 overflow-y-auto bg-black/40 rounded-lg border border-white/5 p-2 scrollbar-thin relative">
                {pdfs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                        <FileText size={40} className="mb-2 text-gray-400" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-relaxed pointer-events-none">Presione clic derecho<br/>para agregar PDFs</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1">
                        {pdfs.map(doc => (
                            <div key={doc.id} onClick={() => onSelectPdf(doc)} onContextMenu={(e) => handleItemContextMenu(e, doc)}
                                 className="p-2 text-[11px] text-gray-400 hover:bg-accent/20 hover:text-white rounded flex items-center gap-3 group cursor-pointer transition-all border border-transparent hover:border-white/10">
                                <div className="w-8 h-8 bg-red-500/10 text-red-400 rounded flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
                                    <FileText size={16}/>
                                </div>
                                <span className="font-bold text-gray-300 group-hover:text-accent truncate flex-1 leading-tight">{doc.nombre}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}></div>
                    <div className="fixed z-50 bg-sidebar border border-white/10 rounded-lg shadow-2xl py-1 w-44 animate-in fade-in zoom-in duration-150" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={handleAddPdf} className="w-full text-left px-4 py-2 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Plus size={12}/> Agregar PDF</button>
                        {contextMenu.pdf && (
                            <>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button onClick={() => { setShowDeleteModal(contextMenu.pdf); closeContextMenu(); }} className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/20 hover:text-red-500 flex items-center gap-2"><Trash2 size={12}/> Eliminar PDF</button>
                            </>
                        )}
                    </div>
                </>
            )}

            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-sidebar border border-white/10 w-[400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-center">
                        <div className="p-8 pb-4 flex flex-col items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
                            <div><h3 className="text-lg font-black text-white mb-2">¿Eliminar PDF?</h3><p className="text-xs text-gray-400 leading-relaxed">Desaparecerá de la biblioteca.</p></div>
                        </div>
                        <div className="p-4 bg-black/40 border-t border-white/5 flex gap-3 mt-4">
                            <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-gray-400 bg-panel hover:bg-white/5 transition-colors border border-white/5">No, Cancelar</button>
                            <button onClick={handleDeletePdf} className="flex-1 px-4 py-3 rounded-lg text-[11px] font-bold uppercase text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
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
      <div className="h-14 flex items-center px-4 border-b border-white/5 gap-2 shrink-0">
        <MonitorPlay size={20} className="text-accent" />
        <span className="font-black text-sm tracking-tight text-gray-100">EASY PRESENTER</span>
      </div>
      
      <nav className="shrink-0 py-3 space-y-1">
        <Link to="/" className={menuClass('/')}><Music size={16}/> Cantos</Link>
        <Link to="/bibles" className={menuClass('/bibles')}><BookOpen size={16}/> Biblias</Link>
        <div className="pt-4 pb-2 text-[9px] font-bold text-gray-600 uppercase px-4 tracking-widest">Multimedia</div>
        <Link to="/images" className={menuClass('/images')}><ImageIcon size={16}/> Imágenes</Link>
        <Link to="/videos" className={menuClass('/videos')}><Video size={16}/> Videos</Link>
        <Link to="/pdf" className={menuClass('/pdf')}><FileText size={16}/> Presentación PDF</Link>
      </nav>
      
      <div className="flex-1 min-h-0 bg-black/20 border-t border-white/5 p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1 shrink-0">
          <span className="text-yellow-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1"><Star size={10} fill="currentColor"/> Favoritos ({favorites.length})</span>
          {favorites.length > 0 && <span className="text-[8px] text-gray-600 cursor-pointer hover:text-red-500" onClick={() => setFavorites([])}>Limpiar</span>}
        </div>
        
        <div className={`flex-1 min-h-0 rounded-lg flex flex-col p-1 overflow-y-auto scrollbar-thin transition-colors ${favorites.length === 0 ? 'bg-panel/10 border-2 border-dashed border-white/5 justify-center items-center' : 'bg-transparent'}`}>
           {favorites.length === 0 ? (
             <p className="text-[9px] text-gray-500 font-medium uppercase text-center pointer-events-none">Selecciona la estrella <br/> para añadir aquí</p>
           ) : (
             <div className="space-y-1.5 w-full pb-2">
               {favorites.map((fav: any, idx: number) => (
                  <div key={idx} onDoubleClick={() => onProjectFavorite(fav)} className="bg-panel border border-white/5 p-3 rounded group relative cursor-pointer hover:bg-accent/20 transition-all shadow-sm flex items-center justify-between">
                      <span className="text-[11px] font-black text-accent truncate">
                          {fav.libro} {fav.isCanto ? '' : (fav.capitulo > 0 ? `${fav.capitulo}:${fav.versiculo}` : fav.versiculo)}
                      </span>
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
// 4. DASHBOARD PRINCIPAL
// ==========================================
const DashboardLayout = () => {
  const [currentChapter, setCurrentChapter] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  
  // Agregamos bucle a activeBookInfo
  const [activeBookInfo, setActiveBookInfo] = useState({ book: "", cap: 0, cantoId: null as number | null, tipo: 'texto', ruta: '', imgId: null as number | null, aspecto: 'contain', bucle: false });
  const [previewVerse, setPreviewVerse] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [pdfPage, setPdfPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null); 

  const [chapterCache, setChapterCache] = useState<Record<string, any[]>>({});
  const [cantoCache, setCantoCache] = useState<Record<number, any[]>>({});

  // Estilos de fondo actualizados para contener video
  const [bibleStyles, setBibleStyles] = useState({ bgColor: '#000000', textColor: '#ffffff', bgImage: '', bgVideo: '' });
  const [cantoStyles, setCantoStyles] = useState({ bgColor: '#000000', textColor: '#ffffff', bgImage: '', bgVideo: '' });
  
  const [styleTab, setStyleTab] = useState<'biblia' | 'cantos'>('biblia');
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [recentImages, setRecentImages] = useState<string[]>([]);
  const presetColors = ['#ffffff', '#000000', '#facc15', '#22d3ee', '#f87171', '#4ade80'];

  const [centerMenu, setCenterMenu] = useState<{ x: number, y: number } | null>(null);

  
  useEffect(() => {
    if (activeVersion && activeBookInfo.book && activeBookInfo.cap > 0 && activeBookInfo.tipo === 'texto') {
        loadChapter(activeVersion, activeBookInfo.book, activeBookInfo.cap);
    }
  }, [activeVersion]);

  useEffect(() => {
    if (previewVerse && previewVerse.tipo !== 'imagen' && previewVerse.tipo !== 'video') {
        const index = currentChapter.findIndex(v => isSameVerse(v, previewVerse));
        if (index !== -1) document.getElementById(`verse-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const handleKey = (e: KeyboardEvent) => {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || !currentChapter.length || !previewVerse || previewVerse.tipo === 'imagen' || previewVerse.tipo === 'video') return;
        const idx = currentChapter.findIndex(v => isSameVerse(v, previewVerse));
        if (e.key === 'ArrowDown' && currentChapter[idx + 1]) projectVerse(currentChapter[idx + 1]);
        if (e.key === 'ArrowUp' && currentChapter[idx - 1]) projectVerse(currentChapter[idx - 1]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewVerse, currentChapter]);

  const loadChapter = (version: string, book: string, cap: number) => {
    const cacheKey = `${version}-${book}-${cap}`;
    if (chapterCache[cacheKey]) {
        setCurrentChapter(chapterCache[cacheKey]);
        setActiveBookInfo({ book, cap, cantoId: null, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false });
        return;
    }

    invoke("get_chapter_verses", { version, book, cap }).then((verses: any) => {
      setChapterCache(prev => ({ ...prev, [cacheKey]: verses })); 
      setCurrentChapter(verses);
      setActiveBookInfo({ book, cap, cantoId: null, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false });
    });
  };

  const loadCanto = (canto: any) => {
    if (cantoCache[canto.id]) {
        setCurrentChapter(cantoCache[canto.id]);
        setActiveBookInfo({ book: canto.titulo, cap: 0, cantoId: canto.id, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false });
        return;
    }

    invoke("get_canto_diapositivas", { cantoId: canto.id }).then((slides: any) => {
      const formattedSlides = slides.map((s: any) => ({ libro: canto.titulo, capitulo: 0, versiculo: s.orden, texto: s.texto, versionName: "CANTO" }));
      setCantoCache(prev => ({ ...prev, [canto.id]: formattedSlides })); 
      setCurrentChapter(formattedSlides);
      setActiveBookInfo({ book: canto.titulo, cap: 0, cantoId: canto.id, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false }); 
    }).catch(err => console.error("Error cargando canto:", err));
  };

  const projectVerse = (verse: any) => {
    if (verse.tipo === 'imagen' || verse.tipo === 'video') {
        invoke("trigger_projection", { verse });
        setPreviewVerse(verse);
        return;
    }

    const vWithVersion = { ...verse, versionName: verse.versionName || activeVersion };
    if (verse.capitulo > 0 && (verse.libro !== activeBookInfo.book || verse.capitulo !== activeBookInfo.cap)) {
        loadChapter(vWithVersion.versionName, verse.libro, verse.capitulo);
    }
    invoke("trigger_projection", { verse: vWithVersion });
    setPreviewVerse(vWithVersion);
  };

  const emitVideoControl = (action: string) => {
      invoke("trigger_video_control", { action });
  };

  const handleFavoriteAction = (fav: any) => {
      if (fav.isCanto) loadCanto(fav.cantoData);
      else projectVerse(fav); 
  };

  const handleCantoUpdated = (id: number, nuevoTitulo: string, nuevaLetra: string) => {
      const estrofas = nuevaLetra.split('\n\n').map(s => s.trim()).filter(s => s !== '');
      const formattedSlides = estrofas.map((texto, i) => ({ libro: nuevoTitulo, capitulo: 0, versiculo: i + 1, texto: texto, versionName: "CANTO" }));
      setCantoCache(prev => ({ ...prev, [id]: formattedSlides }));
      if (activeBookInfo.cantoId === id) {
          setCurrentChapter(formattedSlides); setActiveBookInfo(prev => ({ ...prev, book: nuevoTitulo })); setPreviewVerse(null); 
      }
  };

  const handleCantoDeleted = (id: number) => {
      if (activeBookInfo.cantoId === id) {
          setCurrentChapter([]); setActiveBookInfo({ book: "", cap: 0, cantoId: null, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false });
      }
  };

  const applyImageFit = async (fitMode: 'contain' | 'cover' | 'fill') => {
      if (activeBookInfo.imgId) {
          await invoke("update_image_aspect", { id: activeBookInfo.imgId, aspecto: fitMode });
          setActiveBookInfo(prev => ({ ...prev, aspecto: fitMode }));
          if (previewVerse?.ruta === activeBookInfo.ruta) projectVerse({ tipo: 'imagen', ruta: activeBookInfo.ruta, aspecto: fitMode });
      }
      setCenterMenu(null);
  };

  const updateStyles = (newS: any) => {
    let updatedBiblia = bibleStyles; let updatedCantos = cantoStyles;
    if (styleTab === 'biblia') {
        updatedBiblia = { ...bibleStyles, ...newS };
        // Si suben video, limpiamos imagen. Si suben imagen, limpiamos video
        if (newS.bgImage) updatedBiblia.bgVideo = "";
        if (newS.bgVideo) updatedBiblia.bgImage = "";
        if (newS.bgColor && !newS.bgImage && !newS.bgVideo) { updatedBiblia.bgImage = ""; updatedBiblia.bgVideo = ""; }
        setBibleStyles(updatedBiblia);
    } else {
        updatedCantos = { ...cantoStyles, ...newS };
        if (newS.bgImage) updatedCantos.bgVideo = "";
        if (newS.bgVideo) updatedCantos.bgImage = "";
        if (newS.bgColor && !newS.bgImage && !newS.bgVideo) { updatedCantos.bgImage = ""; updatedCantos.bgVideo = ""; }
        setCantoStyles(updatedCantos);
    }
    invoke("trigger_style_update", { styles: { biblia: updatedBiblia, cantos: updatedCantos } });
  };

  const handleBgImageUpload = async () => {
    try {
        const path = await invoke("select_background_image");
        if (path) {
            const pStr = path as string;
            if (!recentImages.includes(pStr)) setRecentImages([...recentImages, pStr]);
            updateStyles({ bgImage: pStr, bgColor: 'transparent' });
        }
    } catch (error) { console.error("Error seleccionando imagen:", error); }
  };

  // NUEVO: Verificación de límite de 60 segundos
  const handleBgVideoUpload = async () => {
      try {
          const path = await invoke("select_video_file");
          if (path) {
              const videoStr = path as string;
              // Creamos un elemento de video en memoria temporal
              const videoEl = document.createElement('video');
              videoEl.src = convertFileSrc(videoStr);
              videoEl.onloadedmetadata = () => {
                  if (videoEl.duration > 60) {
                      alert("⚠️ Por rendimiento y optimización, los videos de fondo no pueden durar más de 60 segundos.");
                  } else {
                      if (!recentImages.includes(videoStr)) setRecentImages([...recentImages, videoStr]);
                      updateStyles({ bgVideo: videoStr, bgColor: 'transparent' });
                  }
              };
          }
      } catch (error) { console.error("Error seleccionando video de fondo:", error); }
  };

  const isPreviewCanto = previewVerse?.capitulo === 0;
  const activeStyles = isPreviewCanto ? cantoStyles : bibleStyles;
  const currentModalStyles = styleTab === 'biblia' ? bibleStyles : cantoStyles;

  return (
    <div className="flex h-screen w-screen bg-mainbg text-gray-100 overflow-hidden font-sans select-none">
      
      <SidebarLeft favorites={favorites} setFavorites={setFavorites} onProjectFavorite={handleFavoriteAction} />

      <main className="flex-1 flex flex-col border-r border-black/50 bg-mainbg shadow-inner relative z-10">
        <header className="h-14 border-b border-white/5 flex items-center px-8 justify-between bg-black/10 shrink-0">
          <div className="flex flex-col">
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Panel de Edición</span>
             <span className="text-lg font-black text-accent tracking-tight">
                {activeBookInfo.book || ""} <span className="text-gray-400">{activeBookInfo.cap > 0 ? activeBookInfo.cap : ""}</span>
             </span>
          </div>
          
          <Settings size={16} className="text-gray-500 hover:text-white cursor-pointer transition-transform hover:rotate-90" onClick={() => setShowSettingsModal(true)} />
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sidebar via-mainbg to-mainbg scrollbar-thin relative" ref={scrollRef}>
          
          {/* ---> AQUÍ AGREGAMOS EL PANEL CENTRAL DEL PDF <--- */}
          {activeBookInfo.tipo === 'pdf' ? (
              <div className="h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 relative">
                  <div className="w-full max-w-4xl h-[80vh] bg-black rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10 flex flex-col">
                      <div className="bg-panel p-3 border-b border-white/10 flex items-center justify-between shrink-0">
                          <span className="text-xs font-bold text-gray-300 uppercase flex items-center gap-2">
                              <FileText size={14} className="text-red-400"/> {activeBookInfo.book}
                          </span>
                          
                          {/* CONTROLES CON CACHÉ DE NAVEGACIÓN */}
                          <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                              <button onClick={() => {
                                  const newPage = Math.max(1, pdfPage - 1);
                                  setPdfPage(newPage);
                                  projectVerse({ tipo: 'pdf', ruta: activeBookInfo.ruta, pagina: newPage });
                              }} className="text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors"><ChevronLeft size={16}/></button>
                              
                              <span className="text-[11px] font-black w-24 text-center tracking-widest text-gray-200">PÁG. {pdfPage}</span>
                              
                              <button onClick={() => {
                                  const newPage = pdfPage + 1;
                                  setPdfPage(newPage);
                                  projectVerse({ tipo: 'pdf', ruta: activeBookInfo.ruta, pagina: newPage });
                              }} className="text-gray-400 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors"><ChevronRight size={16}/></button>
                          </div>
                          
                          <button onClick={() => projectVerse({ tipo: 'pdf', ruta: activeBookInfo.ruta, pagina: pdfPage })} className="bg-accent text-white px-5 py-2 rounded shadow-lg text-xs font-black uppercase flex items-center gap-2 hover:bg-accent/80 transition-all active:scale-95">
                              <MonitorPlay size={14}/> Sincronizar
                          </button>
                      </div>
                      <iframe src={`${convertFileSrc(activeBookInfo.ruta)}#page=${pdfPage}&view=FitH&toolbar=0&navpanes=0`} className="w-full flex-1 border-none bg-black" />
                  </div>
              </div>

          // PANEL CENTRAL: VIDEOS 
          ) : activeBookInfo.tipo === 'video' ? (
              <div className="h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 relative">
                  <div className="relative group w-full max-w-3xl aspect-video bg-black rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                      <video src={convertFileSrc(activeBookInfo.ruta)} className="w-full h-full object-contain" controls controlsList="nodownload" loop={activeBookInfo.bucle} />
                      {previewVerse?.ruta !== activeBookInfo.ruta && (
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => projectVerse({ tipo: 'video', ruta: activeBookInfo.ruta, bucle: activeBookInfo.bucle })} className="bg-accent text-white px-4 py-2 rounded shadow-lg text-xs font-bold uppercase flex items-center gap-2 hover:bg-accent/80">
                                  <MonitorPlay size={14}/> Proyectar Video
                              </button>
                          </div>
                      )}
                  </div>
                  {previewVerse?.ruta === activeBookInfo.ruta && (
                      <div className="mt-8 bg-sidebar border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center animate-in slide-in-from-bottom-4">
                          <div className="flex items-center gap-2 text-accent font-black uppercase text-xs tracking-widest mb-4">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Video en Vivo {activeBookInfo.bucle && "(Bucle Activado)"}
                          </div>
                          <div className="flex gap-4">
                              <button onClick={() => emitVideoControl('play')} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl transition-all active:scale-95 font-bold text-[11px] uppercase border border-white/10"><Play size={16} className="text-green-400"/> Reproducir</button>
                              <button onClick={() => emitVideoControl('pause')} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl transition-all active:scale-95 font-bold text-[11px] uppercase border border-white/10"><Pause size={16} className="text-yellow-400"/> Pausar</button>
                              <button onClick={() => emitVideoControl('restart')} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl transition-all active:scale-95 font-bold text-[11px] uppercase border border-white/10"><RotateCcw size={16} className="text-blue-400"/> Reiniciar</button>
                          </div>
                      </div>
                  )}
              </div>
          
          // PANEL CENTRAL: IMÁGENES
          ) : activeBookInfo.tipo === 'imagen' ? (
              <div className="h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 relative group"
                   onContextMenu={(e) => { 
                       e.preventDefault(); 
                       let x = e.clientX; let y = e.clientY;
                       if (window.innerHeight - y < 150) y -= 150;
                       if (window.innerWidth - x < 250) x -= 250;
                       setCenterMenu({ x, y }); 
                   }}>
                  <img src={convertFileSrc(activeBookInfo.ruta)} 
                      className={`max-w-full max-h-full rounded shadow-2xl cursor-pointer hover:scale-[1.01] transition-transform ring-1 ring-white/10 ${activeBookInfo.aspecto === 'cover' ? 'object-cover w-full h-full' : activeBookInfo.aspecto === 'fill' ? 'object-fill w-full h-full' : 'object-contain'}`}
                      onClick={() => projectVerse({ tipo: 'imagen', ruta: activeBookInfo.ruta, aspecto: activeBookInfo.aspecto })} alt="Vista previa" />
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 opacity-70">Modo: {activeBookInfo.aspecto === 'contain' ? 'Ajustado al centro' : activeBookInfo.aspecto === 'cover' ? 'Rellenar Pantalla' : 'Estirar'}</div>
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10 shadow-lg"><MonitorPlay size={12} className="inline mr-2 text-accent"/> Un clic para proyectar | Clic derecho para opciones</div>
                  {centerMenu && (
                      <>
                          <div className="fixed inset-0 z-40 cursor-default" onClick={(e) => { e.stopPropagation(); setCenterMenu(null); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCenterMenu(null); }}></div>
                          <div className="fixed z-50 bg-sidebar border border-white/10 rounded-lg shadow-2xl py-1 w-56 animate-in fade-in zoom-in duration-150" style={{ top: centerMenu.y, left: centerMenu.x }}>
                              <button onClick={() => applyImageFit('contain')} className="w-full text-left px-4 py-3 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Minimize size={14}/> Ajustar al centro</button>
                              <div className="h-px bg-white/5 my-0.5 mx-2"></div>
                              <button onClick={() => applyImageFit('cover')} className="w-full text-left px-4 py-3 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Maximize size={14}/> Rellenar pantalla completa</button>
                              <div className="h-px bg-white/5 my-0.5 mx-2"></div>
                              <button onClick={() => applyImageFit('fill')} className="w-full text-left px-4 py-3 text-[11px] font-bold text-gray-300 hover:bg-accent/20 hover:text-accent flex items-center gap-2"><Type size={14}/> Estirar forzado</button>
                          </div>
                      </>
                  )}
              </div>

          // PANEL CENTRAL: TEXTO
          ) : currentChapter.length > 0 ? (
            <div className="max-w-4xl mx-auto space-y-4">
              {currentChapter.map((v, i) => {
                const isFav = favorites.some((f: any) => isSameVerse(f, v));
                const active = isSameVerse(previewVerse, v);
                return (
                  <div key={i} id={`verse-${i}`} onDoubleClick={() => projectVerse(v)} className={`group relative p-4 pr-12 rounded-xl border transition-all cursor-pointer ${active ? 'bg-accent/10 border-accent' : 'hover:bg-accent/5 border-transparent hover:border-accent/20'}`}>
                    <span className={`absolute right-12 top-4 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity border px-1 rounded mr-2 ${active ? 'text-accent border-accent opacity-100' : 'text-gray-500 border-gray-600'}`}>{active ? 'EN VIVO' : 'PROYECTAR'}</span>
                    <button onClick={(e) => { e.stopPropagation(); setFavorites(isFav ? favorites.filter(f=>!isSameVerse(f,v)) : [...favorites, {...v, versionName: activeVersion}]) }} className="absolute right-4 top-4 transition-transform active:scale-90 hover:scale-110">
                        <Star size={18} className={isFav ? "text-yellow-500" : "text-gray-600 hover:text-yellow-500"} fill={isFav ? "currentColor" : "none"}/>
                    </button>
                    <p className={`text-xl leading-relaxed font-serif ${active ? 'text-white' : 'text-gray-300 whitespace-pre-line'}`}><span className="text-accent font-sans font-black text-xs mr-3 align-top select-none">{v.versiculo}</span>{v.texto}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
                <Music size={80} className="mb-4" />
                <p className="text-xl font-black italic">SELECCIONA UN ARCHIVO DE LA BIBLIOTECA</p>
            </div>
          )}
        </div>
      </main>

      <aside className="w-[340px] bg-sidebar flex flex-col h-full shadow-2xl relative z-10 shrink-0">
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="h-10 border-b border-white/5 flex items-center px-4 bg-panel/10 shrink-0">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Biblioteca</span>
            </div>
            <div className="flex-1 overflow-hidden">
               <Routes>
                  <Route path="/" element={<CantosLibrary onSelectCanto={loadCanto} favorites={favorites} setFavorites={setFavorites} onCantoUpdated={handleCantoUpdated} onCantoDeleted={handleCantoDeleted} />} />
                  <Route path="/bibles" element={<BiblesLibrary currentVersion={activeVersion} onVersionChange={setActiveVersion} onSelectChapter={loadChapter} onDirectSearch={(v:any, b:any, c:any, vr:any) => invoke("get_single_verse", {version:v,book:b,cap:c,ver:vr}).then((r:any)=>r&&projectVerse(r))} />} />
                  
                  <Route path="/images" element={<ImagesLibrary 
                      onSelectImage={(img: any) => { setActiveBookInfo({ book: img.nombre, cap: 0, cantoId: null, tipo: 'imagen', ruta: img.ruta, imgId: img.id, aspecto: img.aspecto, bucle: false }); setPreviewVerse(null); setCurrentChapter([]); }}
                      onProjectImage={(img: any) => projectVerse({ tipo: 'imagen', ruta: img.ruta, aspecto: img.aspecto })}
                      onImageDeleted={(ruta: string) => { if (activeBookInfo.ruta === ruta) { setActiveBookInfo({ book: "", cap: 0, cantoId: null, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false }); setPreviewVerse(null); } }}
                      onImageAspectChanged={(imgId: number, newAspecto: string) => { if (activeBookInfo.imgId === imgId) { setActiveBookInfo(prev => ({ ...prev, aspecto: newAspecto })); if (previewVerse?.ruta === activeBookInfo.ruta) projectVerse({ tipo: 'imagen', ruta: activeBookInfo.ruta, aspecto: newAspecto }); } }}
                  />} />

                  <Route path="/videos" element={<VideosLibrary 
                      onSelectVideo={(vid: any) => { setActiveBookInfo({ book: vid.nombre, cap: 0, cantoId: null, tipo: 'video', ruta: vid.ruta, imgId: vid.id, aspecto: 'contain', bucle: vid.bucle }); setPreviewVerse(null); setCurrentChapter([]); }}
                      onProjectVideo={(vid: any) => projectVerse({ tipo: 'video', ruta: vid.ruta, bucle: vid.bucle })}
                      onVideoDeleted={(ruta: string) => { if (activeBookInfo.ruta === ruta) { setActiveBookInfo({ book: "", cap: 0, cantoId: null, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false }); setPreviewVerse(null); } }}
                      onVideoLoopChanged={(imgId: number, newBucle: boolean) => { if (activeBookInfo.imgId === imgId) { setActiveBookInfo(prev => ({ ...prev, bucle: newBucle })); if (previewVerse?.ruta === activeBookInfo.ruta) projectVerse({ tipo: 'video', ruta: activeBookInfo.ruta, bucle: newBucle }); } }}
                  />} />

                  <Route path="/pdf" element={<PdfLibrary 
                      onSelectPdf={(doc: any) => { 
                          setPdfPage(1); 
                          setActiveBookInfo({ book: doc.nombre, cap: 0, cantoId: null, tipo: 'pdf', ruta: doc.ruta, imgId: doc.id, aspecto: 'contain', bucle: false }); 
                          setPreviewVerse(null); 
                          setCurrentChapter([]); 
                      }}
                      onPdfDeleted={(ruta: string) => { if (activeBookInfo.ruta === ruta) { setActiveBookInfo({ book: "", cap: 0, cantoId: null, tipo: 'texto', ruta: '', imgId: null, aspecto: 'contain', bucle: false }); setPreviewVerse(null); } }}
                  />} />
               </Routes>
            </div>
        </div>

        <div className="flex-shrink-0 relative z-20 mt-2 pl-4">
             <button onClick={() => setShowStyleModal(true)} className="bg-accent hover:bg-accent/90 text-white text-[9px] font-bold uppercase py-1 px-4 rounded-t-lg shadow-sm flex items-center gap-2 transition-all translate-y-[1px]">
                <Palette size={10}/> PERSONALIZAR
            </button>
        </div>

        <div className="p-4 bg-black/40 border-t border-white/10 space-y-3 relative z-10 shrink-0">
            <div className="h-28 bg-black rounded-lg flex items-center justify-center border border-white/5 relative overflow-hidden bg-cover bg-center"
                 style={{ 
                    backgroundImage: previewVerse?.tipo === 'imagen' ? `url('${convertFileSrc(previewVerse.ruta)}')` : (activeStyles.bgImage && previewVerse?.tipo !== 'video' ? `url('${convertFileSrc(activeStyles.bgImage)}')` : 'none'),
                    backgroundColor: (previewVerse?.tipo === 'imagen' || previewVerse?.tipo === 'video') ? '#000' : activeStyles.bgColor,
                    backgroundSize: previewVerse?.tipo === 'imagen' && previewVerse.aspecto === 'contain' ? 'contain' : (previewVerse?.tipo === 'imagen' && previewVerse.aspecto === 'fill' ? '100% 100%' : 'cover')
                 }}>
                 
                 {/* Preview de Video de Fondo */}
                 {activeStyles.bgVideo && !previewVerse?.tipo && (
                     <video src={convertFileSrc(activeStyles.bgVideo)} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover opacity-50 z-0" />
                 )}

                 {previewVerse?.tipo === 'video' ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 z-10">
                         <MonitorPlay size={24} className="text-accent animate-pulse"/>
                         <span className="text-[9px] font-black uppercase tracking-widest text-white">Video en Proyección</span>
                     </div>
                      ) : previewVerse?.tipo === 'pdf' ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 z-10">
                         <FileText size={24} className="text-red-400 animate-pulse"/>
                         <span className="text-[9px] font-black uppercase tracking-widest text-white">PDF Pág. {previewVerse.pagina}</span>
                     </div>
                 ) : previewVerse ? (
                    previewVerse.tipo !== 'imagen' && (
                        <div className="p-3 text-center w-full drop-shadow-md z-10">
                            <p className="text-[10px] font-bold line-clamp-3 leading-tight" style={{ color: activeStyles.textColor }}>{isPreviewCanto ? previewVerse.texto : `"${previewVerse.texto}"`}</p>
                        </div>
                    )
                 ) : (
                    <span className="text-[10px] opacity-20 uppercase font-black z-10">Monitor</span>
                 )}
            </div>

            <button onClick={() => invoke('open_projector')} className="w-full py-3 bg-red-600 hover:bg-red-500 rounded text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                <MonitorPlay size={12}/> Abrir Proyector
            </button>
        </div>
      </aside>

      {/* MODAL ESTILOS */}
      {showStyleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-sidebar border border-white/10 w-[500px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-center p-4 bg-panel/50">
                    <h2 className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2"><Palette size={14}/> Personalizar Proyección</h2>
                    <button onClick={() => setShowStyleModal(false)} className="text-gray-500 hover:text-white transition-colors"><X size={16}/></button>
                </div>

                <div className="flex border-b border-white/10 bg-panel/30">
                    <button onClick={() => setStyleTab('biblia')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${styleTab === 'biblia' ? 'border-b-2 border-accent text-accent bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>Fondo de Biblia</button>
                    <button onClick={() => setStyleTab('cantos')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${styleTab === 'cantos' ? 'border-b-2 border-accent text-accent bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>Fondo de Cantos</button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div>
                        <p className="text-[9px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1"><ImageIcon size={10}/> Fondo Actual: {styleTab}</p>
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div onClick={() => updateStyles({ bgColor: '#000000', bgImage: '', bgVideo: '' })} className={`aspect-video rounded-lg bg-black border cursor-pointer flex items-center justify-center ${currentModalStyles.bgColor==='#000000' && !currentModalStyles.bgImage && !currentModalStyles.bgVideo ? 'border-accent ring-1 ring-accent' : 'border-white/20 hover:border-white/50'}`}><span className="text-[8px] text-gray-700 font-bold">NEGRO</span></div>
                            <div onClick={() => updateStyles({ bgColor: '#ffffff', bgImage: '', bgVideo: '' })} className={`aspect-video rounded-lg bg-white border cursor-pointer flex items-center justify-center ${currentModalStyles.bgColor==='#ffffff' && !currentModalStyles.bgImage && !currentModalStyles.bgVideo ? 'border-accent ring-1 ring-accent' : 'border-white/20 hover:border-white/50'}`}><span className="text-[8px] text-gray-300 font-bold">BLANCO</span></div>
                            <div onClick={handleBgImageUpload} className="aspect-video rounded-lg bg-panel border border-dashed border-white/20 cursor-pointer flex flex-col items-center justify-center gap-1 hover:bg-white/5 hover:border-accent text-gray-500 hover:text-accent transition-all"><ImageIcon size={14} /><span className="text-[8px] font-bold">IMAGEN</span></div>
                            
                            {/* BOTÓN AGREGAR VIDEO CON BUCLE (Limita a 60 seg) */}
                            <div onClick={handleBgVideoUpload} className="aspect-video rounded-lg bg-panel border border-dashed border-white/20 cursor-pointer flex flex-col items-center justify-center gap-1 hover:bg-white/5 hover:border-accent text-gray-500 hover:text-accent transition-all">
                                <Clapperboard size={14} />
                                <span className="text-[8px] font-bold">VIDEO</span>
                            </div>
                        </div>

                        {recentImages.length > 0 && (
                            <div>
                                <p className="text-[8px] font-bold text-gray-600 mb-2 uppercase">Galería (Imágenes y Videos)</p>
                                <div className="grid grid-cols-4 gap-3">
                                    {recentImages.map((file, idx) => {
                                        const isVideo = file.match(/\.(mp4|webm|mov|mkv)$/i);
                                        return (
                                            <div key={idx} onClick={() => isVideo ? updateStyles({ bgVideo: file, bgImage: '', bgColor: 'transparent' }) : updateStyles({ bgImage: file, bgVideo: '', bgColor: 'transparent' })} 
                                                 className={`aspect-video rounded-lg border cursor-pointer bg-cover bg-center relative group overflow-hidden ${currentModalStyles.bgImage === file || currentModalStyles.bgVideo === file ? 'border-accent ring-1 ring-accent' : 'border-white/10 hover:border-white/40'}`} 
                                                 style={!isVideo ? { backgroundImage: `url('${convertFileSrc(file)}')` } : {}}>
                                                 
                                                 {isVideo && <video src={`${convertFileSrc(file)}#t=0.1`} className="absolute inset-0 w-full h-full object-cover" preload="metadata" />}
                                                 
                                                 <button onClick={(e) => {e.stopPropagation(); setRecentImages(recentImages.filter(i => i !== file))}} className="absolute top-1 right-1 bg-black/50 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500 z-10"><X size={8}/></button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-[9px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1"><Type size={10}/> Color del Texto</p>
                        <div className="flex gap-3 items-center bg-black/20 p-3 rounded-lg border border-white/5">
                            {presetColors.map(c => (
                                <div key={c} onClick={() => updateStyles({ textColor: c })} className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${currentModalStyles.textColor === c ? 'border-accent scale-125 ring-2 ring-accent/30' : 'border-white/20 hover:scale-110'}`} style={{ backgroundColor: c }}></div>
                            ))}
                            <div className="w-px h-6 bg-white/10 mx-1"></div>
                            <div className="relative group">
                                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 cursor-pointer group-hover:border-accent"><Type size={12} className="text-white drop-shadow-md"/></div>
                                <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={currentModalStyles.textColor} onChange={(e) => updateStyles({ textColor: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
                    <button onClick={() => setShowStyleModal(false)} className="bg-white text-black px-6 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-gray-200 transition-colors">Listo</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE CONFIGURACIÓN Y BASE DE DATOS */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-sidebar border border-white/10 w-[450px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-white/5 bg-panel/50">
                    <h2 className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2"><Settings size={14}/> Base de Datos</h2>
                    <button onClick={() => { setShowSettingsModal(false); setSyncMessage(""); }} className="text-gray-500 hover:text-white transition-colors"><X size={16}/></button>
                </div>

                <div className="p-8 flex flex-col gap-4">
                    <button onClick={async () => {
                        const res = await invoke("export_cantos");
                        setSyncMessage(res as string);
                    }} className="bg-panel border border-white/10 hover:border-accent hover:bg-white/5 text-gray-300 px-4 py-5 rounded-xl text-xs font-bold uppercase transition-all flex flex-col items-center gap-2 shadow-inner active:scale-95">
                        <span> Exportar Cantos (Respaldo)</span>
                        <span className="text-[9px] text-gray-500 normal-case font-normal text-center">Guarda tu biblioteca en un archivo .json <br/>para llevarla a otra computadora.</span>
                    </button>

                    <button onClick={async () => {
                        const res = await invoke("import_cantos");
                        setSyncMessage(res as string);
                    }} className="bg-panel border border-white/10 hover:border-accent hover:bg-white/5 text-gray-300 px-4 py-5 rounded-xl text-xs font-bold uppercase transition-all flex flex-col items-center gap-2 shadow-inner active:scale-95">
                        <span> Importar Cantos</span>
                        <span className="text-[9px] text-gray-500 normal-case font-normal text-center">Carga cantos desde un archivo .json <br/>(Se agregarán y sobreescribirán a los actuales).</span>
                    </button>

                    {syncMessage && (
                        <div className={`mt-2 p-3 border rounded-lg text-[10px] font-bold text-center animate-in fade-in ${syncMessage === "Cancelado" ? "bg-panel/50 border-white/10 text-gray-400" : "bg-accent/20 border-accent/30 text-accent"}`}>
                            {syncMessage}
                        </div>
                    )}
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