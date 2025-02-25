
import { Button } from "@/components/ui/button";
import { FileText, User, Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

const Sidebar = () => {
  return (
    <div className="w-64 bg-white/5 backdrop-blur-sm border-r border-white/10 flex flex-col h-screen">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm"></div>
          </div>
          <span className="font-bold text-white">Admin Dashboard</span>
        </div>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
        >
          <FileText className="mr-2 h-5 w-5" />
          Generate Post
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
        >
          <User className="mr-2 h-5 w-5" />
          Profile
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
        >
          <Settings className="mr-2 h-5 w-5" />
          Settings
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </Button>
      </div>
      
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full overflow-hidden">
            <img src="https://i.pravatar.cc/100" alt="User" className="w-full h-full object-cover" />
          </div>
          <span className="text-white">Manu Arora</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
