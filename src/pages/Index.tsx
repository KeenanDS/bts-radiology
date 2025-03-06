
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const IndexPage = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0b17] to-[#121639] text-white">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Content Automation Platform
        </h1>
        <p className="text-xl text-gray-300 mb-10">
          Generate, schedule, and manage AI-powered content with ease
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-[#3a3f7d] hover:bg-[#2a2f5d]"
            onClick={() => navigate("/admin/dashboard")}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IndexPage;
