import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { useDemoVideoAvailable } from "../hooks/use-demo-video";
import { DEMO_VIDEO_SRC, DEMO_VIDEO_TITLE } from "../lib/demo-video";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

// Renders nothing until the demo file is confirmed to exist.
export default function DemoVideoButton({ className = "" }: { className?: string }) {
  const available = useDemoVideoAvailable();
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return (
    <>
      <button type="button" aria-label="Watch the demo" className={`demo-glow ${className}`.trim()} onClick={() => setOpen(true)}>
        <Clapperboard size={14} aria-hidden="true" />
        <span>Watch the demo</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="demo-video-dialog">
          <DialogTitle>{DEMO_VIDEO_TITLE}</DialogTitle>
          <DialogDescription className="sr-only">A short walkthrough of Better Call Pet.</DialogDescription>
          <div className="demo-video-frame">
            {open && <video src={DEMO_VIDEO_SRC} title={DEMO_VIDEO_TITLE} controls autoPlay playsInline />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
