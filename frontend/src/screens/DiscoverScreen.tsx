import { useEffect, useState, useRef } from "react";
import { fetchFeed, type Post } from "../lib/api";

interface Props {
  hasPostedToday: boolean;
  todaysPost: Post | null;
  onPosted: (post: Post) => void;
}

export function DiscoverScreen({ hasPostedToday, todaysPost, onPosted }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Audio playback states
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFeed({ limit: 50 })
      .then((res) => {
        if (alive) setPosts(res.posts);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!todaysPost) return;
    setPosts((prev) =>
      prev.some((p) => p.id === todaysPost.id) ? prev : [todaysPost, ...prev],
    );
  }, [todaysPost]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const getAtmosphereData = (tagline: string = "", index: number) => {
    const text = tagline.toLowerCase();
    if (text.includes("rain")) return { emoji: "🌧️", tag: "RAINY NIGHT" };
    if (text.includes("commute") || text.includes("metro") || text.includes("train")) return { emoji: "🚇", tag: "COMMUTE" };
    if (text.includes("café") || text.includes("cafe") || text.includes("coffee")) return { emoji: "☕", tag: "COFFEE SHOP" };
    if (text.includes("ocean") || text.includes("sea")) return { emoji: "🌊", tag: "OCEAN" };
    if (text.includes("city") || text.includes("lights") || text.includes("night")) return { emoji: "🌃", tag: "CITY LIGHTS" };
    if (text.includes("nature") || text.includes("forest")) return { emoji: "🌿", tag: "NATURE" };
    if (text.includes("quiet") || text.includes("room")) return { emoji: "💤", tag: "QUIET ROOM" };
    if (text.includes("music")) return { emoji: "🎧", tag: "MUSIC NEARBY" };

    const fallbackCycle = [
      { emoji: "🌧️", tag: "RAINY NIGHT" },
      { emoji: "☕", tag: "COFFEE SHOP" },
      { emoji: "🌃", tag: "CITY LIGHTS" }
    ];
    return fallbackCycle[index % fallbackCycle.length];
  };

  const handlePlaySound = (postId: string, audioUrl: string) => {
    if (playingPostId === postId) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingPostId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const sourceUrl = audioUrl || "https://actions.google.com/sounds/v1/ambiences/rain_heavy_loud.ogg";

    audioRef.current = new Audio(sourceUrl);
    audioRef.current.play()
      .then(() => {
        setPlayingPostId(postId);
      })
      .catch((err) => console.error("Audio playback failed:", err));

    audioRef.current.onended = () => {
      setPlayingPostId(null);
    };
  };

  return (
    <div className="relative flex h-full flex-col bg-black text-white font-sans antialiased">
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8 space-y-[11px]">
        {loading ? (
          <div className="grid h-48 place-items-center">
            <p className="rounded-full border border-neutral-900 bg-neutral-950/40 px-3 py-1 text-[10px] tracking-widest text-neutral-400 uppercase backdrop-blur animate-pulse">
              Tuning in…
            </p>
          </div>
        ) : (
          posts.map((post: any, index) => {
            const rawTagline = post.tagline || post.location || post.environment || "";
            const atmosphere = getAtmosphereData(rawTagline, index);
            const accountLabel = post.title || post.username || "unknown_user";
            
            const mockTimes = ["2M", "15M", "1H", "3H", "5H"];
            const timeLabel = post.duration || post.timestamp || mockTimes[index % mockTimes.length];
            
            const uniqueId = post.id || `track-${index}`;
            const isCurrentlyPlaying = playingPostId === uniqueId;

            return (
              <div
                key={uniqueId}
                className="flex bg-[#121212] rounded-[24px] min-h-[92px] p-4 relative"
              >
                {/* Left Side: Clean, Unobstructed Native Emoji */}
                <div className="flex-shrink-0 w-12 flex items-center justify-center text-[34px] select-none pl-1">
                  <span>{post.icon || atmosphere.emoji}</span>
                </div>

                {/* Content Block */}
                <div className="flex-1 pl-4 flex flex-col justify-center pr-6">
                  {/* Top Line Row */}
                  <div className="flex items-baseline justify-between w-full">
                    <h3 className="text-[15px] font-normal text-[#f3f3f3] tracking-wide truncate pr-2">
                      {accountLabel}
                    </h3>
                    
                    <div className="text-[11px] font-bold text-[#636366] tracking-wider uppercase whitespace-nowrap">
                      <span>{atmosphere.tag}</span>
                      <span className="mx-1">•</span>
                      <span>{timeLabel}</span>
                    </div>
                  </div>

                  {/* Audio Controls & Waveform Interaction Row */}
                  <div className="flex items-center space-x-3 mt-[7px]">
                    {/* Separate dedicated Play/Pause Button */}
                    <button
                      onClick={() => handlePlaySound(uniqueId, post.audioUrl)}
                      className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 hover:bg-neutral-700 active:scale-95 flex items-center justify-center text-white transition duration-150 focus:outline-none"
                      aria-label={isCurrentlyPlaying ? "Pause sound" : "Play sound"}
                    >
                      {isCurrentlyPlaying ? (
                        /* Pause Icon */
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                        </svg>
                      ) : (
                        /* Play Icon */
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-3 h-3 ml-0.5">
                          <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* Waveform Bars */}
                    <div className="flex items-center space-x-[2.5px] h-[18px]">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const waveSeed = (((index + 1) * (i + 3) * 7) % 9) + 3;
                        return (
                          <div
                            key={i}
                            style={{ 
                              height: `${waveSeed * 1.5}px`,
                              animationDelay: `${i * 0.04}s`
                            }}
                            className={`w-[2px] rounded-full transition-all duration-300 ${
                              isCurrentlyPlaying 
                                ? "bg-white opacity-100 animate-[pulse_0.6s_infinite_alternate]" 
                                : "bg-[#9a9a9f] opacity-90"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Option Menu Toggle */}
                <button className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[#545456] hover:text-white transition-colors duration-200 p-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-[18px] h-[18px]"
                  >
                    <path d="M12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}