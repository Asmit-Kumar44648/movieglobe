import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { X, Zap, Search, Loader2, Star, Heart, LogOut, PlayCircle, Filter, Volume2, VolumeX } from 'lucide-react';

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
  { id: null, name: 'Trending', color: '#ffffff' },
  { id: 28, name: 'Action', color: '#ff4d4d' },
  { id: 878, name: 'Sci-Fi', color: '#00f2ff' },
  { id: 27, name: 'Horror', color: '#660000' },
  { id: 35, name: 'Comedy', color: '#ffcc00' },
  { id: 16, name: 'Animation', color: '#ff66cc' },
];

// --- 3D COMPONENTS ---
function MoviePoster({ movie, position, onSelect, isSelected }) {
  const meshRef = useRef();
  useFrame(({ camera }) => { 
    if (meshRef.current) {
        if (isSelected) meshRef.current.lookAt(camera.position);
        else meshRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <group position={position}>
      <Float speed={isSelected ? 0 : 2} rotationIntensity={0.2} floatIntensity={0.5}>
        <Image 
          ref={meshRef} 
          url={movie.poster} 
          transparent 
          scale={isSelected ? [3.2, 4.8] : [1.5, 2.25]} 
          onClick={(e) => { e.stopPropagation(); onSelect(movie, position); }} 
        />
      </Float>
      {!isSelected && <Text position={[0, -1.5, 0]} fontSize={0.12} font="/font.woff" color="white" maxWidth={1.8} textAlign="center">{movie.title}</Text>}
    </group>
  );
}

function GlobeScene({ movies, onSelect, targetPos, selectedMovie, genreColor }) {
  const { camera } = useThree();
  const groupRef = useRef();
  const radius = useMemo(() => Math.sqrt(movies.length || 1) * 3 + 14, [movies.length]);
  
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
    camera.position.lerp(targetPos.current.pos, 0.06);
    camera.lookAt(0, 0, 0);
    if (!targetPos.current.active && groupRef.current) {
        groupRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <>
      <color attach="background" args={['#000']} />
      <Stars radius={100} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={2} color={genreColor} />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#444" />
      
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.4} />

      <group ref={groupRef}>
        {movies.map((m, i) => (
          <MoviePoster key={`${m.id}-${i}`} movie={m} position={positions[i]} onSelect={onSelect} isSelected={selectedMovie?.id === m.id} />
        ))}
      </group>

      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
        <ChromaticAberration offset={[0.0005, 0.0005]} />
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
  const [isMuted, setIsMuted] = useState(true);
  const [page, setPage] = useState(1);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 45), active: true });

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

  const loadMovies = async (reset = false) => {
    if (view === 'favs') return;
    setLoading(true);
    try {
      let endpoint;
      const currentPage = reset ? 1 : page;
      if (query) endpoint = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=${currentPage}`;
      else if (genre) endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_genres=${genre}&page=${currentPage}`;
      else endpoint = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&page=${currentPage}`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      const formatted = data.results.filter(m => m.poster_path).map(m => ({
        id: m.id, title: m.title, poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        overview: m.overview, rating: m.vote_average
      }));

      if (reset) { setMovies(formatted); setPage(2); targetPos.current = { pos: new THREE.Vector3(0, 0, 45), active: true }; }
      else { setMovies(prev => [...prev, ...formatted]); setPage(p => p + 1); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (user && view === 'explore') loadMovies(true); }, [user, view, genre]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setGenre(null);
    setSelected(null);
    loadMovies(true);
  };

  const fetchTrailer = async (movie) => {
    // Cinematic transition: Dive into poster
    targetPos.current = { pos: targetPos.current.pos.clone().multiplyScalar(0.5), active: true };
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${TMDB_KEY}`);
      const data = await res.json();
      const trailer = data.results.find(v => v.type === "Trailer" && v.site === "YouTube");
      setTimeout(() => { if (trailer) setTrailerKey(trailer.key); }, 500);
    } catch (e) { console.error(e); }
  };

  const toggleFav = async (movie) => {
    const ref = doc(db, "users", user.uid, "favorites", movie.id.toString());
    if (favs[movie.id]) await deleteDoc(ref);
    else await setDoc(ref, movie);
  };

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white p-10">
      <div className="absolute inset-0 opacity-30"><Canvas><Stars/></Canvas></div>
      <div className="z-10 text-center space-y-8 max-w-lg">
        <h1 className="text-9xl font-black tracking-tighter italic uppercase bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">Galaxy</h1>
        <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-white text-black py-6 rounded-2xl font-black text-xs tracking-[0.3em] flex items-center justify-center gap-4 hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] uppercase">
          <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5" /> Continue with Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-black relative overflow-hidden text-white selection:bg-white/20">
      {/* Background Audio (Deep Space Drone) */}
      <iframe src="https://www.youtube.com/embed/z8WvS0_SAtg?autoplay=1&loop=1&playlist=z8WvS0_SAtg&mute=1" className="hidden" allow="autoplay"></iframe>

      <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 1000 }}>
        <Suspense fallback={null}>
          <GlobeScene movies={movies} targetPos={targetPos} selectedMovie={selected} genreColor={activeGenreObj.color} />
        </Suspense>
      </Canvas>

      {/* TOP NAVIGATION: Perfect Alignment & Visual Hierarchy */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-8 z-40 pointer-events-none">
        <div className="flex items-center gap-6 pointer-events-auto">
          <div className="flex p-1.5 bg-white/5 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-2xl">
            <button onClick={() => {setView('explore'); setGenre(null);}} className={`px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view === 'explore' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>Explore</button>
            <button onClick={() => setView('favs')} className={`px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view === 'favs' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>Galaxy ({Object.keys(favs).length})</button>
          </div>
          
          <div className="relative group">
            <button className="flex items-center gap-3 px-8 py-4.5 rounded-[2rem] bg-white/5 backdrop-blur-3xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:border-white/40 transition-all">
              <Filter size={14} style={{ color: activeGenreObj.color }}/> {activeGenreObj.name}
            </button>
            <div className="absolute top-[110%] left-0 w-56 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden hidden group-hover:block shadow-2xl">
              {GENRES.map(g => (
                <button key={g.id} onClick={() => { setGenre(g.id); setQuery(''); }} className="w-full text-left px-8 py-4 text-[10px] uppercase font-black tracking-widest hover:bg-white hover:text-black transition-all border-b border-white/5 last:border-0" style={{ color: genre === g.id ? g.color : 'inherit' }}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'explore' && (
          <form onSubmit={handleSearch} className="relative w-full max-w-md pointer-events-auto group">
            <input type="text" placeholder="SEARCH THE VOID..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 px-14 py-5 rounded-[2rem] outline-none focus:border-white/40 text-[10px] font-bold tracking-[0.2em] uppercase transition-all" />
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white" size={18} />
            {loading && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 animate-spin text-white/40" size={18} />}
          </form>
        )}
      </div>

      {/* INFO PANEL: Senior UX Layout */}
      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-center p-6 md:p-12 pointer-events-none w-full md:w-auto overflow-hidden">
          <div className="w-full md:w-[480px] p-10 md:p-14 rounded-[4rem] pointer-events-auto bg-black/40 backdrop-blur-[60px] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-20 duration-700 relative">
            <button onClick={() => { setSelected(null); targetPos.current.active = false; }} className="absolute top-12 right-12 text-white/20 hover:text-white transition-all hover:rotate-90 duration-300"><X size={36}/></button>
            
            <div className="flex items-center gap-3 mb-10">
              <div className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase tracking-widest">
                <Star size={12} fill="currentColor" /> {selected.rating.toFixed(1)}
              </div>
              <span className="text-white/20 text-[10px] font-black uppercase tracking-widest tracking-[0.3em]">Critical Score</span>
            </div>

            <h2 className="text-5xl md:text-6xl font-black mb-8 uppercase tracking-tighter leading-[0.85]">{selected.title}</h2>
            <div className="w-20 h-1.5 bg-white mb-10 rounded-full opacity-20"></div>
            <p className="text-white/50 mb-14 text-lg leading-[1.6] line-clamp-5 font-medium italic">{selected.overview}</p>
            
            <div className="flex gap-4">
              <button onClick={() => fetchTrailer(selected)} className="flex-[2] bg-white text-black py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl">
                <PlayCircle size={20} /> Watch Trailer
              </button>
              <button onClick={() => toggleFav(selected)} className={`flex-1 rounded-[2rem] border flex items-center justify-center transition-all active:scale-90 ${favs[selected.id] ? 'bg-red-600 border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.4)]' : 'border-white/10 hover:bg-white/20'}`}>
                <Heart size={28} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRAILER OVERLAY */}
      {trailerKey && (
        <div className="absolute inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in zoom-in-95 duration-500 backdrop-blur-xl">
           <div className="relative w-full max-w-6xl aspect-video rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.1)] border border-white/10">
              <button onClick={() => setTrailerKey(null)} className="absolute top-8 right-8 z-10 p-4 bg-black/60 rounded-full hover:bg-white hover:text-black transition-all"><X size={28}/></button>
              <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen></iframe>
           </div>
        </div>
      )}

      {/* MORE BUTTON */}
      {view === 'explore' && !selected && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button onClick={() => loadMovies()} className="group flex items-center gap-4 px-12 py-6 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 hover:border-white/40 transition-all">
            <Zap size={20} className="text-yellow-400 fill-yellow-400 group-hover:scale-125 transition-transform" />
            <span className="font-black tracking-[0.3em] text-[10px] uppercase">Expand Galaxy</span>
          </button>
        </div>
      )}
    </div>
  );
}
