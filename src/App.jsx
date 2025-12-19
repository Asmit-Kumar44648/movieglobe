import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Zap, Search, Loader2, Star, Heart } from 'lucide-react';

// --- CONFIG ---
const API_KEY = import.meta.env.VITE_TMDB_KEY;

// --- 3D SUB-COMPONENTS ---

function MoviePoster({ movie, position, onSelect, isSelected }) {
  const meshRef = useRef();
  useFrame(() => {
    if (meshRef.current) meshRef.current.lookAt(0, 0, 0);
  });

  return (
    <group position={position}>
      <Float speed={isSelected ? 0 : 2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Image 
          ref={meshRef}
          url={movie.poster} 
          transparent
          scale={isSelected ? [3, 4.5] : [1.5, 2.25]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(movie, position);
          }}
        />
      </Float>
      {!isSelected && (
        <Text position={[0, -1.4, 0]} fontSize={0.12} color="white" maxWidth={1.5} textAlign="center">
          {movie.title}
        </Text>
      )}
    </group>
  );
}

function GlobeScene({ movies, onSelect, targetPos, selectedMovie }) {
  const { camera } = useThree();
  const groupRef = useRef();
  const radius = useMemo(() => Math.sqrt(movies.length) * 2.8 + 8, [movies.length]);

  const positions = useMemo(() => {
    const phi = Math.PI * (3 - Math.sqrt(5));
    return movies.map((_, i) => {
      const y = 1 - (i / (movies.length - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      return new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius);
    });
  }, [movies, radius]);

  useFrame((state, delta) => {
    camera.position.lerp(targetPos.current.pos, 0.08);
    camera.lookAt(0, 0, 0);
    if (!targetPos.current.active && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <>
      <Stars radius={100} depth={50} count={7000} factor={4} fade speed={1} />
      <ambientLight intensity={0.8} />
      <group ref={groupRef}>
        {movies.map((m, i) => (
          <MoviePoster key={`${m.id}-${i}`} movie={m} position={positions[i]} onSelect={onSelect} isSelected={selectedMovie?.id === m.id} />
        ))}
      </group>
    </>
  );
}

// --- MAIN APP COMPONENT ---

export default function App() {
  const [movies, setMovies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 30), active: false });

  const loadMovies = async (isSearch = false) => {
    setLoading(true);
    const endpoint = isSearch 
      ? `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${query}`
      : `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&page=${page}`;
    
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      const formatted = data.results.map(m => ({
        id: m.id,
        title: m.title,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750',
        overview: m.overview,
        rating: m.vote_average
      }));
      
      if (isSearch) {
        setMovies(formatted);
        targetPos.current = { pos: new THREE.Vector3(0, 0, 30), active: false };
      } else {
        setMovies(prev => [...prev, ...formatted]);
        setPage(p => p + 1);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadMovies(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSelected(null);
    targetPos.current = { pos: new THREE.Vector3(0, 0, 60), active: true };
    setTimeout(() => loadMovies(true), 400);
  };

  const handleSelect = (movie, pos) => {
    setSelected(movie);
    targetPos.current = { pos: pos.clone().multiplyScalar(1.35), active: true };
  };

  return (
    <div className="h-screen w-full bg-[#020202] relative overflow-hidden text-white font-sans selection:bg-white/20">
      <Canvas dpr={[1, 2]} camera={{ fov: 45 }}>
        <GlobeScene movies={movies} onSelect={handleSelect} targetPos={targetPos} selectedMovie={selected} />
      </Canvas>

      {/* Search Header */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-lg">
        <form onSubmit={handleSearch} className="relative group">
          <input 
            type="text" 
            placeholder="Search Galaxy..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 backdrop-blur-2xl border border-white/10 px-14 py-4 rounded-full outline-none focus:border-white/30 focus:bg-white/10 transition-all text-lg"
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity" size={24} />
          {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-yellow-400" size={24} />}
        </form>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="absolute inset-0 z-50 flex items-center justify-end p-4 md:p-12 pointer-events-none bg-black/40">
          <div className="w-full md:w-[480px] p-10 rounded-[3rem] pointer-events-auto flex flex-col shadow-2xl animate-in fade-in slide-in-from-right-20 duration-500 bg-black/60 backdrop-blur-3xl border border-white/10">
            <button onClick={() => {setSelected(null); targetPos.current.active = false;}} className="absolute top-10 right-10 opacity-40 hover:opacity-100 transition-all">
              <X size={32}/>
            </button>
            <div className="flex items-center gap-2 mb-4 text-yellow-500 font-bold tracking-widest text-sm">
              <Star size={16} fill="currentColor" /> {selected.rating.toFixed(1)}
            </div>
            <h2 className="text-4xl font-black mb-6 uppercase tracking-tighter leading-none">{selected.title}</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-10 line-clamp-6 italic">{selected.overview}</p>
            <div className="flex gap-4">
              <button className="flex-1 bg-white text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95 uppercase">
                <Play size={22} fill="black" /> Trailer
              </button>
              <button className="p-5 rounded-2xl border border-white/10 hover:bg-white/5"><Heart/></button>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Bottom UI */}
      {!selected && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
          <button onClick={() => loadMovies()} className="flex items-center gap-3 px-10 py-5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all shadow-2xl active:scale-95">
            <Zap size={20} className="text-yellow-400 fill-yellow-400" />
            <span className="font-bold tracking-widest text-xs uppercase">Expand discovery</span>
          </button>
        </div>
      )}
    </div>
  );
}
