import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface PomodoroTimerProps {
  todoId: string;
}

type TimerState = "idle" | "work" | "rest" | "paused";

export function PomodoroTimer({ todoId }: PomodoroTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(30 * 60); // 30 minutes for work period
  const [originalSeconds, setOriginalSeconds] = useState(30 * 60); // To know which timer to restart

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (timerState === "work" || timerState === "rest") {
      interval = setInterval(() => {
        setSecondsLeft((prevSeconds) => {
          if (prevSeconds <= 1) {
            // Timer completed
            if (timerState === "work") {
              // Switch to rest period
              setTimerState("rest");
              setSecondsLeft(10 * 60); // 10 minutes in seconds
              setOriginalSeconds(10 * 60);
            } else {
              // Rest period completed
              setTimerState("idle");
            }
            return 0;
          }
          return prevSeconds - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartTimer = () => {
    setTimerState("work");
    setSecondsLeft(30 * 60); // 30 minutes for work period
    setOriginalSeconds(30 * 60);
  };

  const handlePauseResume = () => {
    if (timerState === "paused") {
      setTimerState(originalSeconds === 30 * 60 ? "work" : "rest");
    } else {
      setTimerState("paused");
    }
  };

  if (timerState === "idle") {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleStartTimer}
        className="flex items-center gap-1"
      >
        <Clock className="h-4 w-4" />
        <span>Pomodoro</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div 
        className={cn(
          "text-sm font-medium px-2 py-1 rounded",
          timerState === "work" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800",
          timerState === "paused" && "opacity-50"
        )}
      >
        {timerState === "work" ? "Focus" : "Rest"}: {formatTime(secondsLeft)}
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handlePauseResume}
        className="h-7 w-7 p-0"
      >
        {timerState === "paused" ? (
          <Play className="h-3 w-3" />
        ) : (
          <Pause className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
