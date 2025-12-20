import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Zap, Search, Loader2, Star, Heart, Bookmark, LogOut } from 'lucide-react';

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

// --- 3D COMPONENTS ---
function MoviePoster({ movie, position, onSelect, isSelected }) {
  const meshRef = useRef();
  useFrame(() => { if (meshRef.current) meshRef.current.lookAt(0, 0, 0); });
  return (
    <group position={position}>
      <Float speed={isSelected ? 0 : 2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Image 
          ref={meshRef} 
          url={movie.poster} 
          transparent 
          scale={isSelected ? [3, 4.5] : [1.5, 2.25]} 
          onClick={(e) => { e.stopPropagation(); onSelect(movie, position); }} 
        />
      </Float>
      {!isSelected && <Text position={[0, -1.4, 0]} fontSize={0.12} color="white" maxWidth={1.5} textAlign="center">{movie.title}</Text>}
    </group>
  );
}

function GlobeScene({ movies, onSelect, targetPos, selectedMovie }) {
  const { camera } = useThree();
  const groupRef = useRef();
  const radius = useMemo(() => Math.sqrt(movies.length || 1) * 3 + 12, [movies.length]);
  
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
    if (!targetPos.current.active && groupRef.current) groupRef.current.rotation.y += delta * 0.08;
  });

  return (
    <>
      <Stars radius={100} depth={50} count={6000} factor={4} fade speed={1} />
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 0, 0]} intensity={3} color="#fff" />
      <group ref={groupRef}>
        {movies.map((m, i) => (
          <MoviePoster key={`${m.id}-${i}`} movie={m} position={positions[i] || new THREE.Vector3(0,0,0)} onSelect={onSelect} isSelected={selectedMovie?.id === m.id} />
        ))}
      </group>
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
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 40), active: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Real-time Favorites Sync
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

  const loadMovies = async (isSearch = false) => {
    if (view === 'favs' && !isSearch) return;
    setLoading(true);
    try {
      const endpoint = isSearch 
        ? `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`
        : `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&page=${page}`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      const formatted = data.results.filter(m => m.poster_path).map(m => ({
        id: m.id, title: m.title, poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        overview: m.overview, rating: m.vote_average
      }));

      if (isSearch) {
        setMovies(formatted);
        targetPos.current = { pos: new THREE.Vector3(0, 0, 40), active: false };
      } else {
        setMovies(prev => [...prev, ...formatted]);
        setPage(p => p + 1);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (user && view === 'explore') loadMovies(); }, [user, view === 'explore']);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSelected(null);
    targetPos.current = { pos: new THREE.Vector3(0, 20, 80), active: true };
    setTimeout(() => loadMovies(true), 500);
  };

  const toggleFav = async (movie) => {
    const ref = doc(db, "users", user.uid, "favorites", movie.id.toString());
    if (favs[movie.id]) { await deleteDoc(ref); } 
    else { await setDoc(ref, movie); }
  };

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white relative">
      <div className="absolute inset-0 opacity-40"><Canvas><Stars/></Canvas></div>
      <div className="z-10 text-center">
        <h1 className="text-8xl font-black mb-4 tracking-tighter uppercase italic">Galaxy</h1>
        <p className="text-white/40 mb-10 tracking-widest text-[10px] uppercase">Your journey begins here</p>
        <button onClick={() => signInWithPopup(auth, provider)} className="bg-white text-black px-12 py-5 rounded-full font-black flex items-center gap-4 hover:scale-105 transition-all">
          <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-6" alt="google" />
          CONTINUE WITH GOOGLE
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-black relative overflow-hidden text-white">
      <Canvas dpr={[1, 2]} camera={{ fov: 45 }}>
        <GlobeScene movies={movies} targetPos={targetPos} selectedMovie={selected} onSelect={(m, p) => { setSelected(m); targetPos.current = { pos: p.clone().multiplyScalar(1.35), active: true }; }} />
      </Canvas>

      {/* Top UI: Search & Tabs */}
      <div className="absolute top-8 w-full px-10 flex flex-col md:flex-row justify-between items-center gap-6 z-20">
        <div className="flex gap-4 p-1 bg-white/5 backdrop-blur-3xl rounded-full border border-white/10">
          <button onClick={() => setView('explore')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'explore' ? 'bg-white text-black' : 'text-white/40'}`}>Explore</button>
          <button onClick={() => setView('favs')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'favs' ? 'bg-white text-black' : 'text-white/40'}`}>My Galaxy ({Object.keys(favs).length})</button>
        </div>

        {view === 'explore' && (
          <form onSubmit={handleSearch} className="relative w-full max-w-md">
            <input type="text" placeholder="Search the void..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 px-14 py-4 rounded-full outline-none focus:border-white/30 text-sm tracking-widest" />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" size={20} />
            {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" size={20} />}
          </form>
        )}

        <button onClick={() => signOut(auth)} className="text-white/20 hover:text-red-500 transition-all flex items-center gap-2 group">
          <span className="text-[10px] font-bold tracking-widest opacity-0 group-hover:opacity-100 uppercase">{user.displayName}</span>
          <LogOut size={22}/>
        </button>
      </div>

      {/* Infinite Expand Button */}
      {view === 'explore' && !selected && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
          <button onClick={() => loadMovies()} className="flex items-center gap-3 px-10 py-5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all">
            <Zap size={18} className="text-yellow-400 fill-yellow-400" />
            <span className="font-black tracking-[0.2em] text-[10px] uppercase">Expand Galaxy</span>
          </button>
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-center p-8 pointer-events-none">
          <div className="w-[440px] p-12 rounded-[3.5rem] pointer-events-auto bg-black/50 backdrop-blur-[40px] border border-white/10 shadow-2xl animate-in slide-in-from-right-10">
            <button onClick={() => { setSelected(null); targetPos.current.active = false; }} className="absolute top-10 right-10 text-white/20 hover:text-white"><X size={32}/></button>
            <div className="flex items-center gap-2 mb-6 text-yellow-500 font-black tracking-[0.2em] text-[10px] uppercase">
              <Star size={16} fill="currentColor" /> {selected.rating.toFixed(1)} / 10
            </div>
            <h2 className="text-5xl font-black mb-6 uppercase tracking-tighter leading-none">{selected.title}</h2>
            <p className="text-white/40 mb-10 text-lg leading-relaxed line-clamp-6">{selected.overview}</p>
            <div className="flex gap-4">
              <button className="flex-1 bg-white text-black py-6 rounded-2xl font-black uppercase tracking-widest text-[10px]">Watch Trailer</button>
              <button onClick={() => toggleFav(selected)} className={`p-6 rounded-2xl border transition-all active:scale-90 ${favs[selected.id] ? 'bg-red-600 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'border-white/10 hover:bg-white/10'}`}>
                <Heart size={24} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
