import { motion } from "framer-motion";
import { Recorder } from "../components/Recorder";
import type { Post } from "../lib/api";

interface Props {
  todaysPost: Post | null;
  onPosted: (post: Post) => void;
}

export function CaptureScreen({ todaysPost, onPosted }: Props) {
  return (
    <div className="h-full overflow-hidden px-5">
      <motion.div
        className="h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Recorder todaysPost={todaysPost} onPosted={onPosted} />
      </motion.div>
    </div>
  );
}
