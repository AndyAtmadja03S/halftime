import { motion } from "framer-motion";
import { Recorder } from "../components/Recorder";
import type { Post } from "../lib/api";

interface Props {
  todaysPost: Post | null;
  onPosted: (post: Post) => void;
}

export function CaptureScreen({ todaysPost, onPosted }: Props) {
  return (
    <div className="flex h-full flex-col justify-center px-4 pb-10">
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Recorder todaysPost={todaysPost} onPosted={onPosted} />
      </motion.div>
    </div>
  );
}
