import { MapPin } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="mt-auto py-4 border-t border-gray-200">
      <div className="container flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
        <div>
          © {currentYear} Todo App. All rights reserved.
        </div>
        <div className="flex items-center mt-2 sm:mt-0">
          <span className="flex items-center">
            Made on <span className="font-medium mx-1">Skye</span> 
            <MapPin className="h-4 w-4 ml-1 text-blue-500" />
          </span>
        </div>
      </div>
    </footer>
  );
}
