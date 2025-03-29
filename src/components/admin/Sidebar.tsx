
import { Button } from "@/components/ui/button";
import { FileText, User, Settings, LogOut, BookText, Calendar, Mic, ChevronUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const Sidebar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { user, userRole, signOut } = useAuth();
  
  const handleLogout = async () => {
    await signOut();
    setOpen(false);
  };

  // Function to get the role badge color
  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'global_administrator':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'owner':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  // Format role name for display
  const formatRoleName = (role: string | null) => {
    if (!role) return 'User';
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

        {userRole === 'global_administrator' && (
          <Link to="/admin/users">
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${location.pathname === '/admin/users' ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
            >
              <User className="mr-2 h-5 w-5" />
              User Management
            </Button>
          </Link>
        )}
      </div>
      
      <div className="p-4 border-t border-white/10">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full px-2 py-1 justify-between hover:bg-white/10 rounded-md">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full overflow-hidden">
                  <img src="https://i.pravatar.cc/100" alt="User" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-white text-sm">{user?.email}</span>
                  <Badge className={`text-xs ${getRoleBadgeColor()}`}>
                    {formatRoleName(userRole)}
                  </Badge>
                </div>
              </div>
              <ChevronUp className={`h-4 w-4 text-white transition-transform ${open ? 'rotate-0' : 'rotate-180'}`} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0 bg-gray-800 border border-gray-700" align="start">
            <div className="px-2 py-1.5 text-sm font-medium text-white/80">
              <span>{user?.email}</span>
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
