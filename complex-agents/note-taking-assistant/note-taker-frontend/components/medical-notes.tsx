"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RpcInvocationData } from "livekit-client";
import { useMaybeRoomContext } from "@livekit/components-react";
import ReactMarkdown from "react-markdown";

export interface MedicalNotesProps {
  className?: string;
}

export function MedicalNotes({ className }: MedicalNotesProps) {
  const [notes, setNotes] = useState<string>("");
  const [recentTranscription, setRecentTranscription] = useState<string>("");
  const [allTranscriptions, setAllTranscriptions] = useState<string[]>([]);
  const room = useMaybeRoomContext();

  // Register RPC handlers for receiving notes and transcription updates
  useEffect(() => {
    if (!room || !room.localParticipant) return;

    // Handler for receiving full notes updates
    const handleReceiveNotes = async (rpcInvocation: RpcInvocationData): Promise<string> => {
      try {
        const payload = JSON.parse(rpcInvocation.payload);
        
        if (payload) {
          if (payload.notes) {
            setNotes(payload.notes);
          }
          if (payload.transcriptions) {
            setAllTranscriptions(payload.transcriptions);
          }
          return "Success: Notes received";
        } else {
          return "Error: Invalid notes data format";
        }
      } catch (error) {
        return "Error: " + (error instanceof Error ? error.message : String(error));
      }
    };

    // Handler for receiving individual transcription updates
    const handleReceiveTranscription = async (rpcInvocation: RpcInvocationData): Promise<string> => {
      try {
        const payload = JSON.parse(rpcInvocation.payload);
        
        if (payload && payload.transcription) {
          setRecentTranscription(payload.transcription);
          // Also add to all transcriptions
          setAllTranscriptions(prev => [...prev, payload.transcription]);
          return "Success: Transcription received";
        } else {
          return "Error: Invalid transcription data format";
        }
      } catch (error) {
        return "Error: " + (error instanceof Error ? error.message : String(error));
      }
    };

    // Register both RPC methods
    room.localParticipant.registerRpcMethod("receive_notes", handleReceiveNotes);
    room.localParticipant.registerRpcMethod("receive_transcription", handleReceiveTranscription);

    return () => {
      if (room && room.localParticipant) {
        room.localParticipant.unregisterRpcMethod("receive_notes");
        room.localParticipant.unregisterRpcMethod("receive_transcription");
      }
    };
  }, [room]);

  return (
    <div className={`flex flex-col gap-6 h-full ${className || ''}`}>
      {/* Recent Transcription Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Transcription</h3>
        <AnimatePresence mode="wait">
          <motion.div
            key={recentTranscription}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-gray-600 font-mono leading-relaxed min-h-[4rem]"
          >
            {recentTranscription || "Waiting for transcription..."}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Medical Notes Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg flex-1 overflow-hidden border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Notes</h3>
        <div className="overflow-y-auto h-full pr-2 custom-scrollbar-light">
          <AnimatePresence mode="wait">
            <motion.div
              key={notes}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-gray-700 leading-relaxed prose prose-sm max-w-none"
            >
              {notes ? (
                <ReactMarkdown
                  components={{
                    h1: ({children}) => <h1 className="text-xl font-bold text-gray-900 mb-2">{children}</h1>,
                    h2: ({children}) => <h2 className="text-lg font-semibold text-gray-900 mb-2 mt-4">{children}</h2>,
                    h3: ({children}) => <h3 className="text-base font-semibold text-gray-800 mb-1 mt-3">{children}</h3>,
                    p: ({children}) => <p className="mb-2 text-gray-700">{children}</p>,
                    ul: ({children}) => <ul className="list-disc ml-5 mb-2 text-gray-700">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal ml-5 mb-2 text-gray-700">{children}</ol>,
                    li: ({children}) => <li className="mb-1">{children}</li>,
                    strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                    em: ({children}) => <em className="italic">{children}</em>,
                  }}
                >
                  {notes}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-500 italic">No notes yet. Start speaking to generate medical notes...</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}