import os
import re

file_path = "src/components/SiteComponents.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add imports
import_str = """import { useInView } from "react-intersection-observer";
import MuxPlayer from "@mux/mux-player-react";
import { useSanityProjects } from "../hooks/useSanityProjects";"""
content = content.replace('import { useInView } from "react-intersection-observer";', import_str)

# 2. PortfolioGrid
content = content.replace("""export function PortfolioGrid() {
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(siteConfig.portfolio.map((item: any) => item.category)))];

  const filteredItems = useMemo(() => siteConfig.portfolio.filter(item => !(item as any).isDirectorCut), []);""", 
  """export function PortfolioGrid() {
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  
  const { projects, loading } = useSanityProjects();

  const categories = useMemo(() => ["All", ...Array.from(new Set(projects.map((item: any) => item.category)))], [projects]);

  const filteredItems = useMemo(() => projects.filter(item => !(item as any).isDirectorCut), [projects]);

  if (loading) return null;""")

# 3. PortfolioItem HlsVideo -> MuxPlayer
content = content.replace("""<HlsVideo
          src={item.video}
          autoPlay
          muted
          loop
          className="w-full h-full object-cover rounded-2xl"
        />""", """<MuxPlayer
          playbackId={item.playbackId}
          autoPlay="muted"
          muted
          loop
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '1rem', '--controls': 'none' }}
        />""")

# 4. DirectorCut
content = content.replace("""export const DirectorCut = memo(function DirectorCut() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const items = useMemo(() => siteConfig.portfolio.filter(item => (item as any).isDirectorCut), []);""",
  """export const DirectorCut = memo(function DirectorCut() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const { projects, loading } = useSanityProjects();

  const items = useMemo(() => projects.filter(item => (item as any).isDirectorCut), [projects]);
  if (loading) return null;""")

# 5. DirectorCut MuxPlayer
content = content.replace("""<HlsVideo
                src={item.video}
                autoPlay
                muted
                loop
                className="w-full h-full object-cover scale-105"
              />""", """<MuxPlayer
                playbackId={item.playbackId}
                autoPlay="muted"
                muted
                loop
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.05)', '--controls': 'none' }}
              />""")

# 6. ClipsLayout
content = content.replace("""export const ClipsLayout = memo(function ClipsLayout() {
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const clips = (siteConfig as any).clips || [];""",
  """export const ClipsLayout = memo(function ClipsLayout() {
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const { projects: clips, loading } = useSanityProjects();""")
content = content.replace("""  useEffect(() => {
    window.dispatchEvent(new CustomEvent("videoModalState", { detail: !!activeClip }));
  }, [activeClip]);""", """  useEffect(() => {
    window.dispatchEvent(new CustomEvent("videoModalState", { detail: !!activeClip }));
  }, [activeClip]);

  if (loading) return null;""")
content = content.replace("""onOpen={() => setActiveClip(clip.video)}""", """onOpen={() => setActiveClip(clip.playbackId)}""")

# 7. ClipsPreview
content = content.replace("""const ClipsPreview = memo(function ClipsPreview({ video, shouldPlay }: { video: string; shouldPlay: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);""", """const ClipsPreview = memo(function ClipsPreview({ video, shouldPlay }: { video: string; shouldPlay: boolean }) {
  const videoRef = useRef<any>(null);""")

content = content.replace("""    if (shouldPlay) {
      vid.play().catch(() => { });
    } else {
      vid.pause();
      // Reset to start for consistent preview
      if (vid.readyState > 0) vid.currentTime = 0;
    }""", """    if (shouldPlay) {
      vid.play()?.catch(() => { });
    } else {
      vid.pause();
      if (vid.currentTime > 0) vid.currentTime = 0;
    }""")

content = content.replace("""      <HlsVideo
        ref={videoRef}
        src={video}
        muted
        loop
        className="w-full h-full object-cover rounded-[2.5rem]"
      />""", """      <MuxPlayer
        ref={videoRef}
        playbackId={video}
        muted
        loop
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '2.5rem', '--controls': 'none' }}
      />""")

# 8. VerticalVideoPlayer
content = content.replace("""const VerticalVideoPlayer = memo(function VerticalVideoPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showPlayFeedback, setShowPlayFeedback] = useState<"play" | "pause" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);""", """const VerticalVideoPlayer = memo(function VerticalVideoPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showPlayFeedback, setShowPlayFeedback] = useState<"play" | "pause" | null>(null);
  const videoRef = useRef<any>(null);""")

content = content.replace("""        <HlsVideo
          ref={videoRef}
          src={src}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-contain pointer-events-none"
          onTimeUpdate={handleTimeUpdate}
          onEnded={onClose}
          onClick={togglePlay}
        />""", """        <MuxPlayer
          ref={videoRef}
          playbackId={src}
          autoPlay
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onClose}
          onClick={togglePlay}
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', '--controls': 'none' }}
        />""")


# 9. VideoModal
content = content.replace("""        <HlsVideo
          src={videoSrc}
          autoPlay
          controls
          className="w-full h-full"
        />""", """        <MuxPlayer
          playbackId={videoSrc}
          autoPlay
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />""")


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Migration script completed!")
