import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Zap, Search, Loader2, Star, Heart, Bookmark, LogOut } from 'lucide-react';

// FIREBASE IMPORTS
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";

// --- YOUR EXACT FIREBASE CONFIG ---
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
        <Image ref={meshRef} url={movie.poster} transparent scale={isSelected ? [3, 4.5] : [1.5, 2.25]} onClick={(e) => { e.stopPropagation(); onSelect(movie, position); }} />
      </Float>
      {!isSelected && <Text position={[0, -1.4, 0]} fontSize={0.12} color="white" maxWidth={1.5} textAlign="center">{movie.title}</Text>}
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
    if (!targetPos.current.active && groupRef.current) groupRef.current.rotation.y += delta * 0.1;
  });

  return (
    <>
      <Stars radius={100} depth={50} count={5000} factor={4} fade />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#fff" />
      <group ref={groupRef}>{movies.map((m, i) => (<MoviePoster key={`${m.id}-${i}`} movie={m} position={positions[i]} onSelect={onSelect} isSelected={selectedMovie?.id === m.id} />))}</group>
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
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 30), active: false });

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
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}`);
      const data = await res.json();
      setMovies(data.results.map(m => ({ id: m.id, title: m.title, poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`, overview: m.overview, rating: m.vote_average })));
    } catch (err) { console.error("TMDB Load Error"); }
    setLoading(false);
  };

  useEffect(() => { if (user) loadMovies(); }, [user, view]);

  const toggleFav = async (movie) => {
    const ref = doc(db, "users", user.uid, "favorites", movie.id.toString());
    if (favs[movie.id]) { await deleteDoc(ref); } 
    else { await setDoc(ref, movie); }
  };

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white p-6 text-center">
      <div className="absolute inset-0 opacity-40"><Canvas><Stars/></Canvas></div>
      <h1 className="text-7xl font-black mb-4 z-10 tracking-tighter uppercase italic">Galaxy</h1>
      <p className="text-gray-400 mb-10 z-10 max-w-sm font-medium tracking-wide">Sign in to claim your corner of the universe and save your favorite films.</p>
      <button onClick={() => signInWithPopup(auth, provider)} className="z-10 bg-white text-black px-10 py-5 rounded-full font-black flex items-center gap-4 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" className="w-6" alt="google" />
        CONTINUE WITH GOOGLE
      </button>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#020202] relative overflow-hidden text-white">
      <Canvas dpr={[1, 2]} camera={{ fov: 45 }}>
        <GlobeScene movies={movies} targetPos={targetPos} selectedMovie={selected} onSelect={(m, p) => { setSelected(m); targetPos.current = { pos: p.clone().multiplyScalar(1.35), active: true }; }} />
      </Canvas>

      <div className="absolute top-8 w-full px-10 flex justify-between items-center z-20">
        <div className="flex gap-4 p-1 bg-white/5 backdrop-blur-3xl rounded-full border border-white/10">
          <button onClick={() => setView('explore')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'explore' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>Explore</button>
          <button onClick={() => setView('favs')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'favs' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>My Galaxy ({Object.keys(favs).length})</button>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase hidden md:block">{user.displayName}</span>
          <button onClick={() => signOut(auth)} className="text-white/30 hover:text-red-500 transition-all"><LogOut size={22}/></button>
        </div>
      </div>

      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-center p-8 pointer-events-none">
          <div className="w-[440px] p-10 rounded-[3rem] pointer-events-auto bg-black/60 backdrop-blur-3xl border border-white/10 shadow-2xl animate-in slide-in-from-right-10 duration-500">
            <button onClick={() => { setSelected(null); targetPos.current.active = false; }} className="absolute top-10 right-10 text-white/20 hover:text-white transition-all"><X size={32}/></button>
            <div className="flex items-center gap-2 mb-4 text-yellow-500 font-black tracking-[0.2em] text-[10px]">
              <Star size={14} fill="currentColor" /> {selected.rating.toFixed(1)} / 10
            </div>
            <h2 className="text-5xl font-black mb-6 uppercase tracking-tighter leading-[0.85]">{selected.title}</h2>
            <p className="text-gray-400 mb-10 text-lg leading-relaxed line-clamp-6 font-medium pr-4">{selected.overview}</p>
            <div className="flex gap-4">
              <button className="flex-1 bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95">Watch Trailer</button>
              <button onClick={() => toggleFav(selected)} className={`p-5 rounded-2xl border transition-all active:scale-90 ${favs[selected.id] ? 'bg-red-600 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'border-white/10 hover:bg-white/10'}`}>
                <Heart size={24} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
