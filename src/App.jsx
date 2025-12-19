import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Zap, Search, Loader2, Star, Heart, Bookmark, LogOut } from 'lucide-react';

// FIREBASE IMPORTS
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";

// --- CONFIGS ---
// This line pulls the key from your Vercel Environment Variables
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
      <Float speed={isSelected ? 0 : 1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <Image 
          ref={meshRef} 
          url={movie.poster} 
          transparent 
          scale={isSelected ? [3, 4.5] : [1.5, 2.25]} 
          onClick={(e) => { e.stopPropagation(); onSelect(movie, position); }} 
        />
      </Float>
      {!isSelected && (
        <Text position={[0, -1.4, 0]} fontSize={0.1} color="white" maxWidth={1.5} textAlign="center">
          {movie.title}
        </Text>
      )}
    </group>
  );
}

function GlobeScene({ movies, onSelect, targetPos, selectedMovie }) {
  const { camera } = useThree();
  const groupRef = useRef();
  const radius = useMemo(() => Math.sqrt(movies.length || 1) * 3 + 10, [movies.length]);
  
  const positions = useMemo(() => {
    if (movies.length === 0) return [];
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
    if (!targetPos.current.active && groupRef.current) groupRef.current.rotation.y += delta * 0.03;
  });

  return (
    <>
      <Stars radius={100} depth={50} count={3000} factor={4} fade />
      <ambientLight intensity={0.8} />
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#fff" />
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
  const [loading, setLoading] = useState(false);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 45), active: false });

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
    if (view === 'favs' || !user) return;
    
    // Safety Check for the variable
    if (typeof TMDB_KEY === 'undefined' || TMDB_KEY.includes('PASTE')) {
        console.error("TMDB_KEY is not defined properly in App.jsx");
        return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=en-US&page=1`);
      const data = await response.json();
      if (data.results) {
        setMovies(data.results.map(m => ({
          id: m.id,
          title: m.title,
          poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750',
          overview: m.overview,
          rating: m.vote_average
        })));
      }
    } catch (err) { 
      console.error("Fetch Error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { loadMovies(); }, [user, view]);

  const toggleFav = async (movie) => {
    const ref = doc(db, "users", user.uid, "favorites", movie.id.toString());
    if (favs[movie.id]) { await deleteDoc(ref); } 
    else { await setDoc(ref, movie); }
  };

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white relative">
      <div className="absolute inset-0 z-0 opacity-40"><Canvas><Stars/></Canvas></div>
      <div className="z-10 text-center px-6">
        <h1 className="text-7xl font-black mb-4 tracking-tighter uppercase italic">Galaxy</h1>
        <p className="text-white/40 mb-10 tracking-widest text-[10px] uppercase">Sign in to explore</p>
        <button 
          onClick={() => signInWithPopup(auth, provider)} 
          className="bg-white text-black px-12 py-5 rounded-full font-black flex items-center justify-center gap-4 hover:scale-105 transition-all mx-auto"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" className="w-5" alt="google" />
          SIGN IN WITH GOOGLE
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#020202] relative overflow-hidden text-white">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 45 }}>
        <GlobeScene movies={movies} targetPos={targetPos} selectedMovie={selected} onSelect={(m, p) => { setSelected(m); targetPos.current = { pos: p.clone().multiplyScalar(1.35), active: true }; }} />
      </Canvas>

      <div className="absolute top-8 w-full px-10 flex justify-between items-center z-20">
        <div className="flex gap-4 p-1 bg-white/5 backdrop-blur-3xl rounded-full border border-white/10">
          <button onClick={() => setView('explore')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'explore' ? 'bg-white text-black' : 'text-white/40'}`}>Explore</button>
          <button onClick={() => setView('favs')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'favs' ? 'bg-white text-black' : 'text-white/40'}`}>My Galaxy ({Object.keys(favs).length})</button>
        </div>
        <button onClick={() => signOut(auth)} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={22}/></button>
      </div>

      {loading && <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-bold tracking-widest text-white/50 uppercase"><Loader2 className="animate-spin" size={14}/> Loading Galaxy...</div>}

      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-center p-8 pointer-events-none">
          <div className="w-[420px] p-10 rounded-[3rem] pointer-events-auto bg-black/60 backdrop-blur-3xl border border-white/10 animate-in slide-in-from-right-10">
            <button onClick={() => { setSelected(null); targetPos.current.active = false; }} className="absolute top-10 right-10 text-white/20 hover:text-white"><X size={32}/></button>
            <h2 className="text-5xl font-black mb-6 uppercase tracking-tighter leading-none">{selected.title}</h2>
            <p className="text-white/50 mb-10 text-lg leading-relaxed line-clamp-6">{selected.overview}</p>
            <div className="flex gap-4">
              <button className="flex-1 bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest text-xs">Trailer</button>
              <button onClick={() => toggleFav(selected)} className={`p-5 rounded-2xl border transition-all ${favs[selected.id] ? 'bg-red-600 border-red-600' : 'border-white/10 hover:bg-white/10'}`}>
                <Heart size={24} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
