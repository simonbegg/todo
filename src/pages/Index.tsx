
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  task: string;
  is_completed: boolean;
  due_date: string | null;
}

const Index = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        fetchTodos();
      }
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    const channel = supabase
      .channel('todos_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'todos' },
        fetchTodos
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "You must be logged in to add todos",
        });
        return;
      }

      const { error } = await supabase
        .from('todos')
        .insert({
          task: newTask,
          due_date: dueDate ? dueDate.toISOString() : null,
          user_id: user.id
        });

      if (error) throw error;
      setNewTask("");
      setDueDate(undefined);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const toggleTodo = async (id: string, is_completed: boolean) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ is_completed: !is_completed })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Todo List</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <form onSubmit={addTodo} className="flex gap-4 mb-8">
          <div className="flex-1">
            <Input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a new task..."
              className="w-full"
            />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-[200px]",
                  !dueDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "PPP") : <span>Due date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={setDueDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button type="submit">Add</Button>
        </form>

        <div className="space-y-4">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={cn(
                "flex items-center justify-between p-4 bg-white rounded-lg shadow-sm transition-all",
                todo.is_completed && "bg-gray-50"
              )}
            >
              <div className="flex-1">
                <p
                  onClick={() => toggleTodo(todo.id, todo.is_completed)}
                  className={cn(
                    "cursor-pointer text-gray-800",
                    todo.is_completed && "line-through text-gray-400"
                  )}
                >
                  {todo.task}
                </p>
                {todo.due_date && (
                  <p className="text-sm text-gray-500 mt-1">
                    Due: {format(new Date(todo.due_date), "PPP")}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteTodo(todo.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
