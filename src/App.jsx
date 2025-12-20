import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float, OrbitControls, Points, PointMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import * as THREE from 'three';
import { X, Zap, Search, Loader2, Star, Heart, LogOut, PlayCircle, Filter } from 'lucide-react';

// FIREBASE
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";

// --- CONFIGS ---
const TMDB_KEY = import.meta.env.VITE_TMDB_KEY; 
const firebaseConfig = {
  apiKey: "AIzaSyBAlzr5iDMGukw5ms2IRMU_YHKYbLOiEg4",
  authDomain: "moviegalaxy-879b7.firebaseapp.com",
  projectId: "moviegalaxy-879b7",
  storageBucket: "moviegalaxy-879b7.firebasestorage.app",
  messagingSenderId: "700475939762",
  appId: "1:700475939762:web:013f67a50c2e753266e2ab",
  measurementId: "G-B2HTCHCFC0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const GENRES = [
  { id: null, name: 'Trending', color: '#00f2ff' }, // Cyan for Sci-Fi vibe
  { id: 28, name: 'Action', color: '#ff4d4d' },
  { id: 878, name: 'Sci-Fi', color: '#00f2ff' },
  { id: 27, name: 'Horror', color: '#660000' },
  { id: 35, name: 'Comedy', color: '#ffcc00' },
  { id: 16, name: 'Animation', color: '#ff66cc' },
];

// --- 1. SPACE DUST COMPONENT ---
function SpaceDust({ count = 1500 }) {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 100;
      p[i * 3 + 1] = (Math.random() - 0.5) * 100;
      p[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    return p;
  }, [count]);

  const ref = useRef();
  useFrame((state) => {
    ref.current.rotation.y += 0.001;
    ref.current.rotation.x += 0.0005;
  });

  return (
    <Points ref={ref} positions={points} stride={3}>
      <PointMaterial transparent color="#ffffff" size={0.05} sizeAttenuation={true} depthWrite={false} opacity={0.4} />
    </Points>
  );
}

// --- 3D COMPONENTS ---
function MoviePoster({ movie, position, onSelect, isSelected }) {
  const meshRef = useRef();
  
  useFrame(({ camera }) => { 
    if (meshRef.current) {
      meshRef.current.lookAt(isSelected ? camera.position : new THREE.Vector3(0,0,0));
    }
  });

  return (
    <group position={position}>
      <Float speed={isSelected ? 0 : 2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Image 
          ref={meshRef} 
          url={movie.poster} 
          transparent 
          scale={isSelected ? [3.8, 5.7] : [1.8, 2.7]} 
          onClick={(e) => { e.stopPropagation(); onSelect(movie, position); }}
        >
          {/* 3. FRESNEL SHINE EFFECT simulation via material props */}
          <meshBasicMaterial toneMapped={false} />
        </Image>
      </Float>
      {!isSelected && (
        <Text position={[0, -1.8, 0]} fontSize={0.15} color="white" font="https://fonts.gstatic.com/s/raleway/v22/1Ptxg8zYS_SKggPN4iEgvnxyumZquhZ-A4z9pW9O9Ag.woff">
          {movie.title}
        </Text>
      )}
    </group>
  );
}

function GlobeScene({ movies, onSelect, targetPos, selectedMovie, genreColor, isWarping }) {
  const { camera } = useThree();
  const groupRef = useRef();
  const radius = useMemo(() => Math.sqrt(movies.length || 1) * 3 + 18, [movies.length]);
  
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
    // 4. DYNAMIC FOV WARP
    if (isWarping) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, 70, 0.1);
    } else {
      camera.fov = THREE.MathUtils.lerp(camera.fov, 45, 0.1);
    }
    camera.updateProjectionMatrix();

    camera.position.lerp(targetPos.current.pos, 0.08);
    camera.lookAt(0, 0, 0);
    
    if (!targetPos.current.active && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <>
      <color attach="background" args={['#00050a']} />
      <Stars radius={150} depth={50} count={10000} factor={4} fade speed={1} />
      <SpaceDust />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={2} color={genreColor} />
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} />

      <group ref={groupRef}>
        {movies.map((m, i) => (
          <MoviePoster key={`${m.id}-${i}`} movie={m} position={positions[i]} onSelect={onSelect} isSelected={selectedMovie?.id === m.id} />
        ))}
      </group>

      {/* 5. COLOR GRADING & BLOOM */}
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
        <HueSaturation saturation={0.1} hue={0} />
        <BrightnessContrast brightness={0} contrast={0.2} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <ChromaticAberration offset={[0.0008, 0.0008]} />
      </EffectComposer>
    </>
  );
}

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [movies, setMovies] = useState([]);
  const [favs, setFavs] = useState({});
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('explore');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [isWarping, setIsWarping] = useState(false);
  const [page, setPage] = useState(1);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 50), active: false });

  const activeGenreObj = useMemo(() => GENRES.find(g => g.id === genre) || GENRES[0], [genre]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users", user.uid, "favorites"), (snap) => {
      const d = {};
      snap.forEach(doc => d[doc.id] = doc.data());
      setFavs(d);
      if (view === 'favs') setMovies(Object.values(d));
    });
    return unsub;
  }, [user, view]);

  const triggerWarp = () => {
    setIsWarping(true);
    setTimeout(() => setIsWarping(false), 800);
  };

  const loadMovies = async (reset = false) => {
    if (view === 'favs') return;
    setLoading(true);
    triggerWarp();
    try {
      const currentPage = reset ? 1 : page;
      let endpoint = query 
        ? `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=${currentPage}`
        : genre 
        ? `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_genres=${genre}&page=${currentPage}`
        : `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&page=${currentPage}`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      const formatted = data.results.filter(m => m.poster_path).map(m => ({
        id: m.id, title: m.title, poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        overview: m.overview, rating: m.vote_average
      }));

      if (reset) {
        setMovies(formatted);
        setPage(2);
        targetPos.current = { pos: new THREE.Vector3(0, 0, 50), active: false };
      } else {
        setMovies(prev => [...prev, ...formatted]);
        setPage(p => p + 1);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (user && view === 'explore') loadMovies(true); }, [user, view, genre]);

  const handleSelect = (movie, pos) => {
    if (selected?.id === movie.id) {
      setSelected(null);
      targetPos.current = { pos: new THREE.Vector3(0, 0, 50), active: false };
    } else {
      setSelected(movie);
      const zoomPos = pos.clone().normalize().multiplyScalar(Math.sqrt(movies.length) * 3 + 12);
      targetPos.current = { pos: zoomPos, active: true };
    }
  };

  if (!user) return (
    <div className="h-screen w-full bg-black flex items-center justify-center text-white">
      <button onClick={() => signInWithPopup(auth, provider)} className="px-10 py-5 bg-white text-black font-black rounded-full uppercase tracking-widest hover:scale-105 transition-all">Enter Galaxy</button>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#00050a] relative overflow-hidden text-white font-sans">
      <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 1000 }}>
        <Suspense fallback={null}>
          <GlobeScene movies={movies} onSelect={handleSelect} targetPos={targetPos} selectedMovie={selected} genreColor={activeGenreObj.color} isWarping={isWarping} />
        </Suspense>
      </Canvas>

      {/* 2. GLASSMORPHISM UI */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-6 z-40 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex p-1 bg-white/5 backdrop-blur-[20px] rounded-full border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]">
            <button onClick={() => setView('explore')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'explore' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>Explore</button>
            <button onClick={() => setView('favs')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'favs' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>Favs</button>
          </div>
          <div className="relative group">
            <button className="px-8 py-3.5 bg-white/5 backdrop-blur-[20px] border border-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
              <Filter size={12} className="inline mr-2" style={{ color: activeGenreObj.color }}/> {activeGenreObj.name}
            </button>
            <div className="absolute top-full left-0 mt-3 w-48 bg-black/80 backdrop-blur-[30px] border border-white/10 rounded-2xl hidden group-hover:block overflow-hidden shadow-2xl">
              {GENRES.map(g => (
                <button key={g.id} onClick={() => { setGenre(g.id); setQuery(''); }} className="w-full text-left px-6 py-4 text-[10px] uppercase font-black hover:bg-white hover:text-black transition-all border-b border-white/5 last:border-0">
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          {view === 'explore' && (
            <form onSubmit={(e) => { e.preventDefault(); loadMovies(true); }} className="relative group">
              <input type="text" placeholder="SEARCH VOID..." value={query} onChange={(e) => setQuery(e.target.value)} className="bg-white/5 backdrop-blur-[20px] border border-white/20 px-12 py-3.5 rounded-full outline-none focus:border-white/50 text-[10px] font-black uppercase tracking-[0.2em] transition-all w-64 md:w-80" />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
            </form>
          )}
          <button onClick={() => signOut(auth)} className="p-4 bg-white/5 backdrop-blur-[20px] border border-white/20 rounded-full hover:bg-red-500/20 hover:border-red-500/50 transition-all group">
            <LogOut size={16} className="group-hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* INFO PANEL: Glass style */}
      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-center p-6 md:p-12 pointer-events-none w-full md:w-auto">
          <div className="w-full md:w-[460px] p-12 rounded-[3.5rem] pointer-events-auto bg-black/40 backdrop-blur-[40px] border border-white/20 shadow-2xl animate-in slide-in-from-right duration-700">
            <button onClick={() => { setSelected(null); targetPos.current = { pos: new THREE.Vector3(0, 0, 50), active: false }; }} className="absolute top-10 right-10 text-white/30 hover:text-white transition-all"><X size={28}/></button>
            <div className="flex items-center gap-2 mb-8 text-yellow-500 font-black text-xs uppercase tracking-widest"><Star size={14} fill="currentColor" /> {selected.rating.toFixed(1)} TMDB Score</div>
            <h2 className="text-5xl font-black mb-8 uppercase tracking-tighter leading-[0.9]">{selected.title}</h2>
            <p className="text-white/40 mb-12 text-sm leading-relaxed italic line-clamp-6">{selected.overview}</p>
            <div className="flex gap-4">
              <button onClick={() => {
                fetch(`https://api.themoviedb.org/3/movie/${selected.id}/videos?api_key=${TMDB_KEY}`)
                  .then(r => r.json()).then(d => {
                    const t = d.results.find(v => v.type === "Trailer");
                    if(t) setTrailerKey(t.key);
                  });
              }} className="flex-1 bg-white text-black py-5 rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-105 transition-all"><PlayCircle size={18} /> Watch Trailer</button>
              <button onClick={async () => {
                const ref = doc(db, "users", user.uid, "favorites", selected.id.toString());
                if (favs[selected.id]) await deleteDoc(ref); else await setDoc(ref, selected);
              }} className={`p-5 rounded-full border transition-all ${favs[selected.id] ? 'bg-red-600 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'border-white/20 hover:bg-white/10'}`}>
                <Heart size={22} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {trailerKey && (
        <div className="absolute inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 backdrop-blur-3xl">
           <div className="relative w-full max-w-6xl aspect-video rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
              <button onClick={() => setTrailerKey(null)} className="absolute top-8 right-8 z-10 p-4 bg-black/60 rounded-full hover:bg-white hover:text-black transition-all"><X size={24}/></button>
              <iframe width="100%" height="100%" src={`https://youtube.com/embed/${trailerKey}?autoplay=1`} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen></iframe>
           </div>
        </div>
      )}

      {!selected && (
        <button onClick={() => loadMovies()} className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 px-10 py-5 bg-white/5 backdrop-blur-[20px] border border-white/20 rounded-full font-black text-[10px] uppercase tracking-[0.3em] hover:bg-white/10 transition-all z-30 pointer-events-auto">
          <Zap size={16} className="text-cyan-400 fill-cyan-400" /> Warp Forward
        </button>
      )}
    </div>
  );
}
