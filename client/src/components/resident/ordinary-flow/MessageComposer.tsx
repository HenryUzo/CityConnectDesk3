import { useEffect, useRef, useState } from "react";
import { ImagePlus, MapPin, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ComposerAttachment = {
  id: string;
  name: string;
  previewUrl: string;
  kind?: "image" | "audio";
  mimeType?: string;
};

interface MessageComposerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
  attachments?: ComposerAttachment[];
  onAttachFiles?: (files: File[]) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onShareLocation?: () => void;
}

export function MessageComposer({
  label,
  value,
  onChange,
  onSend,
  disabled,
  isSending,
  placeholder = "Describe the issue, preferred time, and any details that will help the provider.",
  attachments = [],
  onAttachFiles,
  onRemoveAttachment,
  onShareLocation,
}: MessageComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recorderError, setRecorderError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const attachFiles = (files: File[]) => {
    if (!files.length) return;
    onAttachFiles?.(files);
  };

  const stopAndCleanupStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopAndCleanupStream();
      setIsRecording(false);
    }
  };

  const startRecording = async () => {
    if (disabled || isRecording) return;
    setRecorderError("");

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecorderError("Voice note is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: blobType });
        if (blob.size > 0) {
          const extension = blobType.includes("mp4") ? "m4a" : "webm";
          const voiceFile = new File([blob], `voice-note-${Date.now()}.${extension}`, {
            type: blobType,
          });
          attachFiles([voiceFile]);
        }
        audioChunksRef.current = [];
        stopAndCleanupStream();
        setIsRecording(false);
      };
      recorder.onerror = () => {
        setRecorderError("Could not record voice note. Please try again.");
        stopAndCleanupStream();
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setRecorderError("Microphone access was denied.");
      stopAndCleanupStream();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      stopAndCleanupStream();
    };
  }, []);

  return (
    <div className="border-t border-[#EAECF0] bg-[#F8FAFC] px-5 py-2">
      <div className="mx-auto max-w-5xl space-y-2">
        <p className="text-xs font-medium text-[#475467]">{label}</p>

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative overflow-hidden rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] p-1.5"
              >
                {(attachment.kind === "audio" || attachment.mimeType?.startsWith("audio/")) ? (
                  <div className="w-[190px] space-y-1">
                    <audio controls src={attachment.previewUrl} className="w-full h-9" />
                    <p className="truncate text-[11px] text-[#475467]">{attachment.name}</p>
                  </div>
                ) : (
                  <img src={attachment.previewUrl} alt={attachment.name} className="h-12 w-12 object-cover" />
                )}
                <button
                  type="button"
                  className="absolute right-1 top-1 hidden rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white group-hover:block"
                  onClick={() => onRemoveAttachment?.(attachment.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-2xl border border-[#D0D5DD] bg-white p-3 transition-colors",
            dragActive && "border-dashed border-[#039855] bg-[#ECFDF3]/35",
            disabled && "opacity-70",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            if (disabled) return;
            const droppedFiles = Array.from(event.dataTransfer.files || []).filter((file) =>
              file.type.startsWith("image/") || file.type.startsWith("audio/"),
            );
            attachFiles(droppedFiles);
          }}
        >
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="min-h-[74px] max-h-[150px] w-full resize-y bg-transparent text-[14px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none"
            disabled={disabled}
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EAECF0] pt-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-[#D0D5DD] bg-white px-2.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <ImagePlus className="h-4 w-4" />
                Add image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-[#D0D5DD] bg-white px-2.5 text-xs"
                onClick={onShareLocation}
                disabled={disabled}
              >
                <MapPin className="h-4 w-4" />
                Share location
              </Button>
              <Button
                type="button"
                variant={isRecording ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1 border-[#D0D5DD] bg-white px-2.5 text-xs data-[recording=true]:bg-rose-600 data-[recording=true]:text-white"
                data-recording={isRecording}
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                    return;
                  }
                  void startRecording();
                }}
                disabled={disabled}
              >
                <Mic className={cn("h-4 w-4", isRecording ? "text-white" : "text-[#344054]")} />
                {isRecording ? "Stop recording" : "Voice note"}
              </Button>
              {dragActive ? (
                <span className="text-xs font-medium text-[#027A48]">Drop image/audio to attach</span>
              ) : null}
              {isRecording ? (
                <span className="text-xs font-medium text-rose-600">Recording...</span>
              ) : null}
              {recorderError ? (
                <span className="text-xs text-rose-600">{recorderError}</span>
              ) : null}
            </div>

            <Button
              type="button"
              onClick={onSend}
              disabled={disabled || (!value.trim() && attachments.length === 0) || isSending}
              className="h-8 rounded-full bg-[#039855] px-4 text-xs hover:bg-[#027A48]"
            >
              {isSending ? "Sending..." : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,audio/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          attachFiles(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export type { ComposerAttachment };
