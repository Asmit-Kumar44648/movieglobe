import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
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
      if (isSelected) {
        meshRef.current.lookAt(camera.position);
      } else {
        meshRef.current.lookAt(0, 0, 0);
      }
    }
  });

  return (
    <group position={position}>
      <Float speed={isSelected ? 0 : 2.5} rotationIntensity={0.3} floatIntensity={0.6}>
        <Image 
          ref={meshRef} 
          url={movie.poster} 
          transparent 
          scale={isSelected ? [3.5, 5.25] : [1.6, 2.4]} 
          onClick={(e) => { 
            e.stopPropagation(); 
            onSelect(movie, position); 
          }} 
        />
      </Float>
      {!isSelected && (
        <Text position={[0, -1.6, 0]} fontSize={0.14} color="white" maxWidth={1.8} textAlign="center" font="/font.woff">
          {movie.title}
        </Text>
      )}
    </group>
  );
}

function GlobeScene({ movies, onSelect, targetPos, selectedMovie, genreColor }) {
  const { camera } = useThree();
  const groupRef = useRef();
  
  const radius = useMemo(() => Math.sqrt(movies.length || 1) * 3 + 15, [movies.length]);
  
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
    // Camera Lerp (The Smooth Movement)
    camera.position.lerp(targetPos.current.pos, 0.07);
    camera.lookAt(0, 0, 0);
    
    // Constant Globe Rotation (The Palleted Movement you missed)
    if (!targetPos.current.active && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <>
      <color attach="background" args={['#000']} />
      <Stars radius={120} depth={60} count={8000} factor={5} saturation={0} fade speed={1.5} />
      <ambientLight intensity={0.5} />
      <pointLight position={[15, 15, 15]} intensity={2.5} color={genreColor} />
      
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} />

      <group ref={groupRef}>
        {movies.map((m, i) => (
          <MoviePoster key={`${m.id}-${i}`} movie={m} position={positions[i]} onSelect={onSelect} isSelected={selectedMovie?.id === m.id} />
        ))}
      </group>

      {/* THE WOW FACTOR: POST PROCESSING */}
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.2} radius={0.3} />
        <ChromaticAberration offset={[0.0006, 0.0006]} />
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
  const [page, setPage] = useState(1);
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 48), active: false });

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
        targetPos.current = { pos: new THREE.Vector3(0, 0, 48), active: false };
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
      targetPos.current = { pos: new THREE.Vector3(0, 0, 48), active: false };
    } else {
      setSelected(movie);
      const zoomPos = pos.clone().normalize().multiplyScalar(radiusToZoom(movies.length));
      targetPos.current = { pos: zoomPos, active: true };
    }
  };

  const radiusToZoom = (count) => Math.sqrt(count) * 3 + 10;

  const toggleFav = async (movie) => {
    const ref = doc(db, "users", user.uid, "favorites", movie.id.toString());
    if (favs[movie.id]) await deleteDoc(ref);
    else await setDoc(ref, movie);
  };

  const handleSignOut = () => signOut(auth);

  if (!user) return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white p-10">
      <div className="absolute inset-0 opacity-20"><Canvas><Stars/></Canvas></div>
      <div className="z-10 text-center space-y-8 max-w-lg">
        <h1 className="text-8xl font-black italic uppercase tracking-tighter">Galaxy</h1>
        <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:scale-105 transition-all">
           Continue with Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-black relative overflow-hidden text-white selection:bg-white/20">
      <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.1, far: 1000 }}>
        <Suspense fallback={null}>
          <GlobeScene movies={movies} onSelect={handleSelect} targetPos={targetPos} selectedMovie={selected} genreColor={activeGenreObj.color} />
        </Suspense>
      </Canvas>

      {/* HEADER: Balanced alignment */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-6 z-40 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex p-1 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10">
            <button onClick={() => setView('explore')} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view === 'explore' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>Explore</button>
            <button onClick={() => setView('favs')} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view === 'favs' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>Favs ({Object.keys(favs).length})</button>
          </div>
          
          <div className="relative group">
            <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest">
              <Filter size={12} style={{ color: activeGenreObj.color }}/> {activeGenreObj.name}
            </button>
            <div className="absolute top-full left-0 mt-2 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl hidden group-hover:block overflow-hidden shadow-2xl">
              {GENRES.map(g => (
                <button key={g.id} onClick={() => { setGenre(g.id); setQuery(''); }} className="w-full text-left px-6 py-3 text-[10px] uppercase font-black hover:bg-white hover:text-black transition-all">
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          {view === 'explore' && (
            <form onSubmit={(e) => { e.preventDefault(); loadMovies(true); }} className="relative">
              <input type="text" placeholder="SEARCH..." value={query} onChange={(e) => setQuery(e.target.value)} className="bg-white/5 backdrop-blur-xl border border-white/10 px-10 py-3 rounded-full outline-none focus:border-white/40 text-[10px] font-bold uppercase tracking-widest" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            </form>
          )}
          {/* SIGNOUT BUTTON RESTORED */}
          <button onClick={handleSignOut} className="p-3 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-full transition-all group">
            <LogOut size={18} className="group-hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* INFO PANEL */}
      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-center p-6 md:p-12 pointer-events-none w-full md:w-auto overflow-hidden">
          <div className="w-full md:w-[450px] p-10 rounded-[3rem] pointer-events-auto bg-black/60 backdrop-blur-3xl border border-white/10 shadow-2xl animate-in slide-in-from-right duration-500">
            <button onClick={() => { setSelected(null); targetPos.current = { pos: new THREE.Vector3(0, 0, 48), active: false }; }} className="absolute top-8 right-8 text-white/30 hover:text-white transition-all"><X size={24}/></button>
            <div className="flex items-center gap-2 mb-6">
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
              <span className="text-yellow-500 font-black text-xs">{selected.rating.toFixed(1)}</span>
            </div>
            <h2 className="text-4xl font-black mb-6 uppercase tracking-tighter leading-tight">{selected.title}</h2>
            <p className="text-white/50 mb-10 text-sm leading-relaxed line-clamp-6">{selected.overview}</p>
            <div className="flex gap-4">
              <button onClick={() => {
                targetPos.current = { pos: targetPos.current.pos.clone().multiplyScalar(0.4), active: true };
                fetch(`https://api.themoviedb.org/3/movie/${selected.id}/videos?api_key=${TMDB_KEY}`)
                  .then(r => r.json()).then(d => {
                    const t = d.results.find(v => v.type === "Trailer");
                    if(t) setTimeout(() => setTrailerKey(t.key), 600);
                  });
              }} className="flex-1 bg-white text-black py-4 rounded-full font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                <PlayCircle size={16} /> Trailer
              </button>
              <button onClick={() => toggleFav(selected)} className={`p-4 rounded-full border transition-all ${favs[selected.id] ? 'bg-red-600 border-red-600' : 'border-white/10'}`}>
                <Heart size={20} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRAILER MODAL */}
      {trailerKey && (
        <div className="absolute inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
           <div className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <button onClick={() => setTrailerKey(null)} className="absolute top-6 right-6 z-10 p-3 bg-black/60 rounded-full hover:bg-white hover:text-black transition-all"><X size={20}/></button>
              <iframe width="100%" height="100%" src={`https://youtube.com/embed/${trailerKey}?autoplay=1`} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen></iframe>
           </div>
        </div>
      )}

      {/* "MORE" BUTTON */}
      {view === 'explore' && !selected && (
        <button onClick={() => loadMovies()} className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-8 py-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest">
          <Zap size={14} className="text-yellow-400 fill-yellow-400" /> Expand Galaxy
        </button>
      )}
    </div>
  );
}
