import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-[#0a0b17] bg-gradient-to-br from-[#0a0b17] via-[#111936] to-[#0a0b17] p-6 text-gray-300">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#1a1f3d]">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
          </div>
        </div>

        <Separator className="bg-[#2a2f4d] opacity-50" />

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#1a1f3d]">
            <TabsTrigger 
              value="create" 
              className="data-[state=active]:bg-[#2a2f5d] data-[state=active]:text-white"
            >
              Create Post
            </TabsTrigger>
            <TabsTrigger 
              value="manage"
              className="data-[state=active]:bg-[#2a2f5d] data-[state=active]:text-white"
            >
              Manage Posts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="create" className="space-y-4 mt-6">
            <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
              <CardHeader>
                <CardTitle className="text-white text-2xl">Create New Blog Post</CardTitle>
                <CardDescription className="text-gray-400">
                  Create a new blog post for your podcast. Fill in the details below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-gray-300">Title</Label>
                  <Input 
                    id="title" 
                    placeholder="Enter blog post title" 
                    className="bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="summary" className="text-gray-300">Summary</Label>
                  <Textarea 
                    id="summary" 
                    placeholder="Enter a brief summary of the blog post"
                    className="min-h-20 bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="content" className="text-gray-300">Content</Label>
                  <Textarea 
                    id="content" 
                    placeholder="Enter the full content of your blog post"
                    className="min-h-40 bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-gray-300">Tags (comma separated)</Label>
                  <Input 
                    id="tags" 
                    placeholder="radiology, career, healthcare" 
                    className="bg-[#1a1f3d] border-[#2a2f4d] focus:border-[#3a3f6d] focus:ring-[#3a3f6d] text-white placeholder:text-gray-500"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none">
                  <Save className="mr-2 h-4 w-4" />
                  Save Post
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="manage" className="mt-6">
            <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
              <CardHeader>
                <CardTitle className="text-white text-2xl">Manage Posts</CardTitle>
                <CardDescription className="text-gray-400">
                  View and manage your existing blog posts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">No posts available yet. Create your first post.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard; 