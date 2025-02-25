
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import { motion } from "framer-motion";

interface GeneratedPostProps {
  topic: string;
  generatedPost: string;
  resetForm: () => void;
}

const GeneratedPost = ({ topic, generatedPost, resetForm }: GeneratedPostProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50 md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white text-2xl">Generated Blog Post</CardTitle>
            <CardDescription className="text-gray-400">
              Your AI-generated blog post based on the provided topic.
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-400 hover:text-white hover:bg-[#1a1f3d]"
            onClick={resetForm}
          >
            Back to Form
          </Button>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap bg-[#1a1f3d] p-4 rounded-md text-gray-200 font-mono text-sm overflow-auto max-h-[600px]">
              {generatedPost}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="bg-[#2a2f5d] hover:bg-[#3a3f7d] text-white border-none">
            <Save className="mr-2 h-4 w-4" />
            Save Post
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-[#111936] border-[#2a2f4d] shadow-lg shadow-[#0a0b17]/50">
        <CardHeader>
          <CardTitle className="text-white text-xl">Meta Description</CardTitle>
          <CardDescription className="text-gray-400">
            SEO metadata for your blog post.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Meta description functionality will be added soon.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default GeneratedPost;
