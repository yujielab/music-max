import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, List, Music, Heart, 
  Repeat, Shuffle, ChevronDown, X, Disc3, RefreshCw, Search, 
  MoreHorizontal, Volume2 
} from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

// --- 常量与工具函数 (保持原有逻辑) ---
const R2_BASE = 'https://pub-4b0391c7b46a443783ccc235ddeb1669.r2.dev';
const API_URL = 'https://patient-silence-131f.tokio-fb6.workers.dev';

const parseLRC = (lrc) => {
  if (!lrc) return [];
  const result = [];
  const reg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  lrc.split('\n').forEach(line => {
    const matches = [...line.matchAll(reg)];
    const text = line.replace(reg, '').trim();
    if (text && matches.length) {
      matches.forEach(m => {
        result.push({ time: parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3].padEnd(3, '0')) / 1000, text });
      });
    }
  });
  return result.sort((a, b) => a.time - b.time);
};

const formatTime = (s) => !s || isNaN(s) ? '0:00' : `:`;

// --- UI 组件 ---

// 1. 沉浸式背景
const ImmersiveBackground = ({ cover }) => (
  <motion.div 
    className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1 }}
  >
    <motion.div 
      key={cover} // 封面变化时触发切换动画
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(//images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop')` }}
    />
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[80px]" />
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
  </motion.div>
);

// 2. 歌词视图 (Apple Style: 模糊非活性行, 居中高亮)
const LyricsView = ({ lyrics, currentTime, onSeek, loading }) => {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const idx = lyrics.findIndex((l, i) => 
      l.time <= currentTime + 0.3 && (lyrics[i + 1]?.time > currentTime + 0.3 || i === lyrics.length - 1)
    );
    setActiveIndex(idx);
  }, [currentTime, lyrics]);

  useEffect(() => {
    if (activeIndex >= 0 && containerRef.current?.children[activeIndex]) {
      containerRef.current.children[activeIndex].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [activeIndex]);

  if (loading) return (
    <div className="h-full flex items-center justify-center text-white/50 space-x-2">
      <RefreshCw className="animate-spin w-5 h-5" />
      <span className="text-sm font-medium tracking-wide">Loading Lyrics...</span>
    </div>
  );

  if (!lyrics.length) return (
    <div className="h-full flex flex-col items-center justify-center text-white/30 space-y-4">
      <Music size={48} strokeWidth={1} />
      <p className="text-sm font-medium tracking-widest uppercase">No Lyrics Available</p>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-6 py-[50vh] no-scrollbar mask-image-gradient" ref={containerRef}>
      {lyrics.map((l, i) => {
        const isActive = i === activeIndex;
        return (
          <motion.p
            key={i}
            onClick={() => onSeek(l.time)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ 
              opacity: isActive ? 1 : 0.3, 
              scale: isActive ? 1.05 : 1,
              filter: isActive ? 'blur(0px)' : 'blur(1.5px)',
              y: 0
            }}
            className={`
              py-3 text-2xl md:text-3xl font-bold cursor-pointer transition-colors duration-500
               'text-white/60 hover:text-white/80'
            `}
            style={{ textShadow: isActive ? '0 0 20px rgba(255,255,255,0.3)' : 'none' }}
          >
            {l.text}
          </motion.p>
        );
      })}
    </div>
  );
};

// 3. 播放列表 (Sheet Modal 风格)
const PlaylistSheet = ({ isOpen, onClose, playlist, current, onSelect, onRefresh, loading, searchTerm, setSearchTerm }) => {
  const filtered = searchTerm 
    ? playlist.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.artist.toLowerCase().includes(searchTerm.toLowerCase()))
    : playlist;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 h-[85vh] bg-[#1c1c1e]/90 backdrop-blur-xl rounded-t-[40px] z-50 overflow-hidden flex flex-col border-t border-white/10"
          >
            {/* Handle Bar */}
            <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
              <div className="w-12 h-1.5 bg-white/20 rounded-full cursor-pointer hover:bg-white/40 transition-colors"/>
            </div>

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
              <h2 className="text-xl font-bold text-white tracking-tight">Up Next</h2>
              <div className="flex gap-3">
                <button onClick={onRefresh} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                  <RefreshCw size={18} className={`text-white/80  ''`}/>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="bg-white/10 rounded-xl flex items-center px-3 py-2.5 focus-within:bg-white/15 transition-colors">
                <Search size={16} className="text-white/40 mr-2"/>
                <input 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search Songs..." 
                  className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-white/30"
                />
                {searchTerm && <X size={16} onClick={() => setSearchTerm('')} className="text-white/40 cursor-pointer"/>}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-10">
              {filtered.map((song, i) => (
                <motion.div 
                  layoutId={`song-`}
                  key={song.id} 
                  onClick={() => onSelect(song)}
                  className={`group flex items-center p-3 rounded-2xl mb-1 cursor-pointer transition-all ${
                    current?.id === song.id ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-lg mr-4 bg-white/5">
                    {song.cover ? (
                      <img src={song.cover} className="w-full h-full object-cover"/>
                    ) : (
                      <Music className="w-full h-full p-3 text-white/20"/>
                    )}
                    {current?.id === song.id && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex gap-0.5 items-end h-4">
                           {[1,2,3].map(n => <motion.div key={n} 
                              animate={{ height: [4, 12, 4] }} 
                              transition={{ repeat: Infinity, duration: 0.6, delay: n * 0.1 }}
                              className="w-1 bg-pink-500 rounded-full"
                           />)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold truncate text-[15px]  'text-white'`}>
                      {song.title}
                    </h3>
                    <p className="text-white/40 text-xs truncate">{song.artist}</p>
                  </div>
                </motion.div>
              ))}
              {!filtered.length && !loading && (
                <div className="py-20 text-center text-white/20">No songs found</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- 主应用组件 ---
export default function AppleMusicApp() {
  // State 保持原样，仅做极小调整
  const [playlist, setPlaylist] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState([]);
  const [showLyrics, setShowLyrics] = useState(false); // 默认显示封面
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [cover, setCover] = useState('');
  const [loading, setLoading] = useState(true);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const audioRef = useRef(null);
  const infoCache = useRef({});

  // 逻辑复用 (保持原有的 fetch 逻辑)
  const fetchPlaylist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data.success && data.songs) {
        const songs = data.songs.map(s => ({
          ...s,
          audioUrl: `/`,
        }));
        setPlaylist(songs);
        if (!currentSong && songs.length) setCurrentSong(songs[0]);
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlaylist(); }, []);

  const fetchSongInfo = useCallback(async (song) => {
    if (!song) return;
    if (infoCache.current[song.id]) {
      const cached = infoCache.current[song.id];
      setCover(cached.cover || '');
      setLyrics(cached.lyrics || []);
      return;
    }
    setLyricsLoading(true);
    setLyrics([]);
    setCover('');
    let foundCover = '', foundLyrics = [];
    const searchQuery = ` `.replace(/未知艺术家|Unknown/gi, '').trim();
    const q = encodeURIComponent(searchQuery);

    try {
      // 1. iTunes CN
      const res = await fetch(`https://itunes.apple.com/search?term=&media=music&limit=5&country=cn`);
      const data = await res.json();
      const exact = data.results?.find(r => r.trackName?.toLowerCase().includes(song.title.toLowerCase()));
      const result = exact || data.results?.[0];
      if (result?.artworkUrl100) foundCover = result.artworkUrl100.replace('100x100', '1200x1200');
    } catch (e) {}

    // 2. iTunes JP Fallback
    if (!foundCover) {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=&media=music&limit=3&country=jp`);
        const data = await res.json();
        if (data.results?.[0]?.artworkUrl100) foundCover = data.results[0].artworkUrl100.replace('100x100', '1200x1200');
      } catch (e) {}
    }

    // 3. Netease Lyrics & Cover Fallback
    try {
      const searchRes = await fetch(`https://api.injahow.cn/meting/?type=search&server=netease&content=`);
      const searchData = await searchRes.json();
      if (searchData?.[0]?.lrc) {
        const lrcRes = await fetch(searchData[0].lrc);
        if (lrcRes.ok) foundLyrics = parseLRC(await lrcRes.text());
        if (!foundCover && searchData[0].pic) foundCover = searchData[0].pic;
      }
    } catch (e) {}

    infoCache.current[song.id] = { cover: foundCover, lyrics: foundLyrics };
    if (foundCover) setPlaylist(p => p.map(s => s.id === song.id ? {...s, cover: foundCover} : s));
    setCover(foundCover);
    setLyrics(foundLyrics);
    setLyricsLoading(false);
  }, []);

  useEffect(() => { if (currentSong) fetchSongInfo(currentSong); }, [currentSong?.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onDur = () => setDuration(a.duration);
    const onEnd = () => { isRepeat ? (a.currentTime = 0, a.play()) : playNext(); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onDur);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, [isRepeat, currentSong, playlist]);

  const togglePlay = () => isPlaying ? audioRef.current?.pause() : audioRef.current?.play().catch(() => {});
  const seek = (t) => { if (audioRef.current) { audioRef.current.currentTime = t; setCurrentTime(t); }};
  
  const getNextSong = () => {
    if (!playlist.length) return null;
    const idx = playlist.findIndex(s => s.id === currentSong?.id);
    if (isShuffle) return playlist[Math.floor(Math.random() * playlist.length)];
    return playlist[(idx + 1) % playlist.length];
  };

  const playNext = () => {
    const next = getNextSong();
    if (next) { setCurrentSong(next); setTimeout(() => audioRef.current?.play(), 100); }
  };
  
  const playPrev = () => {
    const idx = playlist.findIndex(s => s.id === currentSong?.id);
    const prev = playlist[idx <= 0 ? playlist.length - 1 : idx - 1];
    if (prev) { setCurrentSong(prev); setTimeout(() => audioRef.current?.play(), 100); }
  };

  const selectSong = (song) => {
    setCurrentSong(song);
    setShowPlaylist(false);
    setTimeout(() => audioRef.current?.play(), 100);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  // --- 主渲染 ---
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white select-none">
      <audio ref={audioRef} src={currentSong?.audioUrl || ''} preload="auto"/>
      
      {/* 1. 全局背景 */}
      <ImmersiveBackground cover={cover} />

      {/* 2. 顶部导航栏 */}
      <header className="absolute top-0 inset-x-0 z-20 px-6 py-6 flex items-center justify-between">
         <button onClick={() => setShowPlaylist(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors">
            <List size={20} className="text-white/90" />
         </button>
         <div className="w-12 h-1.5 bg-white/20 rounded-full opacity-0" /> {/* 占位符 */}
         <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors">
            <MoreHorizontal size={20} className="text-white/90" />
         </button>
      </header>

      {/* 3. 主要内容区 (封面 / 歌词) */}
      <main className="absolute inset-0 z-10 flex flex-col pt-24 pb-48 px-8">
        <AnimatePresence mode="wait">
           {!showLyrics ? (
             <motion.div 
                key="art"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                transition={{ duration: 0.4 }}
                className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full"
                onClick={() => setShowLyrics(true)}
             >
                {/* 专辑封面 - 仿 Apple Music 缩放动效 */}
                <motion.div 
                  className="relative aspect-square w-full rounded-[40px] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.5)] overflow-hidden cursor-pointer"
                  animate={{ 
                    scale: isPlaying ? 1 : 0.85,
                    boxShadow: isPlaying 
                      ? "0 40px 80px -12px rgba(0,0,0,0.5)" 
                      : "0 20px 40px -12px rgba(0,0,0,0.3)" 
                  }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                >
                  {cover ? (
                    <img src={cover} className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <Music size={80} className="text-white/20" />
                    </div>
                  )}
                </motion.div>
                
                {/* 歌曲信息 */}
                <div className="w-full mt-10 flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight truncate">
                      {currentSong?.title || "Not Playing"}
                    </h1>
                    <p className="text-lg text-white/60 truncate mt-1">
                      {currentSong?.artist || "Select a song"}
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setIsLiked(!isLiked); }} 
                    className="p-3 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-all">
                    <Heart size={24} className={isLiked ? "fill-pink-500 text-pink-500" : "text-white/40"} />
                  </button>
                </div>
             </motion.div>
           ) : (
             <motion.div 
                key="lyrics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4 }}
                className="flex-1 w-full h-full relative"
             >
                <LyricsView lyrics={lyrics} currentTime={currentTime} onSeek={seek} loading={lyricsLoading} />
                {/* 歌词模式下的迷你控制栏 */}
                <div className="absolute bottom-4 right-4 z-20">
                    <button onClick={() => setShowLyrics(false)} className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium hover:bg-white/20">
                      View Art
                    </button>
                </div>
             </motion.div>
           )}
        </AnimatePresence>
      </main>

      {/* 4. 底部播放控制 (始终可见) */}
      <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-10 pt-20 px-8">
        <div className="max-w-md mx-auto w-full space-y-6">
          
          {/* 进度条 */}
          <div className="group relative h-10 flex items-center cursor-pointer"
               onClick={e => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const p = (e.clientX - rect.left) / rect.width;
                 seek(p * duration);
               }}>
            {/* 轨道 */}
            <div className="absolute inset-x-0 h-1.5 bg-white/20 rounded-full overflow-hidden group-hover:h-2.5 transition-all duration-300">
               <motion.div 
                 className="h-full bg-white/90 rounded-full"
                 style={{ width: `%` }}
                 layoutId="progress"
               />
            </div>
            {/* 时间提示 */}
            <div className="absolute top-6 left-0 text-xs font-medium text-white/40">{formatTime(currentTime)}</div>
            <div className="absolute top-6 right-0 text-xs font-medium text-white/40">{formatTime(duration)}</div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <button onClick={() => setIsShuffle(!isShuffle)} className={`p-2 transition-colors  'text-white/40'`}>
              <Shuffle size={20} />
            </button>

            <div className="flex items-center gap-6">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={playPrev} 
                className="text-white hover:text-white/80"
              >
                <SkipBack size={36} fill="currentColor" className="opacity-100" />
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay} 
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                   <Pause size={32} fill="black" className="text-black" />
                ) : (
                   <Play size={32} fill="black" className="text-black ml-1" />
                )}
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={playNext} 
                className="text-white hover:text-white/80"
              >
                <SkipForward size={36} fill="currentColor" />
              </motion.button>
            </div>

            <button onClick={() => setIsRepeat(!isRepeat)} className={`p-2 transition-colors  'text-white/40'`}>
              <Repeat size={20} />
            </button>
          </div>
          
        </div>
      </div>

      {/* 播放列表抽屉 */}
      <PlaylistSheet 
        isOpen={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        playlist={playlist}
        current={currentSong}
        onSelect={selectSong}
        onRefresh={fetchPlaylist}
        loading={loading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

    </div>
  );
}
