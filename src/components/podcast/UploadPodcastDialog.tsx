
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileAudio, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadPodcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const UploadPodcastDialog: React.FC<UploadPodcastDialogProps> = ({ 
  open, 
  onOpenChange,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an audio file",
          variant: "destructive",
        });
        return;
      }
      
      setAudioFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!audioFile) {
      toast({
        title: "Missing audio file",
        description: "Please select an audio file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Missing title",
        description: "Please enter a title for your podcast",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      
      // Generate a unique filename
      const fileExt = audioFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `podcast_audio/${fileName}`;
      
      // Upload to Storage
      const { error: uploadError } = await supabase
        .storage
        .from('podcast_audio')
        .upload(filePath, audioFile, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) throw uploadError;
      
      // Get the public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('podcast_audio')
        .getPublicUrl(filePath);
      
      // Create podcast episode entry in the database
      const { error: dbError } = await supabase
        .from('podcast_episodes')
        .insert({
          custom_title: title,
          audio_url: publicUrlData.publicUrl,
          status: 'completed',
          scheduled_for: new Date().toISOString(),
        });
      
      if (dbError) throw dbError;
      
      toast({
        title: "Upload successful",
        description: "Your podcast has been uploaded successfully",
      });
      
      // Reset form
      setTitle('');
      setAudioFile(null);
      
      // Close dialog and refresh list
      onOpenChange(false);
      onSuccess();
      
    } catch (error) {
      console.error("Error uploading podcast:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload podcast",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111936] border-[#2a2f4d] text-white">
        <DialogHeader>
          <DialogTitle>Upload Podcast</DialogTitle>
          <DialogDescription className="text-gray-400">
            Upload a podcast audio file manually to the system.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-white">Podcast Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter podcast title"
              className="bg-[#1a1f3d] border-[#2a2f4d] text-white"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="audio" className="text-white">Audio File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="audio"
                type="file"
                onChange={handleFileChange}
                accept="audio/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('audio')?.click()}
                className="w-full h-24 border-dashed border-2 border-[#2a2f4d] bg-[#1a1f3d] hover:bg-[#2a2f5d] text-white"
              >
                <div className="flex flex-col items-center justify-center w-full">
                  {audioFile ? (
                    <>
                      <FileAudio className="h-6 w-6 mb-2" />
                      <span className="text-sm truncate max-w-[200px]">{audioFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mb-2" />
                      <span>Click to select audio file</span>
                    </>
                  )}
                </div>
              </Button>
            </div>
            {audioFile && (
              <p className="text-xs text-gray-400">
                File size: {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="border-[#2a2f4d] bg-[#1a1f3d] text-white hover:bg-[#2a2f5d]"
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isUploading || !audioFile}
              className="bg-gradient-to-r from-[#3a3f7d] to-[#6366f1] hover:from-[#4a4f8d] hover:to-[#7376ff] text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Podcast"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadPodcastDialog;
