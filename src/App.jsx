import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Zap, Search, Loader2, Star, Heart, Bookmark, LogOut } from 'lucide-react';

// FIREBASE IMPORTS
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";

// --- YOUR CONFIGS ---
const firebaseConfig = {
  apiKey: "AIzaSyBAlzr5iDMGukw5ms2IRMU_YHKYbLOiEg4",
  authDomain: "moviegalaxy-879b7.firebaseapp.com",
  projectId: "moviegalaxy-879b7",
  storageBucket: "moviegalaxy-879b7.firebasestorage.app",
  messagingSenderId: "700475939762",
  appId: "1:700475939762:web:013f67a50c2e753266e2ab",
  measurementId: "G-B2HTCHCFC0"
};

const API_KEY = import.meta.env.VITE_TMDB_KEY;

// Initialize Firebase
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
  const radius = useMemo(() => Math.sqrt(movies.length) * 3 + 10, [movies.length]);
  
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
    if (!targetPos.current.active && groupRef.current) groupRef.current.rotation.y += delta * 0.05;
  });

  return (
    <>
      <Stars radius={100} depth={50} count={5000} factor={4} fade />
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#fff" />
      <group ref={groupRef}>
        {movies.map((m, i) => (
          <MoviePoster key={`${m.id}-${i}`} movie={m} position={positions[i]} onSelect={onSelect} isSelected={selectedMovie?.id === m.id} />
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
  const [loading, setLoading] = useState(false);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 40), active: false });

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

  const loadMovies = async () => {
    if (view === 'favs') return;
    if (!TMDB_KEY || TMDB_KEY.includes('PASTE')) {
        console.error("Missing TMDB API Key");
        return;
    }
    setLoading(true);
    try {
      const url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=en-US&page=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("API Response not OK");
      const data = await res.json();
      setMovies(data.results.map(m => ({
        id: m.id,
        title: m.title,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750',
        overview: m.overview,
        rating: m.vote_average
      })));
    } catch (err) { 
      console.error("TMDB Load Error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) loadMovies(); }, [user, view]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const toggleFav = async (movie) => {
    const ref = doc(db, "users", user.uid, "favorites", movie.id.toString());
    if (favs[movie.id]) { await deleteDoc(ref); } 
    else { await setDoc(ref, movie); }
  };

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white p-6 overflow-hidden">
      <div className="absolute inset-0 z-0"><Canvas><Stars count={2000}/></Canvas></div>
      <div className="z-10 text-center animate-in fade-in zoom-in duration-1000">
        <h1 className="text-8xl font-black mb-2 tracking-tighter uppercase italic bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">Galaxy</h1>
        <p className="text-white/40 mb-12 max-w-sm mx-auto font-medium tracking-widest text-[10px] uppercase">Your cinematic universe awaits</p>
        <button 
          onClick={handleLogin} 
          className="bg-white text-black px-12 py-5 rounded-full font-black flex items-center justify-center gap-4 hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)] mx-auto"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          CONTINUE WITH GOOGLE
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-black relative overflow-hidden text-white selection:bg-white/20">
      <Canvas dpr={[1, 2]} camera={{ fov: 45 }}>
        <GlobeScene movies={movies} targetPos={targetPos} selectedMovie={selected} onSelect={(m, p) => { setSelected(m); targetPos.current = { pos: p.clone().multiplyScalar(1.35), active: true }; }} />
      </Canvas>

      {/* Header UI */}
      <div className="absolute top-8 w-full px-10 flex justify-between items-center z-20 pointer-events-none">
        <div className="flex gap-4 p-1 bg-white/5 backdrop-blur-3xl rounded-full border border-white/10 pointer-events-auto">
          <button onClick={() => setView('explore')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'explore' ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:text-white'}`}>Explore</button>
          <button onClick={() => setView('favs')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'favs' ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:text-white'}`}>My Galaxy ({Object.keys(favs).length})</button>
        </div>
        <div className="flex items-center gap-6 pointer-events-auto">
          <button onClick={() => signOut(auth)} className="text-white/20 hover:text-red-500 transition-all flex items-center gap-2 group">
            <span className="text-[10px] font-bold tracking-widest opacity-0 group-hover:opacity-100 transition-all">SIGN OUT</span>
            <LogOut size={20}/>
          </button>
        </div>
      </div>

      {/* Movie Details */}
      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-center p-8 pointer-events-none">
          <div className="w-[450px] p-12 rounded-[3.5rem] pointer-events-auto bg-black/40 backdrop-blur-[40px] border border-white/10 shadow-2xl animate-in slide-in-from-right-20 duration-700">
            <button onClick={() => { setSelected(null); targetPos.current.active = false; }} className="absolute top-12 right-12 text-white/20 hover:text-white transition-all"><X size={32}/></button>
            <div className="flex items-center gap-3 mb-6 text-yellow-500 font-black tracking-[0.3em] text-[10px]">
              <Star size={16} fill="currentColor" /> {selected.rating.toFixed(1)} / 10
            </div>
            <h2 className="text-6xl font-black mb-8 uppercase tracking-tighter leading-[0.8]">{selected.title}</h2>
            <p className="text-white/50 mb-12 text-lg leading-relaxed line-clamp-6 font-medium italic">{selected.overview}</p>
            <div className="flex gap-4">
              <button className="flex-1 bg-white text-black py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95 shadow-2xl">Watch Trailer</button>
              <button onClick={() => toggleFav(selected)} className={`p-6 rounded-[2rem] border transition-all active:scale-90 ${favs[selected.id] ? 'bg-red-600 border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : 'border-white/10 hover:bg-white/10'}`}>
                <Heart size={28} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
