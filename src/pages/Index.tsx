
import AudioPlayer from "@/components/AudioPlayer";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center space-y-20">
        <div className="space-y-4">
          <h1 className="text-7xl font-bold text-white tracking-tight">
            perplexity
          </h1>
          <p className="text-2xl text-gray-400">
            Discover Daily Podcast
          </p>
          <div className="text-sm uppercase tracking-widest text-gray-500 mt-8">
            Listen to the latest episode
          </div>
        </div>

        <div className="flex justify-center w-full px-4">
          <AudioPlayer />
        </div>

        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-lg font-medium text-white mb-4">ABOUT</h2>
          <p className="text-gray-400 leading-relaxed">
            For daily dives into tech, science, and culture. Our episodes, drawn from our Discover feed and brought to life with ElevenLabs' voices. Discover Daily is designed to fit seamlessly into your day—whether you're on the move or making the most of the in-between moments. Where will your curiosity take you?
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
