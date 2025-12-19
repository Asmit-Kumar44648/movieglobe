import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Zap, Heart, Star } from 'lucide-react';

const API_KEY = import.meta.env.VITE_TMDB_KEY;

// 3D POSTER COMPONENT
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
        <Text position={[0, -1.4, 0]} fontSize={0.12} color="white" font="https://fonts.gstatic.com/s/raleway/v28/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaorCIPrQ.ttf">
          {movie.title.length > 20 ? movie.title.substring(0, 20) + '...' : movie.title}
        </Text>
      )}
    </group>
  );
}

// 3D GLOBE SCENE
function GlobeScene({ movies, onSelect, targetPos, selectedMovie }) {
  const { camera } = useThree();
  const groupRef = useRef();
  
  // Math: Dynamic Radius based on movie count
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
    // Smooth Camera Fly-In (Lerp)
    camera.position.lerp(targetPos.current.pos, 0.08);
    camera.lookAt(0, 0, 0);

    // Subtle Globe Rotation when idle
    if (!targetPos.current.active && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <>
      <Stars radius={100} depth={50} count={7000} factor={4} fade speed={1} />
      <ambientLight intensity={0.8} />
      <group ref={groupRef}>
        {movies.map((m, i) => (
          <MoviePoster 
            key={m.id + i} 
            movie={m} 
            position={positions[i]} 
            onSelect={onSelect}
            isSelected={selectedMovie?.id === m.id}
          />
        ))}
      </group>
    </>
  );
}

// MAIN APP
export default function App() {
  const [movies, setMovies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [liked, setLiked] = useState([]);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 30), active: false });

  const loadMovies = async () => {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&page=${page}`);
      const data = await res.json();
      const formatted = data.results.map(m => ({
        id: m.id,
        title: m.title,
        poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        overview: m.overview,
        rating: m.vote_average
      }));
      setMovies(prev => [...prev, ...formatted]);
      setPage(p => p + 1);
    } catch (e) { console.error("API Key missing or invalid"); }
  };

  useEffect(() => { loadMovies(); }, []);

  const handleSelect = (movie, pos) => {
    setSelected(movie);
    // Position camera 35% away from the movie to see it clearly
    targetPos.current = { pos: pos.clone().multiplyScalar(1.35), active: true };
  };

  const close = () => {
    setSelected(null);
    targetPos.current = { pos: new THREE.Vector3(0, 0, 30), active: false };
  };

  return (
    <div className="h-screen w-full bg-[#020202] relative overflow-hidden text-white selection:bg-white/20">
      <Canvas dpr={[1, 2]} camera={{ fov: 45 }}>
        <GlobeScene movies={movies} onSelect={handleSelect} targetPos={targetPos} selectedMovie={selected} />
      </Canvas>

      {/* Discovery Trigger */}
      {!selected && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6">
          <button onClick={loadMovies} className="glass group flex items-center gap-3 px-10 py-5 rounded-full transition-all hover:bg-white/10 active:scale-95 shadow-2xl">
            <Zap size={22} className="text-yellow-400 group-hover:animate-pulse fill-yellow-400" />
            <span className="font-bold tracking-widest text-sm uppercase">Expand Galaxy</span>
          </button>
        </div>
      )}

      {/* High-End Detail Overlay */}
      {selected && (
        <div className="absolute inset-0 z-50 flex items-center justify-end p-4 md:p-12 pointer-events-none bg-black/20">
          <div className="glass w-full md:w-[500px] p-10 rounded-[3rem] pointer-events-auto flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-right-20 duration-700">
            <button onClick={close} className="absolute top-10 right-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
              <X size={28}/>
            </button>
            
            <div className="flex items-center gap-2 mb-6 text-yellow-500 font-black tracking-widest text-sm">
              <Star size={16} fill="currentColor" /> {selected.rating.toFixed(1)} / 10
            </div>

            <h2 className="text-5xl font-black mb-6 uppercase tracking-tighter leading-[0.9]">{selected.title}</h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-10 overflow-y-auto max-h-[30vh] pr-4 scrollbar-hide">
              {selected.overview}
            </p>

            <div className="flex gap-4 mt-auto">
              <button className="flex-[2] bg-white text-black py-6 rounded-3xl font-black flex items-center justify-center gap-3 text-lg hover:bg-gray-200 transition-all active:scale-95">
                <Play size={24} fill="black" /> WATCH NOW
              </button>
              <button 
                onClick={() => setLiked([...liked, selected])}
                className="flex-1 glass rounded-3xl flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/50 transition-all"
              >
                <Heart size={28} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
