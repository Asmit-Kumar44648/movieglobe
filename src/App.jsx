import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, Text, Stars, Float, OrbitControls } from '@react-three/drei';
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

// GENRES MAP
const GENRES = [
  { id: null, name: 'Popular' },
  { id: 28, name: 'Action' },
  { id: 878, name: 'Sci-Fi' },
  { id: 27, name: 'Horror' },
  { id: 35, name: 'Comedy' },
  { id: 16, name: 'Animation' },
  { id: 18, name: 'Drama' },
];

// --- 3D COMPONENTS ---
function MoviePoster({ movie, position, onSelect, isSelected }) {
  const meshRef = useRef();
  // Look at center, but if selected, look at camera
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
    // Smooth Camera Warp
    if (targetPos.current.active) {
        camera.position.lerp(targetPos.current.pos, 0.05);
        camera.lookAt(0, 0, 0);
    }
    // Auto Rotation (only if not dragging/interacting)
    if (!selectedMovie && groupRef.current) {
        groupRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <>
      <Stars radius={100} depth={50} count={6000} factor={4} fade speed={1} />
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 0, 0]} intensity={3} color="#fff" />
      
      {/* Mobile Controls: Enable rotation, disable zoom to prevent breaking the warp */}
      <OrbitControls 
        enableZoom={false} 
        enablePan={false} 
        rotateSpeed={0.5} 
        autoRotate={false}
        target={[0,0,0]}
      />

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
  const [genre, setGenre] = useState(null); // null = popular
  const [loading, setLoading] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null); // For YouTube Video
  const [page, setPage] = useState(1);
  
  // Camera Target for Warp Effect
  const targetPos = useRef({ pos: new THREE.Vector3(0, 0, 40), active: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Sync Favorites
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

  // Load Movies (Popular, Search, or Genre)
  const loadMovies = async (reset = false) => {
    if (view === 'favs') return;
    setLoading(true);
    try {
      let endpoint;
      const currentPage = reset ? 1 : page;

      if (query) {
        endpoint = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=${currentPage}`;
      } else if (genre) {
        endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_genres=${genre}&page=${currentPage}`;
      } else {
        endpoint = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&page=${currentPage}`;
      }
      
      const res = await fetch(endpoint);
      const data = await res.json();
      const formatted = data.results.filter(m => m.poster_path).map(m => ({
        id: m.id, title: m.title, poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        overview: m.overview, rating: m.vote_average
      }));

      if (reset) {
        setMovies(formatted);
        setPage(2);
        // Warp Camera Reset
        targetPos.current = { pos: new THREE.Vector3(0, 0, 40), active: true };
      } else {
        setMovies(prev => [...prev, ...formatted]);
        setPage(p => p + 1);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (user && view === 'explore') loadMovies(true); }, [user, view, genre]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setGenre(null); // Clear genre if searching
    setSelected(null);
    loadMovies(true);
  };

  const handleGenreChange = (newGenreId) => {
    setQuery(''); // Clear search if picking genre
    setGenre(newGenreId);
    setSelected(null);
  };

  const fetchTrailer = async (movie) => {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${TMDB_KEY}`);
      const data = await res.json();
      const trailer = data.results.find(v => v.type === "Trailer" && v.site === "YouTube");
      if (trailer) setTrailerKey(trailer.key);
      else alert("No trailer available for this movie yet!");
    } catch (e) { console.error("Trailer Error", e); }
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

      {/* TOP BAR */}
      <div className="absolute top-8 w-full px-4 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4 z-20 pointer-events-none">
        
        {/* Toggle & Genre */}
        <div className="flex flex-wrap justify-center gap-4 pointer-events-auto">
          <div className="flex gap-2 p-1 bg-white/5 backdrop-blur-3xl rounded-full border border-white/10">
            <button onClick={() => {setView('explore'); setGenre(null);}} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view === 'explore' ? 'bg-white text-black' : 'text-white/40'}`}>Explore</button>
            <button onClick={() => setView('favs')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view === 'favs' ? 'bg-white text-black' : 'text-white/40'}`}>Favs</button>
          </div>

          {view === 'explore' && (
            <div className="relative group">
               <button className="flex items-center gap-2 px-6 py-4 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                 <Filter size={14}/> {GENRES.find(g => g.id === genre)?.name || 'Genre'}
               </button>
               {/* Dropdown */}
               <div className="absolute top-full left-0 mt-2 w-48 bg-black/90 border border-white/10 rounded-2xl overflow-hidden hidden group-hover:block max-h-60 overflow-y-auto">
                 {GENRES.map(g => (
                   <button key={g.id} onClick={() => handleGenreChange(g.id)} className="w-full text-left px-6 py-3 text-[10px] uppercase font-bold hover:bg-white hover:text-black transition-all">
                     {g.name}
                   </button>
                 ))}
               </div>
            </div>
          )}
        </div>

        {/* Search */}
        {view === 'explore' && (
          <form onSubmit={handleSearch} className="relative w-full max-w-xs md:max-w-md pointer-events-auto">
            <input type="text" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 px-12 py-4 rounded-full outline-none focus:border-white/30 text-xs tracking-widest" />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" size={16} />}
          </form>
        )}

        {/* Profile */}
        <button onClick={() => signOut(auth)} className="pointer-events-auto text-white/20 hover:text-red-500 transition-all hidden md:block">
           <LogOut size={22}/>
        </button>
      </div>

      {/* Expand Button */}
      {view === 'explore' && !selected && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
          <button onClick={() => loadMovies()} className="flex items-center gap-3 px-8 py-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95">
            <Zap size={16} className="text-yellow-400 fill-yellow-400" />
            <span className="font-black tracking-[0.2em] text-[10px] uppercase">More</span>
          </button>
        </div>
      )}

      {/* TRAILER MODAL */}
      {trailerKey && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 md:p-20 animate-in fade-in duration-300">
           <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
              <button onClick={() => setTrailerKey(null)} className="absolute top-6 right-6 z-10 p-2 bg-black/50 rounded-full hover:bg-white hover:text-black transition-all"><X size={24}/></button>
              <iframe 
                width="100%" height="100%" 
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`} 
                title="Trailer" frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
           </div>
        </div>
      )}

      {/* DETAIL PANEL */}
      {selected && (
        <div className="absolute inset-y-0 right-0 z-50 flex items-end md:items-center p-0 md:p-8 pointer-events-none w-full md:w-auto">
          <div className="w-full md:w-[450px] p-8 md:p-12 rounded-t-[3rem] md:rounded-[3.5rem] pointer-events-auto bg-[#0a0a0a]/80 backdrop-blur-[40px] border-t md:border border-white/10 shadow-2xl animate-in slide-in-from-bottom-10 md:slide-in-from-right-10 duration-500">
            <button onClick={() => { setSelected(null); targetPos.current.active = false; }} className="absolute top-8 right-8 text-white/20 hover:text-white transition-all"><X size={32}/></button>
            <div className="flex items-center gap-2 mb-6 text-yellow-500 font-black tracking-[0.2em] text-[10px] uppercase">
              <Star size={16} fill="currentColor" /> {selected.rating.toFixed(1)} / 10
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tighter leading-none">{selected.title}</h2>
            <p className="text-white/40 mb-10 text-sm md:text-lg leading-relaxed line-clamp-4">{selected.overview}</p>
            <div className="flex gap-4">
              <button onClick={() => fetchTrailer(selected)} className="flex-1 bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all flex items-center justify-center gap-2">
                <PlayCircle size={16} /> Trailer
              </button>
              <button onClick={() => toggleFav(selected)} className={`p-5 rounded-2xl border transition-all active:scale-90 ${favs[selected.id] ? 'bg-red-600 border-red-600' : 'border-white/10 hover:bg-white/10'}`}>
                <Heart size={24} fill={favs[selected.id] ? "white" : "none"} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
