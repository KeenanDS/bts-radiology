
import { Button } from "@/components/ui/button";
import { FileText, User, Settings, LogOut, BookText, Calendar, Mic, ChevronUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const Sidebar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  
  const handleLogout = () => {
    // This will be implemented when we add authentication
    console.log("User logged out");
    // For now, just close the popover
    setOpen(false);
  };
  
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
        <Link to="/admin">
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${location.pathname === '/admin' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
          >
            <FileText className="mr-2 h-5 w-5" />
            Generate Post
          </Button>
        </Link>
        
        <Link to="/admin/posts">
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${location.pathname === '/admin/posts' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
          >
            <BookText className="mr-2 h-5 w-5" />
            Blog Posts
          </Button>
        </Link>
        
        <Link to="/admin/scheduler">
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${location.pathname === '/admin/scheduler' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
          >
            <Calendar className="mr-2 h-5 w-5" />
            Post Scheduler
          </Button>
        </Link>
        
        <Link to="/admin/podcast">
          <Button 
            variant="ghost" 
            className={`w-full justify-start ${location.pathname === '/admin/podcast' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
          >
            <Mic className="mr-2 h-5 w-5" />
            Podcast
          </Button>
        </Link>
      </div>
      
      <div className="p-4 border-t border-white/10">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full px-2 py-1 justify-between hover:bg-white/10 rounded-md">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full overflow-hidden">
                  <img src="https://i.pravatar.cc/100" alt="User" className="w-full h-full object-cover" />
                </div>
                <span className="text-white">Manu Arora</span>
              </div>
              <ChevronUp className={`h-4 w-4 text-white transition-transform ${open ? 'rotate-0' : 'rotate-180'}`} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0 bg-gray-800 border border-gray-700" align="start">
            <div className="px-2 py-1.5 text-sm font-medium text-white/80">
              <span>manu@example.com</span>
            </div>
            <Separator className="bg-gray-700" />
            <div className="p-2 space-y-1">
              <Link to="/admin/profile">
                <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Button>
              </Link>
              <Link to="/admin/settings">
                <Button variant="ghost" className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </div>
            <Separator className="bg-gray-700" />
            <div className="p-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sign out of your account</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default Sidebar;
