import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import MovieGlobe from './movieglobe';
import { X, Play, Zap, Search, Loader2 } from 'lucide-react';

const API_KEY = import.meta.env.VITE_TMDB_KEY;

export default function App() {
  const [movies, setMovies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 30), active: false });

  // 1. Initial Load
  useEffect(() => { loadMore(); }, []);

  // 2. Fetch Popular Movies (Discovery)
  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&page=${page}`);
      const data = await res.json();
      const formatted = data.results.map(m => ({
        id: m.id,
        title: m.title,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster',
        overview: m.overview,
        rating: m.vote_average
      }));
      setMovies(prev => [...prev, ...formatted]);
      setPage(p => p + 1);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // 3. WARP SEARCH LOGIC
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    
    setLoading(true);
    // Warp Effect: Reset camera and clear movies first
    targetPos.current = { pos: new THREE.Vector3(0, 0, 50), active: true };
    
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${query}`);
      const data = await res.json();
      const formatted = data.results.map(m => ({
        id: m.id,
        title: m.title,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750',
        overview: m.overview,
        rating: m.vote_average
      }));
      
      // Delay slightly for the "warp" feel
      setTimeout(() => {
        setMovies(formatted);
        setSelected(null);
        targetPos.current = { pos: new THREE.Vector3(0, 0, 30), active: false };
      }, 500);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSelect = (movie, pos) => {
    setSelected(movie);
    targetPos.current = { pos: pos.clone().multiplyScalar(1.35), active: true };
  };

  return (
    <div className="h-screen w-full bg-[#020202] relative overflow-hidden text-white">
      {/* 3D Scene */}
      <Canvas dpr={[1, 2]} camera={{ fov: 45 }}>
        <MovieGlobe movies={movies} onSelect={handleSelect} targetPos={targetPos} selectedMovie={selected} />
      </Canvas>

      {/* SEARCH BAR (Glassmorphism) */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-lg">
        <form onSubmit={handleSearch} className="relative group">
          <input 
            type="text" 
            placeholder="Search the Galaxy..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 backdrop-blur-2xl border border-white/10 px-14 py-4 rounded-full outline-none focus:border-white/30 focus:bg-white/10 transition-all text-lg tracking-wide"
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity" size={24} />
          {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-yellow-400" size={24} />}
        </form>
      </div>

      {/* DISCOVERY UI */}
      {!selected && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4">
          <button onClick={loadMore} className="glass group flex items-center gap-3 px-8 py-4 rounded-full transition-all hover:bg-white/10 active:scale-95 shadow-2xl">
            <Zap size={20} className="text-yellow-400 fill-yellow-400" />
            <span className="font-bold tracking-widest text-xs uppercase">Expand discovery</span>
          </button>
          
          {/* Back to Popular Reset */}
          <button onClick={() => { setPage(1); loadMore(); setQuery(''); }} className="glass px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
            Reset Galaxy
          </button>
        </div>
      )}

      {/* DETAIL OVERLAY (Same as before but with added Search logic) */}
      {selected && (
        <div className="absolute inset-0 z-50 flex items-center justify-end p-4 md:p-12 pointer-events-none bg-black/20">
          <div className="glass w-full md:w-[480px] p-10 rounded-[2.5rem] pointer-events-auto shadow-2xl animate-in fade-in slide-in-from-right-20 duration-700">
            <button onClick={() => {setSelected(null); targetPos.current.active = false;}} className="absolute top-8 right-8 text-white/30 hover:text-white transition-all">
              <X size={32}/>
            </button>
            <h2 className="text-4xl font-black mb-6 uppercase tracking-tighter leading-tight">{selected.title}</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-10 line-clamp-6">{selected.overview}</p>
            <div className="flex gap-4">
              <button className="flex-1 bg-white text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95 uppercase tracking-widest">
                <Play size={20} fill="black" /> Trailer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
