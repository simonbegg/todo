import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon, GripVertical, Loader2, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Todo {
  id: string;
  task: string;
  is_completed: boolean;
  due_date: string | null;
  order: number;
}

const SortableTodoItem = ({ todo, onToggle, onEdit, onDelete }: { 
  todo: Todo, 
  onToggle: (id: string, is_completed: boolean) => void,
  onEdit: (todo: Todo) => void,
  onDelete: (id: string) => void
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1, // Hide the original item when dragging
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-4 bg-white p-4 rounded-lg shadow"
    >
      <div className="cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      <span 
        onClick={() => onToggle(todo.id, todo.is_completed)}
        className={cn(
          "flex-1 cursor-pointer hover:text-gray-600 transition-colors",
          todo.is_completed && "line-through text-gray-400"
        )}
      >
        {todo.task}
      </span>
      {todo.due_date && (
        <span className="text-sm text-gray-500">
          {format(new Date(todo.due_date), "PPP")}
        </span>
      )}
      <Button onClick={() => onEdit(todo)} size="icon" variant="outline">
        ✎
      </Button>
      <Button onClick={() => onDelete(todo.id)} size="icon" variant="destructive">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

const Index = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDate, setEditingDate] = useState<Date>();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
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
        .order('order', { ascending: true });

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

      // Get the minimum order value (lowest number = highest position)
      const { data: highestTodo, error: fetchError } = await supabase
        .from('todos')
        .select('order')
        .order('order', { ascending: true })
        .limit(1);

      if (fetchError) throw fetchError;

      // Set new todo's order to be one less than the current minimum (to place it at the top)
      // If no todos exist yet, start with order 0
      const newOrder = highestTodo && highestTodo.length > 0 ? highestTodo[0].order - 1 : 0;

      const { error } = await supabase
        .from('todos')
        .insert({
          task: newTask,
          due_date: dueDate ? dueDate.toISOString() : null,
          user_id: user.id,
          order: newOrder
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

  const handleEdit = async (todo: Todo) => {
    setEditingTodo(todo);
    setEditingText(todo.task);
    setEditingDate(todo.due_date ? new Date(todo.due_date) : undefined);
  };

  const handleSaveEdit = async () => {
    if (!editingTodo) return;
    
    try {
      const { error } = await supabase
        .from('todos')
        .update({ 
          task: editingText,
          due_date: editingDate?.toISOString() || null 
        })
        .eq('id', editingTodo.id);

      if (error) throw error;

      setEditingTodo(null);
      setEditingText("");
      setEditingDate(undefined);
      
      toast({
        title: "Success!",
        description: "Task updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingTodo(null);
    setEditingText("");
    setEditingDate(undefined);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    // Update the local state first for immediate UI feedback
    setTodos((prevTodos) => {
      const oldIndex = prevTodos.findIndex((todo) => todo.id === active.id);
      const newIndex = prevTodos.findIndex((todo) => todo.id === over.id);
      
      return arrayMove(prevTodos, oldIndex, newIndex);
    });

    // Then update the database
    try {
      // Get the reordered todos after the state update
      const updatedTodos = [...todos];
      const oldIndex = updatedTodos.findIndex((todo) => todo.id === active.id);
      const newIndex = updatedTodos.findIndex((todo) => todo.id === over.id);
      
      const reorderedTodos = arrayMove(updatedTodos, oldIndex, newIndex);
      
      // Assign new order values
      const updates = reorderedTodos.map((todo, index) => ({
        id: todo.id,
        order: index
      }));
      
      // Update all todos with their new order values
      const promises = updates.map(update => 
        supabase
          .from('todos')
          .update({ order: update.order })
          .eq('id', update.id)
      );
      
      const results = await Promise.all(promises);
      const errors = results.filter(result => result.error);
      
      if (errors.length > 0) {
        throw new Error(errors[0].error.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task order: " + error.message,
      });
      // Refetch to ensure UI is in sync with database
      fetchTodos();
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get the active todo item for the drag overlay
  const activeTodo = todos.find(todo => todo.id === activeDragId);

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={todos.map(todo => todo.id)}
              strategy={verticalListSortingStrategy}
            >
              {todos.map((todo) => (
                editingTodo?.id === todo.id ? (
                  <div key={todo.id} className="flex items-center space-x-4 bg-white p-4 rounded-lg shadow">
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "justify-start text-left font-normal",
                            !editingDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editingDate ? format(editingDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={editingDate}
                          onSelect={setEditingDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button onClick={handleSaveEdit} size="icon">
                      ✓
                    </Button>
                    <Button onClick={handleCancelEdit} size="icon" variant="destructive">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <SortableTodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={toggleTodo}
                    onEdit={handleEdit}
                    onDelete={deleteTodo}
                  />
                )
              ))}
            </SortableContext>
            
            {/* Drag overlay to show a consistent representation during dragging */}
            <DragOverlay adjustScale={true} dropAnimation={null}>
              {activeTodo ? (
                <div className="flex items-center space-x-4 bg-white p-4 rounded-lg shadow-lg opacity-95 scale-[1.02]">
                  <div className="cursor-grab">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                  </div>
                  <span className={cn(
                    "flex-1",
                    activeTodo.is_completed && "line-through text-gray-400"
                  )}>
                    {activeTodo.task}
                  </span>
                  {activeTodo.due_date && (
                    <span className="text-sm text-gray-500">
                      {format(new Date(activeTodo.due_date), "PPP")}
                    </span>
                  )}
                  <div className="w-10 h-10"></div>
                  <div className="w-10 h-10"></div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
};

export default Index;
